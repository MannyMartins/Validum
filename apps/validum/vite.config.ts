import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  if (mode === 'production') {
    const raw = (process.env.VITE_API_URL || env.VITE_API_URL)?.trim();
    const apiUrl = (!raw || raw.startsWith('http://localhost') || raw.startsWith('http://127.0.0.1'))
      ? 'https://api-validum.up.railway.app/api'
      : raw;
    if (!apiUrl || !/^https:\/\//i.test(apiUrl)) throw new Error('VITE_API_URL debe ser una URL HTTPS válida en producción.');
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: true,
    },
    build: {
      sourcemap: false,
    },
  };
});
