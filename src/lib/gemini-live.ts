/**
 * Google Gemini Live API client for real-time speech-to-text transcription.
 *
 * Streams audio chunks over a WebSocket session and uses inputAudioTranscription
 * (server-side ASR) for fast transcription. Falls back gracefully — callers can
 * detect failure and use the batch API instead.
 */

import { GoogleGenAI, Modality } from '@google/genai';
import type { Session, LiveServerMessage } from '@google/genai';

const LIVE_MODEL = 'models/gemini-3.1-flash-live-preview';
const TURN_COMPLETE_TIMEOUT_MS = 10_000;

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
  private textParts: string[] = [];
  private resolveWait: (() => void) | null = null;
  private rejectWait: ((err: Error) => void) | null = null;
  private connected = false;
  private finished = false;
  private error: Error | null = null;
  private callbacks: LiveTranscriberCallbacks;
  private model: string;
  private chunksSent = 0;
  private systemPrompt: string;

  constructor(
    apiKey: string,
    callbacks: LiveTranscriberCallbacks = {},
    model?: string,
    systemPrompt?: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.callbacks = callbacks;
    this.model = model || LIVE_MODEL;
    this.systemPrompt = systemPrompt || 'Do not respond. Stay silent.';
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
                voiceName: 'Schedar',
              },
            },
          },
          inputAudioTranscription: {},
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
            // Resolve with whatever we have
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

    console.log(`[GeminiLive] ${ts()} finish() — chunks: ${this.chunksSent}, text parts: ${this.textParts.length}`);

    // If we already have input transcription, return it immediately — don't wait for model response
    if (this.textParts.length > 0) {
      console.log(`[GeminiLive] ${ts()} Already have transcript, returning immediately`);
      this.close();
      return this.getTranscript();
    }

    // Signal end of audio
    try {
      this.session.sendRealtimeInput({ audioStreamEnd: true });
      console.log(`[GeminiLive] ${ts()} Sent audioStreamEnd`);
    } catch (err) {
      console.error(`[GeminiLive] ${ts()} Error sending audioStreamEnd:`, err);
    }

    // Wait for inputTranscription or turnComplete (whichever comes first)
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

    console.log(`[GeminiLive] ${ts()} Done — transcript length: ${this.getTranscript().length}`);

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
  }

  isConnected(): boolean {
    return this.connected && !this.finished;
  }

  hasError(): boolean {
    return this.error !== null;
  }

  private handleMessage(message: LiveServerMessage): void {
    // Extract input transcription — this is our primary result
    const sc = message.serverContent as Record<string, unknown> | undefined;
    if (sc) {
      const inputTx = sc.inputTranscription as { text?: string } | undefined;
      if (inputTx?.text) {
        console.log(`[GeminiLive] ${ts()} INPUT TRANSCRIPT: "${inputTx.text}"`);
        this.textParts.push(inputTx.text);
        this.callbacks.onPartialText?.(inputTx.text);
        // Got our transcript — resolve immediately, don't wait for model to finish talking
        this.resolveWait?.();
      }
    }

    // Turn complete
    if (message.serverContent?.turnComplete) {
      console.log(`[GeminiLive] ${ts()} Turn complete`);
      this.resolveWait?.();
    }

    if (message.setupComplete) {
      console.log(`[GeminiLive] ${ts()} Setup complete`);
    }
  }

  private getTranscript(): string {
    return this.textParts.join('').trim();
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
