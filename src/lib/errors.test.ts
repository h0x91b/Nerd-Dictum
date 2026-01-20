import { describe, it, expect } from 'bun:test';
import { classifyError, ErrorType } from './errors';

describe('classifyError', () => {
  describe('microphone errors', () => {
    it('should classify microphone permission denied', () => {
      const error = new Error('Microphone permission denied');
      const result = classifyError(error);

      expect(result.type).toBe('microphone_permission');
      expect(result.message).toBe('Microphone access denied');
      expect(result.isRetryable).toBe(true);
    });

    it('should classify NotAllowedError', () => {
      const error = new Error('NotAllowedError: Permission denied');
      const result = classifyError(error);

      expect(result.type).toBe('microphone_permission');
      expect(result.isRetryable).toBe(true);
    });

    it('should classify no microphone found', () => {
      const error = new Error('No microphone found');
      const result = classifyError(error);

      expect(result.type).toBe('microphone_not_found');
      expect(result.message).toBe('No microphone found');
      expect(result.isRetryable).toBe(false);
    });

    it('should classify NotFoundError', () => {
      const error = new Error('NotFoundError: No device');
      const result = classifyError(error);

      expect(result.type).toBe('microphone_not_found');
      expect(result.isRetryable).toBe(false);
    });
  });

  describe('recording duration errors', () => {
    it('should classify recording too short', () => {
      const error = new Error('Recording too short (minimum 250ms)');
      const result = classifyError(error);

      expect(result.type).toBe('recording_too_short');
      expect(result.message).toBe('Recording too short');
      expect(result.isRetryable).toBe(true);
    });

    it('should classify recording too long', () => {
      const error = new Error('Recording too long (maximum 15 minutes)');
      const result = classifyError(error);

      expect(result.type).toBe('recording_too_long');
      expect(result.message).toBe('Recording too long (max 15 min)');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('API key errors', () => {
    it('should classify missing API key', () => {
      const error = new Error('Missing API key');
      const result = classifyError(error);

      expect(result.type).toBe('api_key_missing');
      expect(result.message).toBe('API key not configured');
      expect(result.isRetryable).toBe(false);
    });

    it('should classify invalid API key', () => {
      const error = new Error('Invalid or missing API key');
      const result = classifyError(error);

      expect(result.type).toBe('api_key_invalid');
      expect(result.message).toBe('Invalid API key');
      expect(result.isRetryable).toBe(false);
    });
  });

  describe('network errors', () => {
    it('should classify failed to fetch', () => {
      const error = new Error('Failed to fetch');
      const result = classifyError(error);

      expect(result.type).toBe('network_error');
      expect(result.message).toBe('Network error - check connection');
      expect(result.isRetryable).toBe(true);
    });

    it('should classify TypeError (network)', () => {
      const error = new TypeError('Network request failed');
      const result = classifyError(error);

      expect(result.type).toBe('network_error');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('timeout errors', () => {
    it('should classify abort error', () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      const result = classifyError(error);

      expect(result.type).toBe('timeout');
      expect(result.message).toBe('Request timed out');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('API errors', () => {
    it('should classify HTTP error', () => {
      const error = new Error('HTTP error: 500');
      const result = classifyError(error);

      expect(result.type).toBe('api_error');
      expect(result.message).toBe('API error - try again');
      expect(result.isRetryable).toBe(true);
    });

    it('should classify empty response', () => {
      const error = new Error('Empty response from API');
      const result = classifyError(error);

      expect(result.type).toBe('api_error');
      expect(result.message).toBe('No transcription received');
      expect(result.isRetryable).toBe(true);
    });

    it('should classify transcription failed', () => {
      const error = new Error('Transcription failed');
      const result = classifyError(error);

      expect(result.type).toBe('api_error');
      expect(result.message).toBe('Transcription failed');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('unknown errors', () => {
    it('should classify unknown error message', () => {
      const error = new Error('Something unexpected happened');
      const result = classifyError(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Something went wrong');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle non-Error objects', () => {
      const result = classifyError('string error');

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Something went wrong');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle null', () => {
      const result = classifyError(null);

      expect(result.type).toBe('unknown');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle undefined', () => {
      const result = classifyError(undefined);

      expect(result.type).toBe('unknown');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('edge cases and case insensitivity', () => {
    it('should handle uppercase error messages', () => {
      const error = new Error('MICROPHONE PERMISSION DENIED');
      const result = classifyError(error);

      expect(result.type).toBe('microphone_permission');
    });

    it('should handle mixed case error messages', () => {
      const error = new Error('Failed To Fetch');
      const result = classifyError(error);

      expect(result.type).toBe('network_error');
    });

    it('should classify PermissionDeniedError variant', () => {
      const error = new Error('PermissionDeniedError occurred');
      const result = classifyError(error);

      expect(result.type).toBe('microphone_permission');
    });

    it('should classify DevicesNotFoundError variant', () => {
      const error = new Error('DevicesNotFoundError: no devices');
      const result = classifyError(error);

      expect(result.type).toBe('microphone_not_found');
    });

    it('should classify network error keyword', () => {
      const error = new Error('NetworkError when attempting to fetch');
      const result = classifyError(error);

      expect(result.type).toBe('network_error');
    });

    it('should classify bad request error', () => {
      const error = new Error('Bad request: invalid audio format');
      const result = classifyError(error);

      expect(result.type).toBe('api_error');
    });

    it('should handle number as error', () => {
      const result = classifyError(42);

      expect(result.type).toBe('unknown');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle object as error', () => {
      const result = classifyError({ code: 500 });

      expect(result.type).toBe('unknown');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle empty string as error', () => {
      const result = classifyError('');

      expect(result.type).toBe('unknown');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('retryability rules', () => {
    it('should mark microphone_permission as retryable (user can grant permission)', () => {
      const error = new Error('Microphone permission denied');
      const result = classifyError(error);

      expect(result.isRetryable).toBe(true);
    });

    it('should mark microphone_not_found as non-retryable (hardware issue)', () => {
      const error = new Error('No microphone found');
      const result = classifyError(error);

      expect(result.isRetryable).toBe(false);
    });

    it('should mark api_key_missing as non-retryable (config issue)', () => {
      const error = new Error('Missing API key');
      const result = classifyError(error);

      expect(result.isRetryable).toBe(false);
    });

    it('should mark api_key_invalid as non-retryable (config issue)', () => {
      const error = new Error('Invalid API key');
      const result = classifyError(error);

      expect(result.isRetryable).toBe(false);
    });

    it('should mark network_error as retryable (transient)', () => {
      const error = new Error('Failed to fetch');
      const result = classifyError(error);

      expect(result.isRetryable).toBe(true);
    });

    it('should mark timeout as retryable (transient)', () => {
      const error = new Error('abort');
      error.name = 'AbortError';
      const result = classifyError(error);

      expect(result.isRetryable).toBe(true);
    });

    it('should mark api_error as retryable (server might recover)', () => {
      const error = new Error('HTTP error: 503');
      const result = classifyError(error);

      expect(result.isRetryable).toBe(true);
    });

    it('should mark recording_too_short as retryable (user can try again)', () => {
      const error = new Error('Recording too short');
      const result = classifyError(error);

      expect(result.isRetryable).toBe(true);
    });

    it('should mark recording_too_long as retryable (user can try again)', () => {
      const error = new Error('Recording too long');
      const result = classifyError(error);

      expect(result.isRetryable).toBe(true);
    });
  });
});
