/**
 * Google Gemini Live API client for real-time speech-to-text transcription.
 *
 * Streams audio chunks over a WebSocket session. The model "repeats" the user's
 * words guided by our system prompt (with domain hints, keywords, etc.), and
 * outputAudioTranscription gives us the LLM-enhanced transcript.
 */

import { GoogleGenAI, Modality } from '@google/genai';
import type { Session, LiveServerMessage } from '@google/genai';

const LIVE_MODEL = 'models/gemini-3.1-flash-live-preview';
const TURN_COMPLETE_TIMEOUT_MS = 15_000;

const t0 = Date.now();
function ts(): string {
  return `+${((Date.now() - t0) / 1000).toFixed(2)}s`;
}

export interface LiveTranscriberCallbacks {
  onConnected?: () => void;
  onPartialText?: (text: string) => void;
  onError?: (error: Error) => void;
}

export class LiveTranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveTranscriptionError';
  }
}

export class LiveTranscriber {
  private ai: GoogleGenAI;
  private session: Session | null = null;
  private outputTextParts: string[] = [];
  private resolveWait: (() => void) | null = null;
  private rejectWait: ((err: Error) => void) | null = null;
  private connected = false;
  private finished = false;
  private error: Error | null = null;
  private callbacks: LiveTranscriberCallbacks;
  private model: string;
  private chunksSent = 0;
  private systemPrompt: string;
  private playAudio: boolean;
  private playbackVolume: number; // 0-1, proportion of system volume
  private voiceName: string;
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private nextPlayTime = 0;

  constructor(
    apiKey: string,
    callbacks: LiveTranscriberCallbacks = {},
    model?: string,
    systemPrompt?: string,
    playAudio = false,
    voiceName = 'Schedar',
    playbackVolume = 1.0,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.callbacks = callbacks;
    this.model = model || LIVE_MODEL;
    this.playAudio = playAudio;
    this.voiceName = voiceName;
    this.playbackVolume = Math.max(0, Math.min(1, playbackVolume));
    // Wrap the transcription prompt: tell the model to REPEAT the user's words
    const basePrompt = systemPrompt || 'Transcribe the provided audio to text faithfully.';
    this.systemPrompt = `${basePrompt}

CRITICAL: You are a transcription engine. Your ONLY job is to repeat EXACTLY what the user says, word for word. Do not add commentary, questions, greetings, or responses. Simply echo back their exact words as faithfully as possible. Output nothing else.`;
  }

  async connect(): Promise<void> {
    try {
      this.session = await this.ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: {
            parts: [{ text: this.systemPrompt }],
          },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.voiceName,
              },
            },
          },
          // outputAudioTranscription gives us the TEXT of what the model says back
          // Combined with our system prompt, this = LLM-enhanced transcription
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log(`[GeminiLive] ${ts()} Session opened`);
            this.connected = true;
            this.callbacks.onConnected?.();
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            console.error(`[GeminiLive] ${ts()} Session error:`, e.message);
            this.error = new LiveTranscriptionError(e.message || 'Live session error');
            this.callbacks.onError?.(this.error);
            this.rejectWait?.(this.error);
          },
          onclose: (e: CloseEvent) => {
            console.log(`[GeminiLive] ${ts()} Session closed:`, e.reason);
            this.connected = false;
            this.resolveWait?.();
          },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new LiveTranscriptionError(`Failed to connect live session: ${message}`);
    }
  }

  sendAudioChunk(pcmBase64: string, sampleRate: number): void {
    if (!this.session || !this.connected || this.finished) return;

    try {
      this.session.sendRealtimeInput({
        audio: {
          data: pcmBase64,
          mimeType: `audio/pcm;rate=${sampleRate}`,
        },
      });
      this.chunksSent++;
      if (this.chunksSent === 1 || this.chunksSent % 100 === 0) {
        console.log(`[GeminiLive] ${ts()} Sent chunk #${this.chunksSent}`);
      }
    } catch (err) {
      console.error(`[GeminiLive] ${ts()} Error sending audio chunk:`, err);
    }
  }

  async finish(): Promise<string> {
    if (this.finished) {
      return this.getTranscript();
    }
    this.finished = true;

    if (!this.session || !this.connected) {
      console.warn(`[GeminiLive] ${ts()} finish() — not connected, chunks sent: ${this.chunksSent}`);
      throw this.error || new LiveTranscriptionError('Session not connected');
    }

    console.log(`[GeminiLive] ${ts()} finish() — chunks: ${this.chunksSent}, output parts: ${this.outputTextParts.length}`);

    // Signal end of audio
    try {
      this.session.sendRealtimeInput({ audioStreamEnd: true });
      console.log(`[GeminiLive] ${ts()} Sent audioStreamEnd`);
    } catch (err) {
      console.error(`[GeminiLive] ${ts()} Error sending audioStreamEnd:`, err);
    }

    // Wait for turnComplete — outputTranscription arrives in streaming pieces
    // so we must wait for the model to finish its full response
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          this.resolveWait = resolve;
          this.rejectWait = reject;
        }),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new LiveTranscriptionError('Turn completion timeout')),
            TURN_COMPLETE_TIMEOUT_MS,
          ),
        ),
      ]);
    } finally {
      this.resolveWait = null;
      this.rejectWait = null;
      this.close();
    }

    console.log(`[GeminiLive] ${ts()} Done — transcript: "${this.getTranscript().substring(0, 80)}..."`);

    const transcript = this.getTranscript();
    if (!transcript) {
      throw new LiveTranscriptionError('Empty transcript from live session');
    }
    return transcript;
  }

  close(): void {
    this.finished = true;
    this.connected = false;
    if (this.session) {
      try {
        this.session.close();
      } catch {
        // ignore close errors
      }
      this.session = null;
    }
    // Don't close audioCtx immediately — let queued audio finish playing
    if (this.audioCtx) {
      const ctx = this.audioCtx;
      const closeDelay = Math.max(0, (this.nextPlayTime - ctx.currentTime) * 1000) + 500;
      setTimeout(() => ctx.close().catch(() => {}), closeDelay);
      this.audioCtx = null;
    }
  }

  isConnected(): boolean {
    return this.connected && !this.finished;
  }

  hasError(): boolean {
    return this.error !== null;
  }

  private handleMessage(message: LiveServerMessage): void {
    const sc = message.serverContent as Record<string, unknown> | undefined;
    if (sc) {
      // outputTranscription = text of what the model says (our LLM-enhanced transcript)
      const outputTx = sc.outputTranscription as { text?: string } | undefined;
      if (outputTx?.text) {
        this.outputTextParts.push(outputTx.text);
        this.callbacks.onPartialText?.(outputTx.text);
        if (this.outputTextParts.length <= 3 || this.outputTextParts.length % 10 === 0) {
          console.log(`[GeminiLive] ${ts()} Output chunk #${this.outputTextParts.length}: "${outputTx.text}"`);
        }
      }
    }

    // Play audio chunks from model response
    if (this.playAudio && message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          this.playPcmChunk(part.inlineData.data, part.inlineData.mimeType);
        }
      }
    }

    // Turn complete — model finished speaking, we have the full transcript
    if (message.serverContent?.turnComplete) {
      console.log(`[GeminiLive] ${ts()} Turn complete — ${this.outputTextParts.length} parts, transcript: "${this.getTranscript().substring(0, 80)}"`);
      this.resolveWait?.();
    }

    if (message.setupComplete) {
      console.log(`[GeminiLive] ${ts()} Setup complete`);
    }
  }

  /**
   * Play a base64-encoded PCM audio chunk through Web Audio API.
   * Live API output is 24kHz 16-bit mono little-endian PCM.
   */
  private playPcmChunk(base64Data: string, mimeType: string): void {
    try {
      // Parse sample rate from mimeType (e.g., "audio/L16;rate=24000")
      const rateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContext({ sampleRate });
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = this.playbackVolume;
        this.gainNode.connect(this.audioCtx.destination);
        this.nextPlayTime = this.audioCtx.currentTime;
      }

      // Decode base64 to Int16 PCM
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);

      // Convert Int16 to Float32 for Web Audio
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      // Create and schedule audio buffer
      const buffer = this.audioCtx.createBuffer(1, float32.length, sampleRate);
      buffer.getChannelData(0).set(float32);

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode || this.audioCtx.destination);

      // Schedule seamlessly after previous chunk
      const startTime = Math.max(this.nextPlayTime, this.audioCtx.currentTime);
      source.start(startTime);
      this.nextPlayTime = startTime + buffer.duration;
    } catch (err) {
      console.error(`[GeminiLive] ${ts()} Error playing audio chunk:`, err);
    }
  }

  private getTranscript(): string {
    return this.outputTextParts.join('').trim();
  }
}

/**
 * Convert a Float32Array audio chunk to base64-encoded 16-bit PCM.
 */
export function float32ChunkToBase64PCM(chunk: Float32Array): string {
  const pcm = new Int16Array(chunk.length);
  for (let i = 0; i < chunk.length; i++) {
    const sample = Math.max(-1, Math.min(1, chunk[i]));
    pcm[i] = Math.trunc(sample < 0 ? sample * 32768 : sample * 32767);
  }

  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
