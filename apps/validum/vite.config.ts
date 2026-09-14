import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production') {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL)?.trim();
    const publishableKey = (
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_ANON_KEY
    )?.trim();
    if (!supabaseUrl || !/^https:\/\/[^/]+\.supabase\.co$/i.test(supabaseUrl)) {
      throw new Error('VITE_SUPABASE_URL no está configurada con una URL válida de Supabase. La migración del frontend al API aún no está completa.');
    }
    if (!publishableKey || publishableKey.length < 20 || publishableKey.includes('REEMPLAZAR')) {
      throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY no está configurada correctamente.');
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
