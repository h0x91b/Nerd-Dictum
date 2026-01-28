import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HidePage } from './pages/HidePage';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/global.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <HidePage />
      </ThemeProvider>
    </StrictMode>
  );
}
