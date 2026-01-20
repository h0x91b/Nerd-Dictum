import { describe, it, expect, mock } from 'bun:test';
import {
  AudioRecorder,
  AudioRecordingError,
  AudioRecorderDeps,
  TARGET_SAMPLE_RATE,
  CHANNELS,
  BITS_PER_SAMPLE,
  MIN_RECORDING_MS,
  MAX_RECORDING_MS,
} from './audio';

// Mock audio data generators
const createMockMediaStream = (): MediaStream => ({
  getTracks: () => [{ stop: mock(() => {}) } as unknown as MediaStreamTrack],
}) as unknown as MediaStream;

interface MockAudioContext {
  sampleRate: number;
  createMediaStreamSource: ReturnType<typeof mock>;
  createScriptProcessor: ReturnType<typeof mock>;
  destination: AudioDestinationNode;
  close: ReturnType<typeof mock>;
  _mockProcessor: {
    connect: ReturnType<typeof mock>;
    disconnect: ReturnType<typeof mock>;
    onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
  };
  _mockSource: {
    connect: ReturnType<typeof mock>;
    disconnect: ReturnType<typeof mock>;
  };
}

const createMockAudioContext = (sampleRate = TARGET_SAMPLE_RATE): MockAudioContext => {
  const mockProcessor = {
    connect: mock(() => {}),
    disconnect: mock(() => {}),
    onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null,
  };

  const mockSource = {
    connect: mock(() => {}),
    disconnect: mock(() => {}),
  };

  return {
    sampleRate,
    createMediaStreamSource: mock(() => mockSource),
    createScriptProcessor: mock(() => mockProcessor),
    destination: {} as AudioDestinationNode,
    close: mock(() => Promise.resolve()),
    _mockProcessor: mockProcessor,
    _mockSource: mockSource,
  };
};

const createMockDeps = (
  getUserMediaResult?: MediaStream | Error,
  audioContext?: MockAudioContext
): { deps: AudioRecorderDeps; mockContext: MockAudioContext } => {
  const mockContext = audioContext || createMockAudioContext();

  const getUserMedia =
    getUserMediaResult instanceof Error
      ? mock(() => Promise.reject(getUserMediaResult))
      : mock(() => Promise.resolve(getUserMediaResult || createMockMediaStream()));

  const createAudioContext = mock(() => mockContext as unknown as AudioContext);

  return {
    deps: { getUserMedia, createAudioContext },
    mockContext,
  };
};

describe('AudioRecorder', () => {
  describe('start()', () => {
    it('should request microphone permission with correct constraints', async () => {
      const { deps, mockContext } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      expect(deps.getUserMedia).toHaveBeenCalledTimes(1);
      const constraints = (deps.getUserMedia as ReturnType<typeof mock>).mock
        .calls[0][0] as MediaStreamConstraints;
      expect(constraints.audio).toBeTruthy();
      expect((constraints.audio as MediaTrackConstraints).channelCount).toBe(CHANNELS);
    });

    it('should throw error if already recording', async () => {
      const { deps } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      await expect(recorder.start()).rejects.toThrow('Recording already in progress');
    });

    it('should throw AudioRecordingError on permission denied', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.name = 'NotAllowedError';

      const { deps } = createMockDeps(permissionError);
      const recorder = new AudioRecorder(deps);

      await expect(recorder.start()).rejects.toThrow('Microphone permission denied');
      await expect(recorder.start()).rejects.toBeInstanceOf(AudioRecordingError);
    });

    it('should throw AudioRecordingError when no microphone found', async () => {
      const notFoundError = new Error('No microphone');
      notFoundError.name = 'NotFoundError';

      const { deps } = createMockDeps(notFoundError);
      const recorder = new AudioRecorder(deps);

      await expect(recorder.start()).rejects.toThrow('No microphone found');
      await expect(recorder.start()).rejects.toBeInstanceOf(AudioRecordingError);
    });

    it('should set isRecording to true after starting', async () => {
      const { deps } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      expect(recorder.getIsRecording()).toBe(false);
      await recorder.start();
      expect(recorder.getIsRecording()).toBe(true);
    });

    it('should connect audio nodes correctly', async () => {
      const { deps, mockContext } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      expect(mockContext.createMediaStreamSource).toHaveBeenCalledTimes(1);
      expect(mockContext.createScriptProcessor).toHaveBeenCalledTimes(1);
      expect(mockContext._mockSource.connect).toHaveBeenCalledTimes(1);
      expect(mockContext._mockProcessor.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    it('should throw error if not recording', async () => {
      const { deps } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await expect(recorder.stop()).rejects.toThrow('No recording in progress');
      await expect(recorder.stop()).rejects.toBeInstanceOf(AudioRecordingError);
    });

    it('should throw error if recording is too short', async () => {
      const { deps } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      // Stop immediately (less than MIN_RECORDING_MS)
      await expect(recorder.stop()).rejects.toThrow(
        `Recording too short (minimum ${MIN_RECORDING_MS}ms)`
      );
    });

    it('should return base64-encoded WAV data on successful recording', async () => {
      const { deps, mockContext } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      // Simulate audio data being captured
      const mockAudioBuffer = {
        getChannelData: () => new Float32Array([0.5, -0.5, 0.25, -0.25]),
      };
      const mockEvent = {
        inputBuffer: mockAudioBuffer,
      } as unknown as AudioProcessingEvent;

      // Trigger audio capture
      mockContext._mockProcessor.onaudioprocess?.(mockEvent);

      // Wait for minimum recording time
      await new Promise((resolve) => setTimeout(resolve, MIN_RECORDING_MS + 50));

      const result = await recorder.stop();

      // Verify result is base64 string
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Decode base64 and verify WAV header
      const binaryString = atob(result);
      expect(binaryString.substring(0, 4)).toBe('RIFF');
      expect(binaryString.substring(8, 12)).toBe('WAVE');
    });

    it('should set isRecording to false after stopping', async () => {
      const { deps, mockContext } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();
      expect(recorder.getIsRecording()).toBe(true);

      // Simulate some audio data
      const mockEvent = {
        inputBuffer: { getChannelData: () => new Float32Array(100) },
      } as unknown as AudioProcessingEvent;
      mockContext._mockProcessor.onaudioprocess?.(mockEvent);

      // Wait for minimum recording time
      await new Promise((resolve) => setTimeout(resolve, MIN_RECORDING_MS + 50));

      await recorder.stop();
      expect(recorder.getIsRecording()).toBe(false);
    });

    it('should cleanup resources after stopping', async () => {
      const { deps, mockContext } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      // Simulate some audio data
      const mockEvent = {
        inputBuffer: { getChannelData: () => new Float32Array(100) },
      } as unknown as AudioProcessingEvent;
      mockContext._mockProcessor.onaudioprocess?.(mockEvent);

      await new Promise((resolve) => setTimeout(resolve, MIN_RECORDING_MS + 50));

      await recorder.stop();

      expect(mockContext._mockProcessor.disconnect).toHaveBeenCalled();
      expect(mockContext._mockSource.disconnect).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
    });
  });

  describe('cancel()', () => {
    it('should stop recording without returning data', async () => {
      const { deps } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();
      expect(recorder.getIsRecording()).toBe(true);

      recorder.cancel();
      expect(recorder.getIsRecording()).toBe(false);
    });

    it('should not throw if not recording', () => {
      const { deps } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      expect(() => recorder.cancel()).not.toThrow();
    });

    it('should cleanup resources', async () => {
      const { deps, mockContext } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();
      recorder.cancel();

      expect(mockContext._mockProcessor.disconnect).toHaveBeenCalled();
      expect(mockContext._mockSource.disconnect).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
    });
  });

  describe('getRecordingDuration()', () => {
    it('should return 0 when not recording', () => {
      const { deps } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      expect(recorder.getRecordingDuration()).toBe(0);
    });

    it('should return elapsed time while recording', async () => {
      const { deps } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const duration = recorder.getRecordingDuration();
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('WAV encoding', () => {
    it('should produce valid WAV format with correct headers', async () => {
      const { deps, mockContext } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      // Simulate audio data
      const mockAudioBuffer = {
        getChannelData: () => new Float32Array(1000).fill(0.5),
      };
      const mockEvent = {
        inputBuffer: mockAudioBuffer,
      } as unknown as AudioProcessingEvent;

      mockContext._mockProcessor.onaudioprocess?.(mockEvent);

      await new Promise((resolve) => setTimeout(resolve, MIN_RECORDING_MS + 50));

      const result = await recorder.stop();
      const binary = atob(result);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const view = new DataView(bytes.buffer);

      // Verify WAV header structure
      expect(binary.substring(0, 4)).toBe('RIFF');
      expect(binary.substring(8, 12)).toBe('WAVE');
      expect(binary.substring(12, 16)).toBe('fmt ');

      // Verify audio format (PCM = 1)
      expect(view.getUint16(20, true)).toBe(1);

      // Verify number of channels
      expect(view.getUint16(22, true)).toBe(CHANNELS);

      // Verify sample rate
      expect(view.getUint32(24, true)).toBe(TARGET_SAMPLE_RATE);

      // Verify bits per sample
      expect(view.getUint16(34, true)).toBe(BITS_PER_SAMPLE);

      // Verify data chunk
      expect(binary.substring(36, 40)).toBe('data');
    });

    it('should encode audio samples as 16-bit PCM', async () => {
      const { deps, mockContext } = createMockDeps();
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      // Create known audio samples
      const audioSamples = new Float32Array([0.5, -0.5, 0, 1.0, -1.0]);
      const mockEvent = {
        inputBuffer: { getChannelData: () => audioSamples },
      } as unknown as AudioProcessingEvent;

      mockContext._mockProcessor.onaudioprocess?.(mockEvent);

      await new Promise((resolve) => setTimeout(resolve, MIN_RECORDING_MS + 50));

      const result = await recorder.stop();
      const binary = atob(result);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const view = new DataView(bytes.buffer);

      // Audio data starts at byte 44
      const sample1 = view.getInt16(44, true);
      const sample2 = view.getInt16(46, true);
      const sample3 = view.getInt16(48, true);

      // 0.5 * 32767 ≈ 16383
      expect(sample1).toBeCloseTo(16383, -1);
      // -0.5 * 32768 = -16384
      expect(sample2).toBeCloseTo(-16384, -1);
      // 0 -> 0
      expect(sample3).toBe(0);
    });
  });

  describe('resampling', () => {
    it('should resample audio when sample rate differs', async () => {
      // Create context with different sample rate
      const mockContext = createMockAudioContext(48000);
      const { deps } = createMockDeps(undefined, mockContext);
      const recorder = new AudioRecorder(deps);

      await recorder.start();

      // Create audio samples at 48kHz rate
      const numSamples = 4800; // 100ms at 48kHz
      const audioSamples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        audioSamples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
      }

      const mockEvent = {
        inputBuffer: { getChannelData: () => audioSamples },
      } as unknown as AudioProcessingEvent;

      mockContext._mockProcessor.onaudioprocess?.(mockEvent);

      await new Promise((resolve) => setTimeout(resolve, MIN_RECORDING_MS + 50));

      const result = await recorder.stop();
      const binary = atob(result);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const view = new DataView(bytes.buffer);

      // Get data size from WAV header
      const dataSize = view.getUint32(40, true);

      // Expected samples at 16kHz: 4800 * (16000/48000) = 1600 samples
      // Each sample is 2 bytes (16-bit)
      const expectedDataSize = 1600 * 2;
      expect(dataSize).toBe(expectedDataSize);
    });
  });

  describe('constants', () => {
    it('should export correct audio configuration', () => {
      expect(TARGET_SAMPLE_RATE).toBe(16000);
      expect(CHANNELS).toBe(1);
      expect(BITS_PER_SAMPLE).toBe(16);
    });

    it('should export correct validation constants', () => {
      expect(MIN_RECORDING_MS).toBe(250);
      expect(MAX_RECORDING_MS).toBe(15 * 60 * 1000);
    });
  });
});
