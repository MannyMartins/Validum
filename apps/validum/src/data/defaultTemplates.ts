import { SGSSS_2026_TEMPLATES } from './sgsssTemplateMappings';
import type { FormTemplate } from '../types/formularios';

/**
 * Plantillas oficiales en blanco revisadas y calibradas de forma independiente.
 * No se comparte geometría entre EPS: cada archivo conserva sus páginas y medidas.
 */
export const DEFAULT_TEMPLATES: FormTemplate[] = SGSSS_2026_TEMPLATES;

/** Plantillas de fábrica antiguas que ya no deben reaparecer en equipos existentes. */
export const DEPRECATED_DEFAULT_TEMPLATE_IDS = [
  'default-famisanar-sgsss',
  'default-sanitas-sgsss',
] as const;
