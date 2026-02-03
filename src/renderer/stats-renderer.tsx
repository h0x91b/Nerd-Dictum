import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StatsPage } from './pages/StatsPage';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/global.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <StatsPage />
      </ThemeProvider>
    </StrictMode>
  );
}
