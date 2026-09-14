import { DocumentoAdjunto } from '../types/validum';

const DB_NAME = 'validum-soportes';
const STORE_NAME = 'archivos';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function guardarSoporte(id: string, file: File): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function obtenerSoporte(id: string): Promise<File | undefined> {
  const db = await database();
  const file = await new Promise<File | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as File | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return file;
}

export async function eliminarSoporte(id: string): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export const ordenDocumentos = (documentos: DocumentoAdjunto[]) => {
  const orden: Record<DocumentoAdjunto['categoria'], number> = {
    COTIZANTE: 0,
    AUTORIZACION_TRASLADO: 1,
    RETIRO_EPS: 2,
    CONYUGE: 3,
    BENEFICIARIO: 4,
    REGISTRO_CIVIL: 5,
    OTRO: 6,
  };
  return [...documentos].sort((a, b) => (orden[a.categoria] ?? 9) - (orden[b.categoria] ?? 9) || a.creadoEn.localeCompare(b.creadoEn));
};
