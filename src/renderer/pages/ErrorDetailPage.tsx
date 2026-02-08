import { useState, useEffect, useRef } from 'react';
import './ErrorDetailPage.css';

interface ErrorDetail {
  message: string;
  statusCode?: number;
  responseBody?: string;
}

export function ErrorDetailPage() {
  const [error, setError] = useState<ErrorDetail | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    window.electronAPI.getErrorDetail().then(setError);
  }, []);

  if (!error) {
    return null;
  }

  const isHtml = error.responseBody
    ? /^\s*<!doctype|^\s*<html/i.test(error.responseBody)
    : false;

  return (
    <div className="error-detail-page">
      <div className="error-detail-header">
        <h1 className="error-detail-title">API Error</h1>
        <div className="error-detail-summary">
          {error.statusCode && (
            <span className="error-detail-status">HTTP {error.statusCode}</span>
          )}
          <span className="error-detail-message">{error.message}</span>
        </div>
      </div>
      {error.responseBody && (
        <div className="error-detail-body-section">
          <h2 className="error-detail-body-label">Response</h2>
          {isHtml ? (
            <iframe
              ref={iframeRef}
              className="error-detail-iframe"
              sandbox=""
              srcDoc={error.responseBody}
              title="API error response"
            />
          ) : (
            <pre className="error-detail-pre">{error.responseBody}</pre>
          )}
        </div>
      )}
    </div>
  );
}
