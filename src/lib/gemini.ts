/**
 * Google Gemini API client for speech-to-text transcription
 */

// Domain-specific prompts for different speech contexts
const DOMAIN_PROMPTS: Record<string, string> = {
  programming: `Transcribe the provided audio to text. Preserve developer terms faithfully:
code-like tokens, identifiers, acronyms, file paths. Do not invent content.
Output only the final transcript.

Domain hint: programming / developer speech`,

  general: `Transcribe the provided audio to text accurately.
Do not invent content. Output only the final transcript.

Domain hint: general everyday conversation`,

  cooking: `Transcribe the provided audio to text. Pay attention to:
recipe ingredients, cooking techniques, measurements, kitchen equipment.
Do not invent content. Output only the final transcript.

Domain hint: cooking and culinary terms`,

  medical: `Transcribe the provided audio to text. Preserve medical terms faithfully:
diagnoses, medications, symptoms, procedures, anatomical terms.
Do not invent content. Output only the final transcript.

Domain hint: medical and healthcare terminology`,

  legal: `Transcribe the provided audio to text. Preserve legal terms faithfully:
case citations, legal phrases, contract terminology, statutory references.
Do not invent content. Output only the final transcript.

Domain hint: legal terminology`,

  academic: `Transcribe the provided audio to text. Preserve academic terms faithfully:
citations, research terminology, scientific concepts, methodology terms.
Do not invent content. Output only the final transcript.

Domain hint: academic and research speech`,

  business: `Transcribe the provided audio to text. Preserve business terms faithfully:
financial terms, corporate jargon, metrics, KPIs, project management terms.
Do not invent content. Output only the final transcript.

Domain hint: business and corporate speech`,

  creative: `Transcribe the provided audio to text. Preserve creative writing elements:
dialogue, narrative structure, character names, literary terms.
Do not invent content. Output only the final transcript.

Domain hint: creative writing and storytelling`,
};

const DEFAULT_TRANSCRIPTION_PROMPT = DOMAIN_PROMPTS.programming;

const INITIAL_TIMEOUT_MS = 30000; // 30 seconds for first attempt
const RETRY_TIMEOUT_MS = 120000; // 2 minutes for retry
const MAX_ATTEMPTS = 2; // 1 initial + 1 retry
const RETRY_DELAY_MS = 1000; // 1 second delay before retry
const AUTH_ERROR_STATUSES = new Set([401, 403]);
const CLIENT_ERROR_STATUS_MIN = 400;
const CLIENT_ERROR_STATUS_MAX = 500;

export interface TranscribeOptions {
  languages?: string[];
  speechDomain?: string;
  customDomainHint?: string;
}

export interface TranscribeRequestOptions extends TranscribeOptions {
  signal?: AbortSignal;
}

export class TranscriptionCancelledError extends Error {
  constructor() {
    super('Transcription cancelled');
    this.name = 'TranscriptionCancelledError';
  }
}

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

function buildPrompt(options?: TranscribeOptions): string {
  let basePrompt: string;

  // If custom domain with custom hint, build a custom prompt
  if (options?.speechDomain === 'custom' && options?.customDomainHint) {
    basePrompt = `Transcribe the provided audio to text accurately.
Do not invent content. Output only the final transcript.

Domain hint: ${options.customDomainHint}`;
  } else if (options?.speechDomain && DOMAIN_PROMPTS[options.speechDomain]) {
    basePrompt = DOMAIN_PROMPTS[options.speechDomain];
  } else {
    basePrompt = DEFAULT_TRANSCRIPTION_PROMPT;
  }

  if (options?.languages && options.languages.length > 0) {
    const languageHint = `\n\nPrimary languages: ${options.languages.join(', ')}. The speaker may mix these languages.`;
    return basePrompt + languageHint;
  }

  return basePrompt;
}

function buildRequestBody(prompt: string, audioBase64: string) {
  return {
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
}

function extractTranscript(data: GeminiResponse): string {
  if (data.error) {
    throw new Error(data.error.message);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from API');
  }

  return text.trim();
}

function isNonRetryableError(error: Error): boolean {
  return (
    error.message.includes('API key') ||
    error.message.includes('Bad request')
  );
}

function getTimeoutForAttempt(attempt: number): number {
  return attempt === 0 ? INITIAL_TIMEOUT_MS : RETRY_TIMEOUT_MS;
}

function waitForRetryDelayMs(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (signal.aborted) {
    return Promise.reject(new TranscriptionCancelledError());
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      reject(new TranscriptionCancelledError());
    };
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function transcribeAudio(
  audioBase64: string,
  apiKey: string,
  model: string = 'gemini-3-flash-preview',
  options?: TranscribeRequestOptions
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = buildPrompt(options);
  const requestSignal = options?.signal;

  const requestBody = buildRequestBody(prompt, audioBase64);
  console.log('[TEST] Gemini transcription request:', {
    model,
    promptLength: prompt.length,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const timeoutMs = getTimeoutForAttempt(attempt);
    console.log(`[Gemini] Attempt ${attempt + 1}/${MAX_ATTEMPTS}, timeout: ${timeoutMs / 1000}s`);

    try {
      if (requestSignal?.aborted) {
        throw new TranscriptionCancelledError();
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const abortHandler = requestSignal ? () => controller.abort() : null;

      if (requestSignal && abortHandler) {
        requestSignal.addEventListener('abort', abortHandler, { once: true });
      }

      try {
        if (requestSignal?.aborted) {
          throw new TranscriptionCancelledError();
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (AUTH_ERROR_STATUSES.has(response.status)) {
          throw new Error('Invalid or missing API key');
        }

        if (
          response.status >= CLIENT_ERROR_STATUS_MIN &&
          response.status < CLIENT_ERROR_STATUS_MAX
        ) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Bad request');
        }

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data: GeminiResponse = await response.json();

        return extractTranscript(data);
      } finally {
        clearTimeout(timeoutId);
        if (requestSignal && abortHandler) {
          requestSignal.removeEventListener('abort', abortHandler);
        }
      }
    } catch (error) {
      if (error instanceof TranscriptionCancelledError || requestSignal?.aborted) {
        throw new TranscriptionCancelledError();
      }

      lastError = error as Error;

      // Don't retry on auth errors or bad requests
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        console.log(`[Gemini] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await waitForRetryDelayMs(RETRY_DELAY_MS, requestSignal);
      }
    }
  }

  throw lastError || new Error('Transcription failed');
}
