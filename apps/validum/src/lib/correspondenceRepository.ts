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
  destinatarios?: string | null;
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
  cuenta_origen?: string;
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

export type MailboxStatus = 'conectada' | 'desconectada' | 'pausada';

export interface MailboxAccount {
  id: string;
  direccion: string;
  etiqueta?: string | null;
  estado: MailboxStatus;
  ultimaSincronizacion?: string | null;
  ultimoError?: string | null;
  erroresConsecutivos?: number;
  correosProcesados?: number;
  creadoEn?: string;
  conectada_por?: CorrespondenceAssignee | null;
}

export interface MailboxList {
  items: MailboxAccount[];
  configuracion: { google_configurado: boolean; clave_cifrado_valida: boolean; lectura_habilitada?: boolean; ia_real_habilitada?: boolean };
}

export function testMailboxClassifier(): Promise<{
  ficticio: boolean;
  guardado: boolean;
  clasificacion: { categoria: string; prioridad: string; resumen: string; error_parseo: boolean };
}> {
  return apiRequest('/correspondencia/cuentas/prueba-ia', { method: 'POST' });
}

export interface MailboxSyncResult {
  cuenta: string;
  nuevos: number;
  omitidos: number;
  error?: string;
}

export function loadMailboxes(): Promise<MailboxList> {
  return apiRequest('/correspondencia/cuentas');
}

/** Devuelve la URL de consentimiento de Google para abrirla en una ventana nueva. */
export function startMailboxConnection(cuenta?: string): Promise<{ url: string }> {
  return apiRequest('/correspondencia/cuentas/oauth/iniciar', {
    method: 'POST',
    body: JSON.stringify(cuenta ? { cuenta } : {}),
  });
}

export function updateMailbox(id: string, changes: { etiqueta?: string; activa?: boolean }): Promise<MailboxAccount> {
  return apiRequest(`/correspondencia/cuentas/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export function disconnectMailbox(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/correspondencia/cuentas/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function syncMailboxesNow(): Promise<{ resultados: MailboxSyncResult[] }> {
  return apiRequest('/correspondencia/cuentas/sincronizar', { method: 'POST' });
}

export function reclassifyCorrespondence(id: string): Promise<CorrespondenceItem> {
  return apiRequest(`/correspondencia/${encodeURIComponent(id)}/reclasificar`, { method: 'POST' });
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
