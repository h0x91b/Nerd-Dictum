import { useState, useEffect } from 'react';
import type { AppSettings } from '../types/electron';
import './SettingsPage.css';

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3-flash-preview');
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
      } catch (error) {
        console.error('[Settings] Failed to load:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      const success = await window.electronAPI.saveSettings({ apiKey, model });
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
