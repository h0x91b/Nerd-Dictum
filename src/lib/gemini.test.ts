import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { transcribeAudio, TranscriptionCancelledError } from './gemini';

describe('transcribeAudio', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return transcribed text on successful response', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: '  Hello world  ' }],
          },
        },
      ],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response)
    );

    const result = await transcribeAudio('base64audio', 'test-api-key');

    expect(result).toBe('Hello world');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw on invalid API key', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      } as Response)
    );

    await expect(transcribeAudio('base64audio', 'invalid-key')).rejects.toThrow(
      'Invalid or missing API key'
    );
  });

  it('should throw on empty response', async () => {
    const mockResponse = {
      candidates: [],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response)
    );

    await expect(transcribeAudio('base64audio', 'test-api-key')).rejects.toThrow(
      'Empty response from API'
    );
  });

  it('should stop retries when aborted by signal', async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = mock((_url, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      capturedSignal = signal;
      return new Promise((_resolve, reject) => {
        if (!signal) {
          reject(new Error('Missing abort signal'));
          return;
        }
        if (signal.aborted) {
          reject(signal.reason ?? new Error('Aborted'));
          return;
        }
        signal.addEventListener(
          'abort',
          () => {
            reject(signal.reason ?? new Error('Aborted'));
          },
          { once: true }
        );
      }) as Promise<Response>;
    });

    const controller = new AbortController();
    const promise = transcribeAudio(
      'base64audio',
      'test-api-key',
      'gemini-3-flash-preview',
      { signal: controller.signal }
    );

    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(TranscriptionCancelledError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should include custom keywords in prompt', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello world' }],
          },
        },
      ],
    };

    let capturedPrompt = '';

    globalThis.fetch = mock((_url, init) => {
      const body = init?.body ? JSON.parse(init.body as string) : null;
      capturedPrompt = body?.contents?.[0]?.parts?.[0]?.text ?? '';
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);
    });

    await transcribeAudio(
      'base64audio',
      'test-api-key',
      'gemini-3-flash-preview',
      { customKeywords: 'Bun = bull, b u n\nTypeScript' }
    );

    expect(capturedPrompt).toContain('User keywords and corrections:');
    expect(capturedPrompt).toContain('- Bun (aliases: bull, b u n)');
    expect(capturedPrompt).toContain('- TypeScript');
  });
});
