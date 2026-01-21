/**
 * Audio recording module using Web Audio API
 * Records audio as WAV format (PCM, 16-bit, mono, 16kHz)
 */

import { encodeWavToBase64 } from './wav-encoder';

// Audio configuration
const TARGET_SAMPLE_RATE = 16000;
const CHANNELS = 1; // mono
const BITS_PER_SAMPLE = 16;

// Validation constants
const MIN_RECORDING_MS = 250;
const MAX_RECORDING_MS = 15 * 60 * 1000; // 15 minutes

// Silence detection constants
const SILENCE_THRESHOLD = 0.01; // RMS threshold below which audio is considered silence
const DEFAULT_SILENCE_DURATION_MS = 2500; // Stop recording after 2.5s of silence

// Debug logging interval
let lastRmsLogTime = 0;
const RMS_LOG_INTERVAL_MS = 500; // Log RMS every 500ms

export class AudioRecordingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioRecordingError';
  }
}

/**
 * Dependencies for AudioRecorder (injectable for testing)
 */
export interface AudioRecorderDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext: (options?: AudioContextOptions) => AudioContext;
  getWorkletUrl: () => string;
}

const defaultDeps: AudioRecorderDeps = {
  getUserMedia: (constraints) =>
    navigator.mediaDevices.getUserMedia(constraints),
  createAudioContext: (options) => new AudioContext(options),
  getWorkletUrl: () => new URL('/audio-processor.worklet.js', window.location.origin).href,
};

export type SilenceStopCallback = () => void;
export type AudioLevelCallback = (rms: number) => void;

export interface AudioRecorderOptions {
  deviceId?: string;
  silenceDetectionEnabled?: boolean;
  silenceDurationMs?: number;
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private audioChunks: Float32Array[] = [];
  private recordingStartTime: number = 0;
  private isRecording: boolean = false;
  private originalSampleRate: number = TARGET_SAMPLE_RATE;
  private deps: AudioRecorderDeps;
  private silenceStartTime: number | null = null;
  private onSilenceStop: SilenceStopCallback | null = null;
  private onAudioLevel: AudioLevelCallback | null = null;
  private silenceStopFired: boolean = false;
  private options: AudioRecorderOptions;

  constructor(deps: AudioRecorderDeps = defaultDeps, options: AudioRecorderOptions = {}) {
    this.deps = deps;
    this.options = {
      deviceId: options.deviceId || '',
      silenceDetectionEnabled: options.silenceDetectionEnabled ?? true,
      silenceDurationMs: options.silenceDurationMs || DEFAULT_SILENCE_DURATION_MS,
    };
  }

  /**
   * Set callback to be called when recording stops due to silence
   */
  setOnSilenceStop(callback: SilenceStopCallback | null): void {
    this.onSilenceStop = callback;
  }

  /**
   * Set callback to receive real-time audio level (RMS) updates during recording.
   * Called at ~10-15fps with normalized RMS value (0 to 1).
   */
  setOnAudioLevel(callback: AudioLevelCallback | null): void {
    this.onAudioLevel = callback;
  }

  /**
   * Calculate RMS (root mean square) of audio samples
   */
  private calculateRMS(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Start recording audio from the microphone
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      throw new AudioRecordingError('Recording already in progress');
    }

    try {
      // Request microphone access
      const audioConstraints: MediaTrackConstraints = {
        channelCount: CHANNELS,
        sampleRate: TARGET_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
      };

      // Add device ID if specified
      if (this.options.deviceId) {
        audioConstraints.deviceId = { exact: this.options.deviceId };
      }

      console.log('[AudioRecorder] Requesting microphone with constraints:', JSON.stringify(audioConstraints, null, 2));

      this.mediaStream = await this.deps.getUserMedia({
        audio: audioConstraints,
      });

      // Log which device we actually got
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        const trackSettings = audioTrack.getSettings();
        console.log('[AudioRecorder] Got audio track:', {
          label: audioTrack.label,
          deviceId: trackSettings.deviceId,
          sampleRate: trackSettings.sampleRate,
          channelCount: trackSettings.channelCount,
          echoCancellation: trackSettings.echoCancellation,
          noiseSuppression: trackSettings.noiseSuppression,
        });
      }

      // Create audio context
      this.audioContext = this.deps.createAudioContext({
        sampleRate: TARGET_SAMPLE_RATE,
      });

      // Store the actual sample rate (may differ from requested)
      this.originalSampleRate = this.audioContext.sampleRate;
      console.log(`[AudioRecorder] AudioContext created: requested=${TARGET_SAMPLE_RATE}Hz, actual=${this.originalSampleRate}Hz`);

      // Create source node from media stream
      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );

      // Load and register the AudioWorklet processor
      // In Electron/Vite, the worklet file is served from the public directory
      const workletUrl = this.deps.getWorkletUrl();
      await this.audioContext.audioWorklet.addModule(workletUrl);

      // Create AudioWorkletNode to replace deprecated ScriptProcessorNode
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');

      // Reset audio chunks and silence detection
      this.audioChunks = [];
      this.silenceStartTime = null;
      this.silenceStopFired = false;

      // Handle audio data from the worklet via MessagePort
      this.workletNode.port.onmessage = (event: MessageEvent) => {
        if (!this.isRecording) return;

        const { type, data } = event.data;
        if (type !== 'audio') return;

        const inputData = data as Float32Array;
        // Clone the data since the buffer may be reused
        this.audioChunks.push(new Float32Array(inputData));

        // Calculate RMS for audio level callback and silence detection
        const rms = this.calculateRMS(inputData);
        const now = Date.now();
        const recordingDuration = now - this.recordingStartTime;

        // Call audio level callback (normalized RMS, clamped to 0-1)
        // Multiply by ~3 to make typical speech levels more visible (raw RMS is often 0.01-0.1)
        if (this.onAudioLevel) {
          const normalizedLevel = Math.min(1, rms * 3);
          this.onAudioLevel(normalizedLevel);
        }

        // Silence detection (only if enabled)
        if (this.options.silenceDetectionEnabled) {
          // Periodic RMS logging for debugging
          if (now - lastRmsLogTime >= RMS_LOG_INTERVAL_MS) {
            lastRmsLogTime = now;
            const isSilent = rms < SILENCE_THRESHOLD;
            const silenceDuration = this.silenceStartTime ? now - this.silenceStartTime : 0;
            console.log(`[AudioRecorder] RMS: ${rms.toFixed(4)} | threshold: ${SILENCE_THRESHOLD} | silent: ${isSilent} | silenceDuration: ${silenceDuration}ms | recordingDuration: ${recordingDuration}ms`);
          }

          if (rms < SILENCE_THRESHOLD) {
            // Audio is silent
            if (this.silenceStartTime === null) {
              this.silenceStartTime = now;
              console.log('[AudioRecorder] Silence started');
            } else {
              const silenceDuration = now - this.silenceStartTime;
              // Only auto-stop if we've recorded enough content (past MIN_RECORDING_MS)
              // and callback hasn't been fired yet
              const silenceThreshold = this.options.silenceDurationMs || DEFAULT_SILENCE_DURATION_MS;
              if (silenceDuration >= silenceThreshold && recordingDuration >= MIN_RECORDING_MS && !this.silenceStopFired) {
                console.log(`[AudioRecorder] Silence threshold reached (${silenceDuration}ms >= ${silenceThreshold}ms), triggering auto-stop`);
                this.silenceStopFired = true;
                if (this.onSilenceStop) {
                  this.onSilenceStop();
                }
              }
            }
          } else {
            // Audio is not silent, reset silence timer
            if (this.silenceStartTime !== null) {
              console.log('[AudioRecorder] Sound detected, resetting silence timer');
            }
            this.silenceStartTime = null;
          }
        }
      };

      // Connect nodes: source -> worklet -> destination
      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

      this.isRecording = true;
      this.recordingStartTime = Date.now();
    } catch (error) {
      this.cleanup();
      if (error instanceof Error) {
        if (
          error.name === 'NotAllowedError' ||
          error.name === 'PermissionDeniedError'
        ) {
          throw new AudioRecordingError('Microphone permission denied');
        }
        if (
          error.name === 'NotFoundError' ||
          error.name === 'DevicesNotFoundError'
        ) {
          throw new AudioRecordingError('No microphone found');
        }
        throw new AudioRecordingError(`Failed to start recording: ${error.message}`);
      }
      throw new AudioRecordingError('Failed to start recording');
    }
  }

  /**
   * Stop recording and return the audio as base64-encoded WAV
   */
  async stop(): Promise<string> {
    if (!this.isRecording) {
      throw new AudioRecordingError('No recording in progress');
    }

    const recordingDuration = Date.now() - this.recordingStartTime;
    this.isRecording = false;

    // Validate recording duration
    if (recordingDuration < MIN_RECORDING_MS) {
      this.cleanup();
      throw new AudioRecordingError(
        `Recording too short (minimum ${MIN_RECORDING_MS}ms)`
      );
    }

    if (recordingDuration > MAX_RECORDING_MS) {
      this.cleanup();
      throw new AudioRecordingError(
        `Recording too long (maximum ${MAX_RECORDING_MS / 60000} minutes)`
      );
    }

    try {
      // Merge all audio chunks into a single buffer
      const mergedAudio = this.mergeAudioChunks();

      // Resample if necessary
      const resampledAudio =
        this.originalSampleRate !== TARGET_SAMPLE_RATE
          ? this.resample(mergedAudio, this.originalSampleRate, TARGET_SAMPLE_RATE)
          : mergedAudio;

      const pcmData = this.float32ToInt16(resampledAudio);
      const base64 = encodeWavToBase64(pcmData, {
        sampleRate: TARGET_SAMPLE_RATE,
        numChannels: CHANNELS,
        bitsPerSample: BITS_PER_SAMPLE,
      });
      console.log('[TEST] AudioRecorder WAV base64 length:', base64.length);

      return base64;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Cancel recording without returning audio
   */
  cancel(): void {
    this.isRecording = false;
    this.cleanup();
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current recording duration in milliseconds
   */
  getRecordingDuration(): number {
    if (!this.isRecording) {
      return 0;
    }
    return Date.now() - this.recordingStartTime;
  }

  /**
   * Merge all audio chunks into a single Float32Array
   */
  private mergeAudioChunks(): Float32Array {
    const totalLength = this.audioChunks.reduce(
      (acc, chunk) => acc + chunk.length,
      0
    );
    const merged = new Float32Array(totalLength);
    let offset = 0;

    for (const chunk of this.audioChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }

  /**
   * Resample audio from one sample rate to another using linear interpolation
   */
  private resample(
    audioData: Float32Array,
    fromSampleRate: number,
    toSampleRate: number
  ): Float32Array {
    if (fromSampleRate === toSampleRate) {
      return audioData;
    }

    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
      const fraction = srcIndex - srcIndexFloor;

      // Linear interpolation
      result[i] =
        audioData[srcIndexFloor] * (1 - fraction) +
        audioData[srcIndexCeil] * fraction;
    }

    return result;
  }

  /**
   * Convert Float32 samples to 16-bit PCM.
   */
  private float32ToInt16(audioData: Float32Array): Int16Array {
    const pcmData = new Int16Array(audioData.length);

    for (let i = 0; i < audioData.length; i++) {
      // Clamp and convert float [-1, 1] to 16-bit integer [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      pcmData[i] = Math.trunc(intSample);
    }

    return pcmData;
  }

  /**
   * Clean up all resources
   */
  private cleanup(): void {
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.audioChunks = [];
    this.silenceStartTime = null;
    this.silenceStopFired = false;
  }
}

// Export utility functions for testing
export { TARGET_SAMPLE_RATE, CHANNELS, BITS_PER_SAMPLE, MIN_RECORDING_MS, MAX_RECORDING_MS, SILENCE_THRESHOLD, DEFAULT_SILENCE_DURATION_MS };
