
// Safety: Shim process.env for browser environments immediately
(window as any).process = (window as any).process || { env: {} };
(window as any).process.env = (window as any).process.env || {};

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler for easier debugging of blank page issues
window.onerror = function(message, source, lineno, colno, error) {
  console.error('CRITICAL APP ERROR:', message, 'at', source, lineno + ':' + colno);
  return false;
};

// Handle unhandled promise rejections which are common in network-heavy apps
window.onunhandledrejection = function(event) {
  console.error('UNHANDLED REJECTION:', event.reason);
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Target container 'root' not found in DOM.");
}
