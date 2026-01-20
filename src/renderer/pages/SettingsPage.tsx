import { useState, useEffect } from 'react';
import type { AppSettings } from '../types/electron';
import './SettingsPage.css';

const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Russian' },
  { code: 'he', name: 'Hebrew' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'pl', name: 'Polish' },
];

const DEFAULT_PROMPT = `Transcribe the provided audio to text. Preserve developer terms faithfully:
code-like tokens, identifiers, acronyms, file paths. Do not invent content.
Output only the final transcript.

Domain hint: programming / developer speech`;

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [customPrompt, setCustomPrompt] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await window.electronAPI.getSettings();
        setApiKey(settings.apiKey);
        setModel(settings.model);
        setCustomPrompt(settings.customPrompt || '');
        setLanguages(settings.languages || []);
      } catch (error) {
        console.error('[Settings] Failed to load:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleLanguageToggle = (code: string) => {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      const success = await window.electronAPI.saveSettings({
        apiKey,
        model,
        customPrompt,
        languages,
      });
      if (success) {
        setSaveMessage('Saved!');
        setTimeout(() => {
          window.electronAPI.closeSettingsWindow();
        }, 500);
      } else {
        setSaveMessage('Failed to save');
      }
    } catch (error) {
      setSaveMessage('Failed to save');
    }

    setIsSaving(false);
  };

  const handleCancel = () => {
    window.electronAPI.closeSettingsWindow();
  };

  if (isLoading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-content">
        <div className="settings-field">
          <label htmlFor="api-key">Gemini API Key</label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            autoComplete="off"
          />
          <span className="settings-hint">
            Get your key from{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google AI Studio
            </a>
          </span>
        </div>

        <div className="settings-field">
          <label htmlFor="model">Model</label>
          <input
            id="model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gemini-3-flash-preview"
          />
          <span className="settings-hint">Default: gemini-3-flash-preview</span>
        </div>

        <div className="settings-field">
          <label>Primary Languages</label>
          <div className="language-grid">
            {AVAILABLE_LANGUAGES.map((lang) => (
              <label key={lang.code} className="language-option">
                <input
                  type="checkbox"
                  checked={languages.includes(lang.code)}
                  onChange={() => handleLanguageToggle(lang.code)}
                />
                <span>{lang.name}</span>
              </label>
            ))}
          </div>
          <span className="settings-hint">
            Select your primary languages for better transcription accuracy
          </span>
        </div>

        <div className="settings-field">
          <label htmlFor="custom-prompt">System Prompt</label>
          <textarea
            id="custom-prompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={DEFAULT_PROMPT}
            rows={5}
          />
          <span className="settings-hint">
            Customize the transcription prompt. Leave empty to use default.
          </span>
        </div>
      </div>

      <div className="settings-footer">
        {saveMessage && <span className="settings-message">{saveMessage}</span>}
        <button className="settings-btn settings-btn-secondary" onClick={handleCancel}>
          Cancel
        </button>
        <button
          className="settings-btn settings-btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
