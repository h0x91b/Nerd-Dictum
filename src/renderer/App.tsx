import { useState, useRef, useCallback } from 'react';
import './styles/App.css';
import { AudioRecorder, AudioRecordingError } from '../lib/audio';
import { transcribeAudio } from '../lib/gemini';
import { classifyError, ClassifiedError } from '../lib/errors';

type AppState = 'idle' | 'recording' | 'transcribing';
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
    console.error('[TEST] Error classified:', classified);
    showMessage(classified.message, 'error', classified.isRetryable);
    return classified;
  }, [showMessage]);

  const transcribeWithRetry = useCallback(async (audioBase64: string) => {
    setState('transcribing');
    try {
      // Get API key and model from main process
      const apiKey = await window.electronAPI.getApiKey();
      const model = await window.electronAPI.getModel();

      if (!apiKey) {
        throw new Error('Missing API key');
      }

      console.log('[TEST] Calling transcription API with model:', model);

      // Transcribe audio
      const transcript = await transcribeAudio(audioBase64, apiKey, model);
      console.log('[TEST] Transcription result:', transcript);

      // Copy to clipboard
      await window.electronAPI.copyToClipboard(transcript);
      showMessage('Copied to clipboard', 'success');
      console.log('[TEST] Transcript copied to clipboard');

      // Clear saved audio on success
      lastAudioRef.current = null;
      setState('idle');
    } catch (error) {
      const classified = showError(error);
      console.error('[TEST] Transcription error:', error);

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
      console.log('[TEST] Retrying transcription...');
      await transcribeWithRetry(lastAudioRef.current);
    }
  }, [state, transcribeWithRetry]);

  const handleClick = async () => {
    if (state === 'idle') {
      // Clear any pending retry audio when starting new recording
      lastAudioRef.current = null;

      try {
        recorderRef.current = new AudioRecorder();
        await recorderRef.current.start();
        setState('recording');
        console.log('[AudioRecorder] Recording started');
      } catch (error) {
        showError(error);
        console.error('[AudioRecorder] Start error:', error);
      }
    } else if (state === 'recording') {
      try {
        const audioBase64 = await recorderRef.current!.stop();
        console.log('[TEST] Recording stopped, audio length:', audioBase64.length, 'chars');
        await transcribeWithRetry(audioBase64);
      } catch (error) {
        // Recording stop error (too short, etc.)
        showError(error);
        console.error('[TEST] Recording stop error:', error);
        setState('idle');
      }
    }
  };

  return (
    <div className="widget">
      <div className="drag-handle">
        <span className="grip-dots"></span>
      </div>
      <button
        className={`mic-button ${state}`}
        onClick={handleClick}
        disabled={state === 'transcribing'}
        aria-label={
          state === 'idle'
            ? 'Start recording'
            : state === 'recording'
              ? 'Stop recording'
              : 'Transcribing...'
        }
      >
        {state === 'transcribing' ? (
          <span className="spinner" />
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
