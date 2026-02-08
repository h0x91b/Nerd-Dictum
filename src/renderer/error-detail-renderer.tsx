import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorDetailPage } from './pages/ErrorDetailPage';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/global.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <ErrorDetailPage />
      </ThemeProvider>
    </StrictMode>
  );
}
