import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from './pages/SettingsPage';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/global.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    </StrictMode>
  );
}
