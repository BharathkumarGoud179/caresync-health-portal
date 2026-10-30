import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The React app and the Express API run as two separate projects.
// During development Vite proxies API and upload requests to the backend so
// the browser sees a single origin. Set VITE_PROXY_TARGET to change the target.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_PROXY_TARGET || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true }
      }
    }
  };
});
