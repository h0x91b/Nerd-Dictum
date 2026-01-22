import './InfoPage.css';

export function InfoPage() {
  return (
    <div className="info-page">
      <h1>Voice to Text</h1>

      <p className="info-description">
        Voice recognition tuned for developers and technical speech.
        Understands code terms, CLI commands, file paths, and tech jargon
        that regular dictation apps mess up.
      </p>

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

      <div className="info-shortcut">
        <span className="shortcut-label">Global shortcut:</span>
        <div className="shortcut-keys">
          <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>
        </div>
      </div>

      <p className="info-tip">
        Recording stops automatically after silence.
        Configure domain, keywords, and languages in Settings.
      </p>
    </div>
  );
}
