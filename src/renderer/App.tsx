import { useState, useRef } from 'react';
import './styles/App.css';
import { AudioRecorder, AudioRecordingError } from '../lib/audio';

type AppState = 'idle' | 'recording' | 'transcribing';

export function App() {
  const [state, setState] = useState<AppState>('idle');
  const [message, setMessage] = useState<string>('');
  const recorderRef = useRef<AudioRecorder | null>(null);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2000);
  };

  const handleClick = async () => {
    if (state === 'idle') {
      try {
        recorderRef.current = new AudioRecorder();
        await recorderRef.current.start();
        setState('recording');
        console.log('[AudioRecorder] Recording started');
      } catch (error) {
        if (error instanceof AudioRecordingError) {
          showMessage(error.message);
        } else {
          showMessage('Failed to start recording');
        }
        console.error('[AudioRecorder] Start error:', error);
      }
    } else if (state === 'recording') {
      setState('transcribing');
      try {
        const audioBase64 = await recorderRef.current!.stop();
        console.log('[AudioRecorder] Recording stopped');
        console.log('[AudioRecorder] Audio length:', audioBase64.length, 'chars');
        console.log('[AudioRecorder] Audio preview:', audioBase64.substring(0, 100) + '...');

        // TODO: Send to transcription API
        // For now, just show success
        showMessage('Recording captured!');
        setState('idle');
      } catch (error) {
        if (error instanceof AudioRecordingError) {
          showMessage(error.message);
        } else {
          showMessage('Recording failed');
        }
        console.error('[AudioRecorder] Stop error:', error);
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
      {message && <div className="flash-message">{message}</div>}
    </div>
  );
}
