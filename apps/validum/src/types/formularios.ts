// ============================================================
// TIPOS DEL SISTEMA DE MAPEO Y AUTO-LLENADO DE FORMULARIOS PDF
// ============================================================

/** Tipo de campo sobre el PDF */
export type PDFFieldType = 'text' | 'checkbox' | 'date' | 'number' | 'stamp';

/** Fuente de datos para un campo */
export type FieldDataSource = 'cotizante' | 'empresa' | 'tramite' | 'familiar' | 'manual';

/** Tipo de entidad asociada a una plantilla */
export type EntityType = 'EPS' | 'ARL' | 'AFP' | 'CCF' | 'IPS' | 'OTRO';

/** Alineación del texto dentro del campo */
export type TextAlignment = 'left' | 'center' | 'right';

/** Alineación vertical del contenido dentro del rectángulo mapeado */
export type VerticalAlignment = 'bottom' | 'middle' | 'top';

/** Qué hacer cuando un valor no cabe en el rectángulo configurado */
export type TextOverflowPolicy = 'error' | 'shrink';

/** Familia tipográfica para escribir en el PDF */
export type PDFFontFamily = 'helvetica' | 'courier' | 'times';

/** Regla genérica que decide si una casilla se marca. */
export interface PDFCheckboxRule {
  /** Manual pregunta al generar; los demás modos evalúan datos o una constante explícita. */
  mode: 'manual' | 'always' | 'truthy' | 'equals' | 'notEquals';
  source?: FieldDataSource;
  fieldKey?: string;
  expectedValue?: string;
  /** Al marcar una casilla manual se desmarcan las demás del mismo grupo. */
  groupId?: string;
}

// ============================================================
// CAMPO MAPEADO SOBRE EL PDF
// ============================================================

/**
 * Representa un campo visual dibujado sobre el PDF,
 * mapeado a un dato del sistema Validum.
 */
export interface PDFMappedField {
  /** ID único del campo */
  id: string;

  // --- Posición y dimensiones sobre el PDF (en puntos PDF, 72 dpi) ---
  /** Coordenada X desde la esquina inferior-izquierda */
  x: number;
  /** Coordenada Y desde la esquina inferior-izquierda */
  y: number;
  /** Ancho del campo en puntos PDF */
  width: number;
  /** Alto del campo en puntos PDF */
  height: number;
  /** Número de página (0-indexed) */
  page: number;

  // --- Mapeo al dato del sistema ---
  /** Categoría de la fuente de datos */
  dataSource: FieldDataSource;
  /** Clave del campo en el catálogo (ej: 'primerApellido', 'nit') */
  fieldKey: string;
  /** Etiqueta legible para el usuario (ej: "Primer Apellido") */
  label: string;

  // --- Estilo del texto ---
  /** Tamaño de fuente en puntos */
  fontSize: number;
  /** Familia tipográfica */
  fontFamily: PDFFontFamily;
  /** Alineación del texto */
  alignment: TextAlignment;
  /** Alineación vertical del texto */
  verticalAlignment?: VerticalAlignment;
  /** Si el texto se escribe en negrita */
  bold: boolean;
  /** Si el texto se convierte a mayúsculas */
  uppercase: boolean;
  /** Color del texto en hexadecimal */
  color: string;

  // --- Tipo de campo ---
  /** Tipo de dato del campo */
  fieldType: PDFFieldType;
  /** Para checkboxes: valor que activa el check (ej: 'X', '✓') */
  checkboxCharacter?: string;
  /** Para checkboxes: valor del dato que debe coincidir para marcar */
  checkboxMatchValue?: string;
  /** Regla general para decidir si la casilla se marca */
  checkboxRule?: PDFCheckboxRule;
  /** Para fechas: formato de salida (ej: 'DD/MM/YYYY') */
  dateFormat?: string;
  /** Para números: formato (ej: 'currency', 'integer', 'decimal') */
  numberFormat?: 'currency' | 'integer' | 'decimal';

  // --- Sellos creados dentro del diseñador ---
  stampText?: string;
  stampSubtext?: string;
  stampShape?: 'rectangle' | 'circle';
  stampBorderColor?: string;
  stampFillColor?: string;
  stampBorderWidth?: number;
  stampOpacity?: number;

  // --- Comportamiento ---
  /** Si es un campo individual por carácter (una casilla por letra) */
  isCharacterByCharacter: boolean;
  /** Espacio entre caracteres (solo si isCharacterByCharacter = true) */
  characterSpacing?: number;
  /** Ancho fijo de cada casilla; si se omite se distribuye en todo el rectángulo */
  characterCellWidth?: number;
  /** Desplazamiento horizontal inicial de la primera casilla, en puntos PDF */
  characterOffsetX?: number;
  /** Desplazamiento vertical del texto dentro de las casillas, en puntos PDF */
  characterOffsetY?: number;
  /** Corrección horizontal individual para cada carácter, en puntos PDF */
  characterOffsets?: number[];
  /** Elimina separadores como /, guion y espacios antes de repartir los caracteres */
  stripCharacterSeparators?: boolean;
  /** Número fijo de celdas cuando se diligencia carácter por carácter */
  characterCount?: number;
  /** Margen interior del campo en puntos PDF */
  padding?: number;
  /** Política de desbordamiento; error conserva el mismo tamaño de letra */
  overflowPolicy?: TextOverflowPolicy;
  /** Tamaño mínimo cuando overflowPolicy es shrink */
  minFontSize?: number;
  /** Longitud máxima admitida antes de generar */
  maxLength?: number;
  /** Nombre del campo AcroForm original, si el PDF ya es interactivo */
  acroFieldName?: string;
  /** Indica si el dato debe existir antes de generar */
  required?: boolean;
  /** Valor por defecto si el dato del sistema está vacío */
  defaultValue?: string;
}

// ============================================================
// PLANTILLA DE FORMULARIO
// ============================================================

/**
 * Plantilla completa de un formulario PDF con sus campos mapeados.
 * Representa la configuración reutilizable que el usuario crea una vez
 * y usa muchas veces para diferentes cotizantes.
 */
export interface FormTemplate {
  /** ID único de la plantilla */
  id: string;
  /** Nombre descriptivo (ej: "Famisanar - Afiliación SGSSS") */
  name: string;
  /** Entidad asociada (ej: "Famisanar", "EPS Sura") */
  entity: string;
  /** Tipo de entidad */
  entityType: EntityType;
  /** Tipo de formulario (ej: "Afiliación", "Novedad", "Incapacidad") */
  formType: string;
  /** Descripción del formulario */
  description: string;

  // --- PDF Base ---
  /** Contenido del PDF original en Base64 */
  pdfBase64: string;
  /** Nombre original del archivo subido */
  pdfFileName: string;
  /** Número total de páginas del PDF */
  totalPages: number;
  /** Dimensiones que identifican la distribución reutilizable del formulario */
  pageSizes?: Array<{ width: number; height: number }>;
  /** Huella de textos y posiciones; ignora imágenes variables como el código de barras */
  layoutFingerprint?: string;
  /** Ruta pública del PDF incluido en la aplicación cuando pdfBase64 está vacío */
  pdfAssetPath?: string;

  // --- Campos mapeados ---
  /** Lista de todos los campos configurados sobre el PDF */
  fields: PDFMappedField[];
  /** Solo las plantillas listas pueden usarse para generar formularios */
  mappingStatus?: 'draft' | 'ready';

  // --- Metadatos ---
  /** Fecha de creación ISO */
  createdAt: string;
  /** Fecha de última modificación ISO */
  updatedAt: string;
  /** Número de versión de la plantilla */
  version: number;
  /** Miniatura de la primera página en Base64 (JPEG) */
  thumbnailBase64?: string;
}

/** Sello reutilizable guardado en la biblioteca local. */
export interface StampPreset {
  id: string;
  name: string;
  stampText: string;
  stampSubtext?: string;
  stampShape: 'rectangle' | 'circle';
  stampBorderColor: string;
  stampFillColor: string;
  stampBorderWidth: number;
  stampOpacity: number;
  fontFamily: PDFFontFamily;
  fontSize: number;
  bold: boolean;
  color: string;
  createdAt: string;
}

// ============================================================
// FORMULARIO GENERADO (HISTORIAL)
// ============================================================

/**
 * Registro de un formulario PDF que fue rellenado y generado.
 * Se almacena para historial y posible re-descarga.
 */
export interface GeneratedForm {
  /** ID único del formulario generado */
  id: string;
  /** ID de la plantilla usada */
  templateId: string;
  /** Nombre de la plantilla (para referencia rápida) */
  templateName: string;
  /** ID del empleado/cotizante seleccionado */
  empleadoId: string;
  /** Nombre completo del empleado (para referencia rápida) */
  empleadoNombre: string;
  /** Fecha y hora de generación ISO */
  generatedAt: string;
  /** PDF rellenado en Base64 */
  pdfResultBase64: string;
  /** Campos manuales que se llenaron al momento de generar */
  manualFields: Record<string, string>;
  /** Datos variables del trámite utilizados en la generación */
  tramiteFields?: Record<string, string>;
  /** PDF oficial concreto sobre el que se aplicó la configuración reutilizable */
  sourcePdfFileName?: string;
}

// ============================================================
// CATÁLOGO DE CAMPOS
// ============================================================

/**
 * Item del catálogo de campos disponibles para mapeo.
 * Define qué datos del sistema se pueden vincular a un campo del PDF.
 */
export interface FieldCatalogItem {
  /** Clave única del campo (ej: 'primerApellido') */
  key: string;
  /** Etiqueta visible para el usuario */
  label: string;
  /** Categoría de la fuente de datos */
  source: FieldDataSource;
  /** Descripción breve del campo */
  description?: string;
  /** Tipo de dato esperado */
  type: PDFFieldType;
  /** Ejemplo del valor */
  example?: string;
}

/**
 * Categoría de campos en el catálogo
 */
export interface FieldCatalogCategory {
  /** ID de la categoría */
  id: string;
  /** Nombre de la categoría */
  name: string;
  /** Ícono representativo (nombre de lucide icon) */
  icon: string;
  /** Campos dentro de esta categoría */
  fields: FieldCatalogItem[];
}

// ============================================================
// ESTADO DEL DISEÑADOR
// ============================================================

/** Herramienta activa en el diseñador */
export type DesignerTool = 'select' | 'draw' | 'pan';

/** Estado interno del diseñador de plantillas */
export interface DesignerState {
  /** Herramienta activa */
  activeTool: DesignerTool;
  /** Nivel de zoom (1.0 = 100%) */
  zoom: number;
  /** Página actual visible (0-indexed) */
  currentPage: number;
  /** ID del campo seleccionado (null si ninguno) */
  selectedFieldId: string | null;
  /** Si está en modo de dibujo de nuevo campo */
  isDrawing: boolean;
  /** Coordenadas del inicio del arrastre durante el dibujo */
  drawStart: { x: number; y: number } | null;
  /** Coordenadas actuales del cursor durante el dibujo */
  drawCurrent: { x: number; y: number } | null;
}
