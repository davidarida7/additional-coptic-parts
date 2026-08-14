
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Actively trigger font loading for mobile browsers
if (typeof window !== 'undefined' && typeof document !== 'undefined' && 'fonts' in document) {
  if (typeof FontFace !== 'undefined') {
    try {
      const arabicFont = new FontFace(
        'ArabicTimes',
        'url(/fonts/ArabicTimes.woff) format("woff"), url(/fonts/ArabicTimes.ttf) format("truetype")',
        { weight: 'normal', style: 'normal' }
      );
      const arabicBoldFont = new FontFace(
        'ArabicTimes',
        'url(/fonts/ArabicTimesBold.woff) format("woff"), url(/fonts/ArabicTimesBold.ttf) format("truetype")',
        { weight: 'bold', style: 'normal' }
      );
      const copticFont = new FontFace(
        'FreeSerifAvvaShenouda',
        'url(/fonts/FreeSerifAvvaShenouda.woff) format("woff"), url(/fonts/FreeSerifAvvaShenouda.ttf) format("truetype")',
        { weight: 'normal', style: 'normal' }
      );

      Promise.all([
        arabicFont.load().then(f => document.fonts.add(f)).catch(() => {}),
        arabicBoldFont.load().then(f => document.fonts.add(f)).catch(() => {}),
        copticFont.load().then(f => document.fonts.add(f)).catch(() => {}),
      ]).then(() => {
        document.documentElement.classList.add('fonts-loaded');
      });
    } catch (e) {
      console.warn('FontFace API initialization skipped:', e);
    }
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
