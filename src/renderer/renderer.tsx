import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/global.css';

async function init() {
  // Set up mock electronAPI for browser development (when not running in Electron)
  if (!window.electronAPI) {
    const { setupElectronAPIMock } = await import('./mocks/electronAPI');
    setupElectronAPIMock();
  }

  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </StrictMode>
    );
  }
}

init();
