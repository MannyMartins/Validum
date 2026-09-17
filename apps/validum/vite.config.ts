import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production') {
    const raw = (process.env.VITE_API_URL || env.VITE_API_URL)?.trim();
    if (!raw || !/^https:\/\//i.test(raw) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(raw)) {
      throw new Error('VITE_API_URL debe apuntar a la API HTTPS real en producción.');
    }
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
