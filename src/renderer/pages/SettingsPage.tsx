import { useState, useEffect } from 'react';
import type { AppSettings } from '../types/electron';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
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

const SPEECH_DOMAINS = [
  { id: 'programming', name: 'Programming', hint: 'Code, APIs, technical terms' },
  { id: 'general', name: 'General', hint: 'Everyday conversation' },
  { id: 'cooking', name: 'Cooking', hint: 'Recipes, ingredients, kitchen' },
  { id: 'medical', name: 'Medical', hint: 'Healthcare, symptoms, medications' },
  { id: 'legal', name: 'Legal', hint: 'Contracts, law terms' },
  { id: 'academic', name: 'Academic', hint: 'Research, citations, science' },
  { id: 'business', name: 'Business', hint: 'Meetings, finance, reports' },
  { id: 'creative', name: 'Creative Writing', hint: 'Stories, poetry, scripts' },
  { id: 'custom', name: 'Custom', hint: 'Enter your own domain hint below' },
];

const MAX_CUSTOM_HINT_LENGTH = 500;
const MAX_CUSTOM_KEYWORDS_LENGTH = 1000;

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function SettingsPage() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [languages, setLanguages] = useState<string[]>([]);
  const [speechDomain, setSpeechDomain] = useState('programming');
  const [customDomainHint, setCustomDomainHint] = useState('');
  const [customKeywords, setCustomKeywords] = useState('');
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState('');
  const [silenceDetectionEnabled, setSilenceDetectionEnabled] = useState(true);
  const [silenceDurationMs, setSilenceDurationMs] = useState(2500);
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const themeOptions: Array<{ value: ThemeMode; label: string; previewTheme: 'dark' | 'light' }> = [
    { value: 'light', label: 'Light', previewTheme: 'light' },
    { value: 'dark', label: 'Dark', previewTheme: 'dark' },
    { value: 'system', label: 'System', previewTheme: systemTheme },
  ];

  // Load audio devices
  useEffect(() => {
    async function loadAudioDevices() {
      try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const microphones = devices
          .filter((device) => device.kind === 'audioinput')
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          }));
        setAudioDevices(microphones);
      } catch (error) {
        console.error('[Settings] Failed to load audio devices:', error);
      }
    }
    loadAudioDevices();
  }, []);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await window.electronAPI.getSettings();
        setApiKey(settings.apiKey);
        setModel(settings.model);
        setSpeechDomain(settings.speechDomain || 'programming');
        setCustomDomainHint(settings.customDomainHint || '');
        setCustomKeywords(settings.customKeywords || '');
        setLanguages(settings.languages || []);
        setMicrophoneDeviceId(settings.microphoneDeviceId || '');
        setSilenceDetectionEnabled(settings.silenceDetectionEnabled ?? true);
        setSilenceDurationMs(settings.silenceDurationMs || 2500);
        setLaunchAtStartup(settings.launchAtStartup ?? false);
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

  const handleCustomHintChange = (value: string) => {
    if (value.length <= MAX_CUSTOM_HINT_LENGTH) {
      setCustomDomainHint(value);
    }
  };

  const handleCustomKeywordsChange = (value: string) => {
    if (value.length <= MAX_CUSTOM_KEYWORDS_LENGTH) {
      setCustomKeywords(value);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      const success = await window.electronAPI.saveSettings({
        apiKey,
        model,
        languages,
        speechDomain,
        customDomainHint: customDomainHint.trim(),
        customKeywords: customKeywords.trim(),
        microphoneDeviceId,
        silenceDetectionEnabled,
        silenceDurationMs,
        launchAtStartup,
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
          <label>Theme</label>
          <div className="settings-theme-options" role="radiogroup" aria-label="Theme">
            {themeOptions.map((option) => (
              <label
                key={option.value}
                className={`settings-theme-option${theme === option.value ? ' is-selected' : ''}`}
              >
                <span className="settings-theme-label">
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={theme === option.value}
                    onChange={() => setTheme(option.value)}
                  />
                  <span>{option.label}</span>
                </span>
                <span className="settings-theme-preview" data-theme={option.previewTheme} aria-hidden="true">
                  <span className="settings-theme-swatch settings-theme-swatch--bg" />
                  <span className="settings-theme-swatch settings-theme-swatch--surface" />
                  <span className="settings-theme-swatch settings-theme-swatch--text">Aa</span>
                </span>
              </label>
            ))}
          </div>
          <span className="settings-hint">System follows your OS appearance.</span>
        </div>

        <div className="settings-field">
          <label htmlFor="speech-domain">Speech Domain</label>
          <select
            id="speech-domain"
            value={speechDomain}
            onChange={(e) => setSpeechDomain(e.target.value)}
          >
            {SPEECH_DOMAINS.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </select>
          <span className="settings-hint">
            {SPEECH_DOMAINS.find((d) => d.id === speechDomain)?.hint || 'Select domain for better accuracy'}
          </span>
          {speechDomain === 'custom' && (
            <>
              <input
                id="custom-domain-hint"
                type="text"
                value={customDomainHint}
                onChange={(e) => handleCustomHintChange(e.target.value)}
                placeholder="e.g., gardening terms, music production, sports commentary..."
                style={{ marginTop: '8px' }}
              />
              <span className="settings-hint">
                {customDomainHint.length}/{MAX_CUSTOM_HINT_LENGTH} characters
              </span>
            </>
          )}
        </div>

        <div className="settings-field">
          <label htmlFor="custom-keywords">Custom Keywords</label>
          <textarea
            id="custom-keywords"
            value={customKeywords}
            onChange={(e) => handleCustomKeywordsChange(e.target.value)}
            placeholder={`Bun = bull, b u n\nTypeScript = type script`}
            rows={4}
          />
          <span className="settings-hint">
            One per line. Use "Target = alias1, alias2" for corrections.
          </span>
          <span className="settings-hint">
            {customKeywords.length}/{MAX_CUSTOM_KEYWORDS_LENGTH} characters
          </span>
        </div>

        <div className="settings-field">
          <label htmlFor="microphone">Microphone</label>
          <select
            id="microphone"
            value={microphoneDeviceId}
            onChange={(e) => setMicrophoneDeviceId(e.target.value)}
          >
            <option value="">System Default</option>
            {audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          <span className="settings-hint">
            Select audio input device
          </span>
        </div>

        <div className="settings-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={silenceDetectionEnabled}
              onChange={(e) => setSilenceDetectionEnabled(e.target.checked)}
            />
            <span>Auto-stop on silence</span>
          </label>
          {silenceDetectionEnabled && (
            <div className="slider-container">
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={silenceDurationMs}
                onChange={(e) => setSilenceDurationMs(Number(e.target.value))}
              />
              <span className="slider-value">{(silenceDurationMs / 1000).toFixed(1)}s</span>
            </div>
          )}
          <span className="settings-hint">
            Automatically stop recording after a period of silence
          </span>
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
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={launchAtStartup}
              onChange={(e) => setLaunchAtStartup(e.target.checked)}
            />
            <span>Launch at startup</span>
          </label>
          <span className="settings-hint">
            Automatically start the app when you log in
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
