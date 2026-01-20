import { useState } from 'react';
import './styles/App.css';

type AppState = 'idle' | 'recording' | 'transcribing';

export function App() {
  const [state, setState] = useState<AppState>('idle');
  const [message, setMessage] = useState<string>('');

  const handleClick = async () => {
    if (state === 'idle') {
      // TODO: Start recording
      setState('recording');
    } else if (state === 'recording') {
      // TODO: Stop recording and transcribe
      setState('transcribing');
      // TODO: Implement transcription
      setTimeout(() => {
        setMessage('Copied to clipboard');
        setState('idle');
        setTimeout(() => setMessage(''), 2000);
      }, 1000);
    }
  };

  return (
    <div className="widget">
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
