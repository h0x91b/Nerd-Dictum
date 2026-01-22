import { useState } from 'react';
import './ApiKeySetup.css';

interface ApiKeySetupProps {
  onApiKeySubmit: (apiKey: string) => void;
}

export function ApiKeySetup({ onApiKeySubmit }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAIStudio = () => {
    window.electronAPI.openExternalUrl('https://aistudio.google.com/apikey');
  };

  const handleSubmit = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return;

    setIsSubmitting(true);
    try {
      await window.electronAPI.saveSettings({ apiKey: trimmedKey });
      onApiKeySubmit(trimmedKey);
    } catch (error) {
      console.error('[ApiKeySetup] Failed to save API key:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && apiKey.trim()) {
      handleSubmit();
    }
  };

  return (
    <div className="api-key-setup">
      <div className="setup-header">
        <h1>Welcome!</h1>
        <p>To use voice transcription, you need a Google Gemini API key from a <strong>personal Gmail account</strong> (not Google Workspace/enterprise).</p>
      </div>

      <div className="setup-steps">
        <div className="setup-step">
          <span className="step-number">1</span>
          <div className="step-content">
            <p>Go to Google AI Studio</p>
            <button className="link-button" onClick={handleOpenAIStudio}>
              Open aistudio.google.com
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="setup-step">
          <span className="step-number">2</span>
          <div className="step-content">
            <p>Click <strong>"Get API key"</strong> in the bottom left corner</p>
          </div>
        </div>

        <div className="setup-step">
          <span className="step-number">3</span>
          <div className="step-content">
            <p>Create a new API key (you may need to create a project first)</p>
          </div>
        </div>

        <div className="setup-step">
          <span className="step-number">4</span>
          <div className="step-content">
            <p>Copy the key and paste it below</p>
          </div>
        </div>
      </div>

      <div className="setup-input-section">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste your API key here"
          autoFocus
        />
        <button
          className="submit-button"
          onClick={handleSubmit}
          disabled={!apiKey.trim() || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Start Using'}
        </button>
      </div>

      <p className="setup-note">
        Your API key is stored locally on your device and never shared.
      </p>
    </div>
  );
}
