import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Latin subsets only, bundled into the build: same-origin files the service
// worker caches, so the type survives offline and no font host is ever called.
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-500.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/instrument-serif/latin-400.css';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Production only, and never in tests (vitest runs in a Node environment
// with no `window`/`navigator.serviceWorker`, so this whole block is dead
// there even without the explicit guard below).
if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Registration failing (unsupported browser, etc.) should never block the app.
    });
  });
}
