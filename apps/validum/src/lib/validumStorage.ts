import type { FormTemplate, GeneratedForm, StampPreset } from '../types/formularios';
import type { Empleado, Empresa } from '../types/validum';

const DB_NAME = 'validum-datos';
const DB_VERSION = 2;
const TEMPLATES = 'templates';
const GENERATED = 'generatedForms';
const PROFILE = 'profile';
const STAMPS = 'stamps';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error de IndexedDB.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar la información.'));
    transaction.onabort = () => reject(transaction.error || new Error('La operación de guardado fue cancelada.'));
  });
}

async function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new Error('Este navegador no ofrece almacenamiento IndexedDB.');
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(TEMPLATES)) db.createObjectStore(TEMPLATES, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(GENERATED)) db.createObjectStore(GENERATED, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(PROFILE)) db.createObjectStore(PROFILE);
    if (!db.objectStoreNames.contains(STAMPS)) db.createObjectStore(STAMPS, { keyPath: 'id' });
  };
  return requestResult(request);
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await database();
  try {
    return await requestResult(db.transaction(storeName, 'readonly').objectStore(storeName).getAll()) as T[];
  } finally {
    db.close();
  }
}

async function put<T>(storeName: string, value: T, key?: IDBValidKey): Promise<void> {
  const db = await database();
  try {
    const transaction = db.transaction(storeName, 'readwrite');
    if (key === undefined) transaction.objectStore(storeName).put(value);
    else transaction.objectStore(storeName).put(value, key);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await database();
  try {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function migrateLegacyLocalStorage(): Promise<void> {
  if (!globalThis.localStorage || localStorage.getItem('validum-indexeddb-migrated-v1') === 'true') return;
  const templateRaw = localStorage.getItem('validum_form_templates');
  const generatedRaw = localStorage.getItem('validum_generated_forms');
  const companyRaw = localStorage.getItem('validum-empresa');
  const employeesRaw = localStorage.getItem('validum-afiliados');
  try {
    const templates = templateRaw ? JSON.parse(templateRaw) as FormTemplate[] : [];
    const generated = generatedRaw ? JSON.parse(generatedRaw) as GeneratedForm[] : [];
    await Promise.all(templates.map(item => put(TEMPLATES, item)));
    await Promise.all(generated.map(item => put(GENERATED, item)));
    if (companyRaw) await put(PROFILE, JSON.parse(companyRaw), 'company');
    if (employeesRaw) await put(PROFILE, JSON.parse(employeesRaw), 'employees');
    localStorage.removeItem('validum_form_templates');
    localStorage.removeItem('validum_generated_forms');
    localStorage.removeItem('validum-empresa');
    localStorage.removeItem('validum-afiliados');
    localStorage.setItem('validum-indexeddb-migrated-v1', 'true');
  } catch (error) {
    throw new Error(`No se pudo migrar el almacenamiento anterior: ${error instanceof Error ? error.message : 'error desconocido'}`);
  }
}

export const templateRepository = {
  list: () => getAll<FormTemplate>(TEMPLATES),
  save: (template: FormTemplate) => put(TEMPLATES, template),
  remove: (id: string) => remove(TEMPLATES, id),
};

export const generatedFormRepository = {
  async list(): Promise<GeneratedForm[]> {
    const forms = await getAll<GeneratedForm>(GENERATED);
    return forms.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  },
  async save(form: GeneratedForm): Promise<void> {
    await put(GENERATED, form);
    const forms = await this.list();
    await Promise.all(forms.slice(50).map(item => remove(GENERATED, item.id)));
  },
  remove: (id: string) => remove(GENERATED, id),
};

export const stampPresetRepository = {
  list: () => getAll<StampPreset>(STAMPS),
  save: (stamp: StampPreset) => put(STAMPS, stamp),
  remove: (id: string) => remove(STAMPS, id),
};

export async function loadCompany(): Promise<Empresa | undefined> {
  const db = await database();
  try {
    return await requestResult(db.transaction(PROFILE, 'readonly').objectStore(PROFILE).get('company')) as Empresa | undefined;
  } finally {
    db.close();
  }
}

export async function saveCompany(company: Empresa): Promise<void> {
  await put(PROFILE, company, 'company');
}

/** Catálogo local de empresas. Mantiene compatibilidad con el perfil único anterior. */
export async function loadCompanies(): Promise<Empresa[]> {
  const db = await database();
  try {
    const store = db.transaction(PROFILE, 'readonly').objectStore(PROFILE);
    const [companies, legacy] = await Promise.all([
      requestResult(store.get('companies')) as Promise<Empresa[] | undefined>,
      requestResult(store.get('company')) as Promise<Empresa | undefined>,
    ]);
    if (Array.isArray(companies) && companies.length > 0) return companies;
    return legacy ? [{ ...legacy, id: legacy.id || crypto.randomUUID() }] : [];
  } finally {
    db.close();
  }
}

export async function saveCompanies(companies: Empresa[]): Promise<void> {
  await put(PROFILE, companies, 'companies');
}

export async function loadActiveCompanyId(): Promise<string | undefined> {
  const db = await database();
  try {
    return await requestResult(db.transaction(PROFILE, 'readonly').objectStore(PROFILE).get('activeCompanyId')) as string | undefined;
  } finally {
    db.close();
  }
}

export async function saveActiveCompanyId(companyId: string): Promise<void> {
  await put(PROFILE, companyId, 'activeCompanyId');
}

export async function loadEmployees(): Promise<Empleado[] | undefined> {
  const db = await database();
  try {
    return await requestResult(db.transaction(PROFILE, 'readonly').objectStore(PROFILE).get('employees')) as Empleado[] | undefined;
  } finally {
    db.close();
  }
}

export async function saveEmployees(employees: Empleado[]): Promise<void> {
  await put(PROFILE, employees, 'employees');
}

export interface AffiliationDraft<T> {
  form: T;
  employeeId: string;
  savedAt: string;
}

export async function loadAffiliationDraft<T>(key: string): Promise<AffiliationDraft<T> | undefined> {
  const db = await database();
  try {
    return await requestResult(
      db.transaction(PROFILE, 'readonly').objectStore(PROFILE).get(`affiliationDraft:${key}`)
    ) as AffiliationDraft<T> | undefined;
  } finally {
    db.close();
  }
}

export async function saveAffiliationDraft<T>(key: string, draft: AffiliationDraft<T>): Promise<void> {
  await put(PROFILE, draft, `affiliationDraft:${key}`);
}

export async function removeAffiliationDraft(key: string): Promise<void> {
  await remove(PROFILE, `affiliationDraft:${key}`);
}
