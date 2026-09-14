import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan,
  Download,
  RotateCcw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  X,
  Eye,
  ShieldCheck,
  Layers,
  Stamp,
  FileCheck
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { useScanEffect, applyScanFiltersToCanvas } from '../../hooks/useScanEffect';
import type { ScanColorMode, ScanFilterOptions } from '../../types/soporte';
import { uploadDocumentoSoporte } from '../../lib/supabaseClient';

export interface LookScannedStudioProps {
  sourceFile?: File | Blob | string;
  sourceFileName?: string;
  onClose: () => void;
  onSavedToLibrary?: () => void;
}

async function normalizeSourceToPdfBytes(source: File | Blob | string): Promise<Uint8Array> {
  let bytes: Uint8Array;
  let mimeType = '';

  if (typeof source === 'string') {
    if (/^data:/i.test(source)) {
      mimeType = source.match(/^data:([^;,]+)/i)?.[1] || '';
      const clean = source.replace(/^data:[^;]+;base64,/, '');
      const binary = atob(clean);
      bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    } else {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`No se pudo descargar el documento (${response.status}).`);
      mimeType = response.headers.get('content-type') || '';
      bytes = new Uint8Array(await response.arrayBuffer());
    }
  } else {
    mimeType = source.type || '';
    bytes = new Uint8Array(await source.arrayBuffer());
  }

  const isPdf = mimeType.includes('pdf') || String.fromCharCode(...bytes.subarray(0, 4)) === '%PDF';
  if (isPdf) return bytes;

  const isPng = mimeType.includes('png') || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47);
  const isJpeg = mimeType.includes('jpeg') || mimeType.includes('jpg') || (bytes[0] === 0xff && bytes[1] === 0xd8);
  if (!isPng && !isJpeg) {
    throw new Error('LookScanned admite documentos PDF e imágenes PNG o JPEG.');
  }

  const output = await PDFDocument.create();
  const image = isPng ? await output.embedPng(bytes) : await output.embedJpg(bytes);
  const width = Math.max(1, image.width * 0.75);
  const height = Math.max(1, image.height * 0.75);
  const page = output.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  return output.save();
}

export const LookScannedStudio: React.FC<LookScannedStudioProps> = ({
  sourceFile,
  sourceFileName = 'documento.pdf',
  onClose,
  onSavedToLibrary
}) => {
  const {
    options,
    updateOption,
    resetOptions,
    isProcessing,
    progress,
    processDocumentToScannedPDF,
    cancelProcessing
  } = useScanEffect();

  // Estado del documento y navegación de páginas
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileSizeText, setFileSizeText] = useState<string>('0 KB');

  // Canvases y Vistas
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderGenerationRef = useRef<number>(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'split' | 'scanned_only'>('split');

  // Estado de salida
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState<Blob | null>(null);
  const [isSavingToLibrary, setIsSavingToLibrary] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Acordeones laterales
  const [openSection, setOpenSection] = useState<'scan' | 'paper' | 'stamps' | 'watermark'>('scan');

  useEffect(() => {
    setGeneratedPdfBlob(null);
    setSavedSuccess(false);
  }, [options, sourceFile]);

  const handleClose = () => {
    if (isProcessing) cancelProcessing();
    onClose();
  };

  // Cargar archivo de entrada
  useEffect(() => {
    let isMounted = true;
    let loadedDocument: pdfjsLib.PDFDocumentProxy | null = null;

    async function loadSource() {
      if (!sourceFile) return;

      try {
        const bytes = await normalizeSourceToPdfBytes(sourceFile);
        setFileSizeText(`${(bytes.length / 1024).toFixed(1)} KB`);

        if (!isMounted) return;
        setFileBytes(new Uint8Array(bytes.slice(0)));

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
        const doc = await loadingTask.promise;
        loadedDocument = doc;

        if (!isMounted) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);

        // Generar miniaturas iniciales para la tira inferior
        const thumbs: string[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const vp = page.getViewport({ scale: 0.25 });
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = vp.width;
          thumbCanvas.height = vp.height;
          const tCtx = thumbCanvas.getContext('2d');
          if (tCtx) {
            await page.render({ canvasContext: tCtx, viewport: vp }).promise;
            thumbs.push(thumbCanvas.toDataURL('image/jpeg', 0.6));
          }
        }
        if (isMounted) {
          setThumbnails(thumbs);
        }
      } catch (err) {
        console.error('Error cargando documento en LookScanned:', err);
      }
    }

    loadSource();

    return () => {
      isMounted = false;
      renderGenerationRef.current += 1;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [sourceFile]);

  // Renderizar la página actual y aplicar el efecto en tiempo real
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc) return;
    const generation = ++renderGenerationRef.current;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.4 });

      // Se renderiza fuera de pantalla para que los cambios rápidos de filtros no
      // intenten usar simultáneamente el mismo canvas de PDF.js.
      const origCanvas = document.createElement('canvas');
      origCanvas.width = viewport.width;
      origCanvas.height = viewport.height;
      const origCtx = origCanvas.getContext('2d', { alpha: false });

      if (origCtx) {
        await page.render({ canvasContext: origCtx, viewport }).promise;
      }
      if (generation !== renderGenerationRef.current) return;

      const visibleOriginal = originalCanvasRef.current;
      if (visibleOriginal) {
        visibleOriginal.width = origCanvas.width;
        visibleOriginal.height = origCanvas.height;
        visibleOriginal.getContext('2d')?.drawImage(origCanvas, 0, 0);
      }

      // Aplicar filtros LookScanned sobre el canvas de vista previa
      const treatedCanvas = applyScanFiltersToCanvas(origCanvas, options, currentPage - 1);
      if (generation !== renderGenerationRef.current) return;

      const previewCanvas = previewCanvasRef.current;
      if (previewCanvas) {
        previewCanvas.width = treatedCanvas.width;
        previewCanvas.height = treatedCanvas.height;
        const prevCtx = previewCanvas.getContext('2d');
        if (prevCtx) {
          prevCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
          prevCtx.drawImage(treatedCanvas, 0, 0);
        }
      }
    } catch (err) {
      console.error('Error renderizando página de preview:', err);
    }
  }, [pdfDoc, currentPage, options]);

  useEffect(() => {
    const timer = setTimeout(() => {
      renderCurrentPage();
    }, 40);
    return () => clearTimeout(timer);
  }, [renderCurrentPage]);

  // Acción: Generar PDF escaneado completo
  const handleGenerateScannedPDF = async () => {
    if (!fileBytes && !pdfDoc) return;

    try {
      const res = await processDocumentToScannedPDF(
        fileBytes || new Uint8Array(),
        options,
        pdfDoc || undefined
      );
      setGeneratedPdfBlob(res.pdfBlob);
    } catch (err) {
      console.error('Error generando PDF escaneado:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Ocurrió un error durante la generación del PDF escaneado: ${msg}`);
    }
  };

  // Descarga directa del PDF escaneado
  const handleDownload = () => {
    if (!generatedPdfBlob) return;
    const url = URL.createObjectURL(generatedPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = sourceFileName.replace(/\.[^.]+$/i, '');
    a.download = `${baseName}_escaneado.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Guardar en la Biblioteca de Soportes
  const handleSaveToLibrary = async () => {
    if (!generatedPdfBlob) return;
    setIsSavingToLibrary(true);

    try {
      const baseName = sourceFileName.replace(/\.[^.]+$/i, '');
      const newFileName = `${baseName}_escaneado.pdf`;

      await uploadDocumentoSoporte({
        file: generatedPdfBlob,
        nombre: newFileName,
        categoria: 'Formulario Firmado',
        metadata: {
          paginas: totalPages,
          efecto_escaner_aplicado: true,
          dpi: options.dpi,
          notas: `Procesado con LookScanned Engine (${options.colorMode.toUpperCase()})`
        }
      });

      setSavedSuccess(true);
      if (onSavedToLibrary) {
        onSavedToLibrary();
      }
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Error guardando en biblioteca:', err);
      alert('No se pudo guardar el archivo en la biblioteca de soportes.');
    } finally {
      setIsSavingToLibrary(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#070d17] text-slate-100 select-none overflow-hidden">
      
      {/* ── TOP BAR: Información del documento y acciones ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-[#091322] px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Scan className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-bold tracking-wide text-white">LookScanned Studio</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                100% Client-Side
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Transforma PDFs en documentos de escáner realistas con grano, rotación e imperfecciones analógicas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Metadata del archivo fuente */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-800 bg-[#060c18] px-3 py-1 text-xs text-slate-300">
            <FileText className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-medium truncate max-w-[180px]">{sourceFileName}</span>
            <span className="text-[10px] text-slate-500">({fileSizeText})</span>
          </div>

          <button
            onClick={resetOptions}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
            title="Restablecer ajustes por defecto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Restablecer</span>
          </button>

          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-400 hover:border-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── CUERPO PRINCIPAL: Panel de Ajustes (Izquierda) + Visor de Páginas (Derecha) ── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* PANEL LATERAL DE CONFIGURACIÓN (Estilo LookScanned exacto) */}
        <aside className="w-80 shrink-0 border-r border-slate-800 bg-[#091322] flex flex-col justify-between overflow-y-auto">
          <div className="p-4 space-y-3">
            
            {/* Acordeón 1: Configuración de Escaneo */}
            <div className="rounded-2xl border border-slate-800 bg-[#0b172a] overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === 'scan' ? 'scan' : 'scan')}
                className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold text-slate-200 hover:bg-slate-800/40"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Configuración de escaneo</span>
                </div>
                <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <div className="p-4 pt-1 space-y-4 border-t border-slate-800/80 text-xs">
                
                {/* 1. Espacio de Color & Borde */}
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                      Espacio de color
                    </label>
                    <div className="flex rounded-xl bg-[#060c18] p-1 border border-slate-800">
                      {(['bw', 'grayscale', 'color'] as ScanColorMode[]).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => updateOption('colorMode', mode)}
                          className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition-colors ${
                            options.colorMode === mode
                              ? 'bg-cyan-500 text-slate-950 shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {mode === 'bw' ? 'B/N' : mode === 'grayscale' ? 'Gris' : 'Color'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                      Borde de tapa
                    </label>
                    <button
                      type="button"
                      onClick={() => updateOption('borderShadow', !options.borderShadow)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-1.5 border transition-colors ${
                        options.borderShadow
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                          : 'border-slate-800 bg-[#060c18] text-slate-400'
                      }`}
                    >
                      <span className="font-semibold text-[11px]">Sombra</span>
                      <div className={`h-4 w-7 rounded-full transition-colors relative p-0.5 ${
                        options.borderShadow ? 'bg-cyan-500' : 'bg-slate-700'
                      }`}>
                        <div className={`h-3 w-3 rounded-full bg-white transition-transform ${
                          options.borderShadow ? 'translate-x-3' : 'translate-x-0'
                        }`} />
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Rotación base (-5° a 5°) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-300">Rotar</span>
                    <span className="font-mono text-cyan-400">{options.rotation.toFixed(2)}°</span>
                  </div>
                  <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.05"
                    value={options.rotation}
                    onChange={e => updateOption('rotation', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* 3. Varianza de rotación por página (0° a 5°) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-300">Varianza de rotación (ADF)</span>
                    <span className="font-mono text-cyan-400">{options.rotationVariance.toFixed(2)}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={options.rotationVariance}
                    onChange={e => updateOption('rotationVariance', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* 4. Brillo (-100 a 100) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-300">Brillo</span>
                    <span className="font-mono text-cyan-400">{options.brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={options.brightness}
                    onChange={e => updateOption('brightness', parseInt(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* 5. Contraste (-100 a 100) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-300">Contraste</span>
                    <span className="font-mono text-cyan-400">{options.contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={options.contrast}
                    onChange={e => updateOption('contrast', parseInt(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* 6. Desenfoque (0 a 3px) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-300">Desenfoque óptico</span>
                    <span className="font-mono text-cyan-400">{options.blur.toFixed(1)} px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={options.blur}
                    onChange={e => updateOption('blur', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* 7. Ruido / Grano (0% a 100%) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-300">Ruido analógico</span>
                    <span className="font-mono text-cyan-400">{options.noise}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={options.noise}
                    onChange={e => updateOption('noise', parseInt(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* 8. Amarillento / Papel envejecido (0% a 100%) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-300">Amarillento (Papel/Lámpara)</span>
                    <span className="font-mono text-cyan-400">{options.yellowing}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={options.yellowing}
                    onChange={e => updateOption('yellowing', parseInt(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* 9. Resolución DPI */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                    <span className="text-slate-300">Resolución de salida</span>
                    <span className="font-mono text-[#c4d600]">{options.dpi} DPI</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[72, 150, 300].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => updateOption('dpi', d as ScanFilterOptions['dpi'])}
                        className={`rounded-xl py-1.5 text-xs font-bold border transition-colors ${
                          options.dpi === d
                            ? 'border-[#c4d600] bg-[#c4d600]/15 text-[#c4d600]'
                            : 'border-slate-800 bg-[#060c18] text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {d} DPI
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Acordeones secundarios informativos / expansibles */}
            <div className="rounded-2xl border border-slate-800 bg-[#0b172a] p-3 text-xs text-slate-400">
              <div className="flex items-center justify-between font-bold text-slate-300">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-slate-400" />
                  <span>Configuración de papel</span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">A4 / Auto</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0b172a] p-3 text-xs text-slate-400">
              <div className="flex items-center justify-between font-bold text-slate-300">
                <div className="flex items-center gap-2">
                  <Stamp className="h-3.5 w-3.5 text-slate-400" />
                  <span>Firmas y sellos</span>
                </div>
                <span className="text-[10px] text-slate-500">Conservados</span>
              </div>
            </div>

          </div>

          {/* ── BOTÓN PRINCIPAL DE GENERACIÓN (Estilo LookScanned verde esmeralda/lima) ── */}
          <div className="p-4 border-t border-slate-800/80 bg-[#060c18] space-y-2.5">
            {isProcessing && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
                  <span>{progress.statusText}</span>
                  <span className="font-mono">{progress.currentPage}/{progress.totalPages}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-400 to-[#c4d600]"
                    style={{
                      width: `${progress.totalPages > 0 ? (progress.currentPage / progress.totalPages) * 100 : 10}%`
                    }}
                  />
                </div>
              </div>
            )}

            {!generatedPdfBlob ? (
              <button
                type="button"
                disabled={isProcessing || !fileBytes}
                onClick={handleGenerateScannedPDF}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#c4d600] py-3.5 text-xs font-black text-[#0b132b] shadow-xl hover:bg-[#d6e800] active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Scan className="h-4 w-4" />
                {isProcessing ? 'Procesando páginas...' : 'Generar PDF escaneado'}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 p-2 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>¡Documento escaneado listo!</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-cyan-300 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Descargar
                  </button>

                  <button
                    type="button"
                    disabled={isSavingToLibrary || savedSuccess}
                    onClick={handleSaveToLibrary}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-100 hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    <FolderPlus className="h-4 w-4 text-[#c4d600]" />
                    {savedSuccess ? 'Guardado' : 'A Soportes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── VISOR CENTRAL: Vista previa interactiva de la página ── */}
        <main className="flex-1 flex flex-col bg-[#050a14] overflow-hidden">
          
          {/* Barra de control del visor */}
          <div className="flex h-11 items-center justify-between border-b border-slate-800/80 bg-[#070e1c] px-6 text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-400">Modo de visualización:</span>
              <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    viewMode === 'split' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Original vs Escaneado
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('scanned_only')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    viewMode === 'scanned_only' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Solo Escaneado
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                Página <strong className="text-white">{currentPage}</strong> de {totalPages}
              </span>
            </div>
          </div>

          {/* Área de Canvases con sombra de papel realista */}
          <div className="flex-1 overflow-auto p-6 flex items-center justify-center gap-6">
            
            {/* Vista Original (Solo si split está activo) */}
            {viewMode === 'split' && (
              <div className="flex flex-col items-center">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Documento Original (Vectorial / Limpio)
                </div>
                <div className="relative rounded-lg bg-white shadow-2xl p-1 max-h-[70vh] flex items-center justify-center overflow-hidden border border-slate-700">
                  <canvas
                    ref={originalCanvasRef}
                    className="max-h-[68vh] max-w-full object-contain block"
                  />
                </div>
              </div>
            )}

            {/* Vista Previa Escaneada con Filtros en Vivo */}
            <div className="flex flex-col items-center">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" />
                Efecto Escaneado en Tiempo Real (LookScanned)
              </div>
              <div className="relative rounded-lg bg-[#ffffff] shadow-[0_25px_60px_rgba(0,0,0,0.8)] p-1 max-h-[70vh] flex items-center justify-center overflow-hidden border border-slate-700 ring-1 ring-cyan-500/20">
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-[68vh] max-w-full object-contain block"
                />
              </div>
            </div>

          </div>

          {/* ── TIRA INFERIOR DE MINIATURAS (Estilo LookScanned) ── */}
          <div className="shrink-0 border-t border-slate-800 bg-[#08101e]">
            {/* Botón para ocultar/mostrar miniaturas y paginación */}
            <div className="flex h-9 items-center justify-between px-5 border-b border-slate-800/60 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1 rounded-md hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono text-[11px] text-slate-300">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1 rounded-md hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowThumbnails(!showThumbnails)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
              >
                <span>{showThumbnails ? 'Ocultar miniaturas' : 'Mostrar miniaturas'}</span>
                {showThumbnails ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </button>
            </div>

            {/* Tira horizontal de páginas */}
            <AnimatePresence>
              {showThumbnails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex gap-3 overflow-x-auto p-3"
                >
                  {thumbnails.map((thumb, idx) => {
                    const pageNum = idx + 1;
                    const isSelected = currentPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`group relative flex flex-col items-center rounded-xl p-1 border-2 transition-all ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-950/40 shadow-md shadow-cyan-500/20'
                            : 'border-slate-800 bg-[#060c18] hover:border-slate-700'
                        }`}
                      >
                        <div className="h-16 w-12 overflow-hidden rounded bg-white flex items-center justify-center">
                          <img
                            src={thumb}
                            alt={`Página ${pageNum}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className={`mt-1 font-mono text-[10px] font-bold ${
                          isSelected ? 'text-cyan-300' : 'text-slate-400'
                        }`}>
                          {pageNum}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </main>
      </div>

    </div>
  );
};

export default LookScannedStudio;
