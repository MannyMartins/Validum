import type { FormTemplate, GeneratedForm, StampPreset } from '../types/formularios';
import type { Beneficiario, Empleado, Empresa } from '../types/validum';
import type { Database, Json } from '../types/database.generated';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_TEMPLATES } from '../data/defaultTemplates';
import {
  generatedFormRepository as localGeneratedForms,
  loadActiveCompanyId as loadLocalActiveCompanyId,
  loadCompanies as loadLocalCompanies,
  loadEmployees as loadLocalEmployees,
  saveActiveCompanyId as saveLocalActiveCompanyId,
  saveCompanies as saveLocalCompanies,
  saveEmployees as saveLocalEmployees,
  stampPresetRepository as localStampPresets,
  templateRepository as localTemplates,
} from './validumStorage';
import {
  getActiveOrganizationId,
  hasAuthenticatedSupabaseSession,
  isSupabaseConfigured,
  supabase,
} from './supabaseClient';

const TEMPLATE_BUCKET = 'validum-templates';
const GENERATED_BUCKET = 'validum-generated';
type PublicTableName = keyof Database['public']['Tables'];

function toJson(value: unknown): Json {
  return value as Json;
}

async function useCloud(): Promise<boolean> {
  return Boolean(isSupabaseConfigured && supabase && await hasAuthenticatedSupabaseSession());
}

function requireClient() {
  if (!supabase) throw new Error('Supabase no esta configurado.');
  return supabase;
}

function dataUrlToBlob(value: string, fallbackMime: string): Blob {
  const comma = value.indexOf(',');
  const header = comma >= 0 ? value.slice(0, comma) : '';
  const content = comma >= 0 ? value.slice(comma + 1) : value;
  const mime = /data:([^;]+)/.exec(header)?.[1] || fallbackMime;
  const bytes = atob(content);
  const array = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) array[index] = bytes.charCodeAt(index);
  return new Blob([array], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo remoto.'));
    reader.readAsDataURL(blob);
  });
}

async function downloadDataUrl(bucket: string, path?: string | null): Promise<string> {
  if (!path) return '';
  const { data, error } = await requireClient().storage.from(bucket).download(path);
  if (error) throw error;
  return blobToDataUrl(data);
}

async function uploadDataUrl(bucket: string, path: string, value: string, mime: string): Promise<void> {
  const { error } = await requireClient().storage.from(bucket).upload(path, dataUrlToBlob(value, mime), {
    contentType: mime,
    upsert: true,
  });
  if (error) throw error;
}

/**
 * Copia los PDF oficiales incluidos con la aplicacion al Storage privado de la
 * organizacion. Solo completa plantillas predeterminadas que todavia no tienen
 * archivo remoto; nunca reemplaza coordenadas ni personalizaciones del mapeo.
 */
export async function syncBundledTemplatePdfs(): Promise<void> {
  if (!await useCloud()) return;

  const client = requireClient();
  const organizationId = await getActiveOrganizationId();
  const { data: rows, error: rowsError } = await client
    .from('form_templates')
    .select('template_id,pdf_storage_path')
    .eq('organization_id', organizationId);
  if (rowsError) throw rowsError;

  const remotePathById = new Map(
    (rows || []).map(row => [String(row.template_id), row.pdf_storage_path])
  );

  for (const template of DEFAULT_TEMPLATES) {
    if (remotePathById.get(template.id) || !template.pdfAssetPath) continue;

    const response = await fetch(template.pdfAssetPath);
    if (!response.ok) {
      throw new Error(`No se pudo cargar el PDF base de ${template.name}.`);
    }

    const storagePath = `${organizationId}/templates/${template.id}/base.pdf`;
    const { error: uploadError } = await client.storage
      .from(TEMPLATE_BUCKET)
      .upload(storagePath, await response.blob(), {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error: updateError } = await client
      .from('form_templates')
      .update({ pdf_storage_path: storagePath })
      .eq('organization_id', organizationId)
      .eq('template_id', template.id);
    if (updateError) throw updateError;
  }
}

function companyRow(company: Empresa, organizationId: string) {
  const companyId = company.id || crypto.randomUUID();
  const normalized = { ...company, id: companyId };
  return {
    organization_id: organizationId,
    company_id: companyId,
    document_type: company.tipoDocumento || 'NIT',
    document_number: company.nit,
    verification_digit: company.dv || null,
    legal_name: company.razonSocial,
    trade_name: company.nombreComercial || null,
    department: company.departamento || null,
    city: company.ciudad || null,
    address: company.direccion || null,
    phone: company.telefono || null,
    email: company.email || null,
    data: normalized,
    updated_at: new Date().toISOString(),
  };
}

function employeeRow(employee: Empleado, organizationId: string) {
  const documentNumber = employee.numeroDocumento || employee.cedula;
  const firstNames = (employee.nombres || '').trim().split(/\s+/).filter(Boolean);
  const surnames = (employee.apellidos || '').trim().split(/\s+/).filter(Boolean);
  return {
    organization_id: organizationId,
    employee_id: employee.id,
    company_id: employee.empresaId || null,
    document_type: employee.tipoDocumento || 'CC',
    document_number: documentNumber,
    first_name: employee.primerNombre || firstNames[0] || 'SIN NOMBRE',
    middle_name: employee.segundoNombre || firstNames.slice(1).join(' ') || null,
    first_surname: employee.primerApellido || surnames[0] || 'SIN APELLIDO',
    second_surname: employee.segundoApellido || surnames.slice(1).join(' ') || null,
    status: employee.estado || 'ACTIVO',
    email: employee.emailCotizante || null,
    phone: employee.telefonoCotizante || null,
    eps_name: employee.eps || null,
    data: toJson(employee),
    updated_at: new Date().toISOString(),
  };
}

function beneficiaryRow(beneficiary: Beneficiario, employeeId: string, organizationId: string) {
  return {
    organization_id: organizationId,
    beneficiary_id: beneficiary.id,
    employee_id: employeeId,
    relationship: beneficiary.parentesco,
    document_type: beneficiary.tipoDocumento,
    document_number: beneficiary.numeroDocumento,
    first_name: beneficiary.primerNombre,
    middle_name: beneficiary.segundoNombre || null,
    first_surname: beneficiary.primerApellido,
    second_surname: beneficiary.segundoApellido || null,
    data: toJson(beneficiary),
    updated_at: new Date().toISOString(),
  };
}

export async function loadCompanies(): Promise<Empresa[]> {
  if (!await useCloud()) return loadLocalCompanies();
  const organizationId = await getActiveOrganizationId();
  const { data, error } = await requireClient()
    .from('companies')
    .select('company_id,data')
    .eq('organization_id', organizationId)
    .order('legal_name');
  if (error) throw error;
  return (data || []).map(row => ({ ...(row.data as unknown as Empresa), id: String(row.company_id) }));
}

export async function saveCompanies(companies: Empresa[]): Promise<void> {
  if (!await useCloud()) return saveLocalCompanies(companies);
  if (!companies.length) return;
  const organizationId = await getActiveOrganizationId();
  const { error } = await requireClient()
    .from('companies')
    .upsert(companies.map(company => companyRow(company, organizationId)), {
      onConflict: 'organization_id,company_id',
    });
  if (error) throw error;
}

export async function deleteCompany(companyId: string): Promise<void> {
  if (!await useCloud()) {
    const companies = await loadLocalCompanies();
    return saveLocalCompanies(companies.filter(company => company.id !== companyId));
  }
  const organizationId = await getActiveOrganizationId();
  const { error } = await requireClient().from('companies').delete()
    .eq('organization_id', organizationId).eq('company_id', companyId);
  if (error) throw error;
}

export async function loadActiveCompanyId(): Promise<string | undefined> {
  if (!await useCloud()) return loadLocalActiveCompanyId();
  const organizationId = await getActiveOrganizationId();
  const { data: userData, error: userError } = await requireClient().auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return undefined;
  const { data, error } = await requireClient().from('user_preferences')
    .select('active_company_id')
    .eq('user_id', userData.user.id)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return data?.active_company_id || undefined;
}

export async function saveActiveCompanyId(companyId: string): Promise<void> {
  if (!await useCloud()) return saveLocalActiveCompanyId(companyId);
  const organizationId = await getActiveOrganizationId();
  const { data: userData, error: userError } = await requireClient().auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('No hay una sesion autenticada.');
  const { error } = await requireClient().from('user_preferences').upsert({
    user_id: userData.user.id,
    organization_id: organizationId,
    active_company_id: companyId || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function loadEmployees(): Promise<Empleado[] | undefined> {
  if (!await useCloud()) return loadLocalEmployees();
  const organizationId = await getActiveOrganizationId();
  const { data, error } = await requireClient().from('employees')
    .select('employee_id,data')
    .eq('organization_id', organizationId)
    .order('first_surname');
  if (error) throw error;
  return (data || []).map(row => ({ ...(row.data as unknown as Empleado), id: String(row.employee_id) }));
}

async function syncBeneficiaries(employee: Empleado, organizationId: string): Promise<void> {
  const client = requireClient();
  const { error: deleteError } = await client.from('beneficiaries').delete()
    .eq('organization_id', organizationId).eq('employee_id', employee.id);
  if (deleteError) throw deleteError;
  if (!employee.beneficiarios?.length) return;
  const { error } = await client.from('beneficiaries').insert(
    employee.beneficiarios.map(beneficiary => beneficiaryRow(beneficiary, employee.id, organizationId))
  );
  if (error) throw error;
}

export async function saveEmployees(employees: Empleado[]): Promise<void> {
  if (!await useCloud()) return saveLocalEmployees(employees);
  if (!employees.length) return;
  const organizationId = await getActiveOrganizationId();
  const { error } = await requireClient().from('employees').upsert(
    employees.map(employee => employeeRow(employee, organizationId)),
    { onConflict: 'organization_id,employee_id' }
  );
  if (error) throw error;
  await Promise.all(employees.map(employee => syncBeneficiaries(employee, organizationId)));
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  if (!await useCloud()) {
    const employees = await loadLocalEmployees() || [];
    return saveLocalEmployees(employees.filter(employee => employee.id !== employeeId));
  }
  const organizationId = await getActiveOrganizationId();
  const { error } = await requireClient().from('employees').delete()
    .eq('organization_id', organizationId).eq('employee_id', employeeId);
  if (error) throw error;
}

function templateFromRow(row: Record<string, unknown>, pdfBase64: string, thumbnailBase64: string): FormTemplate {
  const definition = (row.definition || {}) as Partial<FormTemplate>;
  return {
    ...definition,
    id: String(row.template_id),
    name: String(row.name),
    entity: String(row.entity_name),
    entityType: row.entity_type as FormTemplate['entityType'],
    formType: String(row.form_type),
    description: String(row.description || ''),
    pdfBase64,
    pdfFileName: String(definition.pdfFileName || 'formulario.pdf'),
    totalPages: Number(row.page_count),
    pageSizes: row.page_sizes as FormTemplate['pageSizes'],
    layoutFingerprint: row.layout_fingerprint ? String(row.layout_fingerprint) : undefined,
    fields: (row.fields || []) as unknown as FormTemplate['fields'],
    mappingStatus: row.mapping_status as FormTemplate['mappingStatus'],
    version: Number(row.version),
    thumbnailBase64: thumbnailBase64 || undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const templateRepository = {
  async list(): Promise<FormTemplate[]> {
    if (!await useCloud()) return localTemplates.list();
    const organizationId = await getActiveOrganizationId();
    const { data, error } = await requireClient().from('form_templates').select('*')
      .eq('organization_id', organizationId).order('updated_at', { ascending: false });
    if (error) throw error;
    return Promise.all((data || []).map(async row => templateFromRow(
      row,
      await downloadDataUrl(TEMPLATE_BUCKET, row.pdf_storage_path),
      await downloadDataUrl(TEMPLATE_BUCKET, row.thumbnail_storage_path),
    )));
  },

  async save(template: FormTemplate): Promise<void> {
    if (!await useCloud()) return localTemplates.save(template);
    const client = requireClient();
    const organizationId = await getActiveOrganizationId();
    const { data: existing, error: existingError } = await client.from('form_templates')
      .select('pdf_storage_path,thumbnail_storage_path')
      .eq('organization_id', organizationId).eq('template_id', template.id).maybeSingle();
    if (existingError) throw existingError;

    let pdfPath = existing?.pdf_storage_path || null;
    let thumbnailPath = existing?.thumbnail_storage_path || null;
    if (template.pdfBase64) {
      pdfPath = `${organizationId}/templates/${template.id}/base.pdf`;
      await uploadDataUrl(TEMPLATE_BUCKET, pdfPath, template.pdfBase64, 'application/pdf');
    }
    if (template.thumbnailBase64) {
      thumbnailPath = `${organizationId}/templates/${template.id}/thumbnail.jpg`;
      await uploadDataUrl(TEMPLATE_BUCKET, thumbnailPath, template.thumbnailBase64, 'image/jpeg');
    }

    const { pdfBase64: _pdf, thumbnailBase64: _thumbnail, fields: _fields, ...definition } = template;
    const { error } = await client.from('form_templates').upsert({
      organization_id: organizationId,
      template_id: template.id,
      name: template.name,
      entity_name: template.entity,
      entity_type: template.entityType,
      form_type: template.formType,
      description: template.description || null,
      pdf_storage_path: pdfPath,
      thumbnail_storage_path: thumbnailPath,
      page_count: template.totalPages,
      page_sizes: template.pageSizes || null,
      layout_fingerprint: template.layoutFingerprint || null,
      fields: toJson(template.fields),
      mapping_status: template.mappingStatus || 'draft',
      version: template.version,
      definition,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    }, { onConflict: 'organization_id,template_id' });
    if (error) throw error;
  },

  async remove(templateId: string): Promise<void> {
    if (!await useCloud()) return localTemplates.remove(templateId);
    const client = requireClient();
    const organizationId = await getActiveOrganizationId();
    const { data, error: readError } = await client.from('form_templates')
      .select('pdf_storage_path,thumbnail_storage_path')
      .eq('organization_id', organizationId).eq('template_id', templateId).maybeSingle();
    if (readError) throw readError;
    const { error } = await client.from('form_templates').delete()
      .eq('organization_id', organizationId).eq('template_id', templateId);
    if (error) throw error;
    const paths = [data?.pdf_storage_path, data?.thumbnail_storage_path].filter(Boolean) as string[];
    if (paths.length) {
      const { error: storageError } = await client.storage.from(TEMPLATE_BUCKET).remove(paths);
      if (storageError) console.warn('No se pudieron limpiar todos los archivos de la plantilla:', storageError);
    }
  },
};

export const generatedFormRepository = {
  async list(): Promise<GeneratedForm[]> {
    if (!await useCloud()) return localGeneratedForms.list();
    const organizationId = await getActiveOrganizationId();
    const { data, error } = await requireClient().from('generated_forms').select('*')
      .eq('organization_id', organizationId)
      .order('generated_at', { ascending: false }).limit(50);
    if (error) throw error;
    return Promise.all((data || []).map(async row => ({
      id: String(row.generated_form_id),
      templateId: row.template_id ? String(row.template_id) : '',
      templateName: String(row.template_name),
      empleadoId: row.employee_id ? String(row.employee_id) : '',
      empleadoNombre: String(row.employee_name),
      generatedAt: String(row.generated_at),
      pdfResultBase64: await downloadDataUrl(GENERATED_BUCKET, row.pdf_storage_path),
      manualFields: (row.manual_fields || {}) as Record<string, string>,
      tramiteFields: (row.procedure_fields || {}) as Record<string, string>,
      sourcePdfFileName: row.source_pdf_file_name || undefined,
    })));
  },

  async save(form: GeneratedForm): Promise<void> {
    if (!await useCloud()) return localGeneratedForms.save(form);
    const organizationId = await getActiveOrganizationId();
    const path = `${organizationId}/generated/${form.id}.pdf`;
    await uploadDataUrl(GENERATED_BUCKET, path, form.pdfResultBase64, 'application/pdf');
    const { error } = await requireClient().from('generated_forms').upsert({
      organization_id: organizationId,
      generated_form_id: form.id,
      template_id: form.templateId,
      employee_id: form.empleadoId,
      template_name: form.templateName,
      employee_name: form.empleadoNombre,
      pdf_storage_path: path,
      manual_fields: form.manualFields,
      procedure_fields: form.tramiteFields || {},
      source_pdf_file_name: form.sourcePdfFileName || null,
      generated_at: form.generatedAt,
    }, { onConflict: 'organization_id,generated_form_id' });
    if (error) {
      await requireClient().storage.from(GENERATED_BUCKET).remove([path]);
      throw error;
    }
  },

  async remove(generatedFormId: string): Promise<void> {
    if (!await useCloud()) return localGeneratedForms.remove(generatedFormId);
    const client = requireClient();
    const organizationId = await getActiveOrganizationId();
    const { data, error: readError } = await client.from('generated_forms')
      .select('pdf_storage_path').eq('organization_id', organizationId)
      .eq('generated_form_id', generatedFormId).maybeSingle();
    if (readError) throw readError;
    const { error } = await client.from('generated_forms').delete()
      .eq('organization_id', organizationId).eq('generated_form_id', generatedFormId);
    if (error) throw error;
    if (data?.pdf_storage_path) {
      const { error: storageError } = await client.storage.from(GENERATED_BUCKET).remove([data.pdf_storage_path]);
      if (storageError) console.warn('El registro se elimino, pero el PDF quedo pendiente de limpieza:', storageError);
    }
  },
};

export const stampPresetRepository = {
  async list(): Promise<StampPreset[]> {
    if (!await useCloud()) return localStampPresets.list();
    const organizationId = await getActiveOrganizationId();
    const { data, error } = await requireClient().from('stamp_presets').select('stamp_id,definition')
      .eq('organization_id', organizationId).order('name');
    if (error) throw error;
    return (data || []).map(row => ({ ...(row.definition as unknown as StampPreset), id: String(row.stamp_id) }));
  },
  async save(stamp: StampPreset): Promise<void> {
    if (!await useCloud()) return localStampPresets.save(stamp);
    const organizationId = await getActiveOrganizationId();
    const { error } = await requireClient().from('stamp_presets').upsert({
      organization_id: organizationId,
      stamp_id: stamp.id,
      name: stamp.name,
      definition: toJson(stamp),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,stamp_id' });
    if (error) throw error;
  },
  async remove(stampId: string): Promise<void> {
    if (!await useCloud()) return localStampPresets.remove(stampId);
    const organizationId = await getActiveOrganizationId();
    const { error } = await requireClient().from('stamp_presets').delete()
      .eq('organization_id', organizationId).eq('stamp_id', stampId);
    if (error) throw error;
  },
};

/**
 * Importa una sola vez el espacio de trabajo IndexedDB anterior cuando el
 * tenant de Supabase todavía está vacío. Nunca mezcla automáticamente dos
 * catálogos existentes, porque eso podría duplicar expedientes reales.
 */
export async function migrateLocalWorkspaceToSupabase(): Promise<void> {
  if (!await useCloud()) return;
  const client = requireClient();
  const organizationId = await getActiveOrganizationId();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return;
  const marker = `validum-cloud-migrated:${organizationId}:${userData.user.id}`;
  if (globalThis.localStorage?.getItem(marker) === 'true') return;

  const [localCompanies, localEmployees, localTemplateItems, localStamps, localGenerated] = await Promise.all([
    loadLocalCompanies(),
    loadLocalEmployees(),
    localTemplates.list(),
    localStampPresets.list(),
    localGeneratedForms.list(),
  ]);

  const count = async (table: PublicTableName): Promise<number> => {
    // `table` es dinámico en esta comprobación de migración local; cada nombre
    // ya está restringido por PublicTableName y todas las tablas usadas aquí
    // comparten organization_id.
    const dynamicClient = client as unknown as SupabaseClient;
    const { count: value, error } = await dynamicClient.from(table).select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    if (error) throw error;
    return value || 0;
  };
  const [companyCount, employeeCount, templateCount, stampCount, generatedCount] = await Promise.all([
    count('companies'), count('employees'), count('form_templates'), count('stamp_presets'), count('generated_forms'),
  ]);

  if (companyCount === 0 && localCompanies.length) await saveCompanies(localCompanies);
  if (employeeCount === 0 && localEmployees?.length) await saveEmployees(localEmployees);
  if (templateCount === 0) {
    for (const template of localTemplateItems) await templateRepository.save(template);
  }
  if (stampCount === 0) {
    for (const stamp of localStamps) await stampPresetRepository.save(stamp);
  }
  if (generatedCount === 0) {
    for (const generated of localGenerated) {
      try {
        await generatedFormRepository.save(generated);
      } catch (error) {
        // Un historial muy antiguo puede apuntar a un empleado o plantilla que
        // ya no existe. No bloqueamos la migración del resto del espacio.
        console.warn(`No se migró el formulario generado ${generated.id}:`, error);
      }
    }
  }

  const activeCompanyId = await loadLocalActiveCompanyId();
  if (activeCompanyId) await saveActiveCompanyId(activeCompanyId);
  globalThis.localStorage?.setItem(marker, 'true');
}
