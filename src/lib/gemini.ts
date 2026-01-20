/**
 * Google Gemini API client for speech-to-text transcription
 */

const DEFAULT_TRANSCRIPTION_PROMPT = `Transcribe the provided audio to text. Preserve developer terms faithfully:
code-like tokens, identifiers, acronyms, file paths. Do not invent content.
Output only the final transcript.

Domain hint: programming / developer speech`;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export interface TranscribeOptions {
  customPrompt?: string;
  languages?: string[];
}

function buildPrompt(options?: TranscribeOptions): string {
  const basePrompt = options?.customPrompt || DEFAULT_TRANSCRIPTION_PROMPT;

  if (options?.languages && options.languages.length > 0) {
    const languageHint = `\n\nPrimary languages: ${options.languages.join(', ')}. The speaker may mix these languages.`;
    return basePrompt + languageHint;
  }

  return basePrompt;
}

export async function transcribeAudio(
  audioBase64: string,
  apiKey: string,
  model: string = 'gemini-3-flash-preview',
  options?: TranscribeOptions
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = buildPrompt(options);

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'audio/wav',
              data: audioBase64,
            },
          },
        ],
      },
    ],
  };

  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid or missing API key');
      }

      if (response.status >= 400 && response.status < 500) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Bad request');
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty response from API');
      }

      return text.trim();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on auth errors or bad requests
      if (
        lastError.message.includes('API key') ||
        lastError.message.includes('Bad request')
      ) {
        throw lastError;
      }

      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = 250 * Math.pow(2, attempt) + Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Transcription failed');
}
