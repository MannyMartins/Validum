// ============================================================
// MOTOR DE PROCESAMIENTO PDF
// Renderiza PDFs como imágenes y escribe datos en coordenadas
// ============================================================

import { PDFCheckBox, PDFDocument, PDFDropdown, PDFFont, PDFImage, PDFTextField, StandardFonts, TextAlignment as PDFTextAlignment, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { FormTemplate, PDFMappedField } from '../types/formularios';
import type { Empleado, Empresa } from '../types/validum';
import { normalizeSexValue, resolveFieldValue as resolveMappedFieldValue } from './mappingUtils';

// La versión en la URL evita reutilizar respuestas antiguas cacheadas con un
// MIME incorrecto después de actualizar la configuración del servidor.
pdfjsLib.GlobalWorkerOptions.workerSrc = `${pdfWorkerUrl}?v=20260915-1`;

// ============================================================
// RENDERIZADO DE PDF → IMAGEN (para el diseñador visual)
// ============================================================

/**
 * Carga un documento PDF desde un string Base64.
 * Retorna el documento de PDF.js para renderizar páginas.
 */
export async function loadPDFDocument(base64: string) {
  const cleanBase64 = base64.replace(/^data:application\/pdf;base64,/, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return pdfjsLib.getDocument({ data: bytes }).promise;
}

/** Agrega soportes PDF o imágenes al final del formulario, manteniendo el orden indicado. */
export async function anexarSoportesAPdf(formularioBase64: string, soportes: File[]): Promise<string> {
  if (soportes.length === 0) return formularioBase64;
  const formulario = await PDFDocument.load(base64ToUint8Array(formularioBase64));
  for (const soporte of soportes) {
    const bytes = new Uint8Array(await soporte.arrayBuffer());
    if (soporte.type === 'application/pdf' || soporte.name.toLowerCase().endsWith('.pdf')) {
      const anexo = await PDFDocument.load(bytes);
      const pages = await formulario.copyPages(anexo, anexo.getPageIndices());
      pages.forEach(page => formulario.addPage(page));
      continue;
    }
    const lowerName = soporte.name.toLowerCase();
    const isPng = soporte.type === 'image/png' || lowerName.endsWith('.png');
    const isJpeg = ['image/jpeg', 'image/jpg'].includes(soporte.type) || /\.jpe?g$/.test(lowerName);
    if (isPng || isJpeg) {
      const imagen = isPng ? await formulario.embedPng(bytes) : await formulario.embedJpg(bytes);
      const page = formulario.addPage([595.28, 841.89]);
      const scale = Math.min((page.getWidth() - 36) / imagen.width, (page.getHeight() - 36) / imagen.height);
      page.drawImage(imagen, { x: (page.getWidth() - imagen.width * scale) / 2, y: (page.getHeight() - imagen.height * scale) / 2, width: imagen.width * scale, height: imagen.height * scale });
      continue;
    }
    throw new Error(`El soporte "${soporte.name}" no es PDF, PNG ni JPEG. Convierte el archivo antes de anexarlo.`);
  }
  return uint8ArrayToBase64(await formulario.save());
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64.replace(/^data:application\/pdf;base64,/, ''));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export interface AcroFormFieldInfo {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  options?: string[];
  maxLength?: number;
  combed?: boolean;
}

export interface PDFTemplateInspection {
  pageCount: number;
  pageSizes: Array<{ width: number; height: number }>;
  layoutFingerprint: string;
  acroFields: AcroFormFieldInfo[];
  populatedAcroFieldCount: number;
}

function stableLayoutHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function getLayoutFingerprint(base64: string): Promise<string> {
  const document = await loadPDFDocument(base64);
  const fragments: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      content.items.forEach((rawItem) => {
        const item = rawItem as { str?: unknown; transform?: unknown };
        if (typeof item.str !== 'string' || !Array.isArray(item.transform)) return;
        let text = item.str.normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase();
        if (!text) return;
        // Los códigos de radicación y el número legible de un código de barras pueden
        // cambiar entre copias sin modificar la distribución del formulario.
        if (!text.includes(' ') && text.length >= 12 && (text.match(/\d/g)?.length || 0) >= 5) text = '#CODIGO_VARIABLE#';
        else text = text.replace(/\d{5,}/g, '#NUMERO_VARIABLE#');
        const x = Math.round(Number(item.transform[4] || 0) * 2) / 2;
        const y = Math.round(Number(item.transform[5] || 0) * 2) / 2;
        fragments.push(`${pageNumber}:${x}:${y}:${text}`);
      });
    }
  } finally {
    await document.destroy();
  }
  return fragments.length ? `${fragments.length}-${stableLayoutHash(fragments.join('|'))}` : '';
}

/** Inspecciona campos interactivos y detecta plantillas que ya contienen datos. */
export async function inspectPDFTemplate(base64: string): Promise<PDFTemplateInspection> {
  const [pdfDoc, layoutFingerprint] = await Promise.all([
    PDFDocument.load(base64ToUint8Array(base64)),
    getLayoutFingerprint(base64),
  ]);
  const pages = pdfDoc.getPages();
  const pageByRef = new Map(pages.map((page, index) => [String(page.ref), index]));
  const acroFields: AcroFormFieldInfo[] = [];
  let populatedAcroFieldCount = 0;

  for (const field of pdfDoc.getForm().getFields()) {
    let type: AcroFormFieldInfo['type'] | null = null;
    let value = '';
    let options: string[] | undefined;
    let maxLength: number | undefined;
    let combed: boolean | undefined;
    if (field instanceof PDFTextField) {
      type = 'text';
      value = field.getText() || '';
      maxLength = field.getMaxLength();
      combed = field.isCombed();
    } else if (field instanceof PDFCheckBox) {
      type = 'checkbox';
      value = field.isChecked() ? 'X' : '';
    } else if (field instanceof PDFDropdown) {
      type = 'dropdown';
      value = field.getSelected()[0] || '';
      options = field.getOptions();
    }
    if (!type) continue;
    if (value.trim()) populatedAcroFieldCount += 1;

    const widgets = field.acroField.getWidgets();
    for (const widget of widgets) {
      const rect = widget.getRectangle();
      acroFields.push({
        name: field.getName(),
        type,
        page: pageByRef.get(String(widget.P?.())) ?? 0,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        value,
        options,
        maxLength,
        combed,
      });
    }
  }

  return {
    pageCount: pages.length,
    pageSizes: pages.map(page => ({ width: page.getWidth(), height: page.getHeight() })),
    layoutFingerprint,
    acroFields,
    populatedAcroFieldCount,
  };
}

/**
 * Renderiza una página específica del PDF como imagen en un canvas.
 * @param base64 - PDF en Base64
 * @param pageNumber - Número de página (1-indexed)
 * @param scale - Factor de escala (1.0 = tamaño original, 2.0 = doble)
 * @returns Canvas con la página renderizada y las dimensiones del viewport
 */
export async function renderPDFPageToCanvas(
  base64: string,
  pageNumber: number,
  scale: number = 1.5
): Promise<{
  canvas: HTMLCanvasElement;
  viewport: { width: number; height: number; scale: number };
  pdfWidth: number;
  pdfHeight: number;
}> {
  const pdfDoc = await loadPDFDocument(base64);
  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d')!;
  await (page.render({ canvasContext: context, viewport, canvas } as any)).promise;

  // Dimensiones originales del PDF (sin escala) para coordenadas precisas
  const originalViewport = page.getViewport({ scale: 1.0 });

  return {
    canvas,
    viewport: { width: viewport.width, height: viewport.height, scale },
    pdfWidth: originalViewport.width,
    pdfHeight: originalViewport.height,
  };
}

/**
 * Obtiene el número total de páginas de un PDF.
 */
export async function getPDFPageCount(base64: string): Promise<number> {
  const pdfDoc = await loadPDFDocument(base64);
  return pdfDoc.numPages;
}

/**
 * Genera una miniatura (thumbnail) de la primera página del PDF.
 * @returns DataURL de la miniatura en formato JPEG
 */
export async function generatePDFThumbnail(base64: string): Promise<string> {
  const { canvas } = await renderPDFPageToCanvas(base64, 1, 0.3);
  return canvas.toDataURL('image/jpeg', 0.7);
}

// ============================================================
// CONVERSIÓN DE IMAGEN A PDF
// ============================================================

/**
 * Convierte una imagen (PNG/JPG) a PDF para poder usarla como plantilla.
 * @param imageBase64 - Imagen en Base64 (con o sin data URI prefix)
 * @param mimeType - Tipo MIME de la imagen
 * @returns PDF en Base64
 */
export async function imageToPDF(
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg'
): Promise<string> {
  const pdfDoc = await PDFDocument.create();

  // Remover el prefijo data URI si existe
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  const imageBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));

  const image = mimeType === 'image/png'
    ? await pdfDoc.embedPng(imageBytes)
    : await pdfDoc.embedJpg(imageBytes);

  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  const pdfBytes = await pdfDoc.save();
  return uint8ArrayToBase64(pdfBytes);
}

// ============================================================
// AUTO-LLENADO DE PDF (el corazón del sistema)
// ============================================================

/**
 * Resuelve el valor de un campo mapeado usando los datos del sistema.
 */
function resolveFieldValue(
  field: PDFMappedField,
  empleado: Empleado,
  empresa: Empresa,
  manualFields: Record<string, string>,
  tramiteData: Record<string, string>
): string {
  let value = '';

  if (field.dataSource === 'manual') {
    value = manualFields[field.fieldKey] || field.defaultValue || '';
  } else if (field.dataSource === 'tramite') {
    value = tramiteData[field.fieldKey] || field.defaultValue || '';
  } else if (field.dataSource === 'empresa') {
    value = resolveEmpresaField(field.fieldKey, empresa);
  } else if (field.dataSource === 'cotizante') {
    value = resolveEmpleadoField(field.fieldKey, empleado);
  } else if (field.dataSource === 'familiar') {
    value = manualFields[field.fieldKey] || field.defaultValue || '';
  }

  // Aplicar transformaciones
  if (field.uppercase && value) {
    value = value.toUpperCase();
  }

  // Para checkboxes, verificar si el valor coincide
  if (field.fieldType === 'checkbox') {
    const resolvedValue = resolveCheckboxValue(field, empleado, empresa, manualFields, tramiteData);
    return resolvedValue ? (field.checkboxCharacter || 'X') : '';
  }

  // Formatear números
  if (field.fieldType === 'number' && value && field.numberFormat === 'currency') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      value = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(num);
    }
  }

  return value;
}

/**
 * Resuelve un campo del empleado por su clave.
 */
function resolveEmpleadoField(key: string, emp: Empleado): string {
  const map: Record<string, () => string> = {
    primerApellido: () => emp.primerApellido || emp.apellidos?.split(' ')[0] || '',
    segundoApellido: () => emp.segundoApellido || emp.apellidos?.split(' ')[1] || '',
    primerNombre: () => emp.primerNombre || emp.nombres?.split(' ')[0] || '',
    segundoNombre: () => emp.segundoNombre || emp.nombres?.split(' ')[1] || '',
    tipoDocumento: () => emp.tipoDocumento || 'CC',
    numeroDocumento: () => emp.numeroDocumento || emp.cedula || '',
    sexo: () => emp.sexo || '',
    sexoFemenino: () => normalizeSexValue(emp.sexo) === 'F' ? 'X' : '',
    sexoMasculino: () => normalizeSexValue(emp.sexo) === 'M' ? 'X' : '',
    fechaNacimiento: () => emp.fechaNacimiento || '',
    identidadGenero: () => emp.identidadGenero || '',
    paisNacimiento: () => emp.paisNacimiento || '',
    departamentoNacimiento: () => emp.departamentoNacimiento || '',
    ciudadNacimiento: () => emp.ciudadNacimiento || '',
    paisExpedicion: () => emp.paisExpedicion || '',
    departamentoExpedicion: () => emp.departamentoExpedicion || '',
    ciudadExpedicion: () => emp.ciudadExpedicion || '',
    fechaExpedicion: () => emp.fechaExpedicion || '',
    email: () => emp.emailCotizante || '',
    telefono: () => emp.telefonoCotizante || '',
    direccion: () => emp.direccion || '',
    barrio: () => emp.barrio || '',
    ciudad: () => emp.ciudadResidencia || '',
    departamentoResidencia: () => emp.departamentoResidencia || '',
    zona: () => emp.zona === 'U' ? 'URBANA' : emp.zona === 'R' ? 'RURAL' : '',
    etnia: () => emp.etnia || 'NINGUNO',
    discapacidad: () => emp.discapacidad || 'NINGUNA',
    puntajeSisben: () => emp.puntajeSisben?.toString() || '',
    grupoEspecial: () => emp.grupoEspecial || '',
    eps: () => emp.eps || '',
    arl: () => emp.arl || '',
    afp: () => emp.afp || '',
    ccf: () => emp.ccf || '',
    tipoCotizante: () => emp.tipoCotizante || '',
    tipoAfiliacion: () => emp.tipoAfiliacion || '',
    solicitudSat: () => emp.solicitudSat || '',
    ibc: () => emp.ibc?.toString() || '',
    ibcFormateado: () => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(emp.ibc || 0),
    riesgoArl: () => {
      const niveles = ['', 'I', 'II', 'III', 'IV', 'V'];
      return niveles[emp.riesgoArl] || '';
    },
    riesgoArlNumero: () => emp.riesgoArl?.toString() || '',
    cargo: () => emp.cargo || '',
    departamentoLaboral: () => emp.departamento || '',
    fechaIngreso: () => emp.fechaIngreso || '',
    salarioBase: () => emp.salarioBase?.toString() || '',
    salarioBaseFormateado: () => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(emp.salarioBase || 0),
    administradoraPensiones: () => emp.afp || 'NINGUNO',
  };

  const resolver = map[key];
  return resolver ? resolver() : '';
}

/**
 * Resuelve un campo de la empresa por su clave.
 */
function resolveEmpresaField(key: string, emp: Empresa): string {
  const map: Record<string, () => string> = {
    razonSocial: () => emp.razonSocial || '',
    nit: () => emp.nit || '',
    dv: () => emp.dv || '',
    nitCompleto: () => `${emp.nit}-${emp.dv}`,
    tipoDocumentoEmpresa: () => 'NIT',
    direccionEmpresa: () => emp.direccion || '',
    ciudadEmpresa: () => emp.ciudad || '',
    telefonoEmpresa: () => emp.telefono || '',
    emailEmpresa: () => emp.email || '',
    representanteLegal: () => emp.representanteLegal || '',
    cedulaRepresentante: () => emp.cedulaRepresentante || '',
    operadorPila: () => emp.operadorPila || '',
    nombreComercial: () => emp.razonSocial || '',
  };

  const resolver = map[key];
  return resolver ? resolver() : '';
}

/**
 * Resuelve si un checkbox debe estar marcado.
 */
function resolveCheckboxValue(
  field: PDFMappedField,
  empleado: Empleado,
  empresa: Empresa,
  manualFields: Record<string, string> = {},
  tramiteData: Record<string, string> = {}
): boolean {
  const key = field.fieldKey;

  // 1. Checks directos de Cotizante
  if (key === 'sexoFemenino') {
    return normalizeSexValue(empleado.sexo) === 'F';
  }
  if (key === 'sexoMasculino') {
    return normalizeSexValue(empleado.sexo) === 'M';
  }
  if (key === 'zonaUrbana') {
    const z = (empleado.zona || 'U').toUpperCase();
    return z === 'U' || z.startsWith('URB');
  }
  if (key === 'zonaRural') {
    const z = (empleado.zona || '').toUpperCase();
    return z === 'R' || z.startsWith('RUR');
  }

  // 2. Checks automáticos de Trámite y Novedades (Resolución 974 / SGSSS)
  const tipoTramite = (tramiteData['tipoTramite'] || 'AFILIACION').toUpperCase();
  const subTipo = (tramiteData['subTipoTramite'] || 'INICIO_RELACION').toUpperCase();

  if (key === 'tipoTramiteAfiliacion') {
    return tipoTramite === 'AFILIACION';
  }
  if (key === 'tipoTramiteNovedad') {
    return tipoTramite === 'NOVEDAD';
  }
  if (key === 'tipoAfiliacionIndividual') {
    return (tramiteData['tipoAfiliacion'] || 'INDIVIDUAL').toUpperCase() === 'INDIVIDUAL';
  }
  if (key === 'tipoAfiliacionCotizante') {
    return true; // Por defecto cotizante principal
  }
  if (key === 'regimenContributivo') {
    return (tramiteData['regimen'] || 'CONTRIBUTIVO').toUpperCase() === 'CONTRIBUTIVO';
  }
  if (key === 'regimenSubsidiado') {
    return (tramiteData['regimen'] || '').toUpperCase() === 'SUBSIDIADO';
  }
  if (key === 'tipoAfiliadoCotizante') {
    return (tramiteData['tipoAfiliado'] || 'COTIZANTE').toUpperCase() === 'COTIZANTE';
  }
  if (key === 'tipoCotizanteDependiente') {
    const tc = (empleado.tipoCotizante || 'Dependiente').toUpperCase();
    return (tc.includes('DEPEN') && !tc.includes('INDEPEN')) || tc === '01' || (tramiteData['tipoCotizante'] || 'DEPENDIENTE').toUpperCase() === 'DEPENDIENTE';
  }
  if (key === 'tipoCotizanteIndependiente') {
    const tc = (empleado.tipoCotizante || '').toUpperCase();
    return tc.includes('INDEPEN') || tc === '03' || (tramiteData['tipoCotizante'] || '').toUpperCase() === 'INDEPENDIENTE';
  }

  // 3. Casillas de Novedades (Sección VI - Casillas 1 a 18)
  if (key === 'novedadInicioRelacionLaboral') {
    // Check 9: Inicio de relación laboral (muy solicitado)
    return subTipo === 'INICIO_RELACION' || tramiteData['novedadInicioRelacionLaboral'] === 'X' || tipoTramite === 'AFILIACION';
  }
  if (key === 'novedadModificacionDatos') {
    return subTipo === 'MODIFICACION_DATOS' || tramiteData['novedadModificacionDatos'] === 'X';
  }
  if (key === 'novedadInclusionBeneficiarios') {
    return subTipo === 'INCLUSION_BENEFICIARIOS' || tramiteData['novedadInclusionBeneficiarios'] === 'X';
  }
  if (key === 'novedadTraslado') {
    return subTipo === 'TRASLADO' || tramiteData['novedadTraslado'] === 'X';
  }
  if (key === 'novedadTerminacionRelacion') {
    return subTipo === 'TERMINACION_RELACION' || tramiteData['novedadTerminacionRelacion'] === 'X';
  }

  // 4. Declaraciones y Autorizaciones (Sección VII - Casillas 46 a 53)
  // En formularios oficiales, las autorizaciones estándar van marcadas por ley
  if (key.startsWith('declaracion_') || key.startsWith('autorizacion_')) {
    return true;
  }

  // 5. Comparación directa por valor coincidente
  if (field.checkboxMatchValue) {
    let actualValue = '';
    if (field.dataSource === 'cotizante') {
      actualValue = resolveEmpleadoField(field.fieldKey.replace(/Check$/, ''), empleado);
    } else if (field.dataSource === 'empresa') {
      actualValue = resolveEmpresaField(field.fieldKey, empresa);
    } else if (field.dataSource === 'tramite') {
      actualValue = tramiteData[field.fieldKey] || '';
    }
    return actualValue.toUpperCase() === field.checkboxMatchValue.toUpperCase();
  }

  // 6. Valores booleanos genéricos o manuales
  if (field.defaultValue === 'X' || field.defaultValue === '✓' || field.defaultValue === 'true') {
    return true;
  }

  if (field.dataSource === 'manual') {
    const val = manualFields[field.fieldKey] || field.defaultValue || '';
    return val === 'X' || val === '✓' || val === 'true' || val === '1';
  }

  if (field.dataSource === 'cotizante') {
    const val = resolveEmpleadoField(field.fieldKey, empleado);
    return val === 'X' || val === '✓' || val === 'true';
  }

  if (field.dataSource === 'tramite') {
    const val = tramiteData[field.fieldKey] || '';
    return val === 'X' || val === '✓' || val === 'true';
  }

  return false;
}

/**
 * Rellena un PDF con los datos del sistema usando la configuración de la plantilla.
 * Este es el método principal del motor de auto-llenado.
 *
 * @param template - Plantilla con el PDF base y los campos mapeados
 * @param empleado - Datos del cotizante seleccionado
 * @param empresa - Datos de la empresa
 * @param manualFields - Campos manuales llenados por el usuario
 * @param tramiteData - Datos específicos del trámite
 * @returns PDF rellenado en Base64
 */
export async function fillPDFTemplate(
  template: FormTemplate,
  empleado: Empleado,
  empresa: Empresa,
  manualFields: Record<string, string> = {},
  tramiteData: Record<string, string> = {}
): Promise<string> {
  if ((template.mappingStatus || (template.fields.length ? 'ready' : 'draft')) !== 'ready') {
    throw new Error(`La plantilla "${template.name}" todavía está pendiente de calibración.`);
  }

  let pdfBytes: Uint8Array;
  if (template.pdfBase64 && template.pdfBase64.trim() !== '') {
    const cleanBase64 = template.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
  } else if (template.pdfAssetPath) {
    const resp = await fetch(template.pdfAssetPath);
    if (!resp.ok) throw new Error(`No se pudo cargar el PDF base (${resp.status}).`);
    const buffer = await resp.arrayBuffer();
    pdfBytes = new Uint8Array(buffer);
  } else {
    throw new Error(`La plantilla "${template.name}" no tiene un PDF base asociado.`);
  }
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const fonts = {
    helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    'helvetica-bold': await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    courier: await pdfDoc.embedFont(StandardFonts.Courier),
    'courier-bold': await pdfDoc.embedFont(StandardFonts.CourierBold),
    times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    'times-bold': await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
  };

  const issues: string[] = [];
  const acroValues = new Map<string, { field: PDFMappedField; value: string }>();
  const drawingPlan: Array<{ field: PDFMappedField; value: string; font: PDFFont; fontSize: number }> = [];
  const stampPlan: Array<{ field: PDFMappedField; font: PDFFont; fontSize: number }> = [];
  const signaturePlan: Array<{ field: PDFMappedField; image: PDFImage }> = [];
  const pages = pdfDoc.getPages();

  for (const field of template.fields) {
    let value = resolveMappedFieldValue(field, empleado, empresa, manualFields, tramiteData);
    if (field.required && !value) issues.push(`${field.label}: falta un valor obligatorio.`);
    if (!value && !field.acroFieldName) continue;
    if (!Number.isInteger(field.page) || field.page < 0 || field.page >= pages.length) {
      issues.push(`${field.label}: la página ${field.page + 1} no existe.`);
      continue;
    }
    if (![field.x, field.y, field.width, field.height, field.fontSize].every(Number.isFinite) || field.width <= 0 || field.height <= 0) {
      issues.push(`${field.label}: coordenadas o dimensiones inválidas.`);
      continue;
    }
    const page = pages[field.page];
    if (field.x < 0 || field.y < 0 || field.x + field.width > page.getWidth() + 0.5 || field.y + field.height > page.getHeight() + 0.5) {
      issues.push(`${field.label}: el rectángulo está fuera de los límites de la página ${field.page + 1}.`);
      continue;
    }
    if (/^data:image\/png;base64,/i.test(value)) {
      try {
        const cleanBase64 = value.replace(/^data:image\/png;base64,/i, '');
        const bytes = Uint8Array.from(atob(cleanBase64), character => character.charCodeAt(0));
        signaturePlan.push({ field, image: await pdfDoc.embedPng(bytes) });
      } catch {
        issues.push(`${field.label}: la firma dibujada no contiene una imagen PNG válida.`);
      }
      continue;
    }
    if (field.isCharacterByCharacter && field.stripCharacterSeparators) {
      value = value.replace(/[\s/.-]+/g, '');
    }
    if (field.maxLength && Array.from(value).length > field.maxLength) {
      issues.push(`${field.label}: excede el máximo de ${field.maxLength} caracteres.`);
      continue;
    }
    if (field.fieldType === 'stamp') {
      const fontKey = `${field.fontFamily}${field.bold ? '-bold' : ''}` as keyof typeof fonts;
      const font = fonts[fontKey] || fonts.helvetica;
      const mainText = field.uppercase ? value.toUpperCase() : value;
      const subText = field.uppercase ? (field.stampSubtext || '').toUpperCase() : (field.stampSubtext || '');
      const padding = Math.max(2, field.padding ?? 3);
      const availableWidth = field.width - padding * 2;
      const availableHeight = field.height - padding * 2;
      try {
        font.encodeText(`${mainText}${subText}`);
      } catch {
        issues.push(`${field.label}: el sello contiene caracteres que la fuente no puede representar.`);
        continue;
      }
      const subRatio = subText ? 0.55 : 0;
      const mainWidth = font.widthOfTextAtSize(mainText, field.fontSize);
      const subWidth = subText ? font.widthOfTextAtSize(subText, field.fontSize * subRatio) : 0;
      const totalHeight = font.heightAtSize(field.fontSize, { descender: true }) * (subText ? 1.7 : 1);
      const scale = Math.min(1, availableWidth / Math.max(mainWidth, subWidth, 1), availableHeight / Math.max(totalHeight, 1));
      const fontSize = field.fontSize * scale;
      if (scale < 0.999 && (field.overflowPolicy || 'error') === 'error') {
        issues.push(`${field.label}: el texto del sello no cabe a ${field.fontSize} pt.`);
        continue;
      }
      if (fontSize < (field.minFontSize ?? 5)) {
        issues.push(`${field.label}: el sello necesitaría una fuente menor al mínimo permitido.`);
        continue;
      }
      stampPlan.push({ field, font, fontSize });
      continue;
    }
    if (field.acroFieldName) {
      const previous = acroValues.get(field.acroFieldName);
      if (previous && previous.value !== value) issues.push(`${field.label}: el campo AcroForm ${field.acroFieldName} recibe valores distintos.`);
      acroValues.set(field.acroFieldName, { field, value });
      continue;
    }

    const fontKey = `${field.fontFamily}${field.bold ? '-bold' : ''}` as keyof typeof fonts;
    const font = fonts[fontKey] || fonts.helvetica;
    const padding = Math.max(0, field.padding ?? 1);
    const availableWidth = field.width - padding * 2;
    const availableHeight = field.height - padding * 2;
    if (availableWidth <= 0 || availableHeight <= 0) {
      issues.push(`${field.label}: el margen interior deja el campo sin espacio disponible.`);
      continue;
    }

    let fontSize = field.fontSize;
    const characters = Array.from(value);
    const cellCount = field.isCharacterByCharacter ? (field.characterCount || field.maxLength || characters.length) : 0;
    if (field.isCharacterByCharacter && characters.length > cellCount) {
      issues.push(`${field.label}: ${characters.length} caracteres no caben en ${cellCount} casillas.`);
      continue;
    }
    try {
      font.encodeText(value);
    } catch {
      issues.push(`${field.label}: contiene caracteres que la fuente ${field.fontFamily} no puede representar.`);
      continue;
    }

    const fullHeight = font.heightAtSize(field.fontSize, { descender: true });
    let widthScale = 1;
    let requiredWidth = font.widthOfTextAtSize(value, fontSize);
    if (field.isCharacterByCharacter) {
      const gap = Number(field.characterSpacing) || 0;
      const offsetX = Number(field.characterOffsetX) || 0;
      const cellWidth = field.characterCellWidth && field.characterCellWidth > 0
        ? field.characterCellWidth
        : (availableWidth - gap * Math.max(0, cellCount - 1)) / Math.max(cellCount, 1);
      const offsets = field.characterOffsets || [];
      const invalidCell = Array.from({ length: cellCount }, (_, index) => {
        const start = offsetX + index * (cellWidth + gap) + (offsets[index] || 0);
        return start < -0.01 || start + cellWidth > availableWidth + 0.01;
      }).some(Boolean);
      if (cellWidth <= 0 || cellWidth + gap <= 0 || invalidCell) {
        issues.push(`${field.label}: la separación configurada no deja espacio para las casillas.`);
        continue;
      }
      requiredWidth = Math.max(...characters.map(char => font.widthOfTextAtSize(char, fontSize)), 0);
      if (requiredWidth > cellWidth) widthScale = cellWidth / requiredWidth;
    } else if (requiredWidth > availableWidth) {
      widthScale = availableWidth / requiredWidth;
    }
    const heightScale = fullHeight > availableHeight ? availableHeight / fullHeight : 1;
    fontSize = field.fontSize * Math.min(1, widthScale, heightScale);

    if (fontSize < field.fontSize - 0.01) {
      if ((field.overflowPolicy || 'error') === 'error') {
        issues.push(`${field.label}: el valor no cabe a ${field.fontSize} pt. Amplía el campo o habilita ajuste automático.`);
        continue;
      }
      const minimum = field.minFontSize ?? 6;
      if (fontSize < minimum) {
        issues.push(`${field.label}: necesitaría ${fontSize.toFixed(1)} pt, menos del mínimo de ${minimum} pt.`);
        continue;
      }
    }
    drawingPlan.push({ field, value, font, fontSize: Math.min(field.fontSize, fontSize) });
  }

  const form = pdfDoc.getForm();
  for (const [name, assignment] of acroValues) {
    const target = form.getFieldMaybe(name);
    if (!target) {
      issues.push(`${assignment.field.label}: no existe el campo AcroForm ${name}.`);
      continue;
    }
    try {
      const assignedField = assignment.field;
      const assignedFontKey = `${assignedField.fontFamily}${assignedField.bold ? '-bold' : ''}` as keyof typeof fonts;
      const assignedFont = fonts[assignedFontKey] || fonts.helvetica;
      if (target instanceof PDFTextField) {
        target.setText(assignment.value);
        target.setFontSize(assignedField.fontSize);
        target.setAlignment(assignedField.alignment === 'center' ? PDFTextAlignment.Center : assignedField.alignment === 'right' ? PDFTextAlignment.Right : PDFTextAlignment.Left);
        target.updateAppearances(assignedFont);
      } else if (target instanceof PDFCheckBox) {
        assignment.value ? target.check() : target.uncheck();
        target.updateAppearances();
      }
      else if (target instanceof PDFDropdown) {
        if (assignment.value) target.select(assignment.value);
        else target.clear();
        target.setFontSize(assignedField.fontSize);
        target.updateAppearances(assignedFont);
      } else issues.push(`${assignment.field.label}: el tipo de campo AcroForm no es compatible.`);
    } catch (error) {
      issues.push(`${assignment.field.label}: no se pudo actualizar ${name} (${error instanceof Error ? error.message : 'error desconocido'}).`);
    }
  }

  if (issues.length) throw new Error(`No se pudo generar el PDF:\n- ${issues.join('\n- ')}`);

  for (const { field, image } of signaturePlan) {
    const page = pages[field.page];
    const padding = Math.max(0, field.padding ?? 1);
    const availableWidth = Math.max(1, field.width - padding * 2);
    const availableHeight = Math.max(1, field.height - padding * 2);
    const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, {
      x: field.x + (field.width - width) / 2,
      y: field.y + (field.height - height) / 2,
      width,
      height,
    });
  }

  for (const { field, font, fontSize } of stampPlan) {
    const page = pages[field.page];
    const border = colorComponents(field.stampBorderColor || '#B91C1C');
    const fill = colorComponents(field.stampFillColor || '#FFFFFF');
    const opacity = Math.min(1, Math.max(0.05, field.stampOpacity ?? 0.85));
    const borderWidth = Math.max(0.5, field.stampBorderWidth ?? 2);
    if (field.stampShape === 'circle') {
      page.drawEllipse({
        x: field.x + field.width / 2,
        y: field.y + field.height / 2,
        xScale: field.width / 2,
        yScale: field.height / 2,
        color: rgb(...fill),
        borderColor: rgb(...border),
        borderWidth,
        opacity: opacity * 0.12,
        borderOpacity: opacity,
      });
    } else {
      page.drawRectangle({
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        color: rgb(...fill),
        borderColor: rgb(...border),
        borderWidth,
        opacity: opacity * 0.12,
        borderOpacity: opacity,
      });
    }
    const main = field.uppercase ? (field.stampText || field.label).toUpperCase() : (field.stampText || field.label);
    const sub = field.uppercase ? (field.stampSubtext || '').toUpperCase() : (field.stampSubtext || '');
    const textColor = colorComponents(field.color || field.stampBorderColor || '#B91C1C');
    const subSize = fontSize * 0.55;
    const mainHeight = font.heightAtSize(fontSize, { descender: true });
    const subHeight = sub ? font.heightAtSize(subSize, { descender: true }) : 0;
    const gap = sub ? Math.max(1, fontSize * 0.18) : 0;
    const blockHeight = mainHeight + subHeight + gap;
    const blockBottom = field.y + (field.height - blockHeight) / 2;
    const mainWidth = font.widthOfTextAtSize(main, fontSize);
    page.drawText(main, { x: field.x + (field.width - mainWidth) / 2, y: blockBottom + subHeight + gap, size: fontSize, font, color: rgb(...textColor), opacity });
    if (sub) {
      const subWidth = font.widthOfTextAtSize(sub, subSize);
      page.drawText(sub, { x: field.x + (field.width - subWidth) / 2, y: blockBottom, size: subSize, font, color: rgb(...textColor), opacity });
    }
  }

  for (const { field, value, font, fontSize } of drawingPlan) {
    const page = pages[field.page];
    const padding = Math.max(0, field.padding ?? 1);
    const availableWidth = field.width - padding * 2;
    const colorHex = field.color && /^#[0-9A-Fa-f]{6}$/.test(field.color) ? field.color : '#000000';
    const red = parseInt(colorHex.slice(1, 3), 16) / 255;
    const green = parseInt(colorHex.slice(3, 5), 16) / 255;
    const blue = parseInt(colorHex.slice(5, 7), 16) / 255;
    const fullHeight = font.heightAtSize(fontSize, { descender: true });
    const ascent = font.heightAtSize(fontSize, { descender: false });
    const descent = Math.max(0, fullHeight - ascent);
    const availableHeight = field.height - padding * 2;
    const verticalOffset = field.verticalAlignment === 'top'
      ? availableHeight - fullHeight
      : field.verticalAlignment === 'bottom'
        ? 0
        : (availableHeight - fullHeight) / 2;
    const baseline = field.y + padding + Math.max(0, verticalOffset) + descent;

    if (field.isCharacterByCharacter) {
      const chars = Array.from(value);
      const count = field.characterCount || field.maxLength || chars.length;
      const gap = Number(field.characterSpacing) || 0;
      const offsetX = Number(field.characterOffsetX) || 0;
      const offsetY = Number(field.characterOffsetY) || 0;
      const offsets = field.characterOffsets || [];
      const cellWidth = field.characterCellWidth && field.characterCellWidth > 0
        ? field.characterCellWidth
        : (availableWidth - gap * Math.max(0, count - 1)) / Math.max(count, 1);
      chars.forEach((char, index) => {
        const charWidth = font.widthOfTextAtSize(char, fontSize);
        page.drawText(char, {
          x: field.x + padding + offsetX + index * (cellWidth + gap) + (offsets[index] || 0) + (cellWidth - charWidth) / 2,
          y: baseline + offsetY,
          size: fontSize,
          font,
          color: rgb(red, green, blue),
        });
      });
      continue;
    }

    const textWidth = font.widthOfTextAtSize(value, fontSize);
    const x = field.alignment === 'center'
      ? field.x + padding + (availableWidth - textWidth) / 2
      : field.alignment === 'right'
        ? field.x + field.width - padding - textWidth
        : field.x + padding;
    page.drawText(value, { x, y: baseline, size: fontSize, font, color: rgb(red, green, blue) });
  }

  const filledPdfBytes = await pdfDoc.save();
  return uint8ArrayToBase64(filledPdfBytes);
}

// ============================================================
// UTILIDADES
// ============================================================

/**
 * Convierte Uint8Array a string Base64
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function colorComponents(value: string): [number, number, number] {
  const color = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000';
  return [
    parseInt(color.slice(1, 3), 16) / 255,
    parseInt(color.slice(3, 5), 16) / 255,
    parseInt(color.slice(5, 7), 16) / 255,
  ];
}

/**
 * Convierte coordenadas del canvas (píxeles de pantalla) a coordenadas PDF (puntos).
 * En PDF, el origen (0,0) está en la esquina inferior-izquierda.
 * En canvas/pantalla, el origen está en la esquina superior-izquierda.
 */
export function canvasToPDFCoords(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: (canvasX / scale) * (pdfWidth / (canvasWidth / scale)),
    y: pdfHeight - ((canvasY / scale) * (pdfHeight / (canvasHeight / scale))),
  };
}

/**
 * Convierte coordenadas PDF (puntos) a coordenadas del canvas (píxeles de pantalla).
 */
export function pdfToCanvasCoords(
  pdfX: number,
  pdfY: number,
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: (pdfX / pdfWidth) * canvasWidth,
    y: ((pdfHeight - pdfY) / pdfHeight) * canvasHeight,
  };
}
