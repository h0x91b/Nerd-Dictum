import { useState, useEffect } from 'react';
import './InfoPage.css';

// Parse Electron accelerator into individual key parts for kbd display
function parseHotkeyParts(accelerator: string): string[] {
  const parts: string[] = [];
  const keyMap: Record<string, string> = {
    'CommandOrControl': '⌘',
    'Command': '⌘',
    'Control': '⌃',
    'Alt': '⌥',
    'Shift': '⇧',
  };

  const tokens = accelerator.split('+');
  for (const token of tokens) {
    parts.push(keyMap[token] || token);
  }
  return parts;
}

export function InfoPage() {
  const [hotkey, setHotkey] = useState<string>('CommandOrControl+Shift+R');

  useEffect(() => {
    window.electronAPI.getSettings().then((settings) => {
      setHotkey(settings.hotkey || 'CommandOrControl+Shift+R');
    });
  }, []);

  const hotkeyParts = parseHotkeyParts(hotkey);

  return (
    <div className="info-page">
      <h1>Voice to Text</h1>

      <p className="info-description">
        Voice recognition tuned for developers and technical speech.
        Understands <strong>code terms</strong>, <strong>CLI commands</strong>, <strong>file paths</strong>, and tech jargon
        that regular dictation apps mess up.
      </p>

      <div className="info-divider" />

      <div className="info-steps">
        <div className="info-step">
          <span className="step-icon">1</span>
          <p><strong>Click the mic</strong> to start recording</p>
        </div>

        <div className="info-step">
          <span className="step-icon">2</span>
          <p><strong>Click again</strong> to stop and transcribe</p>
        </div>

        <div className="info-step">
          <span className="step-icon">3</span>
          <p>Text is <strong>copied to clipboard</strong> automatically</p>
        </div>
      </div>

      <div className="info-cancel">
        <span className="cancel-label">To cancel:</span>
        <p>Click the mic again while transcribing to abort</p>
      </div>

      <div className="info-shortcuts">
        <span className="shortcuts-title">Keyboard Shortcuts</span>
        <div className="info-shortcut-row">
          <span className="shortcut-label">Toggle recording:</span>
          <div className="shortcut-keys">
            {hotkeyParts.map((part, i) => (
              <span key={i}>
                {i > 0 && ' + '}
                <kbd>{part}</kbd>
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="info-tip">
        Recording stops automatically after silence.
        Configure domain, keywords, and languages in Settings.
      </p>
    </div>
  );
}
