import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2,
  Square,
  ZoomIn,
  ZoomOut,
  Save,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Search,
  Check,
  CheckSquare,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FileSpreadsheet,
  Grid,
  Magnet,
  Copy,
  ClipboardCopy,
  ClipboardPaste,
  Type,
  Rows3,
  Stamp,
  Code2,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
} from 'lucide-react';
import {
  renderPDFPageToCanvas,
  pdfToCanvasCoords,
  getPDFPageCount,
  generatePDFThumbnail,
  imageToPDF,
  inspectPDFTemplate,
} from '../../lib/pdfEngine';
import { findCatalogField, searchCatalogFields } from '../../lib/fieldCatalog';
import { normalizeCheckboxCharacter, normalizeTemplate, validateFormTemplate } from '../../lib/templateValidation';
import { formatDateValue } from '../../lib/mappingUtils';
import { stampPresetRepository } from '../../lib/backendRepository';
import type {
  FormTemplate,
  PDFMappedField,
  DesignerTool,
  FieldDataSource,
  EntityType,
  PDFFieldType,
  StampPreset,
} from '../../types/formularios';

// ============================================================
// PREFERENCIAS DE FUENTE POR DEFECTO
// ============================================================

interface FontDefaults {
  fontSize: number;
  fontFamily: 'helvetica' | 'courier' | 'times';
  bold: boolean;
}

const FONT_DEFAULTS_KEY = 'validum_font_defaults_v1';

const DEFAULT_FONT: FontDefaults = { fontSize: 10, fontFamily: 'helvetica', bold: true };

function loadFontDefaults(): FontDefaults {
  try {
    const raw = localStorage.getItem(FONT_DEFAULTS_KEY);
    if (!raw) return { ...DEFAULT_FONT };
    const parsed = JSON.parse(raw) as Partial<FontDefaults>;
    return {
      fontSize: Math.max(4, Math.min(72, Number(parsed.fontSize) || DEFAULT_FONT.fontSize)),
      fontFamily: (['helvetica', 'courier', 'times'] as const).includes(parsed.fontFamily as any)
        ? (parsed.fontFamily as FontDefaults['fontFamily'])
        : DEFAULT_FONT.fontFamily,
      bold: typeof parsed.bold === 'boolean' ? parsed.bold : DEFAULT_FONT.bold,
    };
  } catch {
    return { ...DEFAULT_FONT };
  }
}

function saveFontDefaults(defaults: FontDefaults): void {
  try {
    localStorage.setItem(FONT_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // localStorage lleno o no disponible — silenciar
  }
}

interface PDFTemplateDesignerProps {
  template?: FormTemplate;
  onSave: (template: FormTemplate) => void;
  onCancel: () => void;
}

function hexToRgba(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  const numeric = Number.parseInt(value, 16);
  return `rgba(${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}, ${Math.max(0, Math.min(1, opacity))})`;
}

export const PDFTemplateDesigner: React.FC<PDFTemplateDesignerProps> = ({
  template,
  onSave,
  onCancel,
}) => {
  // --- PDF & Template State ---
  const [pdfData, setPdfData] = useState<string | null>(template?.pdfBase64 || null);
  const [pdfAssetPath, setPdfAssetPath] = useState<string | undefined>(template?.pdfAssetPath);
  const [isLoadingBasePdf, setIsLoadingBasePdf] = useState<boolean>(Boolean(template?.pdfAssetPath && !template?.pdfBase64));
  const [basePdfError, setBasePdfError] = useState<string>('');
  const [basePdfLoadAttempt, setBasePdfLoadAttempt] = useState(0);
  const [pdfFileName, setPdfFileName] = useState<string>(template?.pdfFileName || 'formulario.pdf');
  const [pageCount, setPageCount] = useState<number>(template?.totalPages || 1);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.25);
  const [fields, setFields] = useState<PDFMappedField[]>(
    template ? normalizeTemplate(template).fields : []
  );
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // --- Grid & Smart Alignment State ---
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(0.5);
  const [clipboardField, setClipboardField] = useState<PDFMappedField | null>(null);
  const [rowCount, setRowCount] = useState<number>(4);
  const [rowGap, setRowGap] = useState<number>(2);
  const [styleScope, setStyleScope] = useState<'selected' | 'page' | 'template'>('selected');
  const [stampPresets, setStampPresets] = useState<StampPreset[]>([]);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [mappingJson, setMappingJson] = useState('');
  const [mappingJsonError, setMappingJsonError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);

  // --- Font Defaults State ---
  const [fontDefaults, setFontDefaults] = useState<FontDefaults>(loadFontDefaults);
  const [showFontDefaults, setShowFontDefaults] = useState(false);

  const updateFontDefault = (updates: Partial<FontDefaults>) => {
    setFontDefaults(prev => {
      const next = { ...prev, ...updates };
      saveFontDefaults(next);
      return next;
    });
  };

  // --- Dimension State for Coordinate Mapping ---
  const [pdfDim, setPdfDim] = useState<{ width: number; height: number }>({ width: 612, height: 792 });
  const [viewportDim, setViewportDim] = useState<{ width: number; height: number }>({ width: 612, height: 792 });

  // --- Interaction State ---
  const [activeTool, setActiveTool] = useState<DesignerTool>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Dragging existing field on canvas ---
  const [isDraggingField, setIsDraggingField] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{
    mouseX: number;
    mouseY: number;
    fieldX: number;
    fieldY: number;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    fieldId: string;
    handle: 'nw' | 'ne' | 'sw' | 'se';
    mouseX: number;
    mouseY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // --- Metadata State ---
  const [name, setName] = useState(template?.name || '');
  const [entity, setEntity] = useState(template?.entity || 'Famisanar');
  const [entityType, setEntityType] = useState<EntityType>(template?.entityType || 'EPS');
  const [formType, setFormType] = useState(template?.formType || 'Afiliación');
  const [description, setDescription] = useState(template?.description || '');
  const [mappingStatus, setMappingStatus] = useState<'draft' | 'ready'>(
    template?.mappingStatus || (template?.fields.length ? 'ready' : 'draft')
  );

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const designerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stampPresetRepository.list()
      .then((items) => setStampPresets(items.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((error) => console.error('No se pudo cargar la biblioteca de sellos:', error));
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === designerRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleEscapeFallback = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', handleEscapeFallback);
    return () => document.removeEventListener('keydown', handleEscapeFallback);
  }, [isFullscreen]);

  // El ancho útil cambia al plegar el panel o entrar en pantalla completa.
  // Ajustamos el documento a ese ancho después de que termine la transición del layout.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!containerRef.current || !pdfDim.width) return;
      const availableWidth = Math.max(320, containerRef.current.clientWidth - 48);
      setZoom(Math.max(0.5, Math.min(2.5, Number((availableWidth / pdfDim.width).toFixed(2)))));
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [isPropertiesCollapsed, isFullscreen, pdfDim.width]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (isFullscreen) {
        setIsFullscreen(false);
      } else if (designerRef.current) {
        await designerRef.current.requestFullscreen();
      }
    } catch {
      // Electron, iframes o pruebas automatizadas pueden restringir Fullscreen API.
      // La vista sin bordes mantiene la misma experiencia y también responde a Esc.
      setIsFullscreen(true);
    }
  };

  // Las plantillas incluidas con Validum conservan el PDF mediante una ruta interna.
  // Al editarlas cargamos automáticamente ese mismo formulario; nunca se obliga a subirlo otra vez.
  useEffect(() => {
    if (pdfData || !pdfAssetPath) return;
    let active = true;
    setIsLoadingBasePdf(true);
    setBasePdfError('');

    fetch(pdfAssetPath)
      .then((response) => {
        if (!response.ok) throw new Error(`No se encontró el PDF base (${response.status}).`);
        return response.blob();
      })
      .then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).replace(/^data:application\/pdf;base64,/, ''));
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer el PDF base.'));
        reader.readAsDataURL(blob);
      }))
      .then((base64) => {
        if (active) setPdfData(base64);
      })
      .catch((error) => {
        if (active) setBasePdfError(error instanceof Error ? error.message : 'No se pudo abrir el PDF base guardado.');
      })
      .finally(() => {
        if (active) setIsLoadingBasePdf(false);
      });

    return () => {
      active = false;
    };
  }, [pdfAssetPath, pdfData, basePdfLoadAttempt]);

  // Initialize Page Count
  useEffect(() => {
    if (pdfData) {
      getPDFPageCount(pdfData)
        .then((count) => setPageCount(count))
        .catch((err) => console.error('Error getting page count:', err));
    }
  }, [pdfData]);

  // Render PDF Page onto Canvas
  useEffect(() => {
    let isActive = true;
    const render = async () => {
      if (!pdfData || !canvasRef.current) return;
      try {
        const result = await renderPDFPageToCanvas(pdfData, currentPage + 1, zoom);
        if (!isActive || !canvasRef.current) return;

        const canvas = canvasRef.current;
        canvas.width = result.canvas.width;
        canvas.height = result.canvas.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(result.canvas, 0, 0);
        }

        setPdfDim({ width: result.pdfWidth, height: result.pdfHeight });
        setViewportDim({ width: result.viewport.width, height: result.viewport.height });

        if (overlayRef.current) {
          overlayRef.current.style.width = `${result.viewport.width}px`;
          overlayRef.current.style.height = `${result.viewport.height}px`;
        }
      } catch (err) {
        console.error('Error rendering PDF:', err);
        if (isActive) {
          setBasePdfError(err instanceof Error
            ? `El visor no pudo dibujar el PDF: ${err.message}`
            : 'El visor no pudo dibujar el PDF guardado.');
        }
      }
    };

    render();
    return () => {
      isActive = false;
    };
  }, [pdfData, currentPage, zoom]);

  // --- KeyDown Listener for Delete and Arrow Nudges ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldId) {
        e.preventDefault();
        deleteField(selectedFieldId);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedFieldId) {
        e.preventDefault();
        const selected = fields.find((field) => field.id === selectedFieldId);
        if (selected) setClipboardField(structuredClone(selected));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboardField) {
        e.preventDefault();
        const pasted: PDFMappedField = {
          ...structuredClone(clipboardField),
          id: crypto.randomUUID(),
          page: currentPage,
          x: Math.max(0, Math.min(pdfDim.width - clipboardField.width, clipboardField.x + gridSize * 2)),
          y: Math.max(0, Math.min(pdfDim.height - clipboardField.height, clipboardField.y - gridSize * 2)),
          label: clipboardField.label.endsWith(' (Copia)') ? clipboardField.label : `${clipboardField.label} (Copia)`,
        };
        setFields((prev) => [...prev, pasted]);
        setSelectedFieldId(pasted.id);
        setClipboardField(pasted);
        return;
      }

      if (selectedFieldId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.25;
        setFields((prev) =>
          prev.map((f) => {
            if (f.id !== selectedFieldId) return f;
            let newX = f.x;
            let newY = f.y;
            if (e.key === 'ArrowUp') newY += step;
            if (e.key === 'ArrowDown') newY -= step;
            if (e.key === 'ArrowLeft') newX -= step;
            if (e.key === 'ArrowRight') newX += step;
            return {
              ...f,
              x: Math.max(0, Math.min(pdfDim.width - f.width, newX)),
              y: Math.max(0, Math.min(pdfDim.height - f.height, newY)),
            };
          })
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clipboardField, currentPage, fields, gridSize, pdfDim.height, pdfDim.width, selectedFieldId]);

  // Helper: Snap to Canvas Grid from Top-Left (Exact alignment with CSS background grid)
  const snapValTop = (canvasCoordPx: number, stepPt: number = gridSize): number => {
    const pt = canvasCoordPx / zoom;
    if (!snapToGrid) return pt;
    return Math.round(pt / stepPt) * stepPt;
  };

  // Helper: Snap points dimension
  const snapDimPt = (dimPx: number, stepPt: number = gridSize): number => {
    const pt = dimPx / zoom;
    if (!snapToGrid) return pt;
    return Math.max(stepPt, Math.round(pt / stepPt) * stepPt);
  };

  // Delete a field by ID
  const deleteField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  // Clean all checkboxes across template
  const cleanAllCheckboxes = () => {
    const count = fields.filter((f) => f.fieldType === 'checkbox').length;
    if (count === 0) {
      alert('No hay casillas de check en esta plantilla.');
      return;
    }
    if (window.confirm(`¿Deseas eliminar todas las ${count} casillas de Check de esta plantilla? Podrás crearlas limpiamente una a una.`)) {
      setFields((prev) => prev.filter((f) => f.fieldType !== 'checkbox'));
      if (selectedField?.fieldType === 'checkbox') {
        setSelectedFieldId(null);
      }
    }
  };

  // Clean current page fields
  const cleanCurrentPage = () => {
    const count = fields.filter((f) => f.page === currentPage).length;
    if (count === 0) {
      alert(`No hay campos en la Página ${currentPage + 1}.`);
      return;
    }
    if (window.confirm(`¿Deseas eliminar todos los ${count} campos de la Página ${currentPage + 1}?`)) {
      setFields((prev) => prev.filter((f) => f.page !== currentPage));
      setSelectedFieldId(null);
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfFileName(file.name);
    setPdfAssetPath(undefined);
    setBasePdfError('');
    try {
      if (file.type === 'image/png' || file.type === 'image/jpeg') {
        const reader = new FileReader();
        const rawBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen.'));
          reader.readAsDataURL(file);
        });
        const mime = file.type as 'image/png' | 'image/jpeg';
        const convertedPdf = await imageToPDF(rawBase64, mime);
        setPdfData(convertedPdf);
        setFields([]);
        setMappingStatus('draft');
        setCurrentPage(0);
        if (!name) setName(file.name.replace(/\.[^/.]+$/, ''));
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const inspection = await inspectPDFTemplate(base64);
        if (inspection.populatedAcroFieldCount > 0) {
          throw new Error(`El PDF contiene ${inspection.populatedAcroFieldCount} campos interactivos ya diligenciados. Usa una copia oficial limpia.`);
        }
        setPdfData(base64);
        setMappingStatus('draft');
        setPageCount(inspection.pageCount);
        if (inspection.acroFields.length) {
          setFields(inspection.acroFields.map((item) => {
            const fieldType: PDFFieldType = item.type === 'checkbox' ? 'checkbox' : 'text';
            return {
              id: crypto.randomUUID(),
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height,
              page: item.page,
              dataSource: 'manual',
              fieldKey: `acro_${item.name}`,
              label: item.name,
              fontSize: Math.max(6, Math.min(fontDefaults.fontSize, item.height * 0.65)),
              fontFamily: fontDefaults.fontFamily,
              alignment: fieldType === 'checkbox' ? 'center' : 'left',
              verticalAlignment: 'middle',
              bold: false,
              uppercase: false,
              color: '#000000',
              fieldType,
              checkboxCharacter: fieldType === 'checkbox' ? 'X' : undefined,
              checkboxRule: fieldType === 'checkbox' ? { mode: 'manual' } : undefined,
              isCharacterByCharacter: item.combed || false,
              characterCount: item.combed ? item.maxLength : undefined,
              maxLength: item.maxLength,
              padding: 1,
              overflowPolicy: 'error',
              minFontSize: 6,
              // Se dibuja como overlay para respetar exactamente fuente, tamaño y alineación.
              acroFieldName: undefined,
              required: false,
            };
          }));
        } else {
          setFields([]);
        }
        setCurrentPage(0);
        if (!name) setName(file.name.replace(/\.[^/.]+$/, ''));
      } else {
        throw new Error('Solo se admiten PDF, PNG y JPEG.');
      }
    } catch (err) {
      console.error('Error cargando archivo:', err);
      alert(err instanceof Error ? err.message : 'Error cargando el archivo.');
    }
  };

  // Drawing Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== 'draw' || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!overlayRef.current) return;

    if (resizeState) {
      const deltaX = (e.clientX - resizeState.mouseX) / zoom;
      const deltaY = (e.clientY - resizeState.mouseY) / zoom;
      const minimumSize = 2;
      const fixedRight = resizeState.x + resizeState.width;
      const fixedTop = resizeState.y + resizeState.height;
      let x = resizeState.x;
      let y = resizeState.y;
      let width = resizeState.width;
      let height = resizeState.height;

      if (resizeState.handle.includes('e')) {
        width = Math.max(minimumSize, Math.min(pdfDim.width - resizeState.x, resizeState.width + deltaX));
      }
      if (resizeState.handle.includes('w')) {
        x = Math.max(0, Math.min(fixedRight - minimumSize, resizeState.x + deltaX));
        width = fixedRight - x;
      }
      if (resizeState.handle.includes('s')) {
        y = Math.max(0, Math.min(fixedTop - minimumSize, resizeState.y - deltaY));
        height = fixedTop - y;
      }
      if (resizeState.handle.includes('n')) {
        height = Math.max(minimumSize, Math.min(pdfDim.height - resizeState.y, resizeState.height - deltaY));
      }

      if (snapToGrid) {
        if (resizeState.handle.includes('w')) {
          x = Math.max(0, Math.min(fixedRight - minimumSize, Math.round(x / gridSize) * gridSize));
          width = fixedRight - x;
        } else width = Math.max(minimumSize, Math.round(width / gridSize) * gridSize);
        if (resizeState.handle.includes('s')) {
          y = Math.max(0, Math.min(fixedTop - minimumSize, Math.round(y / gridSize) * gridSize));
          height = fixedTop - y;
        } else height = Math.max(minimumSize, Math.round(height / gridSize) * gridSize);
      }
      width = Math.min(width, pdfDim.width - x);
      height = Math.min(height, pdfDim.height - y);

      setFields((prev) => prev.map((field) => field.id === resizeState.fieldId
        ? { ...field, x, y, width, height }
        : field));
      return;
    }

    // Handle Dragging existing field
    if (isDraggingField && selectedFieldId && dragStartPos) {
      const deltaX = (e.clientX - dragStartPos.mouseX) / zoom;
      const deltaY = (e.clientY - dragStartPos.mouseY) / zoom;

      let newX = dragStartPos.fieldX + deltaX;
      let newY = dragStartPos.fieldY - deltaY;

      if (snapToGrid) {
        const currentH = fields.find((f) => f.id === selectedFieldId)?.height || 12;
        const topPt = pdfDim.height - (newY + currentH);
        const snappedTopPt = Math.round(topPt / gridSize) * gridSize;
        newY = pdfDim.height - snappedTopPt - currentH;
        newX = Math.round(newX / gridSize) * gridSize;
      }

      const current = fields.find((f) => f.id === selectedFieldId);
      if (current) {
        newX = Math.max(0, Math.min(pdfDim.width - current.width, newX));
        newY = Math.max(0, Math.min(pdfDim.height - current.height, newY));
      }

      setFields((prev) =>
        prev.map((f) => (f.id === selectedFieldId ? { ...f, x: newX, y: newY } : f))
      );
      return;
    }

    // Handle Drawing new field
    if (isDrawing && drawStart) {
      const rect = overlayRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDrawCurrent({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (resizeState) setResizeState(null);
    // Finish Dragging
    if (isDraggingField) {
      setIsDraggingField(false);
      setDragStartPos(null);
    }

    // Finish Drawing
    if (!isDrawing || !drawStart || !drawCurrent) {
      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    const canvasX = Math.min(drawStart.x, drawCurrent.x);
    const canvasY = Math.min(drawStart.y, drawCurrent.y);
    const canvasW = Math.abs(drawCurrent.x - drawStart.x);
    const canvasH = Math.abs(drawCurrent.y - drawStart.y);

    if (canvasW > 6 && canvasH > 6) {
      const leftPt = snapValTop(canvasX, gridSize);
      const topPt = snapValTop(canvasY, gridSize);
      const widthPt = snapDimPt(canvasW, gridSize);
      const heightPt = snapDimPt(canvasH, gridSize);

      const isCheckbox = widthPt <= 18 && heightPt <= 18;
      const finalW = isCheckbox ? 12 : widthPt;
      const finalH = isCheckbox ? 12 : heightPt;
      const rawX = leftPt;
      const rawY = pdfDim.height - topPt - finalH;

      const newField: PDFMappedField = {
        id: crypto.randomUUID(),
        x: rawX,
        y: rawY,
        width: finalW,
        height: finalH,
        page: currentPage,
        dataSource: 'manual',
        fieldKey: isCheckbox ? `manual_check_${crypto.randomUUID()}` : `manual_text_${crypto.randomUUID()}`,
        label: isCheckbox ? 'Casilla Check (X)' : 'Campo manual de texto',
        fontSize: isCheckbox ? Math.max(fontDefaults.fontSize, 10) : fontDefaults.fontSize,
        fontFamily: fontDefaults.fontFamily,
        alignment: isCheckbox ? 'center' : 'left',
        verticalAlignment: 'middle',
        bold: fontDefaults.bold,
        uppercase: true,
        color: '#000000',
        fieldType: isCheckbox ? 'checkbox' : 'text',
        checkboxCharacter: 'X',
        checkboxRule: isCheckbox ? { mode: 'manual' } : undefined,
        defaultValue: '',
        isCharacterByCharacter: false,
        padding: 1,
        overflowPolicy: 'error',
        minFontSize: 6,
        required: false,
      };

      setFields((prev) => [...prev, newField]);
      setSelectedFieldId(newField.id);
      setActiveTool('select');
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const updateSelectedField = (updates: Partial<PDFMappedField>) => {
    if (!selectedFieldId) return;
    setFields((prev) =>
      prev.map((f) => (f.id === selectedFieldId ? { ...f, ...updates } : f))
    );
  };

  const updateTextStyle = (updates: Partial<PDFMappedField>) => {
    if (!selectedFieldId) return;
    const selected = fields.find((field) => field.id === selectedFieldId);
    if (!selected) return;
    if (selected.fieldType === 'checkbox' || selected.fieldType === 'stamp' || styleScope === 'selected') {
      updateSelectedField(updates);
      return;
    }
    setFields((prev) => prev.map((field) => {
      const isText = field.fieldType !== 'checkbox' && field.fieldType !== 'stamp';
      const isTarget = isText && (styleScope === 'template' || field.page === selected.page);
      return isTarget ? { ...field, ...updates } : field;
    }));
  };

  const copySelectedField = () => {
    const selected = fields.find((field) => field.id === selectedFieldId);
    if (selected) setClipboardField(structuredClone(selected));
  };

  const pasteCopiedField = () => {
    if (!clipboardField) return;
    const pasted: PDFMappedField = {
      ...structuredClone(clipboardField),
      id: crypto.randomUUID(),
      page: currentPage,
      x: Math.max(0, Math.min(pdfDim.width - clipboardField.width, clipboardField.x + gridSize * 2)),
      y: Math.max(0, Math.min(pdfDim.height - clipboardField.height, clipboardField.y - gridSize * 2)),
      label: clipboardField.label.endsWith(' (Copia)') ? clipboardField.label : `${clipboardField.label} (Copia)`,
    };
    setFields((prev) => [...prev, pasted]);
    setSelectedFieldId(pasted.id);
    setClipboardField(pasted);
  };

  // Insert Generic Checkbox (The user configures and assigns manually)
  const insertGenericCheck = () => {
    const widthPt = 12;
    const heightPt = 12;
    // Align to center of current viewport
    const leftPt = Math.round((pdfDim.width / 2 - widthPt / 2) / gridSize) * gridSize;
    const topPt = Math.round((pdfDim.height / 2 - heightPt / 2) / gridSize) * gridSize;
    const rawY = pdfDim.height - topPt - heightPt;

    const newCheck: PDFMappedField = {
      id: crypto.randomUUID(),
      x: leftPt,
      y: rawY,
      width: widthPt,
      height: heightPt,
      page: currentPage,
      dataSource: 'manual',
      fieldKey: `manual_check_${crypto.randomUUID()}`,
      label: 'Casilla Check (X)',
      fontSize: Math.max(fontDefaults.fontSize, 10),
      fontFamily: fontDefaults.fontFamily,
      alignment: 'center',
      verticalAlignment: 'middle',
      bold: fontDefaults.bold,
      uppercase: true,
      color: '#000000',
      fieldType: 'checkbox',
      checkboxCharacter: 'X',
      checkboxRule: { mode: 'manual' },
      defaultValue: '',
      isCharacterByCharacter: false,
      padding: 1,
      overflowPolicy: 'error',
      minFontSize: 6,
      required: false,
    };

    setFields((prev) => [...prev, newCheck]);
    setSelectedFieldId(newCheck.id);
    setActiveTool('select');
  };

  // Insert Generic Text Field
  const insertGenericText = () => {
    const widthPt = 120;
    const heightPt = 14;
    const leftPt = Math.round((pdfDim.width / 2 - widthPt / 2) / gridSize) * gridSize;
    const topPt = Math.round((pdfDim.height / 2 - heightPt / 2) / gridSize) * gridSize;
    const rawY = pdfDim.height - topPt - heightPt;

    const newTextField: PDFMappedField = {
      id: crypto.randomUUID(),
      x: leftPt,
      y: rawY,
      width: widthPt,
      height: heightPt,
      page: currentPage,
      dataSource: 'cotizante',
      fieldKey: 'primerApellido',
      label: 'Primer Apellido',
      fontSize: fontDefaults.fontSize,
      fontFamily: fontDefaults.fontFamily,
      alignment: 'left',
      verticalAlignment: 'middle',
      bold: fontDefaults.bold,
      uppercase: true,
      color: '#000000',
      fieldType: 'text',
      isCharacterByCharacter: false,
      padding: 1,
      overflowPolicy: 'error',
      minFontSize: 6,
      required: false,
    };

    setFields((prev) => [...prev, newTextField]);
    setSelectedFieldId(newTextField.id);
    setActiveTool('select');
  };

  const insertStamp = () => {
    const widthPt = 120;
    const heightPt = 42;
    const x = Math.round((pdfDim.width / 2 - widthPt / 2) / gridSize) * gridSize;
    const top = Math.round((pdfDim.height / 2 - heightPt / 2) / gridSize) * gridSize;
    const stampField: PDFMappedField = {
      id: crypto.randomUUID(),
      x,
      y: pdfDim.height - top - heightPt,
      width: widthPt,
      height: heightPt,
      page: currentPage,
      dataSource: 'manual',
      fieldKey: `stamp_${crypto.randomUUID()}`,
      label: 'Sello RECIBIDO',
      fieldType: 'stamp',
      fontSize: Math.max(fontDefaults.fontSize, 12),
      fontFamily: fontDefaults.fontFamily,
      alignment: 'center',
      verticalAlignment: 'middle',
      bold: fontDefaults.bold,
      uppercase: true,
      color: '#B91C1C',
      stampText: 'RECIBIDO',
      stampSubtext: '',
      stampShape: 'rectangle',
      stampBorderColor: '#B91C1C',
      stampFillColor: '#FFFFFF',
      stampBorderWidth: 1.5,
      stampOpacity: 0.92,
      isCharacterByCharacter: false,
      padding: 3,
      overflowPolicy: 'shrink',
      minFontSize: 6,
      required: false,
    };
    setFields((prev) => [...prev, stampField]);
    setSelectedFieldId(stampField.id);
    setActiveTool('select');
  };

  // Auto-Alignment Actions
  const alignSelectedRow = () => {
    if (!selectedFieldId) return;
    const current = fields.find((f) => f.id === selectedFieldId);
    if (!current) return;

    const selectedCenter = current.y + current.height / 2;
    const tolerance = Math.max(3, current.height * 0.8);
    const rowIds = new Set(fields
      .filter((field) => field.page === current.page)
      .filter((field) => Math.abs((field.y + field.height / 2) - selectedCenter) <= tolerance)
      .map((field) => field.id));
    if (rowIds.size < 2) {
      alert('No encontré otra variable cercana en esta fila. Acércala verticalmente y vuelve a alinear.');
      return;
    }
    setFields((prev) => prev.map((field) => rowIds.has(field.id) ? {
      ...field,
      y: current.y,
      height: current.height,
      verticalAlignment: current.verticalAlignment,
      fontFamily: current.fontFamily,
      fontSize: current.fontSize,
      padding: current.padding,
    } : field));
  };

  const createAlignedRow = () => {
    const current = fields.find((field) => field.id === selectedFieldId);
    if (!current) return;
    const additions: PDFMappedField[] = [];
    for (let index = 1; index < Math.max(2, rowCount); index += 1) {
      const x = current.x + index * (current.width + Math.max(0, rowGap));
      if (x + current.width > pdfDim.width) break;
      additions.push({
        ...structuredClone(current),
        id: crypto.randomUUID(),
        x,
        label: `${current.label} (${index + 1})`,
      });
    }
    if (!additions.length) {
      alert('No hay espacio suficiente a la derecha para crear esta fila.');
      return;
    }
    setFields((prev) => [...prev, ...additions]);
    setSelectedFieldId(additions[additions.length - 1].id);
  };

  const saveSelectedStamp = async () => {
    const selected = fields.find((field) => field.id === selectedFieldId);
    if (!selected || selected.fieldType !== 'stamp') return;
    const preset: StampPreset = {
      id: crypto.randomUUID(),
      name: (selected.stampText || selected.label || 'Sello').trim(),
      stampText: (selected.stampText || 'SELLO').trim(),
      stampSubtext: selected.stampSubtext?.trim(),
      stampShape: selected.stampShape || 'rectangle',
      stampBorderColor: selected.stampBorderColor || '#B91C1C',
      stampFillColor: selected.stampFillColor || '#FFFFFF',
      stampBorderWidth: selected.stampBorderWidth ?? 1.5,
      stampOpacity: selected.stampOpacity ?? 0.92,
      fontFamily: selected.fontFamily,
      fontSize: selected.fontSize,
      bold: selected.bold,
      color: selected.color,
      createdAt: new Date().toISOString(),
    };
    try {
      await stampPresetRepository.save(preset);
      setStampPresets((prev) => [...prev, preset].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar el sello.');
    }
  };

  const applyStampPreset = (preset: StampPreset) => updateSelectedField({
    stampText: preset.stampText,
    stampSubtext: preset.stampSubtext,
    stampShape: preset.stampShape,
    stampBorderColor: preset.stampBorderColor,
    stampFillColor: preset.stampFillColor,
    stampBorderWidth: preset.stampBorderWidth,
    stampOpacity: preset.stampOpacity,
    fontFamily: preset.fontFamily,
    fontSize: preset.fontSize,
    bold: preset.bold,
    color: preset.color,
    label: `Sello ${preset.name}`,
  });

  const removeStampPreset = async (id: string) => {
    try {
      await stampPresetRepository.remove(id);
      setStampPresets((prev) => prev.filter((preset) => preset.id !== id));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo eliminar el sello.');
    }
  };

  const duplicateFieldHorizontally = () => {
    if (!selectedFieldId) return;
    const current = fields.find((f) => f.id === selectedFieldId);
    if (!current) return;

    const newField: PDFMappedField = {
      ...current,
      id: crypto.randomUUID(),
      x: Math.min(pdfDim.width - current.width, current.x + current.width + gridSize),
      label: `${current.label} (Copia)`,
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  const getEditableMappingDefinition = () => ({
    id: template?.id || 'nueva-plantilla',
    name,
    entity,
    entityType,
    formType,
    description,
    pdfFileName,
    pdfAssetPath,
    totalPages: pageCount,
    pageSizes: template?.pageSizes,
    layoutFingerprint: template?.layoutFingerprint,
    mappingStatus,
    version: template?.version || 0,
    fields,
  });

  const openJsonEditor = () => {
    setMappingJson(JSON.stringify(getEditableMappingDefinition(), null, 2));
    setMappingJsonError('');
    setShowJsonEditor(true);
  };

  const copyMappingJson = async () => {
    try {
      await navigator.clipboard.writeText(mappingJson);
    } catch {
      const helper = document.createElement('textarea');
      helper.value = mappingJson;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }
  };

  const applyMappingJson = () => {
    try {
      const parsed = JSON.parse(mappingJson) as Partial<FormTemplate>;
      if (!Array.isArray(parsed.fields)) {
        throw new Error('La propiedad "fields" debe ser una lista de campos.');
      }

      const candidate = normalizeTemplate({
        id: template?.id || crypto.randomUUID(),
        name: typeof parsed.name === 'string' ? parsed.name : name,
        entity: typeof parsed.entity === 'string' ? parsed.entity : entity,
        entityType: parsed.entityType || entityType,
        formType: typeof parsed.formType === 'string' ? parsed.formType : formType,
        description: typeof parsed.description === 'string' ? parsed.description : description,
        pdfBase64: pdfAssetPath ? '' : (pdfData || ''),
        pdfAssetPath,
        pdfFileName,
        totalPages: Number(parsed.totalPages) || pageCount,
        pageSizes: parsed.pageSizes || template?.pageSizes,
        layoutFingerprint: parsed.layoutFingerprint || template?.layoutFingerprint,
        fields: parsed.fields,
        mappingStatus: parsed.mappingStatus || mappingStatus,
        createdAt: template?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: template?.version || 0,
        thumbnailBase64: template?.thumbnailBase64,
      });

      const issues = validateFormTemplate(candidate).filter((issue) => !issue.includes('PDF base'));
      if (issues.length) throw new Error(issues.join('\n'));

      setName(candidate.name);
      setEntity(candidate.entity);
      setEntityType(candidate.entityType);
      setFormType(candidate.formType);
      setDescription(candidate.description);
      setPageCount(candidate.totalPages);
      setFields(candidate.fields);
      setSelectedFieldId(null);
      setMappingStatus(candidate.fields.length ? 'ready' : 'draft');
      setMappingJsonError('');
      setShowJsonEditor(false);
    } catch (error) {
      setMappingJsonError(error instanceof Error ? error.message : 'El JSON del mapeo no es válido.');
    }
  };

  const handleSave = async () => {
    if (!pdfData) {
      alert('Por favor suba un archivo PDF antes de guardar.');
      return;
    }
    if (!name.trim()) {
      alert('Por favor ingrese un nombre para la plantilla.');
      return;
    }

    let inspection;
    try {
      inspection = await inspectPDFTemplate(pdfData);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo validar el PDF base.');
      return;
    }
    if (inspection.populatedAcroFieldCount > 0) {
      alert(`El PDF contiene ${inspection.populatedAcroFieldCount} campos interactivos ya diligenciados. Reemplázalo por una copia limpia antes de guardar.`);
      return;
    }

    let thumbnailBase64: string | undefined;
    try {
      thumbnailBase64 = await generatePDFThumbnail(pdfData);
    } catch {
      // Ignorar
    }

    const savedTemplate = normalizeTemplate({
      id: template?.id || crypto.randomUUID(),
      name: name.trim(),
      entity: entity.trim(),
      entityType,
      formType: formType.trim(),
      description: description.trim(),
      pdfBase64: pdfAssetPath ? (template?.pdfBase64 || '') : pdfData,
      pdfAssetPath,
      pdfFileName,
      totalPages: inspection.pageCount,
      pageSizes: inspection.pageSizes,
      layoutFingerprint: inspection.layoutFingerprint,
      fields,
      mappingStatus: fields.length ? 'ready' : 'draft',
      createdAt: template?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: (template?.version || 0) + 1,
      thumbnailBase64,
    });

    const issues = validateFormTemplate(savedTemplate);
    savedTemplate.fields.forEach(field => {
      const size = inspection.pageSizes[field.page];
      if (size && (field.x + field.width > size.width + 0.01 || field.y + field.height > size.height + 0.01)) {
        issues.push(`${field.label}: el rectángulo sale de la página ${field.page + 1}.`);
      }
    });
    if (issues.length) {
      alert(`Corrige la plantilla antes de guardarla:\n• ${issues.join('\n• ')}`);
      return;
    }

    onSave(savedTemplate);
  };

  const getColorForSource = (source: FieldDataSource) => {
    switch (source) {
      case 'cotizante':
        return 'rgba(59, 130, 246, 0.35)';
      case 'empresa':
        return 'rgba(34, 197, 94, 0.35)';
      case 'tramite':
        return 'rgba(249, 115, 22, 0.35)';
      case 'manual':
        return 'rgba(168, 85, 247, 0.35)';
      case 'familiar':
        return 'rgba(236, 72, 153, 0.35)';
      default:
        return 'rgba(148, 163, 184, 0.35)';
    }
  };

  const getBorderColorForSource = (source: FieldDataSource) => {
    switch (source) {
      case 'cotizante':
        return '#3b82f6';
      case 'empresa':
        return '#22c55e';
      case 'tramite':
        return '#f97316';
      case 'manual':
        return '#a855f7';
      case 'familiar':
        return '#ec4899';
      default:
        return '#94a3b8';
    }
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);
  const catalogFields = searchCatalogFields(searchTerm);

  if (isLoadingBasePdf) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center rounded-3xl border border-slate-800 bg-[#0f182a] p-8 text-center text-white">
        <div className="mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-[#c4d600]" />
        <h2 className="text-xl font-bold">Abriendo el mapeo guardado</h2>
        <p className="mt-2 text-sm text-slate-400">Recuperando automáticamente el formulario base y todos sus campos.</p>
      </div>
    );
  }

  if (basePdfError && pdfAssetPath) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center rounded-3xl border border-rose-500/30 bg-[#0f182a] p-8 text-center text-white">
        <FileSpreadsheet className="mb-5 h-12 w-12 text-rose-300" />
        <h2 className="text-xl font-bold">No se pudo abrir el formulario guardado</h2>
        <p className="mt-2 max-w-lg text-sm text-slate-400">{basePdfError}</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => { setBasePdfError(''); setPdfData(null); setBasePdfLoadAttempt((current) => current + 1); }} className="rounded-xl bg-[#c4d600] px-4 py-2 text-xs font-bold text-slate-950">
            Reintentar
          </button>
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300">
            Volver a la biblioteca
          </button>
        </div>
      </div>
    );
  }

  // Upload View
  if (!pdfData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-[#0f182a] p-8 rounded-3xl border border-slate-800 text-white text-center">
        <div className="w-20 h-20 rounded-3xl bg-[#c4d600]/10 flex items-center justify-center mb-6 text-[#c4d600]">
          <Upload className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-serif font-bold mb-2">Cargar Formulario Oficial EPS / SGSSS</h2>
        <p className="text-sm text-slate-400 max-w-md mb-8">
          Sube el formulario oficial (Famisanar, Sanitas, Coosalud, ARL Sura, etc.) para calibrar las casillas y los checks automáticos con alineación por cuadrícula.
        </p>

        <label className="bg-[#c4d600] hover:bg-[#d2e300] text-slate-950 px-8 py-3.5 rounded-2xl font-bold text-sm cursor-pointer transition-all shadow-lg shadow-[#c4d600]/20 active:scale-95 flex items-center gap-2">
          <Upload className="w-4 h-4" />
          <span>Seleccionar PDF Oficial</span>
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>
    );
  }

  return (
    <div
      id="designer-container"
      ref={designerRef}
      className={`flex flex-col bg-[#0a1824] text-slate-100 overflow-hidden transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen rounded-none border-0'
          : 'h-[calc(100vh-120px)] rounded-3xl border border-slate-800'
      }`}
    >
      {/* Top Header / Metadata Toolbar */}
      <div className="flex flex-col gap-3 p-4 border-b border-slate-800 bg-[#0f182a]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#c4d600]/10 text-[#c4d600] flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <span>Diseñador de Formularios EPS</span>
                <span className="bg-[#c4d600]/20 text-[#c4d600] text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">
                  Cuadrícula Milimétrica
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Alinea casillas con precisión, asigna datos y ubica checks manualmente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Usar pantalla completa'}
              aria-pressed={isFullscreen}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 transition-all hover:border-[#c4d600]/50 hover:text-[#c4d600]"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span>{isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</span>
            </button>
            <button
              type="button"
              onClick={openJsonEditor}
              title="Ver, copiar o editar la definición completa del mapeo"
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Editar JSON</span>
            </button>
            <button
              type="button"
              disabled={fields.length === 0}
              title="Al guardar, una plantilla con campos queda disponible inmediatamente en el generador"
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${fields.length ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-slate-600 bg-slate-800 text-slate-300'}`}
            >
              {fields.length ? 'Lista al guardar' : 'Sin campos'}
            </button>
            <button
              onClick={cleanAllCheckboxes}
              title="Borrar todas las casillas de check de esta plantilla para crearlas limpias"
              className="px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar Checks</span>
            </button>

            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Cancelar</span>
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-[#c4d600] hover:bg-[#d2e300] text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Plantilla</span>
            </button>
          </div>
        </div>

        {/* Metadata Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <input
            type="text"
            placeholder="Nombre de plantilla (ej. Famisanar SGSSS) *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#c4d600] outline-none"
          />
          <input
            type="text"
            placeholder="Entidad (ej. Famisanar EPS)"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-[#c4d600] outline-none"
          />
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as EntityType)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-[#c4d600] outline-none font-bold"
          >
            <option value="EPS">EPS (Salud)</option>
            <option value="ARL">ARL (Riesgos)</option>
            <option value="AFP">AFP (Pensión)</option>
            <option value="CCF">CCF (Compensación)</option>
            <option value="IPS">IPS (Prestador)</option>
            <option value="OTRO">OTRO</option>
          </select>
          <input
            type="text"
            placeholder="Tipo (ej. Afiliación / Novedad)"
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-[#c4d600] outline-none"
          />
        </div>
      </div>

      {/* Main Workspace: Canvas + Properties */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex flex-col relative bg-[#0a1824] overflow-hidden">
          {/* Fixed secondary toolbar: it consumes layout space and never covers the PDF. */}
          <div className="z-20 flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-700 bg-[#0f182a] p-2 shadow-lg">
            {/* Tools */}
            <button
              onClick={() => setActiveTool('select')}
              title="Seleccionar / Mover Casilla (Arrastra con el ratón o usa las flechas del teclado)"
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                activeTool === 'select'
                  ? 'bg-[#c4d600] text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <MousePointer2 className="w-4 h-4" />
              <span>Seleccionar / Mover</span>
            </button>

            <button
              onClick={() => setActiveTool('draw')}
              title="Dibujar Casilla en el PDF"
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                activeTool === 'draw'
                  ? 'bg-[#c4d600] text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Square className="w-4 h-4" />
              <span>Dibujar</span>
            </button>

            <div className="w-px h-5 bg-slate-700 mx-0.5" />

            {/* General Check Button: Clean, manual, user-assigned */}
            <button
              onClick={insertGenericCheck}
              title="Insertar Casilla Check [X] genérica (Tú decides su dato y posición manualmente)"
              className="p-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span>+ Check [X]</span>
            </button>

            <button
              onClick={insertGenericText}
              title="Insertar Casilla de Texto estándar"
              className="p-2 rounded-xl text-xs font-bold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/40 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Type className="w-4 h-4 text-blue-400" />
              <span>+ Texto</span>
            </button>

            <button
              onClick={insertStamp}
              title="Crear un sello editable dentro del formulario"
              className="p-2 rounded-xl text-xs font-bold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Stamp className="w-4 h-4 text-red-400" />
              <span>+ Sello</span>
            </button>

            <div className="w-px h-5 bg-slate-700 mx-0.5" />

            {/* Font Defaults Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowFontDefaults(prev => !prev)}
                title="Configurar fuente por defecto para nuevos campos"
                className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                  showFontDefaults
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Fuente ({fontDefaults.fontSize}pt)</span>
              </button>

              {showFontDefaults && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-[#111827] border border-slate-700 rounded-xl p-3 shadow-2xl min-w-[260px] space-y-2.5">
                  <p className="text-[10px] text-emerald-400 font-mono uppercase font-bold tracking-wide">Fuente por defecto (campos nuevos)</p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Tamaño (pt)</label>
                      <input
                        type="number"
                        min={4}
                        max={72}
                        step={0.5}
                        value={fontDefaults.fontSize}
                        onChange={(e) => updateFontDefault({ fontSize: Math.max(4, Math.min(72, Number(e.target.value) || 10)) })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-100 font-mono focus:border-emerald-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Familia</label>
                      <select
                        value={fontDefaults.fontFamily}
                        onChange={(e) => updateFontDefault({ fontFamily: e.target.value as FontDefaults['fontFamily'] })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-100 focus:border-emerald-400 outline-none"
                      >
                        <option value="helvetica">Helvetica / Arial</option>
                        <option value="times">Times</option>
                        <option value="courier">Courier</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={fontDefaults.bold}
                      onChange={(e) => updateFontDefault({ bold: e.target.checked })}
                    />
                    Negrita por defecto
                  </label>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                    <div className="flex-1 text-[10px] text-slate-500">
                      Vista previa: <span className="text-slate-200 font-bold">{fontDefaults.fontSize}pt {fontDefaults.fontFamily}{fontDefaults.bold ? ' bold' : ''}</span>
                    </div>
                    <button
                      onClick={() => setShowFontDefaults(false)}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 transition-colors"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Grid & Magnetism Controls */}
            <button
              onClick={() => setShowGrid(!showGrid)}
              title="Mostrar / Ocultar Cuadrícula"
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                showGrid
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>Cuadrícula</span>
            </button>

            {/* Granular Grid Size Selector */}
            <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded-xl p-0.5">
              {[0.25, 0.5, 1, 2].map((size) => (
                <button
                  key={size}
                  onClick={() => setGridSize(size)}
                  title={`Tamaño de paso: ${size} puntos`}
                  className={`px-1.5 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                    gridSize === size
                      ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {size}pt
                </button>
              ))}
            </div>

            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              title="Ajustar automáticamente a la Cuadrícula"
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                snapToGrid
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Magnet className="w-4 h-4" />
              <span>Snap</span>
            </button>

            {/* Alignment Buttons for Selected Field */}
            {selectedField && (
              <>
                <div className="w-px h-5 bg-slate-700 mx-0.5" />
                <button
                  onClick={alignSelectedRow}
                  title="Alinear automáticamente toda la fila usando el campo seleccionado como guía"
                  className="p-2 rounded-xl text-xs font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 flex items-center gap-1"
                >
                  <Rows3 className="w-4 h-4" />
                  <span>Alinear Fila</span>
                </button>

                <button
                  onClick={copySelectedField}
                  title="Copiar campo seleccionado (Ctrl+C)"
                  className="p-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-1"
                >
                  <ClipboardCopy className="w-4 h-4" />
                  <span>Copiar</span>
                </button>

                <button
                  onClick={duplicateFieldHorizontally}
                  title="Duplicar casilla hacia la derecha"
                  className="p-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  <span>Duplicar</span>
                </button>

                <button
                  onClick={() => deleteField(selectedField.id)}
                  title="Eliminar casilla seleccionada (Tecla Supr / Backspace)"
                  className="p-2 rounded-xl text-xs font-bold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>
              </>
            )}

            {clipboardField && (
              <button
                onClick={pasteCopiedField}
                title="Pegar el campo copiado en esta página (Ctrl+V)"
                className="p-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-1"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>Pegar</span>
              </button>
            )}

            <div className="w-px h-5 bg-slate-700 mx-0.5" />

            {/* Zoom Controls */}
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold px-1.5 text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas Viewport with Exact Matched Grid */}
          <div
            ref={containerRef}
            className={`flex-1 overflow-auto p-8 flex justify-center items-start ${
              activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            <div
              className="relative shadow-2xl bg-white rounded-lg overflow-hidden border border-slate-700 select-none"
              style={{
                backgroundImage: showGrid
                  ? `linear-gradient(to right, rgba(59, 130, 246, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 130, 246, 0.12) 1px, transparent 1px)`
                  : 'none',
                backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
                backgroundPosition: '0 0',
              }}
            >
              <canvas ref={canvasRef} className="block" />

              {/* Overlay Layer for Drawn Fields */}
              <div
                ref={overlayRef}
                className="absolute top-0 left-0"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Drawn Rectangles */}
                {fields
                  .filter((f) => f.page === currentPage)
                  .map((field) => {
                    const canvasPos = pdfToCanvasCoords(
                      field.x,
                      field.y + field.height,
                      viewportDim.width,
                      viewportDim.height,
                      pdfDim.width,
                      pdfDim.height,
                      zoom
                    );

                    const canvasW = (field.width / pdfDim.width) * viewportDim.width;
                    const canvasH = (field.height / pdfDim.height) * viewportDim.height;
                    const isSelected = selectedFieldId === field.id;
                    const catalogField = findCatalogField(field.fieldKey);
                    const rawPreviewValue = field.fieldType === 'checkbox'
                      ? (field.checkboxCharacter || 'X')
                      : field.fieldType === 'stamp'
                        ? (field.stampText || 'SELLO')
                        : (catalogField?.example || field.defaultValue || 'Texto');
                    const formattedPreviewValue = field.fieldType === 'date'
                      ? formatDateValue(rawPreviewValue, field.dateFormat || 'DD/MM/YYYY')
                      : rawPreviewValue;
                    const previewValue = field.isCharacterByCharacter && field.stripCharacterSeparators
                      ? formattedPreviewValue.replace(/[\s/.-]+/g, '')
                      : formattedPreviewValue;
                    const previewCharacters = Array.from(previewValue);
                    const previewCellCount = field.characterCount || field.maxLength || previewCharacters.length || 1;
                    const previewGap = Number(field.characterSpacing) || 0;
                    const previewPadding = Math.max(0, field.padding ?? 1);
                    const previewAvailableWidth = Math.max(1, field.width - previewPadding * 2);
                    const previewCellWidth = field.characterCellWidth && field.characterCellWidth > 0
                      ? field.characterCellWidth
                      : (previewAvailableWidth - previewGap * Math.max(0, previewCellCount - 1)) / Math.max(1, previewCellCount);
                    const fontFamily = field.fontFamily === 'courier'
                      ? 'Courier New, monospace'
                      : field.fontFamily === 'times'
                        ? 'Times New Roman, serif'
                        : 'Arial, Helvetica, sans-serif';

                    return (
                      <div
                        key={field.id}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setSelectedFieldId(field.id);
                          if (activeTool === 'select') {
                            setIsDraggingField(true);
                            setDragStartPos({
                              mouseX: e.clientX,
                              mouseY: e.clientY,
                              fieldX: field.x,
                              fieldY: field.y,
                            });
                          }
                        }}
                        className={`absolute border-2 flex items-center justify-center overflow-visible transition-colors ${
                          activeTool === 'select' ? 'cursor-move' : 'cursor-pointer'
                        }`}
                        style={{
                          left: `${canvasPos.x}px`,
                          top: `${canvasPos.y}px`,
                          width: `${canvasW}px`,
                          height: `${canvasH}px`,
                          backgroundColor: field.fieldType === 'stamp'
                            ? hexToRgba(field.stampFillColor || '#FFFFFF', Math.min(0.35, field.stampOpacity ?? 0.92))
                            : getColorForSource(field.dataSource),
                          borderColor: isSelected
                            ? '#c4d600'
                            : field.fieldType === 'stamp'
                              ? (field.stampBorderColor || '#B91C1C')
                              : getBorderColorForSource(field.dataSource),
                          borderWidth: field.fieldType === 'stamp' ? `${Math.max(1, (field.stampBorderWidth ?? 1.5) * zoom)}px` : undefined,
                          borderRadius: field.fieldType === 'stamp' && field.stampShape === 'circle' ? '9999px' : undefined,
                          boxShadow: isSelected ? '0 0 0 2px #c4d600, 0 4px 12px rgba(0,0,0,0.5)' : 'none',
                          zIndex: isSelected ? 30 : 10,
                          justifyContent: field.alignment === 'center' ? 'center' : field.alignment === 'right' ? 'flex-end' : 'flex-start',
                          alignItems: field.verticalAlignment === 'top' ? 'flex-start' : field.verticalAlignment === 'bottom' ? 'flex-end' : 'center',
                          padding: `${Math.max(0, field.padding ?? 1) * zoom}px`,
                        }}
                      >
                        {/* Floating Quick Delete Button on Canvas for selected field */}
                        {isSelected && (
                          <button
                            type="button"
                            title="Eliminar esta casilla (Tecla Supr / Backspace)"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteField(field.id);
                            }}
                            className="absolute -top-3.5 -right-3.5 z-40 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg border border-white cursor-pointer transition-transform hover:scale-110"
                          >
                            <X className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        )}

                        {isSelected && (['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                          <button
                            key={handle}
                            type="button"
                            aria-label={`Redimensionar desde ${handle}`}
                            title="Arrastra para achicar o agrandar"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setIsDraggingField(false);
                              setResizeState({
                                fieldId: field.id,
                                handle,
                                mouseX: event.clientX,
                                mouseY: event.clientY,
                                x: field.x,
                                y: field.y,
                                width: field.width,
                                height: field.height,
                              });
                            }}
                            className={`absolute z-50 h-3 w-3 rounded-sm border border-slate-950 bg-[#c4d600] shadow-md ${
                              handle === 'nw' ? '-left-1.5 -top-1.5 cursor-nwse-resize'
                                : handle === 'ne' ? '-right-1.5 -top-1.5 cursor-nesw-resize'
                                  : handle === 'sw' ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                                    : '-bottom-1.5 -right-1.5 cursor-nwse-resize'
                            }`}
                          />
                        ))}

                        {field.isCharacterByCharacter ? (
                          <div className="pointer-events-none absolute inset-0 overflow-hidden">
                            {previewCharacters.slice(0, previewCellCount).map((character, index) => (
                              <span
                                key={`${field.id}-character-${index}`}
                                className="absolute top-0 flex h-full items-center justify-center overflow-visible whitespace-nowrap leading-none"
                                style={{
                                  left: `${(previewPadding + (field.characterOffsetX || 0) + index * (previewCellWidth + previewGap) + (field.characterOffsets?.[index] || 0)) * zoom}px`,
                                  top: `${-(field.characterOffsetY || 0) * zoom}px`,
                                  width: `${previewCellWidth * zoom}px`,
                                  fontFamily,
                                  fontSize: `${field.fontSize * zoom}px`,
                                  fontWeight: field.bold ? 700 : 400,
                                  textTransform: field.uppercase ? 'uppercase' : 'none',
                                  color: field.color || '#000000',
                                  outline: isSelected ? '1px dashed rgba(196, 214, 0, 0.6)' : undefined,
                                }}
                              >
                                {character}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span
                            className="block max-w-full overflow-hidden whitespace-nowrap text-slate-950 select-none pointer-events-none leading-none text-center"
                            style={{
                              fontFamily,
                              fontSize: `${field.fontSize * zoom}px`,
                              fontWeight: field.bold ? 700 : 400,
                              textTransform: field.uppercase ? 'uppercase' : 'none',
                              color: field.color || '#000000',
                            }}
                          >
                            {previewValue}
                            {field.fieldType === 'stamp' && field.stampSubtext && (
                              <small className="block mt-1" style={{ fontSize: `${Math.max(4, field.fontSize * 0.52) * zoom}px` }}>
                                {field.stampSubtext}
                              </small>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}

                {/* In-progress drawing rectangle */}
                {isDrawing && drawStart && drawCurrent && (
                  <div
                    className="absolute border-2 border-dashed border-[#c4d600] bg-[#c4d600]/30 pointer-events-none"
                    style={{
                      left: `${Math.min(drawStart.x, drawCurrent.x)}px`,
                      top: `${Math.min(drawStart.y, drawCurrent.y)}px`,
                      width: `${Math.abs(drawCurrent.x - drawStart.x)}px`,
                      height: `${Math.abs(drawCurrent.y - drawStart.y)}px`,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Fixed bottom page navigation: outside the document viewport. */}
          {pageCount > 1 && (
            <div className="z-20 flex shrink-0 items-center justify-center gap-3 border-t border-slate-700 bg-[#0f182a] p-2 shadow-xl">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage <= 0}
                className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-xs font-mono font-bold text-slate-200">
                Página {currentPage + 1} de {pageCount}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage >= pageCount - 1}
                className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Properties & Catalog Sidebar */}
        <div className={`bg-[#0f182a] border-l border-slate-800 flex shrink-0 flex-col overflow-hidden transition-[width] duration-200 ${isPropertiesCollapsed ? 'w-12' : 'w-80'}`}>
          {isPropertiesCollapsed ? (
            <div className="flex h-full flex-col items-center py-3">
              <button
                type="button"
                title="Abrir panel de configuración"
                aria-label="Abrir panel de configuración"
                onClick={() => setIsPropertiesCollapsed(false)}
                className="rounded-xl border border-slate-700 p-2 text-[#c4d600] hover:bg-slate-800"
              >
                <PanelRightOpen className="h-5 w-5" />
              </button>
              <span className="mt-4 [writing-mode:vertical-rl] text-[10px] font-bold uppercase tracking-widest text-slate-500">Configuración</span>
            </div>
          ) : (
          <>
          {/* Field Configuration */}
          <div className="flex-1 overflow-y-auto p-4 border-b border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-sm text-amber-400 font-mono uppercase tracking-wider">
                {selectedField ? 'Configuración del Campo' : 'Propiedades'}
              </h3>
              <div className="flex items-center gap-1">
                {selectedField && (
                <button
                  type="button"
                  title="Eliminar casilla"
                  onClick={() => deleteField(selectedField.id)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                )}
                <button
                  type="button"
                  title="Ocultar panel y ampliar el lienzo"
                  aria-label="Ocultar panel de configuración"
                  onClick={() => setIsPropertiesCollapsed(true)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-[#c4d600]"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </div>
            </div>

            {selectedField ? (
              <div className="space-y-4 text-xs">
                {/* Field Type Toggle (Text vs Checkbox) */}
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">
                    Tipo de Campo
                  </label>
                  <select value={selectedField.fieldType} onChange={(event) => {
                    const fieldType = event.target.value as PDFFieldType;
                    updateSelectedField({
                      fieldType,
                      dataSource: fieldType === 'stamp' ? 'manual' : selectedField.dataSource,
                      checkboxCharacter: fieldType === 'checkbox' ? (selectedField.checkboxCharacter || 'X') : undefined,
                      checkboxRule: fieldType === 'checkbox' ? (selectedField.checkboxRule || { mode: selectedField.dataSource === 'manual' ? 'manual' : 'truthy' }) : undefined,
                      alignment: fieldType === 'checkbox' ? 'center' : selectedField.alignment,
                      dateFormat: fieldType === 'date' ? (selectedField.dateFormat || 'DD/MM/YYYY') : undefined,
                      stripCharacterSeparators: fieldType === 'date' && selectedField.isCharacterByCharacter
                        ? (selectedField.stripCharacterSeparators ?? true)
                        : selectedField.stripCharacterSeparators,
                      numberFormat: fieldType === 'number' ? (selectedField.numberFormat || 'integer') : undefined,
                      stampText: fieldType === 'stamp' ? (selectedField.stampText || 'RECIBIDO') : undefined,
                      stampSubtext: fieldType === 'stamp' ? (selectedField.stampSubtext || '') : undefined,
                      stampShape: fieldType === 'stamp' ? (selectedField.stampShape || 'rectangle') : undefined,
                      stampBorderColor: fieldType === 'stamp' ? (selectedField.stampBorderColor || '#B91C1C') : undefined,
                      stampFillColor: fieldType === 'stamp' ? (selectedField.stampFillColor || '#FFFFFF') : undefined,
                      stampBorderWidth: fieldType === 'stamp' ? (selectedField.stampBorderWidth ?? 1.5) : undefined,
                      stampOpacity: fieldType === 'stamp' ? (selectedField.stampOpacity ?? 0.92) : undefined,
                    });
                  }} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-bold">
                    <option value="text">Texto</option>
                    <option value="date">Fecha</option>
                    <option value="number">Número</option>
                    <option value="checkbox">Casilla / Check [X]</option>
                    <option value="stamp">Sello</option>
                  </select>
                </div>

                {/* Field Label */}
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">
                    Nombre / Etiqueta del Campo
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={(e) => updateSelectedField({ label: e.target.value })}
                    placeholder="Ej: Sexo Femenino, Primer Apellido..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-[#c4d600]"
                  />
                </div>

                {/* Checkbox Specific Configurations */}
                {selectedField.fieldType === 'checkbox' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-amber-300 font-mono uppercase font-bold">
                        Carácter de Marca
                      </label>
                      <input
                        type="text"
                        maxLength={1}
                        value={selectedField.checkboxCharacter || 'X'}
                        onChange={(e) => updateSelectedField({ checkboxCharacter: normalizeCheckboxCharacter(e.target.value) })}
                        className="w-12 bg-slate-900 border border-slate-700 rounded-lg p-1 text-center font-bold text-amber-300 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">
                        Regla para marcar
                      </label>
                      <select
                        value={selectedField.checkboxRule?.mode || (selectedField.dataSource === 'manual' ? 'manual' : 'truthy')}
                        onChange={(e) => updateSelectedField({
                          checkboxRule: {
                            ...selectedField.checkboxRule,
                            mode: e.target.value as NonNullable<PDFMappedField['checkboxRule']>['mode'],
                            source: selectedField.dataSource,
                            fieldKey: selectedField.fieldKey,
                          },
                        })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-400"
                      >
                        <option value="manual">Manual al generar</option>
                        <option value="truthy">Cuando el dato sea Sí/X/verdadero</option>
                        <option value="equals">Cuando sea igual a un valor</option>
                        <option value="notEquals">Cuando sea diferente de un valor</option>
                        <option value="always">Marcar siempre</option>
                      </select>
                    </div>

                    {['equals', 'notEquals'].includes(selectedField.checkboxRule?.mode || '') && <div>
                      <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Valor esperado</label>
                      <input type="text" placeholder="Ej: F, SI, DEPENDIENTE" value={selectedField.checkboxRule?.expectedValue || ''} onChange={(e) => updateSelectedField({ checkboxRule: { ...(selectedField.checkboxRule || { mode: 'equals' }), expectedValue: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-400" />
                    </div>}

                    {(selectedField.checkboxRule?.mode || 'manual') === 'manual' && <div>
                      <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Grupo exclusivo (opcional)</label>
                      <input type="text" placeholder="Ej: sexo, régimen, tipo trámite" value={selectedField.checkboxRule?.groupId || ''} onChange={(e) => updateSelectedField({ checkboxRule: { ...(selectedField.checkboxRule || { mode: 'manual' }), groupId: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-400" />
                    </div>}

                    {(selectedField.checkboxRule?.mode || 'manual') === 'manual' && <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedField.defaultValue === 'X'}
                        onChange={(e) =>
                          updateSelectedField({
                            defaultValue: e.target.checked ? 'X' : '',
                          })
                        }
                        className="rounded bg-slate-900 border-slate-700 text-amber-400 focus:ring-amber-400"
                      />
                      <span>Marcado inicialmente (solo manual)</span>
                    </label>}
                  </div>
                )}

                {selectedField.fieldType === 'stamp' && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 space-y-3">
                    <div>
                      <label className="block text-[10px] text-red-300 font-mono uppercase font-bold mb-1">Texto principal</label>
                      <input type="text" value={selectedField.stampText || ''} onChange={(event) => updateSelectedField({ stampText: event.target.value })}
                        placeholder="RECIBIDO" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-red-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Texto secundario</label>
                      <input type="text" value={selectedField.stampSubtext || ''} onChange={(event) => updateSelectedField({ stampSubtext: event.target.value })}
                        placeholder="Fecha, área o asesor" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-slate-400">Forma
                        <select value={selectedField.stampShape || 'rectangle'} onChange={(event) => updateSelectedField({ stampShape: event.target.value as PDFMappedField['stampShape'] })}
                          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100">
                          <option value="rectangle">Rectangular</option><option value="circle">Circular / oval</option>
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-400">Grosor
                        <input type="number" min={0.25} max={8} step={0.25} value={selectedField.stampBorderWidth ?? 1.5}
                          onChange={(event) => updateSelectedField({ stampBorderWidth: Number(event.target.value) || 1.5 })}
                          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100" />
                      </label>
                      <label className="text-[10px] text-slate-400">Borde
                        <input type="color" value={selectedField.stampBorderColor || '#B91C1C'} onChange={(event) => updateSelectedField({ stampBorderColor: event.target.value })}
                          className="mt-1 w-full h-8 bg-slate-900 border border-slate-700 rounded-lg p-1" />
                      </label>
                      <label className="text-[10px] text-slate-400">Fondo
                        <input type="color" value={selectedField.stampFillColor || '#FFFFFF'} onChange={(event) => updateSelectedField({ stampFillColor: event.target.value })}
                          className="mt-1 w-full h-8 bg-slate-900 border border-slate-700 rounded-lg p-1" />
                      </label>
                    </div>
                    <label className="block text-[10px] text-slate-400">Intensidad: {Math.round((selectedField.stampOpacity ?? 0.92) * 100)}%
                      <input type="range" min={0.1} max={1} step={0.05} value={selectedField.stampOpacity ?? 0.92}
                        onChange={(event) => updateSelectedField({ stampOpacity: Number(event.target.value) })} className="mt-1 w-full accent-red-500" />
                    </label>
                    <button type="button" onClick={saveSelectedStamp}
                      className="w-full rounded-xl border border-red-500/40 bg-red-500/15 py-2 text-[11px] font-bold text-red-200 hover:bg-red-500/25">
                      Guardar en biblioteca de sellos
                    </button>
                    {stampPresets.length > 0 && (
                      <div className="space-y-1.5 border-t border-red-500/20 pt-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Biblioteca</span>
                        {stampPresets.map((preset) => (
                          <div key={preset.id} className="flex gap-1.5">
                            <button type="button" onClick={() => applyStampPreset(preset)}
                              className="min-w-0 flex-1 truncate rounded-lg bg-slate-900 px-2 py-1.5 text-left text-[11px] text-slate-200 hover:text-red-200">
                              {preset.name}
                            </button>
                            <button type="button" title="Eliminar de la biblioteca" onClick={() => void removeStampPreset(preset.id)}
                              className="rounded-lg bg-slate-900 p-1.5 text-slate-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Data Source */}
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">
                    Fuente de Datos
                  </label>
                  <select
                    value={selectedField.dataSource}
                    disabled={selectedField.fieldType === 'stamp'}
                    onChange={(e) =>
                      updateSelectedField({
                        dataSource: e.target.value as FieldDataSource,
                        checkboxRule: selectedField.fieldType === 'checkbox'
                          ? {
                              ...(selectedField.checkboxRule || { mode: e.target.value === 'manual' ? 'manual' : 'truthy' }),
                              mode: e.target.value === 'manual' ? 'manual' : (selectedField.checkboxRule?.mode === 'manual' ? 'truthy' : selectedField.checkboxRule?.mode || 'truthy'),
                              source: e.target.value as FieldDataSource,
                            }
                          : undefined,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-bold disabled:opacity-60"
                  >
                    <option value="manual">Manual (Tú lo marcas o escribes al rellenar)</option>
                    <option value="cotizante">Cotizante / Empleado</option>
                    <option value="empresa">Empresa / Aportante</option>
                    <option value="tramite">Datos del Trámite</option>
                    <option value="familiar">Núcleo Familiar</option>
                  </select>
                </div>

                {/* Catalog Search & Selection */}
                {(
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">
                      Vincular a Campo del Sistema
                    </label>
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar campo o número (ej. nacionalidad, nov. 14, anexo 63)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-[#c4d600] outline-none"
                      />
                    </div>

                    <div className="max-h-32 overflow-y-auto bg-slate-900/60 border border-slate-800 rounded-xl divide-y divide-slate-800/60">
                      {catalogFields
                        .filter((cf) => cf.source === selectedField.dataSource)
                        .slice(0, 100)
                        .map((cf) => (
                          <button
                            key={cf.key}
                            type="button"
                            onClick={() =>
                              updateSelectedField({
                                fieldKey: cf.key,
                                label: cf.label,
                                fieldType: cf.type,
                                alignment: cf.type === 'checkbox' ? 'center' : selectedField.alignment,
                                checkboxCharacter: cf.type === 'checkbox' ? (selectedField.checkboxCharacter || 'X') : undefined,
                                checkboxRule: cf.type === 'checkbox'
                                  ? { mode: cf.source === 'manual' ? 'manual' : 'truthy', source: cf.source, fieldKey: cf.key }
                                  : undefined,
                                dateFormat: cf.type === 'date' ? (selectedField.dateFormat || 'DD/MM/YYYY') : undefined,
                                numberFormat: cf.type === 'number' ? (selectedField.numberFormat || 'integer') : undefined,
                              })
                            }
                            className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors ${
                              selectedField.fieldKey === cf.key
                                ? 'bg-[#c4d600]/10 text-[#c4d600] font-bold'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span className="truncate">{cf.label}</span>
                            {selectedField.fieldKey === cf.key && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 p-2.5 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-purple-300">
                    <Rows3 className="h-3.5 w-3.5" /> Fila automática
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-slate-400">Total de campos
                      <input type="number" min={2} max={30} value={rowCount} onChange={(event) => setRowCount(Math.max(2, Math.min(30, Number(event.target.value) || 2)))}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100" />
                    </label>
                    <label className="text-[10px] text-slate-400">Separación (pt)
                      <input type="number" min={0} max={100} step={0.25} value={rowGap} onChange={(event) => setRowGap(Math.max(0, Number(event.target.value) || 0))}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100" />
                    </label>
                  </div>
                  <button type="button" onClick={createAlignedRow}
                    className="w-full rounded-lg border border-purple-500/30 bg-purple-500/15 py-1.5 text-[11px] font-bold text-purple-200 hover:bg-purple-500/25">
                    Crear fila desde este campo
                  </button>
                  <p className="text-[9px] leading-relaxed text-slate-500">Las copias conservan el dato vinculado. Puedes reasignar cada una después.</p>
                </div>

                {/* Coordinate Inputs (Fine Tuning) */}
                <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-[9px] text-slate-500 font-mono uppercase font-bold">X (pt)</label>
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      max={Math.max(0, pdfDim.width - selectedField.width)}
                      value={Number(selectedField.x.toFixed(2))}
                      onChange={(e) => updateSelectedField({ x: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 font-mono uppercase font-bold">Y (pt)</label>
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      max={Math.max(0, pdfDim.height - selectedField.height)}
                      value={Number(selectedField.y.toFixed(2))}
                      onChange={(e) => updateSelectedField({ y: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 font-mono uppercase font-bold">Ancho</label>
                    <input
                      type="number"
                      step={0.25}
                      min={1}
                      max={pdfDim.width - selectedField.x}
                      value={Number(selectedField.width.toFixed(2))}
                      onChange={(e) => updateSelectedField({ width: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 font-mono uppercase font-bold">Alto</label>
                    <input
                      type="number"
                      step={0.25}
                      min={1}
                      max={pdfDim.height - selectedField.y}
                      value={Number(selectedField.height.toFixed(2))}
                      onChange={(e) => updateSelectedField({ height: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>

                {/* Exact typography controls */}
                {selectedField.fieldType !== 'checkbox' && selectedField.fieldType !== 'stamp' && (
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Aplicar cambios de texto a</label>
                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
                      {([
                        ['selected', 'Solo este'],
                        ['page', 'Página'],
                        ['template', 'Todos'],
                      ] as const).map(([scope, label]) => (
                        <button key={scope} type="button" onClick={() => setStyleScope(scope)}
                          className={`rounded-lg px-1 py-1.5 text-[10px] font-bold ${styleScope === scope ? 'bg-[#c4d600] text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[9px] text-slate-500">El tamaño, fuente, color y alineación respetarán este alcance.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Tamaño (pt)</label>
                    <input type="number" min={4} max={72} step={0.25} value={selectedField.fontSize}
                      onChange={(e) => updateTextStyle({ fontSize: Number(e.target.value) || 9 })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Fuente</label>
                    <select value={selectedField.fontFamily} onChange={(e) => updateTextStyle({ fontFamily: e.target.value as PDFMappedField['fontFamily'] })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100">
                      <option value="helvetica">Helvetica / Arial</option>
                      <option value="times">Times</option>
                      <option value="courier">Courier</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Vertical</label>
                    <select value={selectedField.verticalAlignment || 'middle'} onChange={(e) => updateTextStyle({ verticalAlignment: e.target.value as PDFMappedField['verticalAlignment'] })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100">
                      <option value="top">Arriba</option><option value="middle">Centro</option><option value="bottom">Abajo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Margen (pt)</label>
                    <input type="number" min={0} max={20} step={0.25} value={selectedField.padding ?? 1}
                      onChange={(e) => updateTextStyle({ padding: Math.max(0, Number(e.target.value)) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 font-mono" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Alineación horizontal</label>
                  <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
                    {(['left', 'center', 'right'] as const).map((alignment) => (
                      <button key={alignment} type="button" onClick={() => updateTextStyle({ alignment })}
                        className={`flex-1 p-1 rounded-lg flex justify-center ${selectedField.alignment === alignment ? 'bg-slate-800 text-[#c4d600]' : 'text-slate-400'}`}>
                        {alignment === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : alignment === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Texto largo</label>
                    <select value={selectedField.overflowPolicy || 'error'} onChange={(e) => updateTextStyle({ overflowPolicy: e.target.value as PDFMappedField['overflowPolicy'] })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100">
                      <option value="error">Avisar y detener</option><option value="shrink">Reducir tamaño</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Color</label>
                    <input type="color" value={selectedField.color || '#000000'} onChange={(e) => updateTextStyle({ color: e.target.value })}
                      className="w-full h-9 bg-slate-900 border border-slate-800 rounded-xl p-1" />
                  </div>
                </div>

                {selectedField.overflowPolicy === 'shrink' && (
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Tamaño mínimo (pt)</label>
                    <input type="number" min={4} max={selectedField.fontSize} step={0.25} value={selectedField.minFontSize ?? 6}
                      onChange={(e) => updateTextStyle({ minFontSize: Number(e.target.value) || 6 })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 font-mono" />
                  </div>
                )}

                {selectedField.fieldType === 'date' && (
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Formato de fecha</label>
                    <select value={selectedField.dateFormat || 'DD/MM/YYYY'} onChange={(e) => updateSelectedField({ dateFormat: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100">
                      <option value="DD/MM/YYYY">DD/MM/AAAA</option><option value="YYYY-MM-DD">AAAA-MM-DD</option><option value="DD-MM-YYYY">DD-MM-AAAA</option>
                    </select>
                  </div>
                )}

                {selectedField.fieldType === 'number' && (
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono uppercase font-bold mb-1">Formato numérico</label>
                    <select value={selectedField.numberFormat || 'integer'} onChange={(e) => updateSelectedField({ numberFormat: e.target.value as PDFMappedField['numberFormat'] })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100">
                      <option value="integer">Entero</option><option value="decimal">Decimal</option><option value="currency">Moneda COP</option>
                    </select>
                  </div>
                )}

                {selectedField.fieldType !== 'checkbox' && (
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input type="checkbox" checked={Boolean(selectedField.isCharacterByCharacter)}
                        onChange={(e) => updateSelectedField({
                          isCharacterByCharacter: e.target.checked,
                          fontFamily: e.target.checked ? 'courier' : selectedField.fontFamily,
                          stripCharacterSeparators: e.target.checked && selectedField.fieldType === 'date'
                            ? (selectedField.stripCharacterSeparators ?? true)
                            : selectedField.stripCharacterSeparators,
                        })} />
                      Una letra por casilla
                    </label>
                    {selectedField.isCharacterByCharacter && (
                      <div className="space-y-2 border-t border-slate-800 pt-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#c4d600]">Calibración precisa de casillas</p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] text-slate-400">Cantidad de casillas
                            <input type="number" min={1} max={100} value={selectedField.characterCount ?? selectedField.maxLength ?? 1}
                              onChange={(e) => updateSelectedField({ characterCount: Number(e.target.value), maxLength: Number(e.target.value) })}
                              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100" />
                          </label>
                          <label className="text-[10px] text-slate-400">Separación (pt)
                            <input type="number" min={-20} max={100} step={0.1} value={selectedField.characterSpacing ?? 0}
                              onChange={(e) => updateSelectedField({ characterSpacing: Number(e.target.value) })}
                              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100" />
                          </label>
                          <label className="text-[10px] text-slate-400">Ancho por casilla
                            <input type="number" min={0.1} max={100} step={0.1} placeholder="Automático" value={selectedField.characterCellWidth ?? ''}
                              onChange={(e) => updateSelectedField({ characterCellWidth: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })}
                              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100" />
                          </label>
                          <label className="text-[10px] text-slate-400">Inicio horizontal X
                            <input type="number" min={-100} max={100} step={0.1} value={selectedField.characterOffsetX ?? 0}
                              onChange={(e) => updateSelectedField({ characterOffsetX: Number(e.target.value) })}
                              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100" />
                          </label>
                          <label className="text-[10px] text-slate-400">Desplazamiento vertical
                            <input type="number" min={-100} max={100} step={0.1} value={selectedField.characterOffsetY ?? 0}
                              onChange={(e) => updateSelectedField({ characterOffsetY: Number(e.target.value) })}
                              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100" />
                          </label>
                          <label className="flex items-end gap-2 pb-1 text-[10px] text-slate-300">
                            <input type="checkbox" checked={Boolean(selectedField.stripCharacterSeparators)}
                              onChange={(e) => updateSelectedField({ stripCharacterSeparators: e.target.checked })} />
                            Quitar /, guiones y espacios
                          </label>
                        </div>
                        <label className="block text-[10px] text-slate-400">Corrección individual por carácter
                          <input
                            key={`${selectedField.id}-character-offsets`}
                            type="text"
                            defaultValue={(selectedField.characterOffsets || []).join(', ')}
                            placeholder="Ej. 0, 0.3, 0, -0.2, 0, 0, 0, 0"
                            onBlur={(event) => updateSelectedField({
                              characterOffsets: event.target.value.trim()
                                ? event.target.value.split(',').map((value) => Number(value.trim()) || 0)
                                : undefined,
                            })}
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100"
                          />
                        </label>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[9px] leading-relaxed text-slate-500">Las guías punteadas muestran la posición real de cada letra. Los cambios también se aplican al PDF generado.</p>
                          <button type="button" onClick={() => updateSelectedField({ characterSpacing: 0, characterCellWidth: undefined, characterOffsetX: 0, characterOffsetY: 0, characterOffsets: undefined })}
                            className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-[9px] font-bold text-slate-400 hover:text-white">Restablecer</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={selectedField.bold} onChange={(e) => updateTextStyle({ bold: e.target.checked })} /> Negrita</label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={selectedField.uppercase} onChange={(e) => updateTextStyle({ uppercase: e.target.checked })} /> Mayúsculas</label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={Boolean(selectedField.required)} onChange={(e) => updateSelectedField({ required: e.target.checked })} /> Obligatorio</label>
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => deleteField(selectedField.id)}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/40 hover:border-rose-500/40 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 font-bold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Campo (Supr)</span>
                </button>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 space-y-3">
                <MousePointer2 className="w-8 h-8 mx-auto opacity-40 text-[#c4d600]" />
                <p className="text-xs">
                  Haz clic en <span className="text-amber-400 font-bold">+ Check [X]</span> o <span className="text-[#c4d600] font-bold">Dibujar</span> para agregar y calibrar casillas.
                </p>
                <div className="text-[11px] text-slate-500 space-y-1 bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-left font-mono">
                  <p className="font-bold text-slate-400">Atajos rápidos:</p>
                  <p>• Arrastra cualquier casilla con el ratón</p>
                  <p>• Flechas: mover 0,25pt (Shift: 1pt)</p>
                  <p>• Tecla Supr / Backspace: borrar</p>
                </div>
              </div>
            )}
          </div>

          {/* Fields List for Current Page */}
          <div className="h-56 bg-[#0a1824] flex flex-col">
            <div className="p-3 border-b border-slate-800 bg-[#0f182a] flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300">
                Campos en Pág. {currentPage + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[#c4d600] bg-[#c4d600]/10 px-2 py-0.5 rounded-md font-mono font-bold">
                  {fields.filter((f) => f.page === currentPage).length}
                </span>
                {fields.filter((f) => f.page === currentPage).length > 0 && (
                  <button
                    onClick={cleanCurrentPage}
                    title="Borrar todos los campos de esta página"
                    className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-800/40">
              {fields.filter((f) => f.page === currentPage).length === 0 ? (
                <p className="text-[11px] text-center text-slate-500 py-6">
                  No hay campos en esta página
                </p>
              ) : (
                fields
                  .filter((f) => f.page === currentPage)
                  .map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFieldId(f.id)}
                      className={`flex items-center justify-between gap-2 p-2 rounded-xl cursor-pointer text-xs transition-colors ${
                        selectedFieldId === f.id
                          ? 'bg-[#c4d600]/15 text-white font-bold border border-[#c4d600]/40'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getBorderColorForSource(f.dataSource) }}
                        />
                        <span className="truncate">{f.label || f.fieldKey}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                            f.fieldType === 'checkbox'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}
                        >
                          {f.fieldType === 'checkbox' ? 'CHECK' : 'TXT'}
                        </span>

                        {/* Explicit, dedicated Red Trash Button to delete this field */}
                        <button
                          type="button"
                          title="Eliminar este campo"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(f.id);
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {showJsonEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#0b1725] shadow-2xl">
            <header className="flex flex-col gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Definición completa del mapeo actual</p>
                <h3 className="text-xl font-bold text-white">{name || 'Plantilla sin nombre'} · JSON editable</h3>
                <p className="mt-1 text-xs text-slate-400">Puedes corregir coordenadas, tamaños, fuentes, reglas, valores o añadir objetos dentro de <b>fields</b>. El PDF base se conserva.</p>
              </div>
              <button type="button" onClick={() => setShowJsonEditor(false)} className="self-start rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800" aria-label="Cerrar editor JSON">
                <X className="h-4 w-4" />
              </button>
            </header>

            <textarea
              value={mappingJson}
              onChange={(event) => { setMappingJson(event.target.value); setMappingJsonError(''); }}
              spellCheck={false}
              aria-label="JSON completo del mapeo"
              className="min-h-0 flex-1 resize-none bg-[#07111c] p-5 font-mono text-xs leading-relaxed text-slate-200 outline-none selection:bg-cyan-500/30"
            />

            <footer className="border-t border-slate-800 p-4">
              {mappingJsonError && (
                <div role="alert" className="mb-3 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{mappingJsonError}</div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">Aplicar modifica el borrador en pantalla. Usa “Guardar Plantilla” para conservarlo definitivamente.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void copyMappingJson()} className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">
                    <ClipboardCopy className="h-4 w-4" /> Copiar JSON
                  </button>
                  <button type="button" onClick={() => setShowJsonEditor(false)} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">Cancelar</button>
                  <button type="button" onClick={applyMappingJson} className="rounded-xl bg-[#c4d600] px-5 py-2 text-xs font-bold text-slate-950 hover:bg-[#d2e300]">Aplicar cambios</button>
                </div>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFTemplateDesigner;
