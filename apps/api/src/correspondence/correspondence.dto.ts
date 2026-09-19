import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export const CATEGORY_LABELS = ['Términos jurídicos', 'Cobros Jurídicos', 'Consulta General', 'Soporte Operativo'] as const;
export const PRIORITY_LABELS = ['Urgente', 'Moderado', 'Respuesta Ligera'] as const;
export const STATUS_LABELS = ['pendiente', 'en_revision', 'respondido', 'archivado'] as const;

export const INGEST_LIMITS = {
  address: 1_000,
  account: 320,
  subject: 1_000,
  identifier: 1_000,
  senderName: 500,
  identification: 200,
  company: 500,
  classification: 200,
  body: 1_500_000,
  summary: 20_000,
  response: 100_000,
  rawResponse: 20_000,
  document: 1_000,
  documents: 100,
  batch: 250,
} as const;

export interface IngestCorrespondenceDto {
  from: string;
  to: string;
  subject: string;
  textPlain: string;
  messageId: string;
  threadId: string;
  fecha: string;
  cuenta_origen?: string;
  remitente_nombre: string;
  identificacion?: string | null;
  empresa_relacionada?: string | null;
  categoria: string;
  prioridad: string;
  resumen: string;
  documentos_requeridos: string[];
  propuesta_respuesta: string;
  alerta_inmediata: boolean;
  error_parseo: boolean;
  respuesta_cruda?: string;
}

function text(value: unknown, max: number): string {
  if (value === null || value === undefined) return '';
  return (typeof value === 'string' ? value : String(value)).slice(0, max);
}

function nullableText(value: unknown, max: number): string | null {
  const normalized = text(value, max).trim();
  return !normalized || normalized.toLowerCase() === 'null' ? null : normalized;
}

export function normalizeIngestDate(value: unknown, now = new Date()): string {
  let parsed: Date;
  if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) {
    const numeric = Number(value);
    parsed = new Date(Math.abs(numeric) < 1_000_000_000_000 ? numeric * 1_000 : numeric);
  } else {
    parsed = new Date(typeof value === 'string' ? value : '');
  }
  return Number.isNaN(parsed.getTime()) ? now.toISOString() : parsed.toISOString();
}

export function normalizeIngestRow(value: unknown, now = new Date()): IngestCorrespondenceDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Cada correo del lote debe ser un objeto JSON.');
  }
  const row = value as Record<string, unknown>;
  const messageId = text(row.messageId, INGEST_LIMITS.identifier).trim();
  const to = text(row.to, INGEST_LIMITS.address).trim();
  const cuentaOrigen = text(row.cuenta_origen, INGEST_LIMITS.account).trim().toLowerCase();
  if (!messageId) throw new BadRequestException('messageId es obligatorio.');
  if (!cuentaOrigen && !to) throw new BadRequestException('cuenta_origen o to es obligatorio.');

  const category = text(row.categoria, INGEST_LIMITS.classification).trim();
  const priority = text(row.prioridad, INGEST_LIMITS.classification).trim();
  const validClassification = CATEGORY_LABELS.includes(category as never) && PRIORITY_LABELS.includes(priority as never);
  const suppliedRawResponse = text(row.respuesta_cruda, INGEST_LIMITS.rawResponse);
  const preservedClassification = validClassification ? suppliedRawResponse : JSON.stringify({
    respuesta_cruda: suppliedRawResponse || null,
    categoria_original: category || null,
    prioridad_original: priority || null,
  }).slice(0, INGEST_LIMITS.rawResponse);
  const documents = Array.isArray(row.documentos_requeridos)
    ? row.documentos_requeridos.slice(0, INGEST_LIMITS.documents)
        .map(item => text(item, INGEST_LIMITS.document).trim()).filter(Boolean)
    : [];

  return {
    from: text(row.from, INGEST_LIMITS.address).trim(),
    to,
    subject: text(row.subject, INGEST_LIMITS.subject),
    textPlain: text(row.textPlain, INGEST_LIMITS.body),
    messageId,
    threadId: text(row.threadId, INGEST_LIMITS.identifier).trim(),
    fecha: normalizeIngestDate(row.fecha, now),
    cuenta_origen: cuentaOrigen || undefined,
    remitente_nombre: text(row.remitente_nombre, INGEST_LIMITS.senderName).trim()
      || text(row.from, INGEST_LIMITS.senderName).trim() || 'Remitente no identificado',
    identificacion: nullableText(row.identificacion, INGEST_LIMITS.identification),
    empresa_relacionada: nullableText(row.empresa_relacionada, INGEST_LIMITS.company),
    categoria: validClassification ? category : 'Consulta General',
    prioridad: validClassification ? priority : 'Moderado',
    resumen: text(row.resumen, INGEST_LIMITS.summary).trim() || 'Correo recibido sin clasificación disponible.',
    documentos_requeridos: documents,
    propuesta_respuesta: text(row.propuesta_respuesta, INGEST_LIMITS.response),
    alerta_inmediata: row.alerta_inmediata === true,
    error_parseo: row.error_parseo === true || !validClassification,
    respuesta_cruda: preservedClassification || undefined,
  };
}

@Injectable()
export class IngestPayloadPipe implements PipeTransform {
  transform(value: unknown): IngestCorrespondenceDto | IngestCorrespondenceDto[] {
    const rows = Array.isArray(value) ? value : [value];
    if (!rows.length) throw new BadRequestException('El lote de correspondencia está vacío.');
    if (rows.length > INGEST_LIMITS.batch) throw new BadRequestException(`Cada lote admite máximo ${INGEST_LIMITS.batch} correos.`);
    const parsed = rows.map(row => normalizeIngestRow(row));
    return Array.isArray(value) ? parsed : parsed[0];
  }
}

export class ListCorrespondenceDto {
  @IsOptional() @IsIn(CATEGORY_LABELS) categoria?: string;
  @IsOptional() @IsIn(PRIORITY_LABELS) prioridad?: string;
  @IsOptional() @IsIn(STATUS_LABELS) estado?: string;
  @IsOptional() @IsString() @MaxLength(1_000) cuenta_destino?: string;
  @IsOptional() @IsString() @MaxLength(320) cuenta_origen?: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() alerta_inmediata?: boolean;
  @IsOptional() @IsDateString() fecha_desde?: string;
  @IsOptional() @IsDateString() fecha_hasta?: string;
  @IsOptional() @IsString() @MaxLength(300) busqueda?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
}

export class UpdateCorrespondenceDto {
  @IsOptional() @IsIn(STATUS_LABELS) estado?: string;
  @IsOptional() @IsString() @MaxLength(100) asignado_a?: string | null;
  @IsOptional() @IsString() @MaxLength(20_000) notas_internas?: string | null;
  @IsOptional() @IsString() @MaxLength(100_000) propuesta_respuesta?: string;
}
