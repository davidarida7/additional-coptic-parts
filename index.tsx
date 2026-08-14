
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Actively trigger font loading for mobile browsers
if (typeof document !== 'undefined' && 'fonts' in document) {
  Promise.all([
    document.fonts.load('16px "ArabicTimes"'),
    document.fonts.load('bold 16px "ArabicTimes"'),
    document.fonts.load('16px "FreeSerifAvvaShenouda"'),
    document.fonts.load('bold 16px "FreeSerifAvvaShenouda"'),
  ]).then(() => {
    document.documentElement.classList.add('fonts-loaded');
  }).catch((e) => {
    console.warn('Font loading fallback triggered:', e);
  });
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
