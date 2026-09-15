import { useState, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import type { ScanFilterOptions, PageScanProgress } from '../types/soporte';
import { DEFAULT_SCAN_OPTIONS } from '../types/soporte';

// Asegurar configuración de PDF.js worker
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Mantener esta versión sincronizada con pdfEngine.ts para invalidar
  // respuestas del worker que hayan quedado cacheadas con un MIME incorrecto.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${pdfWorkerUrl}?v=20260915-1`;
}

/**
 * Generador pseudo-aleatorio determinista por página para varianza ADF realista
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999 + 1) * 10000;
  return x - Math.floor(x);
}

/**
 * Algoritmo OTSU para cálculo dinámico del umbral óptimo de binarización
 */
function calculateOtsuThreshold(grayData: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0);
  const totalPixels = grayData.length / 4;

  for (let i = 0; i < grayData.length; i += 4) {
    histogram[grayData[i]]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let weightB = 0;
  let maxVariance = 0;
  let optimalThreshold = 128;

  for (let t = 0; t < 256; t++) {
    weightB += histogram[t];
    if (weightB === 0) continue;

    const weightF = totalPixels - weightB;
    if (weightF === 0) break;

    sumB += t * histogram[t];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;

    const varianceBetween = weightB * weightF * Math.pow(meanB - meanF, 2);
    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      optimalThreshold = t;
    }
  }

  return optimalThreshold;
}

/**
 * Desenfoque rápido (Box Blur 2-pass) para suavizar bordes vectoriales hiper-perfectos
 */
function applyBoxBlur(imageData: ImageData, radius: number): void {
  if (radius <= 0) return;
  const pixels = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const rad = Math.min(Math.round(radius), 4);
  if (rad === 0) return;

  const copy = new Uint8ClampedArray(pixels);

  // Pase horizontal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let k = -rad; k <= rad; k++) {
        const nx = x + k;
        if (nx >= 0 && nx < width) {
          const idx = (y * width + nx) * 4;
          r += copy[idx];
          g += copy[idx + 1];
          b += copy[idx + 2];
          count++;
        }
      }
      const outIdx = (y * width + x) * 4;
      pixels[outIdx] = r / count;
      pixels[outIdx + 1] = g / count;
      pixels[outIdx + 2] = b / count;
    }
  }
}

/**
 * Aplica los filtros de escaneo LookScanned sobre el canvas suministrado
 */
export function applyScanFiltersToCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: ScanFilterOptions,
  pageIndex: number
): HTMLCanvasElement {
  const {
    colorMode,
    borderShadow,
    rotation,
    rotationVariance,
    brightness,
    contrast,
    blur,
    noise,
    yellowing
  } = options;

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // 1. Canvas temporal para transformaciones de píxeles
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return sourceCanvas;

  tempCtx.drawImage(sourceCanvas, 0, 0);

  const imgData = tempCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Pre-cálculo de contraste
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const noiseIntensity = (noise / 100) * 45;
  const yellowingFactor = yellowing / 100;

  // Pase 1: Escala de grises + Brillo + Contraste
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Escala de grises estándar Rec.709
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    if (colorMode === 'grayscale' || colorMode === 'bw') {
      r = gray;
      g = gray;
      b = gray;
    }

    // Contraste y Brillo
    r = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128 + brightness));
    g = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128 + brightness));
    b = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128 + brightness));

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  // Pase 2: Binarización OTSU si está en Blanco y Negro Puro
  if (colorMode === 'bw') {
    const threshold = calculateOtsuThreshold(data);
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const val = avg > threshold ? 255 : 18; // 18 en lugar de 0 para emular tinta de tóner
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }

  // Pase 3: Ruido / Grano & Tinte amarillento de papel
  if (noise > 0 || yellowing > 0) {
    for (let i = 0; i < data.length; i += 4) {
      // Inyección de ruido estático monocromático
      if (noise > 0) {
        const rand = (Math.random() - 0.5) * noiseIntensity;
        data[i] = Math.min(255, Math.max(0, data[i] + rand));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + rand));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + rand));
      }

      // Tinte papel bond / lámpara CCD
      if (yellowingFactor > 0 && colorMode !== 'bw') {
        const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (luma > 70) {
          // Afecta principalmente fondos y tonos medios
          const factor = (luma / 255) * yellowingFactor;
          data[i] = Math.min(255, data[i] + 24 * factor); // + Rojo
          data[i + 1] = Math.min(255, data[i + 1] + 16 * factor); // + Verde
          data[i + 2] = Math.max(0, data[i + 2] - 18 * factor); // - Azul (Amarillo cálido)
        }
      }
    }
  }

  // Pase 4: Desenfoque leve
  if (blur > 0) {
    applyBoxBlur(imgData, blur);
  }

  tempCtx.putImageData(imgData, 0, 0);

  // Pase 5: Sombra de borde / Border Shadow (Tapa de escáner)
  if (borderShadow) {
    tempCtx.save();
    // Borde izquierdo
    const gradLeft = tempCtx.createLinearGradient(0, 0, 32, 0);
    gradLeft.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    gradLeft.addColorStop(1, 'rgba(15, 23, 42, 0)');
    tempCtx.fillStyle = gradLeft;
    tempCtx.fillRect(0, 0, 32, height);

    // Borde superior
    const gradTop = tempCtx.createLinearGradient(0, 0, 0, 24);
    gradTop.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
    gradTop.addColorStop(1, 'rgba(15, 23, 42, 0)');
    tempCtx.fillStyle = gradTop;
    tempCtx.fillRect(0, 0, width, 24);

    // Borde derecho
    const gradRight = tempCtx.createLinearGradient(width - 24, 0, width, 0);
    gradRight.addColorStop(0, 'rgba(15, 23, 42, 0)');
    gradRight.addColorStop(1, 'rgba(15, 23, 42, 0.22)');
    tempCtx.fillStyle = gradRight;
    tempCtx.fillRect(width - 24, 0, 24, height);

    // Borde inferior
    const gradBottom = tempCtx.createLinearGradient(0, height - 24, 0, height);
    gradBottom.addColorStop(0, 'rgba(15, 23, 42, 0)');
    gradBottom.addColorStop(1, 'rgba(15, 23, 42, 0.22)');
    tempCtx.fillStyle = gradBottom;
    tempCtx.fillRect(0, height - 24, width, 24);
    tempCtx.restore();
  }

  // Pase 6: Rotación e Inclinación con Varianza ADF
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = height;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) return tempCanvas;

  // Fondo blanco papel base
  finalCtx.fillStyle = yellowing > 15 ? '#faf8f2' : '#ffffff';
  finalCtx.fillRect(0, 0, width, height);

  // Calcular ángulo total: base + varianza
  const varianceDelta = (seededRandom(pageIndex + 1) - 0.5) * 2 * rotationVariance;
  const totalAngleDeg = rotation + varianceDelta;
  const rad = (totalAngleDeg * Math.PI) / 180;

  finalCtx.save();
  finalCtx.translate(width / 2, height / 2);
  finalCtx.rotate(rad);
  finalCtx.drawImage(tempCanvas, -width / 2, -height / 2);
  finalCtx.restore();

  return finalCanvas;
}

export function useScanEffect() {
  const [options, setOptions] = useState<ScanFilterOptions>(DEFAULT_SCAN_OPTIONS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<PageScanProgress>({
    currentPage: 0,
    totalPages: 0,
    phase: 'idle',
    statusText: 'Listo'
  });

  const abortControllerRef = useRef<boolean>(false);

  /**
   * Procesa un archivo PDF o Imagen y genera un nuevo PDF compilado con efecto escáner
   */
  const processDocumentToScannedPDF = useCallback(async (
    source: File | Blob | Uint8Array | string,
    customOptions?: Partial<ScanFilterOptions>,
    existingPdfDoc?: pdfjsLib.PDFDocumentProxy
  ): Promise<{
    pdfBlob: Blob;
    pdfBytes: Uint8Array;
    pdfBase64: string;
    totalPages: number;
    previewDataUrl: string;
  }> => {
    setIsProcessing(true);
    abortControllerRef.current = false;
    const finalOptions: ScanFilterOptions = { ...options, ...(customOptions || {}) };

    try {
      let pdf: pdfjsLib.PDFDocumentProxy;

      if (existingPdfDoc) {
        pdf = existingPdfDoc;
      } else {
        // 1. Convertir origen a Uint8Array
        let sourceBytes: Uint8Array;
        if (typeof source === 'string') {
          const clean = source.replace(/^data:[^;]+;base64,/, '');
          const binary = atob(clean);
          sourceBytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            sourceBytes[i] = binary.charCodeAt(i);
          }
        } else if (source instanceof Blob) {
          sourceBytes = new Uint8Array(await source.arrayBuffer());
        } else {
          sourceBytes = source;
        }

        setProgress({
          currentPage: 0,
          totalPages: 0,
          phase: 'rendering',
          statusText: 'Cargando documento...'
        });

        // Clonar búfer para evitar desprendimiento en Web Worker
        const dataCopy = new Uint8Array(sourceBytes.slice(0));
        const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
        pdf = await loadingTask.promise;
      }

      const numPages = pdf.numPages;
      const dpiScale = finalOptions.dpi === 300 ? 3.0 : finalOptions.dpi === 150 ? 1.8 : 1.0;

      // 3. Documento de salida con pdf-lib
      const outputPdf = await PDFDocument.create();
      let firstPagePreview = '';

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (abortControllerRef.current) {
          throw new Error('Procesamiento cancelado por el usuario');
        }

        setProgress({
          currentPage: pageNum,
          totalPages: numPages,
          phase: 'rendering',
          statusText: `Rasterizando página ${pageNum} de ${numPages}...`
        });

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: dpiScale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) continue;

        // Renderizado base de la página vectorial
        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;

        // 4. Aplicar filtros LookScanned sobre el canvas
        setProgress({
          currentPage: pageNum,
          totalPages: numPages,
          phase: 'filtering',
          statusText: `Aplicando imperfecciones y textura (Página ${pageNum})...`
        });

        const treatedCanvas = applyScanFiltersToCanvas(canvas, finalOptions, pageNum - 1);

        // 5. Compresión JPEG típica de escáner
        setProgress({
          currentPage: pageNum,
          totalPages: numPages,
          phase: 'compressing',
          statusText: `Comprimiendo imagen de escáner (Página ${pageNum})...`
        });

        const jpegDataUrl = treatedCanvas.toDataURL('image/jpeg', finalOptions.compressionQuality);
        if (pageNum === 1) {
          firstPagePreview = jpegDataUrl;
        }

        // 6. Incrustar en el PDF final respetando dimensiones
        const cleanBase64 = jpegDataUrl.replace(/^data:image\/jpeg;base64,/, '');
        const binaryStr = atob(cleanBase64);
        const imgBytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          imgBytes[j] = binaryStr.charCodeAt(j);
        }

        const embeddedJpg = await outputPdf.embedJpg(imgBytes);
        const origViewport = page.getViewport({ scale: 1.0 });

        const newPdfPage = outputPdf.addPage([origViewport.width, origViewport.height]);
        newPdfPage.drawImage(embeddedJpg, {
          x: 0,
          y: 0,
          width: origViewport.width,
          height: origViewport.height
        });
      }

      // 7. Compilar PDF final
      setProgress({
        currentPage: numPages,
        totalPages: numPages,
        phase: 'assembling',
        statusText: 'Reensamblando PDF escaneado...'
      });

      const pdfBytes = await outputPdf.save();
      const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });

      // Generar base64 en bloques seguros
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < pdfBytes.length; i += chunkSize) {
        const chunk = pdfBytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      const pdfBase64 = `data:application/pdf;base64,${btoa(binary)}`;

      setProgress({
        currentPage: numPages,
        totalPages: numPages,
        phase: 'done',
        statusText: '¡PDF escaneado exitosamente!'
      });

      return {
        pdfBlob,
        pdfBytes,
        pdfBase64,
        totalPages: numPages,
        previewDataUrl: firstPagePreview
      };
    } finally {
      setIsProcessing(false);
    }
  }, [options]);

  const cancelProcessing = useCallback(() => {
    abortControllerRef.current = true;
    setIsProcessing(false);
    setProgress(prev => ({ ...prev, phase: 'idle', statusText: 'Cancelado' }));
  }, []);

  const updateOption = useCallback(<K extends keyof ScanFilterOptions>(
    key: K,
    val: ScanFilterOptions[K]
  ) => {
    setOptions(prev => ({ ...prev, [key]: val }));
  }, []);

  const resetOptions = useCallback(() => {
    setOptions(DEFAULT_SCAN_OPTIONS);
  }, []);

  return {
    options,
    setOptions,
    updateOption,
    resetOptions,
    isProcessing,
    progress,
    processDocumentToScannedPDF,
    cancelProcessing
  };
}

export default useScanEffect;
