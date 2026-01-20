/**
 * Error classification and user-friendly message generation
 */

export type ErrorType =
  | 'microphone_permission'
  | 'microphone_not_found'
  | 'recording_too_short'
  | 'recording_too_long'
  | 'api_key_missing'
  | 'api_key_invalid'
  | 'network_error'
  | 'api_error'
  | 'timeout'
  | 'unknown';

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  isRetryable: boolean;
}

/**
 * Classify an error and return user-friendly information
 */
export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Microphone permission errors
    if (
      message.includes('microphone permission denied') ||
      message.includes('notallowederror') ||
      message.includes('permissiondeniederror')
    ) {
      return {
        type: 'microphone_permission',
        message: 'Microphone access denied',
        isRetryable: true,
      };
    }

    // Microphone not found
    if (
      message.includes('no microphone found') ||
      message.includes('notfounderror') ||
      message.includes('devicesnotfounderror')
    ) {
      return {
        type: 'microphone_not_found',
        message: 'No microphone found',
        isRetryable: false,
      };
    }

    // Recording duration errors
    if (message.includes('recording too short')) {
      return {
        type: 'recording_too_short',
        message: 'Recording too short',
        isRetryable: true,
      };
    }

    if (message.includes('recording too long')) {
      return {
        type: 'recording_too_long',
        message: 'Recording too long (max 15 min)',
        isRetryable: true,
      };
    }

    // API key errors - check invalid first since "Invalid or missing API key" contains both
    if (message.includes('invalid') && message.includes('api key')) {
      return {
        type: 'api_key_invalid',
        message: 'Invalid API key',
        isRetryable: false,
      };
    }

    if (message.includes('missing api key')) {
      return {
        type: 'api_key_missing',
        message: 'API key not configured',
        isRetryable: false,
      };
    }

    // Network errors
    if (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('network error') ||
      error.name === 'TypeError'
    ) {
      return {
        type: 'network_error',
        message: 'Network error - check connection',
        isRetryable: true,
      };
    }

    // Timeout errors
    if (message.includes('abort') || error.name === 'AbortError') {
      return {
        type: 'timeout',
        message: 'Request timed out',
        isRetryable: true,
      };
    }

    // HTTP/API errors
    if (message.includes('http error') || message.includes('bad request')) {
      return {
        type: 'api_error',
        message: 'API error - try again',
        isRetryable: true,
      };
    }

    // Empty response
    if (message.includes('empty response')) {
      return {
        type: 'api_error',
        message: 'No transcription received',
        isRetryable: true,
      };
    }

    // Generic API-related errors
    if (message.includes('transcription failed')) {
      return {
        type: 'api_error',
        message: 'Transcription failed',
        isRetryable: true,
      };
    }
  }

  // Unknown error
  return {
    type: 'unknown',
    message: 'Something went wrong',
    isRetryable: true,
  };
}
