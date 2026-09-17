import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_TEMPLATES, DEPRECATED_DEFAULT_TEMPLATE_IDS } from '../data/defaultTemplates';
import { wasPreviouslyPrunedMappedField } from '../lib/mappingPolicy';
import { normalizeTemplate, parseImportedTemplate, validateFormTemplate } from '../lib/templateValidation';
import { migrateLegacyLocalStorage } from '../lib/validumStorage';
import {
  generatedFormRepository,
  templateRepository,
} from '../lib/backendRepository';
import type { FormTemplate, GeneratedForm } from '../types/formularios';

const STORAGE_EVENT = 'validum-form-storage-changed';
const RESTORE_PRUNED_FIELDS_MARKER = 'validum-restored-pruned-fields-2026-09-12-v2';

function restorePrunedFields(template: FormTemplate, factory: FormTemplate): FormTemplate {
  const capitalRepairKeys = new Set(['contribucionSolidariaSi', 'novedadIngresoContribucionSolidaria']);
  const referenceRequiredKeys = new Set([
    'discapacidadSi', 'discapacidadNo', 'encuestaSisbenSi', 'encuestaSisbenNo',
    'ipsSeleccionada', 'codigoIps',
  ]);
  const repairable = factory.fields.filter(field => template.id === 'default-capital-salud-2026'
    ? capitalRepairKeys.has(field.fieldKey)
    : wasPreviouslyPrunedMappedField(field) || referenceRequiredKeys.has(field.fieldKey));
  const identity = (field: FormTemplate['fields'][number]) => `${field.page}:${field.fieldKey}:${field.label}`;
  const existingFields = new Set(template.fields.map(identity));
  const missing = repairable.filter(field => !existingFields.has(identity(field)));
  if (!missing.length) return template;

  const factoryOrder = new Map(factory.fields.map((field, index) => [identity(field), index]));
  const fields = [...template.fields, ...missing].sort((left, right) =>
    (factoryOrder.get(identity(left)) ?? Number.MAX_SAFE_INTEGER) - (factoryOrder.get(identity(right)) ?? Number.MAX_SAFE_INTEGER));
  return { ...template, fields };
}

function upgradeFactoryTypography(template: FormTemplate, factory: FormTemplate): FormTemplate {
  const factoryFields = new Map(factory.fields.map(field => [field.id, field]));
  return {
    ...template,
    version: factory.version,
    fields: template.fields.map(field => {
      const factoryField = factoryFields.get(field.id);
      if (!factoryField) return field;
      const isKnownSanitasPageError = template.id === 'default-sanitas-2026'
        && field.page === 0
        && Math.abs(field.y - 29.58) < 0.1
        && (
          (field.fieldKey === 'ejecutivoComercial' && Math.abs(field.x - 29) < 0.1 && Math.abs(field.width - 260) < 0.1)
          || (field.fieldKey === 'fechaSelloRadicacion' && Math.abs(field.x - 300) < 0.1 && Math.abs(field.width - 130) < 0.1)
        );
      const repairedField = isKnownSanitasPageError
        ? {
            ...field,
            page: factoryField.page,
            x: factoryField.x,
            y: factoryField.y,
            width: factoryField.width,
            height: factoryField.height,
          }
        : field;
      const legacyLimit = field.fieldType === 'checkbox' ? 7 : 6;
      if (repairedField.fontSize > legacyLimit) return repairedField;
      return {
        ...repairedField,
        fontSize: factoryField.fontSize,
        minFontSize: Math.max(repairedField.minFontSize || 0, factoryField.minFontSize || 5),
      };
    }),
  };
}

function announceChange() {
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function removeFieldsFromMissingPages(template: FormTemplate): FormTemplate {
  const factory = DEFAULT_TEMPLATES.find(item => item.id === template.id);
  const isSanitas = `${template.entity} ${template.name}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .includes('SANITAS');
  // Algunas instalaciones conservaron una versión histórica de Sanitas marcada
  // con tres páginas. El formulario oficial actual y su PDF base solo tienen dos.
  const effectivePageCount = isSanitas
    ? (factory?.totalPages || 2)
    : template.totalPages;
  const fields = template.fields.filter(field =>
    Number.isInteger(field.page) && field.page >= 0 && field.page < effectivePageCount
  );
  const needsRepair = fields.length !== template.fields.length || template.totalPages !== effectivePageCount;
  return needsRepair
    ? {
        ...template,
        totalPages: effectivePageCount,
        pageSizes: template.pageSizes?.slice(0, effectivePageCount) || factory?.pageSizes,
        fields,
      }
    : template;
}

export function useTemplateStorage() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [generatedForms, setGeneratedForms] = useState<GeneratedForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      await migrateLegacyLocalStorage();
      for (const deprecatedId of DEPRECATED_DEFAULT_TEMPLATE_IDS) {
        await templateRepository.remove(deprecatedId);
      }
      let rawStored = await templateRepository.list();
      const sanitizedStored = rawStored.map(removeFieldsFromMissingPages);
      await Promise.all(sanitizedStored.map((template, index) =>
        template.fields.length === rawStored[index].fields.length && template.totalPages === rawStored[index].totalPages
          ? Promise.resolve()
          : templateRepository.save(template)
      ));
      rawStored = sanitizedStored;
      if (globalThis.localStorage?.getItem(RESTORE_PRUNED_FIELDS_MARKER) !== 'true') {
        rawStored = rawStored.map(template => {
          const factory = DEFAULT_TEMPLATES.find(item => item.id === template.id);
          return factory ? restorePrunedFields(template, factory) : template;
        });
        await Promise.all(rawStored.map(template => templateRepository.save(template)));
        globalThis.localStorage?.setItem(RESTORE_PRUNED_FIELDS_MARKER, 'true');
      }
      let stored = rawStored.map(normalizeTemplate);
      await Promise.all(stored.map((template, index) => {
        const raw = rawStored[index];
        return JSON.stringify(raw) === JSON.stringify(template)
          ? Promise.resolve()
          : templateRepository.save(template);
      }));
      for (const factory of DEFAULT_TEMPLATES) {
        const defaultIndex = stored.findIndex(item => item.id === factory.id);
        if (defaultIndex < 0) {
          await templateRepository.save(factory);
          stored.push(factory);
        } else if ((stored[defaultIndex].version || 0) < factory.version) {
          const existing = stored[defaultIndex];
          const wasCustomized = existing.updatedAt !== existing.createdAt;
          const nextTemplate = wasCustomized
            ? upgradeFactoryTypography(existing, factory)
            : factory;
          await templateRepository.save(nextTemplate);
          stored[defaultIndex] = nextTemplate;
        }
      }
      setTemplates(stored.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setGeneratedForms(await generatedFormRepository.list());
      setStorageError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo abrir el almacenamiento local.';
      console.error(message);
      setStorageError(message);
      setTemplates(DEFAULT_TEMPLATES);
      setGeneratedForms([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const handleChange = () => void reload();
    window.addEventListener(STORAGE_EVENT, handleChange);
    return () => window.removeEventListener(STORAGE_EVENT, handleChange);
  }, [reload]);

  const saveTemplate = useCallback(async (template: FormTemplate) => {
    const normalized = normalizeTemplate(template);
    const issues = validateFormTemplate(normalized);
    if (issues.length) throw new Error(issues.join('\n'));
    await templateRepository.save(normalized);
    announceChange();
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    await templateRepository.remove(id);
    announceChange();
  }, []);

  const getTemplate = useCallback((id: string) => templates.find(item => item.id === id), [templates]);

  const duplicateTemplate = useCallback(async (id: string): Promise<FormTemplate | undefined> => {
    const original = templates.find(item => item.id === id);
    if (!original) return undefined;
    const duplicate: FormTemplate = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (copia)`,
      fields: original.fields.map(field => ({ ...field, id: crypto.randomUUID() })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    await templateRepository.save(duplicate);
    announceChange();
    return duplicate;
  }, [templates]);

  const saveGeneratedForm = useCallback(async (form: GeneratedForm) => {
    await generatedFormRepository.save(form);
    announceChange();
  }, []);

  const deleteGeneratedForm = useCallback(async (id: string) => {
    await generatedFormRepository.remove(id);
    announceChange();
  }, []);

  const exportTemplate = useCallback((id: string): string | null => {
    const template = templates.find(item => item.id === id);
    if (!template) return null;
    return JSON.stringify({ _type: 'validum-template', _version: '2.0', template }, null, 2);
  }, [templates]);

  const importTemplate = useCallback(async (jsonString: string): Promise<FormTemplate | null> => {
    try {
      const parsed = parseImportedTemplate(jsonString);
      const template = {
        ...parsed,
        id: crypto.randomUUID(),
        fields: parsed.fields.map(field => ({ ...field, id: crypto.randomUUID() })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await templateRepository.save(template);
      announceChange();
      return template;
    } catch (error) {
      console.error('Error al importar plantilla:', error);
      return null;
    }
  }, []);

  const stats = useMemo(() => ({
    totalTemplates: templates.length,
    totalGenerated: generatedForms.length,
    generatedThisMonth: generatedForms.filter(form => {
      const date = new Date(form.generatedAt);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
    templatesByEntity: templates.reduce((acc, template) => {
      acc[template.entityType] = (acc[template.entityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  }), [generatedForms, templates]);

  return {
    templates,
    generatedForms,
    isLoading,
    storageError,
    saveTemplate,
    deleteTemplate,
    getTemplate,
    duplicateTemplate,
    saveGeneratedForm,
    deleteGeneratedForm,
    exportTemplate,
    importTemplate,
    stats,
  };
}
