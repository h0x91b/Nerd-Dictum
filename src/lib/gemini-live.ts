/**
 * Google Gemini Live API client for real-time speech-to-text transcription.
 *
 * Streams audio chunks over a WebSocket session and accumulates text responses.
 * Falls back gracefully — callers can detect failure and use the batch API instead.
 */

import { GoogleGenAI, Modality } from '@google/genai';
import type { Session, LiveServerMessage } from '@google/genai';

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
  private model: string;
  private chunksSent = 0;
  private messagesReceived = 0;

  constructor(
    apiKey: string,
    callbacks: LiveTranscriberCallbacks = {},
    model?: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.callbacks = callbacks;
    this.model = model || LIVE_MODEL;
  }

  /**
   * Open a WebSocket session to the Gemini Live API.
   * Throws LiveTranscriptionError if the connection fails.
   */
  async connect(): Promise<void> {
    try {
      this.session = await this.ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.AUDIO],
          // Minimal instruction — we only need inputAudioTranscription, not model's response
          systemInstruction: {
            parts: [{ text: 'Do not respond. Stay silent.' }],
          },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Schedar',
              },
            },
          },
          // This is the key feature — server-side ASR transcription of our audio input
          inputAudioTranscription: {},
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
        audio: {
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

    // Signal end of audio stream so the model knows we're done
    try {
      this.session.sendRealtimeInput({ audioStreamEnd: true });
      console.log('[GeminiLive] Sent audioStreamEnd signal');
    } catch (err) {
      console.error('[GeminiLive] Error sending audioStreamEnd:', err);
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

    // Log message structure for debugging (truncated to avoid flooding)
    if (this.messagesReceived <= 5 || this.messagesReceived % 20 === 0) {
      const msg = message as Record<string, unknown>;
      const keys = Object.keys(msg).filter(k => msg[k] != null);
      console.log(`[GeminiLive] Message #${this.messagesReceived}:`, keys.join(', '));
    }

    // Extract input audio transcription (our primary source for speech-to-text)
    // Docs: serverContent.inputTranscription.text
    const sc = message.serverContent as Record<string, unknown> | undefined;
    if (sc) {
      const inputTx = sc.inputTranscription as { text?: string } | undefined;
      if (inputTx?.text) {
        console.log(`[GeminiLive] Input transcription: "${inputTx.text}"`);
        this.textParts.push(inputTx.text);
        this.callbacks.onPartialText?.(inputTx.text);
      }

      const outputTx = sc.outputTranscription as { text?: string } | undefined;
      if (outputTx?.text) {
        console.log(`[GeminiLive] Output transcription: "${outputTx.text.substring(0, 100)}"`);
      }
    }

    // Also extract text from model turn parts (secondary source)
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.text) {
          console.log(`[GeminiLive] Model text: "${part.text.substring(0, 100)}"`);
          // Only use model text if we have no input transcription
          if (this.textParts.length === 0) {
            this.textParts.push(part.text);
            this.callbacks.onPartialText?.(part.text);
          }
        }
      }
    }

    // Check for turn completion
    if (message.serverContent?.turnComplete) {
      console.log('[GeminiLive] Turn complete, collected', this.textParts.length, 'text parts, transcript:', this.getTranscript().substring(0, 80));
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
