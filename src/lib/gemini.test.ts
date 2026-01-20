import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { transcribeAudio } from './gemini';

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
});
