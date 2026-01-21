import { useState, useRef, useEffect, useCallback } from 'react';
import './styles/App.css';
import { AudioRecorder, AudioRecordingError } from '../lib/audio';
import { transcribeAudio, TranscribeOptions } from '../lib/gemini';
import { classifyError, ClassifiedError } from '../lib/errors';
import { SettingsButton } from './components/Settings';

type AppState = 'idle' | 'recording' | 'transcribing' | 'success';
type MessageType = 'success' | 'error';

interface FlashMessage {
  text: string;
  type: MessageType;
  isRetryable: boolean;
}

export function App() {
  const [state, setState] = useState<AppState>('idle');
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const lastAudioRef = useRef<string | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((text: string, type: MessageType = 'success', isRetryable = false) => {
    // Clear any existing timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    setMessage({ text, type, isRetryable });
    // Error messages with retry stay longer
    const duration = type === 'error' && isRetryable ? 4000 : 2000;
    messageTimeoutRef.current = setTimeout(() => setMessage(null), duration);
  }, []);

  const showError = useCallback((error: unknown) => {
    const classified: ClassifiedError = classifyError(error);
    showMessage(classified.message, 'error', classified.isRetryable);
    return classified;
  }, [showMessage]);

  const transcribeWithRetry = useCallback(async (audioBase64: string) => {
    setState('transcribing');
    try {
      // Get settings from main process
      const settings = await window.electronAPI.getSettings();

      if (!settings.apiKey) {
        showMessage('Set API key in settings', 'error', true);
        window.electronAPI.openSettingsWindow();
        // Save audio for retry after setting API key
        lastAudioRef.current = audioBase64;
        setState('idle');
        return;
      }

      const options: TranscribeOptions = {};
      if (settings.customPrompt) {
        options.customPrompt = settings.customPrompt;
      }
      if (settings.languages && settings.languages.length > 0) {
        options.languages = settings.languages;
      }

      // Transcribe audio
      const transcript = await transcribeAudio(audioBase64, settings.apiKey, settings.model, options);
      console.log('[Transcript]', transcript);

      // Copy to clipboard
      await window.electronAPI.copyToClipboard(transcript);
      showMessage('Copied to clipboard', 'success');

      // Clear saved audio on success
      lastAudioRef.current = null;

      // Show success state for 5 seconds, then fade to idle
      setState('success');
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setState('idle');
      }, 5000);
    } catch (error) {
      const classified = showError(error);

      // Save audio for retry only if error is retryable
      if (classified.isRetryable) {
        lastAudioRef.current = audioBase64;
      } else {
        lastAudioRef.current = null;
      }
      setState('idle');
    }
  }, [showError, showMessage]);

  const handleRetry = useCallback(async () => {
    if (lastAudioRef.current && state === 'idle') {
      await transcribeWithRetry(lastAudioRef.current);
    }
  }, [state, transcribeWithRetry]);

  const stopRecordingAndTranscribe = useCallback(async () => {
    // Use recorder's internal state to avoid stale closure issues
    if (!recorderRef.current || !recorderRef.current.getIsRecording()) return;

    try {
      const audioBase64 = await recorderRef.current.stop();
      console.log('[Recording] Stopped');
      await transcribeWithRetry(audioBase64);
    } catch (error) {
      // Recording stop error (too short, etc.)
      showError(error);
      setState('idle');
    }
  }, [transcribeWithRetry, showError]);

  const handleToggleRecording = useCallback(async () => {
    if (state === 'idle' || state === 'success') {
      // Clear any pending retry audio when starting new recording
      lastAudioRef.current = null;
      // Clear success timeout if transitioning from success state
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }

      try {
        recorderRef.current = new AudioRecorder();
        // Set up silence detection callback for auto-stop
        recorderRef.current.setOnSilenceStop(() => {
          stopRecordingAndTranscribe();
        });
        await recorderRef.current.start();
        console.log('[Recording] Started');
        setState('recording');
      } catch (error) {
        showError(error);
      }
    } else if (state === 'recording') {
      await stopRecordingAndTranscribe();
    }
  }, [state, showError, stopRecordingAndTranscribe]);

  // Listen for global keyboard shortcut
  useEffect(() => {
    const unsubscribe = window.electronAPI.onToggleRecording(() => {
      handleToggleRecording();
    });
    return () => {
      unsubscribe();
    };
  }, [handleToggleRecording, state]);

  return (
    <div className="widget">
      <SettingsButton />
      <div className="drag-handle">
        <span className="grip-dots"></span>
      </div>
      <button
        className={`mic-button ${state}`}
        onClick={handleToggleRecording}
        disabled={state === 'transcribing'}
        aria-label={
          state === 'idle' || state === 'success'
            ? 'Start recording'
            : state === 'recording'
              ? 'Stop recording'
              : 'Transcribing...'
        }
        data-tooltip={
          state === 'idle' || state === 'success'
            ? '⌘⇧R'
            : state === 'recording'
              ? '⌘⇧R'
              : undefined
        }
      >
        {state === 'transcribing' ? (
          <span className="spinner" />
        ) : state === 'success' ? (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width="32"
            height="32"
            className="checkmark-icon"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width="32"
            height="32"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>
      {message && (
        <div
          className={`flash-message ${message.type}${message.isRetryable ? ' retryable' : ''}`}
          onClick={message.isRetryable ? handleRetry : undefined}
          role={message.isRetryable ? 'button' : undefined}
          tabIndex={message.isRetryable ? 0 : undefined}
          onKeyDown={message.isRetryable ? (e) => e.key === 'Enter' && handleRetry() : undefined}
        >
          {message.text}
          {message.isRetryable && <span className="retry-hint">(tap to retry)</span>}
        </div>
      )}
    </div>
  );
}
