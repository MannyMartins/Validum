import type { FormTemplate, GeneratedForm, StampPreset } from '../types/formularios';
import type { Empleado, Empresa } from '../types/validum';
import { DEFAULT_TEMPLATES } from '../data/defaultTemplates';
import {
  generatedFormRepository as localGeneratedForms,
  loadActiveCompanyId as loadLocalActiveCompanyId,
  loadCompanies as loadLocalCompanies,
  loadEmployees as loadLocalEmployees,
  saveActiveCompanyId as saveLocalActiveCompanyId,
  stampPresetRepository as localStampPresets,
  templateRepository as localTemplates,
} from './validumStorage';
import { hasApiSession, loadApiWorkspace, removeApiRecord, replaceApiCollection, saveApiRecord, setApiActiveCompany } from './apiClient';

function requireSession() { if (!hasApiSession()) throw new Error('Debes iniciar sesión para acceder a PostgreSQL.'); }

export async function syncBundledTemplatePdfs(): Promise<void> {
  requireSession();
  const existing = await templateRepository.list();
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const bundled of DEFAULT_TEMPLATES) {
    const current = byId.get(bundled.id);
    if (current?.pdfBase64 || !bundled.pdfAssetPath) continue;
    const response = await fetch(bundled.pdfAssetPath);
    if (!response.ok) throw new Error(`No se pudo cargar el PDF base de ${bundled.name}.`);
    const pdfBase64 = await blobToDataUrl(await response.blob());
    await templateRepository.save({ ...(current || bundled), pdfBase64 });
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(blob);
  });
}

export async function loadCompanies(): Promise<Empresa[]> {
  requireSession(); return (await loadApiWorkspace()).companies as Empresa[];
}
export async function saveCompanies(companies: Empresa[]): Promise<void> {
  requireSession(); await replaceApiCollection('companies', companies);
}
export async function deleteCompany(companyId: string): Promise<void> {
  await saveCompanies((await loadCompanies()).filter((company) => company.id !== companyId));
}
export async function loadActiveCompanyId(): Promise<string | undefined> {
  requireSession(); return (await loadApiWorkspace()).activeCompanyId || undefined;
}
export async function saveActiveCompanyId(companyId: string): Promise<void> {
  requireSession(); await setApiActiveCompany(companyId || null);
}
export async function loadEmployees(): Promise<Empleado[]> {
  requireSession(); return (await loadApiWorkspace()).employees as Empleado[];
}
export async function saveEmployees(employees: Empleado[]): Promise<void> {
  requireSession(); await replaceApiCollection('employees', employees);
}
export async function deleteEmployee(employeeId: string): Promise<void> {
  await saveEmployees((await loadEmployees()).filter((employee) => employee.id !== employeeId));
}

export const templateRepository = {
  async list(): Promise<FormTemplate[]> { requireSession(); return (await loadApiWorkspace()).templates as FormTemplate[]; },
  async save(template: FormTemplate): Promise<void> { requireSession(); await saveApiRecord('templates', template as unknown as Record<string, unknown>); },
  async remove(templateId: string): Promise<void> { requireSession(); await removeApiRecord('templates', templateId); },
};
export const generatedFormRepository = {
  async list(): Promise<GeneratedForm[]> { requireSession(); return (await loadApiWorkspace()).generatedForms as GeneratedForm[]; },
  async save(form: GeneratedForm): Promise<void> { requireSession(); await saveApiRecord('generatedForms', form as unknown as Record<string, unknown>); },
  async remove(id: string): Promise<void> { requireSession(); await removeApiRecord('generatedForms', id); },
};
export const stampPresetRepository = {
  async list(): Promise<StampPreset[]> { requireSession(); return (await loadApiWorkspace()).stampPresets as StampPreset[]; },
  async save(stamp: StampPreset): Promise<void> { requireSession(); await saveApiRecord('stampPresets', stamp as unknown as Record<string, unknown>); },
  async remove(id: string): Promise<void> { requireSession(); await removeApiRecord('stampPresets', id); },
};

/** Importa una sola vez el espacio IndexedDB anterior si PostgreSQL todavía está vacío. */
export async function migrateLocalWorkspaceToApi(): Promise<void> {
  requireSession();
  const marker = 'validum-local-workspace-migrated-to-api-v1';
  if (localStorage.getItem(marker) === 'true') return;
  const remote = await loadApiWorkspace();
  const [companies, employees, templates, stamps, generated, activeCompanyId] = await Promise.all([
    loadLocalCompanies(), loadLocalEmployees(), localTemplates.list(), localStampPresets.list(), localGeneratedForms.list(), loadLocalActiveCompanyId(),
  ]);
  if (!remote.companies.length && companies.length) await saveCompanies(companies);
  if (!remote.employees.length && employees?.length) await saveEmployees(employees);
  if (!remote.templates.length) for (const template of templates) await templateRepository.save(template);
  if (!remote.stampPresets.length) for (const stamp of stamps) await stampPresetRepository.save(stamp);
  if (!remote.generatedForms.length) for (const form of generated) await generatedFormRepository.save(form);
  if (!remote.activeCompanyId && activeCompanyId) await saveActiveCompanyId(activeCompanyId);
  localStorage.setItem(marker, 'true');
  await saveLocalActiveCompanyId(activeCompanyId || '');
}
