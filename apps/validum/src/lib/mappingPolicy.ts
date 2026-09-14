import type { PDFMappedField } from '../types/formularios';

/**
 * Inventario de los campos retirados por la migración defectuosa anterior.
 * Se conserva únicamente para restaurarlos una vez; no define una política
 * de borrado y nunca debe filtrar los mapeos vigentes.
 */
export const PREVIOUSLY_PRUNED_FIELD_KEYS = new Set([
  'tipoAfiliacionIndividual',
  'tipoAfiliacionColectiva',
  'tipoAfiliacionOficio',
  'tipoAfiliacionBeneficiario',
  'regimenContributivo',
  'regimenSubsidiado',
  'contribucionSolidariaSi',
  'contribucionSolidariaNo',
  'tarifaContribucionSolidaria',
  'tipoAfiliadoCotizante',
  'tipoAfiliadoCabezaFamilia',
  'tipoAfiliadoBeneficiario',
  'tipoCotizanteDependiente',
  'tipoCotizanteIndependiente',
  'tipoCotizantePensionado',
  'codigoRegistroEps',
  'codigoRegistroEpsTramite',
  'identidadGeneroTrans',
  'identidadGeneroNoBinario',
  'identidadGeneroOtro',
  'identidadGeneroCual',
  'discapacidad',
  'condicion',
  'puntajeSisben',
  'grupoEspecial',
  'barrio',
  'tipoAportantePagador',
  'novedadIngresoContribucionSolidaria',
  'novedadRetiroContribucionSolidaria',
  'motivoTraslado',
  'declaracionFuerzaMayorDocumentos',
  'declaracionNoInternacion',
  'anexoDocumentoIdentidad',
  'anexoDictamenIncapacidad',
  'anexoUnionMarital',
  'anexoTerminacionUnion',
  'anexoAdopcion',
  'anexoCustodia',
  'anexoPatriaPotestad',
  'anexoAutorizacionTraslado',
  'anexoAfiliacionColectiva',
  'anexoAfiliacionOficio',
  'cantidadAnexoCN',
  'cantidadAnexoRC',
  'cantidadAnexoTI',
  'cantidadAnexoCC',
  'cantidadAnexoCE',
  'cantidadAnexoPA',
  'cantidadAnexoCD',
  'cantidadAnexoSC',
  'cantidadAnexosTotal',
  'territorialCodigoMunicipio',
  'territorialCodigoDepartamento',
  'territorialFichaSisben',
  'territorialPuntajeSisben',
  'territorialNivelSisben',
  'territorialFechaRadicacion',
  'territorialFechaValidacion',
  'funcionarioPrimerApellido',
  'funcionarioSegundoApellido',
  'funcionarioPrimerNombre',
  'funcionarioSegundoNombre',
  'funcionarioTipoDocumento',
  'funcionarioNumeroDocumento',
  'firmaFuncionario',
]);

export function wasPreviouslyPrunedMappedField(field: Pick<PDFMappedField, 'fieldKey' | 'label'>): boolean {
  return PREVIOUSLY_PRUNED_FIELD_KEYS.has(field.fieldKey)
    || field.label === 'Comunidad / localidad'
    || /^Responsable contribución\s*-/i.test(field.label);
}

export function exclusiveCheckboxGroup(fieldKey: string): string | undefined {
  if (fieldKey === 'sexoFemenino' || fieldKey === 'sexoMasculino') return 'sexo-cotizante';
  if (fieldKey === 'identidadGeneroFemenino' || fieldKey === 'identidadGeneroMasculino') return 'identidad-cotizante';
  if (fieldKey === 'discapacidadSi' || fieldKey === 'discapacidadNo') return 'discapacidad-cotizante';
  if (fieldKey === 'encuestaSisbenSi' || fieldKey === 'encuestaSisbenNo') return 'sisben-cotizante';
  if (fieldKey === 'conyugeSexoFemenino' || fieldKey === 'conyugeSexoMasculino') return 'sexo-conyuge';
  const beneficiary = fieldKey.match(/^beneficiario(\d+)Sexo(?:Femenino|Masculino)$/);
  return beneficiary ? `sexo-beneficiario-${beneficiary[1]}` : undefined;
}
