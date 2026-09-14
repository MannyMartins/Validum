import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production') {
    const apiUrl = (process.env.VITE_API_URL || env.VITE_API_URL)?.trim();
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
