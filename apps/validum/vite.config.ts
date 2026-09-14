import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // En producción o desarrollo, se admite conexión con API directa de Railway o modo autónomo
  const apiUrl = (process.env.VITE_API_URL || env.VITE_API_URL)?.trim();
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL)?.trim();
  if (supabaseUrl && !/^https:\/\/[^/]+\.supabase\.co$/i.test(supabaseUrl)) {
    console.warn('[Vite] Advertencia: VITE_SUPABASE_URL no parece un dominio Supabase estándar.');
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
