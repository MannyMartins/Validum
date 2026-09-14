import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemeVariant = 'validum' | 'corporate' | 'minimal' | 'vibrant';

interface ThemeContextValue {
  mode: ThemeMode;
  variant: ThemeVariant;
  setMode: (mode: ThemeMode) => void;
  setVariant: (variant: ThemeVariant) => void;
  toggleMode: () => void;
}

const STORAGE_KEY = 'validum-ui-theme-v1';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredTheme(): { mode: ThemeMode; variant: ThemeVariant } {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<ThemeContextValue>;
    return {
      mode: stored.mode === 'light' ? 'light' : 'dark',
      variant: ['validum', 'corporate', 'minimal', 'vibrant'].includes(String(stored.variant))
        ? stored.variant as ThemeVariant
        : 'validum',
    };
  } catch {
    return { mode: 'dark', variant: 'validum' };
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(readStoredTheme, []);
  const [mode, setMode] = useState<ThemeMode>(initial.mode);
  const [variant, setVariant] = useState<ThemeVariant>(initial.variant);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.themeMode = mode;
    root.dataset.themeVariant = variant;
    root.style.colorScheme = mode;
    root.classList.toggle('dark', mode === 'dark');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, variant }));
  }, [mode, variant]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    variant,
    setMode,
    setVariant,
    toggleMode: () => setMode(current => current === 'dark' ? 'light' : 'dark'),
  }), [mode, variant]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return context;
}
