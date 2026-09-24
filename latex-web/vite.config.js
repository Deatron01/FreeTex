import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The FreeTex compile server (../server) listens on port 3001 by default.
// During development its API is proxied so the app can use it without CORS setup.
const serverUrl = process.env.FREETEX_SERVER || 'http://127.0.0.1:3001';

export default defineConfig({
  // Relative asset paths: the built app works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: serverUrl, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: serverUrl, changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'codemirror', test: /node_modules[\\/](@codemirror|@lezer|@replit|codemirror)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
});
