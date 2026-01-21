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
  languages?: string[];
  speechDomain?: string;
  customDomainHint?: string;
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
