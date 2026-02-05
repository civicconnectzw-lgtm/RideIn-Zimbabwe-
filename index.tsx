
// Safety: Shim process.env for browser environments immediately
(window as any).process = (window as any).process || { env: {} };
(window as any).process.env = (window as any).process.env || {};

// Initialize global debug log
(window as any).__RIDEIN_DEBUG_LOGS = [];
const pushLog = (log: any) => {
  const logs = (window as any).__RIDEIN_DEBUG_LOGS;
  logs.unshift({ ...log, timestamp: new Date().toISOString() });
  if (logs.length > 50) logs.pop();
};

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * NUCLEAR SCRUBBER: Recursively removes all 'email' related keys.
 * Explicitly targets 'reference-email' which causes backend errors.
 */
function deepScrub(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepScrub);
  
  const clean: any = {};
  const blacklist = ['email', 'user_email', 'mail', 'e-mail', 'reference-email', 'reference_email'];
  
  for (const key in obj) {
    const k = key.toLowerCase();
    // Block anything resembling the blacklisted keys
    if (blacklist.some(forbidden => k === forbidden || k.includes('reference-email'))) {
      console.warn(`[Interceptor] Terminated unauthorized parameter: ${key}`);
      continue;
    }
    clean[key] = deepScrub(obj[key]);
  }
  return clean;
}

/**
 * TACTICAL FETCH FIREWALL
 * Intercepts every outgoing request to ensure absolute cleanliness.
 */
const originalFetch = window.fetch;
window.fetch = async function(resource: string | Request | URL, config?: RequestInit) {
  const startTime = Date.now();
  let urlString = "";
  let currentConfig: RequestInit = config || {};

  try {
    if (resource instanceof Request) {
      urlString = resource.url;
      // Merge headers from Request object if config doesn't have them
      const reqHeaders = new Headers(resource.headers);
      if (currentConfig.headers) {
        const configHeaders = new Headers(currentConfig.headers);
        configHeaders.forEach((v, k) => reqHeaders.set(k, v));
      }
      currentConfig.headers = reqHeaders;
      // Note: We don't easily scrub the body of a Request object without consuming the stream,
      // but in this app, xanoRequest passes string bodies in config.
    } else {
      urlString = resource.toString();
    }

    // 1. Scrub Query Parameters from URL
    if (urlString.toLowerCase().includes('email')) {
      try {
        const urlObj = new URL(urlString, window.location.origin);
        const params = new URLSearchParams(urlObj.search);
        let changed = false;
        const forbidden = ['email', 'user_email', 'mail', 'e-mail', 'reference-email', 'reference_email'];
        
        forbidden.forEach(key => {
          if (params.has(key)) {
            params.delete(key);
            changed = true;
          }
        });

        if (changed) {
          urlObj.search = params.toString();
          urlString = urlObj.toString();
        }
      } catch (e) {
        urlString = urlString.replace(/([?&])email=[^&]*/gi, '');
      }
    }

    // 2. Scrub Body (Only if JSON string)
    if (currentConfig.body && typeof currentConfig.body === 'string') {
      try {
        const parsed = JSON.parse(currentConfig.body);
        const scrubbed = deepScrub(parsed);
        currentConfig.body = JSON.stringify(scrubbed);
      } catch (e) {
        // Not JSON, leave as is
      }
    }

    // 3. Scrub Headers
    if (currentConfig.headers) {
      const headers = new Headers(currentConfig.headers);
      headers.delete('X-User-Email');
      headers.delete('X-Email');
      headers.delete('reference-email');
      currentConfig.headers = headers;
    }

    const response = await originalFetch(urlString, currentConfig);
    const duration = Date.now() - startTime;
    
    pushLog({
      type: 'request',
      method: currentConfig.method || 'GET',
      url: urlString,
      status: response.status,
      duration: `${duration}ms`,
      ok: response.ok
    });

    return response;
  } catch (err: any) {
    const duration = Date.now() - startTime;
    pushLog({
      type: 'error',
      method: currentConfig.method || 'GET',
      url: urlString || 'unknown',
      error: err.message,
      duration: `${duration}ms`
    });
    console.error('[Interceptor Critical Error]', err);
    return originalFetch(resource, config);
  }
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
