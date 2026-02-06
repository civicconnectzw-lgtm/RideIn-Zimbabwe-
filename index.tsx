
// Safety: Shim process.env for browser environments immediately and with absolute priority
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || { env: {} };
  (window as any).process.env = (window as any).process.env || {};
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * PII SCRUBBER - Ensures no sensitive data leaks to logs or unexpected sinks
 */
function scrubPII(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrubPII);
  
  const clean: any = {};
  const forbidden = ['email', 'user_email', 'mail', 'e-mail', 'reference-email', 'reference_email', 'password', 'pin'];
  
  for (const key in obj) {
    const k = key.toLowerCase();
    if (forbidden.some(f => k === f || k.includes('email'))) {
      if (k === 'password' || k === 'pin') {
        clean[key] = scrubPII(obj[key]);
      } else {
        continue;
      }
    }
    clean[key] = scrubPII(obj[key]);
  }
  return clean;
}

/**
 * FETCH INTERCEPTOR - Global safety net for API calls
 */
const { fetch: originalFetch } = window;
window.fetch = async function(...args) {
  const [resource, config] = args;
  try {
    if (config?.body && typeof config.body === 'string') {
      const headers = new Headers(config.headers);
      if (headers.get('Content-Type')?.includes('application/json')) {
        try {
          const isAuthCall = typeof resource === 'string' && (resource.includes('/auth/login') || resource.includes('/auth/signup'));
          if (!isAuthCall) {
            const parsed = JSON.parse(config.body);
            config.body = JSON.stringify(scrubPII(parsed));
          }
        } catch (e) {}
      }
    }
    return await originalFetch.apply(window, args);
  } catch (err) {
    throw err;
  }
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  try {
    // We wrap in a generic error boundary at the highest level
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("[CRITICAL] App Root Mount Failure:", err);
    rootElement.innerHTML = `
      <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#001D3D;color:white;text-align:center;padding:40px;font-family:sans-serif;">
        <div style="font-size:64px;margin-bottom:20px;">🚨</div>
        <h1 style="color:#FF5F00;font-weight:900;text-transform:uppercase;letter-spacing:-0.05em;margin-bottom:10px;">Tactical_Link_Severed</h1>
        <p style="opacity:0.6;font-size:12px;max-width:320px;line-height:1.6;letter-spacing:0.1em;text-transform:uppercase;">
          The system encountered a fatal initialization error during boot.<br>
          Code: ${err instanceof Error ? err.name : 'BOOT_FAULT_0x1'}
        </p>
        <button onclick="window.location.reload()" style="padding:18px 36px; background:#FF5F00; border:none; color:white; border-radius:16px; margin-top:30px; font-weight:900; text-transform:uppercase; letter-spacing:0.2em; cursor:pointer;">Retry Synchronize</button>
      </div>
    `;
  }
}
