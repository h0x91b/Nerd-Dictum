/**
 * Google Gemini Live API client for real-time speech-to-text transcription.
 *
 * Streams audio chunks over a WebSocket session and accumulates text responses.
 * Falls back gracefully — callers can detect failure and use the batch API instead.
 */

import { GoogleGenAI, Modality } from '@google/genai';
import type { Session, LiveServerMessage } from '@google/genai';
import type { TranscribeOptions } from './gemini';

// Re-use prompt builder from the batch module
import { buildPrompt } from './gemini';

const LIVE_MODEL = 'models/gemini-3.1-flash-live-preview';
const TURN_COMPLETE_TIMEOUT_MS = 10_000; // Max wait for model to finish after audio stops

export interface LiveTranscriberCallbacks {
  /** Called when the session is successfully connected */
  onConnected?: () => void;
  /** Called when partial text arrives (for future real-time preview) */
  onPartialText?: (text: string) => void;
  /** Called on unrecoverable session error */
  onError?: (error: Error) => void;
}

export class LiveTranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveTranscriptionError';
  }
}

/**
 * Manages a single live transcription session.
 *
 * Lifecycle:
 *   const live = new LiveTranscriber(apiKey, options);
 *   await live.connect();           // opens WebSocket
 *   live.sendAudioChunk(pcmBase64); // called many times during recording
 *   const text = await live.finish(); // waits for model turn, returns transcript
 *   // session is closed automatically after finish()
 */
export class LiveTranscriber {
  private ai: GoogleGenAI;
  private session: Session | null = null;
  private textParts: string[] = [];
  private turnCompleteResolve: (() => void) | null = null;
  private turnCompleteReject: ((err: Error) => void) | null = null;
  private connected = false;
  private finished = false;
  private error: Error | null = null;
  private callbacks: LiveTranscriberCallbacks;
  private options?: TranscribeOptions;
  private model: string;
  private chunksSent = 0;
  private messagesReceived = 0;

  constructor(
    apiKey: string,
    options?: TranscribeOptions,
    callbacks: LiveTranscriberCallbacks = {},
    model?: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.options = options;
    this.callbacks = callbacks;
    this.model = model || LIVE_MODEL;
  }

  /**
   * Open a WebSocket session to the Gemini Live API.
   * Throws LiveTranscriptionError if the connection fails.
   */
  async connect(): Promise<void> {
    const prompt = buildPrompt(this.options);

    try {
      this.session = await this.ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction: {
            parts: [{ text: prompt }],
          },
        },
        callbacks: {
          onopen: () => {
            console.log('[GeminiLive] Session opened');
            this.connected = true;
            this.callbacks.onConnected?.();
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            console.error('[GeminiLive] Session error:', e.message);
            this.error = new LiveTranscriptionError(e.message || 'Live session error');
            this.callbacks.onError?.(this.error);
            // If we're waiting for turn complete, reject
            this.turnCompleteReject?.(this.error);
          },
          onclose: (e: CloseEvent) => {
            console.log('[GeminiLive] Session closed:', e.reason);
            this.connected = false;
            // If we're waiting for turn complete and haven't received it, resolve with what we have
            if (this.turnCompleteResolve) {
              this.turnCompleteResolve();
            }
          },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new LiveTranscriptionError(`Failed to connect live session: ${message}`);
    }
  }

  /**
   * Send an audio chunk to the live session.
   * @param pcmBase64 Base64-encoded raw PCM audio (16-bit, mono)
   * @param sampleRate Sample rate of the audio (e.g., 16000)
   */
  sendAudioChunk(pcmBase64: string, sampleRate: number): void {
    if (!this.session || !this.connected || this.finished) return;

    try {
      this.session.sendRealtimeInput({
        media: {
          data: pcmBase64,
          mimeType: `audio/pcm;rate=${sampleRate}`,
        },
      });
      this.chunksSent++;
      if (this.chunksSent % 50 === 1) {
        console.log(`[GeminiLive] Sent chunk #${this.chunksSent}, rate=${sampleRate}, size=${pcmBase64.length}`);
      }
    } catch (err) {
      console.error('[GeminiLive] Error sending audio chunk:', err);
    }
  }

  /**
   * Signal that audio input is complete and wait for the model to finish its turn.
   * Returns the accumulated transcript text.
   */
  async finish(): Promise<string> {
    if (this.finished) {
      return this.getTranscript();
    }
    this.finished = true;

    if (!this.session || !this.connected) {
      console.warn('[GeminiLive] finish() called but session not connected, chunks sent:', this.chunksSent);
      throw this.error || new LiveTranscriptionError('Session not connected');
    }

    console.log(`[GeminiLive] finish() — chunks sent: ${this.chunksSent}, messages received: ${this.messagesReceived}, text parts so far: ${this.textParts.length}`);

    // If we already have a turn complete (model responded during streaming), return immediately
    if (this.textParts.length > 0) {
      console.log('[GeminiLive] Already have text, returning immediately');
      this.close();
      return this.getTranscript();
    }

    // Signal end of input so the model knows we're done sending audio
    try {
      this.session.sendClientContent({ turnComplete: true });
      console.log('[GeminiLive] Sent turnComplete signal to model');
    } catch (err) {
      console.error('[GeminiLive] Error sending turnComplete:', err);
    }

    // Wait for the model to complete its turn
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          this.turnCompleteResolve = resolve;
          this.turnCompleteReject = reject;
        }),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new LiveTranscriptionError('Turn completion timeout')),
            TURN_COMPLETE_TIMEOUT_MS,
          ),
        ),
      ]);
    } finally {
      this.turnCompleteResolve = null;
      this.turnCompleteReject = null;
      this.close();
    }

    console.log(`[GeminiLive] After wait — text parts: ${this.textParts.length}, transcript length: ${this.getTranscript().length}`);

    const transcript = this.getTranscript();
    if (!transcript) {
      throw new LiveTranscriptionError('Empty transcript from live session');
    }
    return transcript;
  }

  /**
   * Abort and close the session without waiting for a result.
   */
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

  /** Whether the session is alive and streaming */
  isConnected(): boolean {
    return this.connected && !this.finished;
  }

  /** Whether a fatal error occurred */
  hasError(): boolean {
    return this.error !== null;
  }

  private handleMessage(message: LiveServerMessage): void {
    this.messagesReceived++;

    // Log all messages for debugging (summarized)
    const keys = Object.keys(message).filter(k => (message as Record<string, unknown>)[k] != null);
    console.log(`[GeminiLive] Message #${this.messagesReceived}:`, keys.join(', '));

    // Extract text parts from model turn
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.text) {
          console.log(`[GeminiLive] Text part: "${part.text.substring(0, 100)}"`);
          this.textParts.push(part.text);
          this.callbacks.onPartialText?.(part.text);
        }
        if (part.inlineData) {
          console.log(`[GeminiLive] Got inline data (audio?), mime: ${part.inlineData.mimeType}`);
        }
      }
    }

    // Check for turn completion
    if (message.serverContent?.turnComplete) {
      console.log('[GeminiLive] Turn complete, collected', this.textParts.length, 'text parts');
      this.turnCompleteResolve?.();
    }

    // Log setup complete message
    if (message.setupComplete) {
      console.log('[GeminiLive] Setup complete');
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

  // Convert Int16Array to base64
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
