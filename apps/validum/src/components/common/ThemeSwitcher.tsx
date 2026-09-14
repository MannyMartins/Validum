import React, { useEffect, useRef, useState } from 'react';
import { Check, Moon, Palette, Sun, X } from 'lucide-react';
import { ThemeVariant, useTheme } from '../../context/ThemeContext';

const variants: Array<{ id: ThemeVariant; name: string; description: string; swatch: string }> = [
  { id: 'validum', name: 'Validum', description: 'Identidad verde lima y azul profundo', swatch: '#c4d600' },
  { id: 'corporate', name: 'Corporate Classic', description: 'Azul formal y bordes sobrios', swatch: '#2563eb' },
  { id: 'minimal', name: 'Modern Minimalist', description: 'Zinc monocromático y curvas suaves', swatch: '#71717a' },
  { id: 'vibrant', name: 'High-Contrast Vibrant', description: 'Esmeralda y púrpura para acciones', swatch: '#10b981' },
];

export const ThemeSwitcher: React.FC = () => {
  const { mode, variant, toggleMode, setVariant } = useTheme();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="theme-control flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors"
        aria-expanded={open}
        aria-label="Personalizar apariencia"
        title="Personalizar apariencia"
      >
        <Palette className="h-4 w-4" />
        <span className="hidden xl:inline">Tema</span>
      </button>

      {open && (
        <div className="theme-popover absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="theme-text text-sm font-extrabold">Apariencia de Validum</p>
              <p className="theme-muted mt-1 text-[11px]">El cambio se guarda en este dispositivo.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="theme-control rounded-lg border p-1.5" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-current/10 p-1.5">
            <button
              type="button"
              onClick={() => mode === 'dark' && toggleMode()}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold ${mode === 'light' ? 'theme-accent-button' : 'theme-control'}`}
            >
              <Sun className="h-4 w-4" /> Claro
            </button>
            <button
              type="button"
              onClick={() => mode === 'light' && toggleMode()}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold ${mode === 'dark' ? 'theme-accent-button' : 'theme-control'}`}
            >
              <Moon className="h-4 w-4" /> Oscuro
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {variants.map(item => (
              <button
                type="button"
                key={item.id}
                onClick={() => setVariant(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${variant === item.id ? 'theme-selected-card' : 'theme-control'}`}
              >
                <span className="h-8 w-8 shrink-0 rounded-lg border border-white/20" style={{ background: item.swatch }} />
                <span className="min-w-0 flex-1">
                  <span className="theme-text block text-xs font-extrabold">{item.name}</span>
                  <span className="theme-muted mt-0.5 block text-[10px]">{item.description}</span>
                </span>
                {variant === item.id && <Check className="theme-accent h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
