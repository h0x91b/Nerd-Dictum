import { useState } from 'react';
import './ApiKeyHelp.css';

export function ApiKeyHelp() {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleOpenAIStudio = () => {
    window.electronAPI.openExternalUrl('https://aistudio.google.com/apikey');
  };

  return (
    <div className={`api-key-help${isExpanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="api-key-help-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <svg
          className="api-key-help-chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
        </svg>
        <span>How to get an API key</span>
      </button>

      {isExpanded && (
        <div className="api-key-help-content">
          <div className="api-key-help-steps">
            <div className="api-key-help-step">
              <span className="step-number">1</span>
              <div className="step-content">
                <p>Go to Google AI Studio</p>
                <button className="step-link-button" onClick={handleOpenAIStudio}>
                  Open aistudio.google.com
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="api-key-help-step">
              <span className="step-number">2</span>
              <div className="step-content">
                <p>Click <strong>"Get API key"</strong> in the bottom left corner</p>
              </div>
            </div>

            <div className="api-key-help-step">
              <span className="step-number">3</span>
              <div className="step-content">
                <p>Create a new API key (you may need to create a project first)</p>
              </div>
            </div>

            <div className="api-key-help-step">
              <span className="step-number">4</span>
              <div className="step-content">
                <p>Copy the key and paste it above</p>
              </div>
            </div>
          </div>

          <p className="api-key-help-note">
            Your API key is stored locally and never shared.
          </p>
        </div>
      )}
    </div>
  );
}
