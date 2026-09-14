import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import {
  PenTool,
  Upload,
  RotateCcw,
  Undo2,
  Check,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  FileCheck
} from 'lucide-react';

export interface EnhancedSignatureFieldProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  required?: boolean;
  penColor?: string;
  height?: number;
  className?: string;
}

// Opciones de suavizado y caligrafía fluida con perfect-freehand
const STROKE_OPTIONS = {
  size: 3.2,
  thinning: 0.65,
  smoothing: 0.75,
  streamline: 0.65,
  easing: (t: number) => t,
  start: {
    taper: 4,
    easing: (t: number) => t,
    cap: true
  },
  end: {
    taper: 4,
    easing: (t: number) => t,
    cap: true
  }
};

/**
 * Renderiza el contorno poligonal de perfect-freehand directamente en el contexto 2D
 */
function drawStrokePolygon(ctx: CanvasRenderingContext2D, stroke: number[][]): void {
  if (stroke.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(stroke[0][0], stroke[0][1]);
  for (let i = 1; i < stroke.length; i++) {
    const [x0, y0] = stroke[i];
    const [x1, y1] = stroke[(i + 1) % stroke.length];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.closePath();
  ctx.fill();
}

export const EnhancedSignatureField: React.FC<EnhancedSignatureFieldProps> = ({
  value = '',
  onChange,
  label = 'Firma Digital',
  required = false,
  penColor = '#0B132B',
  height = 170,
  className = ''
}) => {
  // Pestaña activa: 'draw' (Trazar) o 'upload' (Cargar imagen)
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');

  // Referencias para el Canvas interactivo
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Registro de trazos en memoria para soporte Undo / Redraw: [strokeIndex][pointIndex][x, y, pressure]
  const strokesRef = useRef<number[][][]>([]);
  const lastEmittedValueRef = useRef<string>(value);
  const isDrawingRef = useRef<boolean>(false);
  const [hasSignature, setHasSignature] = useState<boolean>(Boolean(value));
  const [canUndo, setCanUndo] = useState<boolean>(false);

  // Drag & drop en modo carga
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  /**
   * Redibuja todos los trazos en el Canvas aplicando escalado HiDPI / Retina
   */
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = container.getBoundingClientRect();
    const targetWidth = rect.width;
    const targetHeight = height;

    if (targetWidth === 0) return;

    // Configurar dimensiones físicas y CSS
    canvas.width = Math.floor(targetWidth * ratio);
    canvas.height = Math.floor(targetHeight * ratio);
    canvas.style.width = `${targetWidth}px`;
    canvas.style.height = `${targetHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // Si hay trazos interactivos grabados en memoria, dibujarlos con perfect-freehand
    if (strokesRef.current.length > 0) {
      ctx.fillStyle = penColor;
      for (const stroke of strokesRef.current) {
        const outline = getStroke(stroke, STROKE_OPTIONS);
        drawStrokePolygon(ctx, outline);
      }
      setHasSignature(true);
      setCanUndo(true);
    } else if (value) {
      // Si el componente se desmontó y volvió a montar (cambio de sección en folio),
      // restaurar la imagen previa almacenada en el estado
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        setHasSignature(true);
      };
      img.src = value;
    } else {
      setHasSignature(false);
      setCanUndo(false);
    }
  }, [height, penColor, value]);

  // Sincronización inicial y detector de redimensionamiento
  useEffect(() => {
    redrawCanvas();

    const resizeObserver = new ResizeObserver(() => {
      redrawCanvas();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [redrawCanvas]);

  // Actualizar estado si el valor externo cambia (ej. reset o carga externa)
  useEffect(() => {
    if (value !== lastEmittedValueRef.current) {
      strokesRef.current = [];
      setCanUndo(false);
      lastEmittedValueRef.current = value;
      redrawCanvas();
    }
    setHasSignature(Boolean(value));
    if (!value) {
      strokesRef.current = [];
      setCanUndo(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [value, redrawCanvas]);

  // ── MANEJADORES DE EVENTOS POINTER (FLUIDEZ & NO SCROLL) ──

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capturar puntero y prevenir scroll en tablets / smartphones
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    const newStroke = [[x, y, pressure]];
    strokesRef.current.push(newStroke);

    redrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activeTab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Si se soltó el botón principal y no hay presión
    if (e.buttons !== 1 && e.pressure === 0) {
      handlePointerUp(e);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    const currentStroke = strokesRef.current[strokesRef.current.length - 1];
    if (currentStroke) {
      currentStroke.push([x, y, pressure]);
      redrawCanvas();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar si el puntero ya se soltó
    }

    // Exportar el canvas a imagen PNG con fondo transparente
    if (strokesRef.current.length > 0) {
      const dataUrl = canvas.toDataURL('image/png');
      lastEmittedValueRef.current = dataUrl;
      onChange(dataUrl);
      setHasSignature(true);
      setCanUndo(true);
    }
  };

  // Acción: Limpiar todo
  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    strokesRef.current = [];
    setHasSignature(false);
    setCanUndo(false);
    lastEmittedValueRef.current = '';
    onChange('');

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  // Acción: Deshacer último trazo (Undo)
  const handleUndo = (e: React.MouseEvent) => {
    e.preventDefault();
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    redrawCanvas();

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (strokesRef.current.length > 0) {
      const dataUrl = canvas.toDataURL('image/png');
      lastEmittedValueRef.current = dataUrl;
      onChange(dataUrl);
      setCanUndo(true);
    } else {
      lastEmittedValueRef.current = '';
      onChange('');
      setHasSignature(false);
      setCanUndo(false);
    }
  };

  // ── MANEJO DE SUBIDA DE IMAGEN DE FIRMA (PESTAÑA 2) ──

  const processUploadedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        strokesRef.current = [];
        setCanUndo(false);
        lastEmittedValueRef.current = result;
        onChange(result);
        setHasSignature(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm transition-all hover:border-slate-300 ${className}`}>
      
      {/* ── HEADER SUPERIOR: Nombre, Badge y Acciones ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100">
            <PenTool className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800">
              {label} {required && <span className="text-cyan-500">*</span>}
            </span>
            <p className="text-[10px] text-slate-400">Tinta digital fluida con trazo caligráfico vectorial</p>
          </div>
        </div>

        {/* Estado y Botones de Acción */}
        <div className="flex items-center gap-1.5">
          {hasSignature ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
              <Check className="h-3 w-3" /> Firma válida
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
              {required ? 'Requerida' : 'Opcional'}
            </span>
          )}

          {activeTab === 'draw' && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-cyan-600 disabled:opacity-35 transition-colors"
              title="Deshacer último trazo"
            >
              <Undo2 className="h-3 w-3" />
              <span className="hidden sm:inline">Deshacer</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleClear()}
            disabled={!hasSignature}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 disabled:opacity-35 transition-colors"
            title="Limpiar firma"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        </div>
      </div>

      {/* ── SELECTOR DE MODO DUAL (Pestaña 1: Trazar / Pestaña 2: Cargar) ── */}
      <div className="mb-2.5 flex rounded-xl bg-slate-100 p-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('draw')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-bold transition-all ${
            activeTab === 'draw'
              ? 'bg-white text-cyan-800 shadow-xs ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <PenTool className="h-3.5 w-3.5" />
          <span>Trazar firma</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-bold transition-all ${
            activeTab === 'upload'
              ? 'bg-white text-cyan-800 shadow-xs ring-1 ring-black/5'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Cargar imagen de firma</span>
        </button>
      </div>

      {/* ── CUERPO DEL CAMPO: LIENZO INTERACTIVO O ZONA DROPZONE ── */}
      {activeTab === 'draw' ? (
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50/50 to-white select-none"
          style={{ height: `${height}px` }}
        >
          {/* Canvas con touch-action none para prevenir scroll involuntario al firmar */}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="absolute inset-0 block touch-none cursor-crosshair"
            style={{ touchAction: 'none' }}
          />

          {/* Línea base de firma */}
          <div className="pointer-events-none absolute bottom-4 inset-x-8 flex items-center gap-2">
            <div className="h-[1px] flex-1 border-b border-dashed border-slate-300" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 select-none">
              Línea base de firma
            </span>
            <div className="h-[1px] flex-1 border-b border-dashed border-slate-300" />
          </div>

          {/* Marca de agua si no hay trazos */}
          {!hasSignature && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-300 select-none">
              <Sparkles className="h-6 w-6 mb-1 text-cyan-500/50" />
              <span className="text-xs font-semibold text-slate-400">
                Firme aquí con tableta, lápiz óptico o cursor
              </span>
              <span className="text-[10px] text-slate-400/80 mt-0.5">
                Suavizado caligráfico activo · Sensible a velocidad
              </span>
            </div>
          )}
        </div>
      ) : (
        /* PESTAÑA 2: CARGA DE ARCHIVO DE IMAGEN */
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleFileDrop}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
            isDraggingFile
              ? 'border-cyan-500 bg-cyan-50/50'
              : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
          }`}
          style={{ height: `${height}px` }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {hasSignature && value ? (
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="relative max-h-24 max-w-[260px] overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-xs">
                <img
                  src={value}
                  alt="Firma cargada"
                  className="max-h-20 w-auto object-contain mx-auto"
                />
              </div>

              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-500/20 transition-colors"
                >
                  Reemplazar imagen
                </button>
                <button
                  type="button"
                  onClick={() => handleClear()}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 mb-1">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                Arrastra tu imagen de firma o haz clic para subir
              </p>
              <p className="text-[11px] text-slate-400">
                Formatos recomendados: PNG transparente, JPG o WEBP
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
              >
                Examinar archivo
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FOOTER INFORMATIVO ── */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <FileCheck className="h-3 w-3 text-cyan-600" />
          <span>Firma con validez legal (Ley 527 de 1999)</span>
        </span>
        <span className="font-mono">PNG 32-bit transparente</span>
      </div>

    </div>
  );
};

export default EnhancedSignatureField;
