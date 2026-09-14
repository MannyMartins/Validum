import type { CategoriaSoporte, MetadataSoporte, SoporteDocumento } from '../types/soporte';
import { apiRequest, isApiConfigured } from './apiClient';
export { isApiConfigured };

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(blob);
  });
}
export function fetchDocumentosSoporte(): Promise<SoporteDocumento[]> { return apiRequest('/workspace/support-documents/list'); }
export async function uploadDocumentoSoporte(params: { file: File | Blob; nombre: string; categoria: CategoriaSoporte; metadata?: MetadataSoporte }): Promise<SoporteDocumento> {
  const record = { nombre: params.nombre, categoria: params.categoria, contentType: params.file.type || 'application/pdf',
    base64: await blobToDataUrl(params.file), metadata: params.metadata || {} };
  return apiRequest('/workspace/support-documents', { method: 'POST', body: JSON.stringify({ record }) });
}
export function deleteDocumentoSoporte(id: string): Promise<void> {
  return apiRequest(`/workspace/support-documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
export function updateDocumentoMetadata(id: string, updates: Partial<Pick<SoporteDocumento, 'nombre' | 'categoria' | 'metadata'>>): Promise<void> {
  return apiRequest(`/workspace/support-documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ record: updates }) });
}
export async function getDocumentoBlob(doc: SoporteDocumento): Promise<Blob | null> {
  const response = await apiRequest<{ contentType: string; base64: string }>(`/workspace/support-documents/${encodeURIComponent(doc.id)}/content`);
  const bytes = Uint8Array.from(atob(response.base64), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: response.contentType });
}
