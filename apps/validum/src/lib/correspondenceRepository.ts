import { apiRequest } from './apiClient';

export type CorrespondenceCategory = 'Términos jurídicos' | 'Cobros Jurídicos' | 'Consulta General' | 'Soporte Operativo';
export type CorrespondencePriority = 'Urgente' | 'Moderado' | 'Respuesta Ligera';
export type CorrespondenceStatus = 'pendiente' | 'en_revision' | 'respondido' | 'archivado';

export interface CorrespondenceAssignee { id: string; fullName?: string | null; email: string; }
export interface CorrespondenceItem {
  id: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  cuentaDestino: string;
  remitenteCorreo: string;
  asunto: string;
  cuerpo?: string;
  fechaRecepcion: string;
  remitenteNombre: string;
  identificacion?: string | null;
  empresaRelacionada?: string | null;
  categoria: CorrespondenceCategory;
  prioridad: CorrespondencePriority;
  resumen: string;
  documentosRequeridos?: string[];
  propuestaRespuesta?: string;
  alertaInmediata: boolean;
  estado: CorrespondenceStatus;
  asignado_a?: CorrespondenceAssignee | null;
  notasInternas?: string | null;
  errorClasificacion: boolean;
  respuestaCrudaIa?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface CorrespondenceFilters {
  categoria?: CorrespondenceCategory;
  prioridad?: CorrespondencePriority;
  estado?: CorrespondenceStatus;
  cuenta_destino?: string;
  alerta_inmediata?: boolean;
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
  pagina?: number;
  limite?: number;
}

export interface CorrespondenceList {
  items: CorrespondenceItem[];
  paginacion: { pagina: number; limite: number; total: number; paginas: number };
}

export interface CorrespondenceSummary {
  total: number;
  alertas_pendientes: number;
  por_categoria: Partial<Record<CorrespondenceCategory, number>>;
  por_prioridad: Partial<Record<CorrespondencePriority, number>>;
  por_estado: Partial<Record<CorrespondenceStatus, number>>;
}

export function loadCorrespondence(filters: CorrespondenceFilters): Promise<CorrespondenceList> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return apiRequest(`/correspondencia?${query.toString()}`);
}

export function loadCorrespondenceSummary(): Promise<CorrespondenceSummary> {
  return apiRequest('/correspondencia/resumen');
}

export function loadCorrespondenceDetail(id: string): Promise<CorrespondenceItem> {
  return apiRequest(`/correspondencia/${encodeURIComponent(id)}`);
}

export function updateCorrespondence(id: string, changes: {
  estado?: CorrespondenceStatus;
  asignado_a?: string | null;
  notas_internas?: string | null;
  propuesta_respuesta?: string;
}): Promise<CorrespondenceItem> {
  return apiRequest(`/correspondencia/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}
