import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SoporteDocumento, CategoriaSoporte, MetadataSoporte } from '../types/soporte';
import type { Database, Json, TablesUpdate } from '../types/database.generated';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
).trim();

export const isSupabaseConfigured = Boolean(
  /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length >= 20
);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'validum-supabase-auth',
      },
      global: {
        headers: { 'X-Client-Info': 'validum-web/1.0' },
      },
    })
  : null;

let organizationPromise: Promise<string> | null = null;

function toJson(value: unknown): Json {
  return value as Json;
}

function mapSupportDocument(item: Database['public']['Tables']['soporte_documentos']['Row']): SoporteDocumento {
  return {
    id: item.id,
    nombre: item.nombre,
    categoria: item.categoria as CategoriaSoporte,
    tipo_archivo: item.tipo_archivo as SoporteDocumento['tipo_archivo'],
    tamano_bytes: item.tamano_bytes,
    storage_path: item.storage_path,
    metadata: item.metadata as unknown as MetadataSoporte,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export async function hasAuthenticatedSupabaseSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return Boolean(data.session?.user);
}

async function resolveActiveOrganizationId(): Promise<string> {
  if (!supabase) throw new Error('Supabase no esta configurado.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) throw new Error('Se requiere iniciar sesion para acceder a los datos en Supabase.');

  const { data: preference, error: preferenceError } = await supabase
    .from('user_preferences')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (preferenceError) throw preferenceError;
  if (preference?.organization_id) return String(preference.organization_id);

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;

  let organizationId = membership?.organization_id ? String(membership.organization_id) : '';
  if (!organizationId) {
    const { data: disabledMembership, error: disabledMembershipError } = await supabase
      .from('organization_members')
      .select('organization_id,status,active')
      .eq('user_id', user.id)
      .eq('active', false)
      .limit(1)
      .maybeSingle();
    if (disabledMembershipError) throw disabledMembershipError;
    if (disabledMembership) {
      throw new Error('Tu acceso a la organización fue revocado. Contacta a un administrador.');
    }

    const suggestedName = String(user.user_metadata?.company_name || user.user_metadata?.full_name || 'Validum').trim();
    const { data, error } = await supabase.rpc('create_organization_with_owner', {
      organization_name: suggestedName || 'Validum',
    });
    if (error) throw error;
    organizationId = String(data);
  }

  const { error: upsertError } = await supabase.from('user_preferences').upsert({
    user_id: user.id,
    organization_id: organizationId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (upsertError) throw upsertError;
  return organizationId;
}

export function getActiveOrganizationId(): Promise<string> {
  organizationPromise ||= resolveActiveOrganizationId().catch(error => {
    organizationPromise = null;
    throw error;
  });
  return organizationPromise;
}

export function clearActiveOrganizationCache(): void {
  organizationPromise = null;
}

const BUCKET_NAME = 'documentos-soporte';
const LOCAL_STORAGE_KEY = 'validum_documentos_soporte_v1';
const INDEXED_DB_NAME = 'validum_soporte_files_db';
const INDEXED_STORE_NAME = 'files';

// ── Fallback en IndexedDB para almacenamiento local offline de Blobs ──
function openLocalDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXED_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXED_STORE_NAME)) {
        db.createObjectStore(INDEXED_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocalBlob(id: string, blob: Blob): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_STORE_NAME, 'readwrite');
    const store = tx.objectStore(INDEXED_STORE_NAME);
    const req = store.put(blob, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getLocalBlob(id: string): Promise<Blob | null> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_STORE_NAME, 'readonly');
    const store = tx.objectStore(INDEXED_STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteLocalBlob(id: string): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_STORE_NAME, 'readwrite');
    const store = tx.objectStore(INDEXED_STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getLocalMetaList(): SoporteDocumento[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMetaList(list: SoporteDocumento[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error guardando lista local de soportes:', err);
  }
}

// ── Servicios de API para Documentos Soporte ──

export async function fetchDocumentosSoporte(): Promise<SoporteDocumento[]> {
  if (supabase && await hasAuthenticatedSupabaseSession()) {
    const organizationId = await getActiveOrganizationId();
    const { data, error } = await supabase
      .from('soporte_documentos')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapSupportDocument);
  }

  // Fallback Local
  const localList = getLocalMetaList();
  return localList;
}

export async function uploadDocumentoSoporte(params: {
  file: File | Blob;
  nombre: string;
  categoria: CategoriaSoporte;
  metadata?: MetadataSoporte;
}): Promise<SoporteDocumento> {
  const { file, nombre, categoria, metadata = {} } = params;
  const id = crypto.randomUUID();
  const fileExt = nombre.split('.').pop()?.toLowerCase() || 'pdf';
  const tipoArchivo = (fileExt === 'png' || fileExt === 'jpg' || fileExt === 'jpeg' ? fileExt : 'pdf') as SoporteDocumento['tipo_archivo'];
  const relativeStoragePath = `${categoria.toLowerCase().replace(/\s+/g, '_')}/${id}_${nombre.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const now = new Date().toISOString();

  const docItem: SoporteDocumento = {
    id,
    nombre,
    categoria,
    tipo_archivo: tipoArchivo,
    tamano_bytes: file.size,
    storage_path: relativeStoragePath,
    metadata: {
      paginas: 1,
      efecto_escaner_aplicado: false,
      tags: [],
      ...metadata
    },
    created_at: now,
    updated_at: now
  };

  // 1. Si Supabase está disponible, subir al Storage y registrar en la BD
  if (supabase && await hasAuthenticatedSupabaseSession()) {
    let uploadedToStorage = false;
    const organizationId = await getActiveOrganizationId();
    const storagePath = `${organizationId}/${relativeStoragePath}`;
    docItem.storage_path = storagePath;
    try {
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, {
          contentType: file.type || (tipoArchivo === 'pdf' ? 'application/pdf' : `image/${tipoArchivo}`),
          upsert: true
        });

      if (storageError) throw storageError;
      uploadedToStorage = true;

      const { data: dbData, error: dbError } = await supabase
        .from('soporte_documentos')
        .insert({
          id,
          organization_id: organizationId,
          owner_id: (await supabase.auth.getUser()).data.user?.id,
          nombre,
          categoria,
          tipo_archivo: tipoArchivo,
          tamano_bytes: file.size,
          storage_path: storagePath,
          metadata: toJson(docItem.metadata),
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (dbError) throw dbError;

      return mapSupportDocument(dbData);
    } catch (err) {
      if (uploadedToStorage) {
        const { error: cleanupError } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        if (cleanupError) console.warn('No se pudo limpiar el archivo huérfano de Supabase Storage:', cleanupError);
      }
      throw err;
    }
  }

  // 2. Almacenamiento Local (Fallback seguro)
  await saveLocalBlob(id, file);
  const localList = getLocalMetaList();
  localList.unshift(docItem);
  saveLocalMetaList(localList);

  return docItem;
}

export async function deleteDocumentoSoporte(id: string, storagePath?: string): Promise<void> {
  if (supabase && storagePath && await hasAuthenticatedSupabaseSession()) {
    const organizationId = await getActiveOrganizationId();
    const { error: databaseError } = await supabase.from('soporte_documentos').delete().eq('id', id).eq('organization_id', organizationId);
    if (databaseError) throw databaseError;
    const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    if (storageError) console.warn('El registro se eliminó, pero el archivo remoto quedó pendiente de limpieza:', storageError);
  }

  // Borrar local
  try {
    await deleteLocalBlob(id);
  } catch (error) {
    console.warn('No se encontró una copia local para eliminar:', error);
  }
  const localList = getLocalMetaList().filter(d => d.id !== id);
  saveLocalMetaList(localList);
}

export async function updateDocumentoMetadata(
  id: string,
  updates: Partial<Pick<SoporteDocumento, 'nombre' | 'categoria' | 'metadata'>>
): Promise<void> {
  const now = new Date().toISOString();

  if (supabase && await hasAuthenticatedSupabaseSession()) {
    const organizationId = await getActiveOrganizationId();
    const remoteUpdates: TablesUpdate<'soporte_documentos'> = {
      updated_at: now,
    };
    if (updates.nombre !== undefined) remoteUpdates.nombre = updates.nombre;
    if (updates.categoria !== undefined) remoteUpdates.categoria = updates.categoria;
    if (updates.metadata !== undefined) remoteUpdates.metadata = toJson(updates.metadata);
    const { error } = await supabase
      .from('soporte_documentos')
      .update(remoteUpdates)
      .eq('id', id)
      .eq('organization_id', organizationId);
    if (error) throw error;
  }

  const localList = getLocalMetaList().map(d => {
    if (d.id === id) {
      return {
        ...d,
        ...updates,
        metadata: {
          ...d.metadata,
          ...(updates.metadata || {})
        },
        updated_at: now
      };
    }
    return d;
  });
  saveLocalMetaList(localList);
}

export async function getDocumentoBlob(doc: SoporteDocumento): Promise<Blob | null> {
  // Primero verificar en IndexedDB local
  let localBlob: Blob | null = null;
  try {
    localBlob = await getLocalBlob(doc.id);
  } catch (error) {
    console.warn('El almacén local no está disponible; se intentará descargar el soporte remoto.', error);
  }
  if (localBlob) return localBlob;

  // Si no está local y Supabase está configurado, descargarlo
  if (supabase && doc.storage_path && await hasAuthenticatedSupabaseSession()) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(doc.storage_path);

      if (error) throw error;
      if (data) {
        // Cachear en local
        await saveLocalBlob(doc.id, data);
        return data;
      }
    } catch (err) {
      console.error('Error descargando documento de Supabase Storage:', err);
    }
  }

  return null;
}
