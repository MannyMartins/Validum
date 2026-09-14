import type { FormTemplate, PDFMappedField } from '../types/formularios';
import { exclusiveCheckboxGroup } from './mappingPolicy';

const SOURCES = new Set(['cotizante', 'empresa', 'tramite', 'familiar', 'manual']);
const FIELD_TYPES = new Set(['text', 'checkbox', 'date', 'number', 'stamp']);
const FONT_FAMILIES = new Set(['helvetica', 'courier', 'times']);
const ALIGNMENTS = new Set(['left', 'center', 'right']);
const VERTICAL_ALIGNMENTS = new Set(['top', 'middle', 'bottom']);
const OVERFLOW_POLICIES = new Set(['error', 'shrink']);
const CHECKBOX_MODES = new Set(['manual', 'always', 'truthy', 'equals', 'notEquals']);

export function normalizeMappedField(field: PDFMappedField): PDFMappedField {
  const isCheckbox = field.fieldType === 'checkbox';
  const exclusiveGroup = isCheckbox ? exclusiveCheckboxGroup(field.fieldKey) : undefined;
  return {
    ...field,
    fontSize: Number(field.fontSize) || (isCheckbox ? 9 : 8),
    fontFamily: FONT_FAMILIES.has(field.fontFamily) ? field.fontFamily : 'helvetica',
    alignment: ALIGNMENTS.has(field.alignment) ? field.alignment : (isCheckbox ? 'center' : 'left'),
    verticalAlignment: VERTICAL_ALIGNMENTS.has(field.verticalAlignment || '') ? field.verticalAlignment : 'middle',
    padding: Math.max(0, Number(field.padding ?? 1)),
    overflowPolicy: OVERFLOW_POLICIES.has(field.overflowPolicy || '') ? field.overflowPolicy : 'error',
    minFontSize: Math.max(4, Number(field.minFontSize ?? 6)),
    // El formulario SGSSS exige el IBC como una secuencia numérica, sin signo
    // de moneda ni separadores de miles, incluso en plantillas ya guardadas.
    numberFormat: field.fieldKey === 'ibc' ? undefined : field.numberFormat,
    characterCount: field.isCharacterByCharacter
      ? Math.max(1, Number(field.characterCount || field.maxLength || 1))
      : undefined,
    characterSpacing: field.isCharacterByCharacter ? Number(field.characterSpacing || 0) : undefined,
    characterCellWidth: field.isCharacterByCharacter && Number(field.characterCellWidth) > 0
      ? Number(field.characterCellWidth)
      : undefined,
    characterOffsetX: field.isCharacterByCharacter ? Number(field.characterOffsetX || 0) : undefined,
    characterOffsetY: field.isCharacterByCharacter ? Number(field.characterOffsetY || 0) : undefined,
    characterOffsets: field.isCharacterByCharacter && Array.isArray(field.characterOffsets)
      ? field.characterOffsets.map((offset) => Number(offset) || 0)
      : undefined,
    stripCharacterSeparators: field.isCharacterByCharacter
      ? (field.stripCharacterSeparators ?? field.fieldType === 'date')
      : undefined,
    // Los widgets se usan para obtener su rectángulo, pero el valor se dibuja
    // como overlay para respetar exactamente fuente, tamaño y alineación.
    acroFieldName: undefined,
    checkboxCharacter: isCheckbox ? normalizeCheckboxCharacter(field.checkboxCharacter) : undefined,
    checkboxRule: isCheckbox
      ? ({ ...(field.checkboxRule || {
          mode: field.dataSource === 'manual' ? 'manual' : field.checkboxMatchValue ? 'equals' : 'truthy',
          expectedValue: field.checkboxMatchValue,
        }), groupId: field.checkboxRule?.groupId || exclusiveGroup })
      : undefined,
    required: field.dataSource === 'familiar' ? false : field.required,
    stampText: field.fieldType === 'stamp' ? (field.stampText || field.label || 'SELLO') : undefined,
    stampSubtext: field.fieldType === 'stamp' ? field.stampSubtext : undefined,
    stampShape: field.fieldType === 'stamp' ? (field.stampShape || 'rectangle') : undefined,
    stampBorderColor: field.fieldType === 'stamp' ? (field.stampBorderColor || '#B91C1C') : undefined,
    stampFillColor: field.fieldType === 'stamp' ? (field.stampFillColor || '#FFFFFF') : undefined,
    stampBorderWidth: field.fieldType === 'stamp' ? Math.max(0.5, Number(field.stampBorderWidth ?? 2)) : undefined,
    stampOpacity: field.fieldType === 'stamp' ? Math.min(1, Math.max(0.05, Number(field.stampOpacity ?? 0.85))) : undefined,
  };
}

export function normalizeCheckboxCharacter(value?: string): string {
  const character = Array.from((value || 'X').trim())[0] || 'X';
  return ['✓', '✔', '☑'].includes(character) ? 'X' : character;
}

export function normalizeTemplate(template: FormTemplate): FormTemplate {
  const fields = Array.isArray(template.fields) ? template.fields.map(normalizeMappedField) : [];
  return {
    ...template,
    totalPages: Math.max(1, Number(template.totalPages) || 1),
    fields,
    mappingStatus: fields.length ? 'ready' : 'draft',
  };
}

export function validateFormTemplate(template: FormTemplate): string[] {
  const issues: string[] = [];
  if (!template.name?.trim()) issues.push('La plantilla necesita un nombre.');
  if (!template.pdfBase64?.trim() && !template.pdfAssetPath?.trim()) issues.push('La plantilla necesita un PDF base.');
  if (!Number.isInteger(template.totalPages) || template.totalPages < 1) issues.push('El número de páginas no es válido.');
  if (template.mappingStatus === 'ready' && template.fields.length === 0) issues.push('Una plantilla lista debe tener al menos un campo mapeado.');

  const ids = new Set<string>();
  template.fields.forEach((field, index) => {
    const prefix = field.label || `Campo ${index + 1}`;
    if (!field.id || ids.has(field.id)) issues.push(`${prefix}: el identificador está vacío o repetido.`);
    ids.add(field.id);
    if (!SOURCES.has(field.dataSource)) issues.push(`${prefix}: fuente de datos inválida.`);
    if (!FIELD_TYPES.has(field.fieldType)) issues.push(`${prefix}: tipo de campo inválido.`);
    if (!field.fieldKey?.trim()) issues.push(`${prefix}: falta la clave de datos.`);
    if (!Number.isInteger(field.page) || field.page < 0 || field.page >= template.totalPages) issues.push(`${prefix}: página fuera de rango.`);
    if (![field.x, field.y, field.width, field.height, field.fontSize].every(Number.isFinite)) issues.push(`${prefix}: coordenadas no numéricas.`);
    if (field.x < 0 || field.y < 0 || field.width <= 0 || field.height <= 0) issues.push(`${prefix}: posición o dimensiones inválidas.`);
    if (field.fontSize < 4 || field.fontSize > 72) issues.push(`${prefix}: tamaño de fuente fuera del rango de 4 a 72 pt.`);
    if (!VERTICAL_ALIGNMENTS.has(field.verticalAlignment || 'middle')) issues.push(`${prefix}: alineación vertical inválida.`);
    if (!OVERFLOW_POLICIES.has(field.overflowPolicy || 'error')) issues.push(`${prefix}: política de texto largo inválida.`);
    if (field.padding !== undefined && (field.padding < 0 || field.padding * 2 >= Math.min(field.width, field.height))) issues.push(`${prefix}: margen interior excesivo.`);
    if (field.isCharacterByCharacter && (!field.characterCount || field.characterCount < 1)) issues.push(`${prefix}: indica el número fijo de casillas.`);
    if (field.isCharacterByCharacter && field.characterCount && !Number.isInteger(field.characterCount)) issues.push(`${prefix}: el número de casillas debe ser entero.`);
    if (field.isCharacterByCharacter && field.characterCellWidth !== undefined && (!Number.isFinite(field.characterCellWidth) || field.characterCellWidth <= 0)) issues.push(`${prefix}: el ancho de casilla debe ser mayor que cero.`);
    if (field.isCharacterByCharacter && ![field.characterSpacing ?? 0, field.characterOffsetX ?? 0, field.characterOffsetY ?? 0].every(Number.isFinite)) issues.push(`${prefix}: los ajustes de espaciado deben ser numéricos.`);
    if (field.isCharacterByCharacter && field.characterOffsets && (!Array.isArray(field.characterOffsets) || field.characterOffsets.some((offset) => !Number.isFinite(offset)))) issues.push(`${prefix}: los ajustes individuales deben ser una lista de números.`);
    if (field.maxLength !== undefined && (!Number.isInteger(field.maxLength) || field.maxLength < 1)) issues.push(`${prefix}: longitud máxima inválida.`);
    if (field.overflowPolicy === 'shrink' && (field.minFontSize || 0) > field.fontSize) issues.push(`${prefix}: el tamaño mínimo no puede superar el tamaño configurado.`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(field.color || '')) issues.push(`${prefix}: color inválido.`);
    if (field.fieldType === 'stamp' && !field.stampText?.trim()) issues.push(`${prefix}: el sello necesita un texto principal.`);
    if (field.fieldType === 'stamp' && !/^#[0-9A-Fa-f]{6}$/.test(field.stampBorderColor || '')) issues.push(`${prefix}: color de borde del sello inválido.`);
    if (field.fieldType === 'stamp' && !/^#[0-9A-Fa-f]{6}$/.test(field.stampFillColor || '')) issues.push(`${prefix}: color de fondo del sello inválido.`);
    if (field.fieldType === 'checkbox' && field.checkboxRule && !CHECKBOX_MODES.has(field.checkboxRule.mode)) issues.push(`${prefix}: regla de casilla inválida.`);
    if (field.fieldType === 'checkbox' && ['equals', 'notEquals'].includes(field.checkboxRule?.mode || '') && !field.checkboxRule?.expectedValue?.trim()) issues.push(`${prefix}: la comparación necesita un valor esperado.`);
  });
  return issues;
}

export function parseImportedTemplate(jsonString: string): FormTemplate {
  const data: unknown = JSON.parse(jsonString);
  if (!data || typeof data !== 'object' || (data as { _type?: unknown })._type !== 'validum-template') {
    throw new Error('El archivo no es una plantilla exportada por Validum.');
  }
  const raw = (data as { template?: unknown }).template;
  if (!raw || typeof raw !== 'object') throw new Error('La plantilla importada está vacía.');
  const template = normalizeTemplate(raw as FormTemplate);
  const issues = validateFormTemplate(template);
  if (issues.length) throw new Error(issues.join('\n'));
  return template;
}
