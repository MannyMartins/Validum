import React, { useEffect, useRef, useState, useCallback } from 'react';
import SignaturePad from 'signature_pad';
import { PenLine, RotateCcw, Check, Sparkles } from 'lucide-react';

export interface SignaturePadFieldProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  required?: boolean;
  penColor?: string;
  minWidth?: number;
  maxWidth?: number;
  velocityFilterWeight?: number;
  height?: number;
  className?: string;
}

export const SignaturePadField: React.FC<SignaturePadFieldProps> = ({
  value = '',
  onChange,
  label,
  required = false,
  penColor = '#0B132B',
  minWidth = 1.2,
  maxWidth = 3.5,
  velocityFilterWeight = 0.7,
  height = 160,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasInk, setHasInk] = useState<boolean>(Boolean(value));
  const [isReady, setIsReady] = useState<boolean>(false);

  // ── Refs estables para romper el ciclo de dependencias ──
  // Guardamos value y onChange en refs para que el useEffect de
  // inicialización NO se re-ejecute cada vez que el padre actualiza el valor.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Redimensionamiento con soporte HiDPI / Retina Display
  const syncCanvasDPI = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = container.getBoundingClientRect();
    const targetWidth = rect.width;
    const targetHeight = height;

    if (targetWidth === 0) return;

    // Guardar trazo actual antes de escalar si existe
    let currentDataUrl = '';
    if (padRef.current && !padRef.current.isEmpty()) {
      currentDataUrl = padRef.current.toDataURL('image/png');
    } else if (valueRef.current) {
      currentDataUrl = valueRef.current;
    }

    // Configurar dimensiones físicas y CSS
    canvas.width = Math.floor(targetWidth * ratio);
    canvas.height = Math.floor(targetHeight * ratio);
    canvas.style.width = `${targetWidth}px`;
    canvas.style.height = `${targetHeight}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
    }

    // Si ya existe instancia de SignaturePad, redibujar trazo guardado
    if (padRef.current) {
      padRef.current.clear();
      if (currentDataUrl) {
        padRef.current.fromDataURL(currentDataUrl, {
          ratio: 1,
          width: targetWidth,
          height: targetHeight
        });
        setHasInk(true);
      }
    }
  }, [height]);

  // Inicializar SignaturePad — solo depende de la config del bolígrafo,
  // NO de value/onChange para evitar el loop de reinicialización.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    syncCanvasDPI();

    const pad = new SignaturePad(canvas, {
      minWidth,
      maxWidth,
      penColor,
      velocityFilterWeight,
      throttle: 16
    });

    padRef.current = pad;

    // Cargar valor inicial si existe (leer de la ref, no de la prop)
    const initialValue = valueRef.current;
    if (initialValue) {
      pad.fromDataURL(initialValue, { ratio: 1 });
      setHasInk(true);
    }

    // Evento al terminar trazo — usa la ref de onChange
    pad.addEventListener('endStroke', () => {
      if (pad.isEmpty()) {
        setHasInk(false);
        onChangeRef.current('');
      } else {
        setHasInk(true);
        const dataUrl = pad.toDataURL('image/png');
        onChangeRef.current(dataUrl);
      }
    });

    setIsReady(true);

    // Observer para cambios de tamaño responsivos del contenedor
    const resizeObserver = new ResizeObserver(() => {
      syncCanvasDPI();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      pad.off();
    };
  }, [minWidth, maxWidth, penColor, velocityFilterWeight, syncCanvasDPI]);

  // Acción Limpiar
  const handleClear = () => {
    if (padRef.current) {
      padRef.current.clear();
      setHasInk(false);
      onChange('');
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <PenLine className="h-3.5 w-3.5 text-cyan-600" />
            <span>{label}</span>
            {required && <span className="text-cyan-600 font-black">*</span>}
          </label>
          {hasInk && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Check className="h-3 w-3" /> Firma capturada
            </span>
          )}
        </div>
      )}

      {/* Contenedor del Canvas */}
      <div
        ref={containerRef}
        className="group relative w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all hover:border-cyan-400 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-400/20"
        style={{ height: `${height}px` }}
      >
        {/* Marca de agua / Guía sutil */}
        <div className="pointer-events-none absolute inset-x-8 bottom-7 flex flex-col items-center justify-center border-b border-dashed border-slate-300 pb-1">
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
            Firme dentro del recuadro sobre esta línea
          </span>
        </div>

        {/* Canvas de trazo Bézier suave */}
        <canvas
          ref={canvasRef}
          className="relative z-10 block h-full w-full touch-none cursor-crosshair"
        />

        {/* Botón Flotante Limpiar */}
        <div className="absolute right-2.5 top-2.5 z-20 flex items-center gap-1.5">
          {hasInk && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm backdrop-blur hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Limpiar firma"
            >
              <RotateCcw className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default SignaturePadField;
