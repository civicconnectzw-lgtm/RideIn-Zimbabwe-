
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Using (process as any).cwd() to avoid TS errors in environments without Node types globally resolved.
  // Using '' to load all variables (including those injected by CI/CD platforms like Netlify).
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Validate MAPBOX_TOKEN at build time
  const MAPBOX_TOKEN_MIN_LENGTH = 50;
  const MAPBOX_TOKEN_PREFIX = 'pk.';
  
  if (!env.MAPBOX_TOKEN) {
    console.warn('\n⚠️  WARNING: MAPBOX_TOKEN is not set in environment variables.');
    console.warn('   Map features will not work without a valid Mapbox token.');
    console.warn('   Please set MAPBOX_TOKEN in your .env file or environment.\n');
  } else if (env.MAPBOX_TOKEN.length < MAPBOX_TOKEN_MIN_LENGTH || !env.MAPBOX_TOKEN.startsWith(MAPBOX_TOKEN_PREFIX)) {
    console.warn('\n⚠️  WARNING: MAPBOX_TOKEN appears to be invalid.');
    console.warn(`   Mapbox tokens typically start with "${MAPBOX_TOKEN_PREFIX}" and are longer than ${MAPBOX_TOKEN_MIN_LENGTH} characters.`);
    console.warn('   Please verify your token at https://www.mapbox.com/\n');
  } else {
    console.log('✓ MAPBOX_TOKEN is configured');
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'RideIn Zimbabwe',
          short_name: 'RideIn',
          description: 'Zimbabwe\'s Premium Mobility App - Powered by Gemini AI',
          theme_color: '#0056E0',
          background_color: '#F5F8FA',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cdn-cache',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'mapbox-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        }
      })
    ],
    // The 'define' block replaces literal process.env strings in source code during build.
    // We prioritize values from 'env' which merges .env files and system process.env.
    // MAPBOX_TOKEN is safe to include as Mapbox tokens are designed for client-side use.
    define: {
      'process.env.MAPBOX_TOKEN': JSON.stringify(env.MAPBOX_TOKEN || ''),
    },
    build: {
      outDir: 'dist',
      target: 'es2020',
      sourcemap: mode === 'development' ? true : 'hidden',
      cssCodeSplit: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          // Splitting large vendor libs into separate chunks improves caching 
          // and reduces the size of the main entry point to prevent "blank screen" timeouts.
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-mapbox': ['mapbox-gl'],
            'vendor-ably': ['ably'],
            'vendor-ai': ['@google/genai']
          }
        }
      }
    },
    server: {
      port: 3000,
      host: true
    }
  };
});
