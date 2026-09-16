import type { FieldDataSource, PDFMappedField } from '../types/formularios';
import type { Beneficiario, Empleado, Empresa } from '../types/validum';

export function normalizeComparable(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function isTruthyValue(value: unknown): boolean {
  return ['X', '✓', 'TRUE', '1', 'SI', 'YES', 'ON'].includes(normalizeComparable(value));
}

export function normalizeSexValue(value: unknown): 'F' | 'M' | '' {
  const normalized = normalizeComparable(value);
  if (['F', 'FEMENINO', 'MUJER'].includes(normalized)) return 'F';
  if (['M', 'MASCULINO', 'HOMBRE'].includes(normalized)) return 'M';
  return '';
}

function splitName(value: string | undefined, index: number): string {
  return (value || '').trim().split(/\s+/)[index] || '';
}

export function resolveEmpleadoField(key: string, emp: Empleado): string {
  const map: Record<string, () => string> = {
    nombreCompleto: () => [emp.primerNombre || splitName(emp.nombres, 0), emp.segundoNombre || splitName(emp.nombres, 1), emp.primerApellido || splitName(emp.apellidos, 0), emp.segundoApellido || splitName(emp.apellidos, 1)].filter(Boolean).join(' '),
    primerApellido: () => emp.primerApellido || splitName(emp.apellidos, 0),
    segundoApellido: () => emp.segundoApellido || splitName(emp.apellidos, 1),
    primerNombre: () => emp.primerNombre || splitName(emp.nombres, 0),
    segundoNombre: () => emp.segundoNombre || splitName(emp.nombres, 1),
    tipoDocumento: () => emp.tipoDocumento || '',
    numeroDocumento: () => emp.numeroDocumento || emp.cedula || '',
    sexo: () => emp.sexo || '',
    fechaNacimiento: () => emp.fechaNacimiento || '',
    identidadGenero: () => emp.identidadGenero || '',
    identidadGeneroCual: () => emp.identidadGenero || '',
    estadoCivil: () => emp.estadoCivil || '',
    nacionalidad: () => emp.nacionalidad || '',
    paisNacimiento: () => emp.paisNacimiento || '',
    departamentoNacimiento: () => emp.departamentoNacimiento || '',
    ciudadNacimiento: () => emp.ciudadNacimiento || '',
    paisExpedicion: () => emp.paisExpedicion || '',
    departamentoExpedicion: () => emp.departamentoExpedicion || '',
    ciudadExpedicion: () => emp.ciudadExpedicion || '',
    fechaExpedicion: () => emp.fechaExpedicion || '',
    email: () => emp.emailCotizante || '',
    telefono: () => emp.telefonoCotizante || '',
    telefonoFijo: () => emp.telefonoFijo || '',
    direccion: () => emp.direccion || '',
    barrio: () => emp.barrio || '',
    ciudad: () => emp.ciudadResidencia || '',
    departamentoResidencia: () => emp.departamentoResidencia || '',
    localidadComuna: () => emp.localidadComuna || '',
    zona: () => emp.zona === 'U' ? 'URBANA' : emp.zona === 'R' ? 'RURAL' : '',
    etnia: () => emp.etnia || '',
    comunidad: () => emp.comunidad || '',
    discapacidad: () => emp.discapacidad || '',
    puntajeSisben: () => typeof emp.puntajeSisben === 'number' && emp.puntajeSisben > 0 ? String(emp.puntajeSisben) : '',
    grupoEspecial: () => emp.grupoEspecial || '',
    condicion: () => emp.condicion || '',
    codigoMunicipio: () => emp.codigoMunicipio || '',
    codigoDepartamento: () => emp.codigoDepartamento || '',
    eps: () => emp.eps || '',
    codigoEps: () => emp.codigoEps || '',
    arl: () => emp.arl || '',
    afp: () => emp.afp || '',
    ccf: () => emp.ccf || '',
    tipoCotizante: () => emp.tipoCotizante || '',
    tipoCotizanteCodigo: () => emp.tipoCotizanteCodigo || '',
    subtipoCotizante: () => emp.subtipoCotizante || '',
    tipoAfiliacion: () => emp.tipoAfiliacion || '',
    solicitudSat: () => emp.solicitudSat || '',
    ibc: () => emp.ibc ? String(emp.ibc) : '',
    ibcFormateado: () => emp.ibc ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(emp.ibc) : '',
    riesgoArl: () => ['', 'I', 'II', 'III', 'IV', 'V'][emp.riesgoArl] || '',
    riesgoArlNumero: () => emp.riesgoArl?.toString() || '',
    cargo: () => emp.cargo || '',
    salario: () => emp.salarioBase?.toString() || '',
    departamentoLaboral: () => emp.departamento || '',
    fechaIngreso: () => emp.fechaIngreso || '',
    salarioBase: () => emp.salarioBase?.toString() || '',
    salarioBaseFormateado: () => emp.salarioBase ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(emp.salarioBase) : '',
    administradoraPensiones: () => emp.afp || '',
    pensionFund: () => emp.afp || '',
    cajaCompensacion: () => emp.ccf || '',
    ipsSeleccionada: () => emp.ipsSeleccionada || '',
    ips: () => emp.ipsSeleccionada || '',
    codigoIps: () => emp.codigoIps || '',
    codigoRegistroEps: () => emp.codigoRegistroEps || '',
    lugarNacimiento: () => [emp.ciudadNacimiento, emp.departamentoNacimiento].filter(Boolean).join(', '),
    lugarExpedicion: () => [emp.ciudadExpedicion, emp.departamentoExpedicion].filter(Boolean).join(', '),
    municipio: () => emp.ciudadResidencia || emp.ciudadNacimiento || '',
    departamento: () => emp.departamentoResidencia || emp.departamentoNacimiento || '',
    celular: () => emp.telefonoCotizante || '',
    telefonoCelular: () => emp.telefonoCotizante || '',
    correo: () => emp.emailCotizante || '',
    correoElectronico: () => emp.emailCotizante || '',
    epsAnterior: () => emp.epsAnterior || '',
    motivoTraslado: () => {
      const isTraslado = (emp.tipoAfiliacion || '').toUpperCase() === 'TRASLADO' || (emp.tipoNovedad || '').toUpperCase() === 'TRASLADO';
      return isTraslado ? (emp.motivoTraslado || '') : '';
    },
    fechaNovedad: () => emp.fechaNovedad || '',
    cajaCompensacionAnterior: () => emp.cajaCompensacionAnterior || '',
    firmaDigitalCotizante: () => emp.firmaDigitalCotizante || '',
    firmaCotizante: () => emp.firmaDigitalCotizante || '',
  };
  return map[key]?.() || '';
}

export function resolveEmpresaField(key: string, emp: Empresa): string {
  const map: Record<string, () => string> = {
    razonSocial: () => emp.razonSocial || '',
    nombreEmpresa: () => emp.razonSocial || '',
    nit: () => emp.nit || '',
    dv: () => emp.dv || '',
    nitCompleto: () => [emp.nit, emp.dv].filter(Boolean).join('-'),
    tipoDocumentoEmpresa: () => emp.tipoDocumento || 'NIT',
    tipoDocumento: () => emp.tipoDocumento || 'NIT',
    direccionEmpresa: () => emp.direccion || '',
    direccion: () => emp.direccion || '',
    ciudadEmpresa: () => emp.ciudad || '',
    ciudad: () => emp.ciudad || '',
    departamentoEmpresa: () => emp.departamento || '',
    departamento: () => emp.departamento || '',
    telefonoEmpresa: () => emp.telefono || '',
    telefono: () => emp.telefono || '',
    emailEmpresa: () => emp.email || emp.emailContacto || '',
    email: () => emp.email || emp.emailContacto || '',
    correoEmpresa: () => emp.email || emp.emailContacto || '',
    representanteLegal: () => emp.representanteLegal || '',
    cedulaRepresentante: () => emp.cedulaRepresentante || '',
    operadorPila: () => emp.operadorPila || '',
    actividadEconomica: () => emp.actividadEconomica || '',
    nombreComercial: () => emp.nombreComercial || emp.razonSocial || '',
    contactoRecursosHumanos: () => emp.contactoRecursosHumanos || '',
    tipoAportantePagador: () => emp.tipoAportantePagador || '01',
    tipoAportante: () => emp.tipoAportantePagador || '01',
    firmaDigitalEmpresa: () => '',
    firmaEmpresa: () => '',
  };
  return map[key]?.() || '';
}

function beneficiaryValue(person: Beneficiario | undefined, suffix: string): string {
  if (!person) return '';
  const values: Record<string, string | undefined> = {
    Apellido1: person.primerApellido,
    Apellido2: person.segundoApellido,
    Nombre1: person.primerNombre,
    Nombre2: person.segundoNombre,
    TipoDoc: person.tipoDocumento,
    NumDoc: person.numeroDocumento,
    Sexo: person.sexo,
    FechaNac: person.fechaNacimiento,
    Parentesco: person.parentesco,
    Etnia: person.etnia,
    Nacionalidad: person.nacionalidad,
    PaisNacimiento: person.paisNacimiento,
    DepartamentoNacimiento: person.departamentoNacimiento,
    MunicipioNacimiento: person.municipioNacimiento,
    Municipio: person.municipio,
    Departamento: person.departamento,
    Telefono: person.telefono,
    ValorUpc: person.valorUpc,
    Ips: person.ipsSeleccionada,
    CodigoIps: person.codigoIps,
    SexoFemenino: normalizeSexValue(person.sexo) === 'F' ? 'X' : '',
    SexoMasculino: normalizeSexValue(person.sexo) === 'M' ? 'X' : '',
    DiscapacidadFisica: normalizeComparable(person.discapacidad).includes('FISIC') ? 'X' : '',
    DiscapacidadNeurosensorial: normalizeComparable(person.discapacidad).includes('NEURO') ? 'X' : '',
    DiscapacidadMental: normalizeComparable(person.discapacidad).includes('MENTAL') ? 'X' : '',
    CondicionTemporal: normalizeComparable(person.condicion).startsWith('TEMP') ? 'X' : '',
    CondicionPermanente: normalizeComparable(person.condicion).startsWith('PERM') ? 'X' : '',
    ZonaUrbana: normalizeComparable(person.zona).startsWith('U') ? 'X' : '',
    ZonaRural: normalizeComparable(person.zona).startsWith('R') ? 'X' : '',
  };
  return values[suffix] || '';
}

export function resolveFamiliarField(key: string, empleado: Empleado): string {
  const relatives = empleado.beneficiarios || [];
  const spouse = relatives.find(item => /CONYUGE|COMPANER[OA]/.test(normalizeComparable(item.parentesco)));
  const spouseMatch = key.match(/^conyuge(.+)$/);
  if (spouseMatch) return beneficiaryValue(spouse, spouseMatch[1]);

  const nonSpouse = relatives.filter(item => !/CONYUGE|COMPANER[OA]/.test(normalizeComparable(item.parentesco)));
  const list = spouse && nonSpouse.length > 0 ? nonSpouse : relatives;

  const indexed = key.match(/^beneficiario(\d+)(.+)$/);
  if (indexed) return beneficiaryValue(list[Number(indexed[1]) - 1], indexed[2]);

  const relationship = key.match(/^parentesco(\d+)$/);
  if (relationship) return beneficiaryValue(list[Number(relationship[1]) - 1], 'Parentesco');
  return '';
}

function resolveTramiteField(key: string, tramiteData: Record<string, string>): string {
  if (tramiteData[key] !== undefined) return tramiteData[key];
  if (key === 'tipoNovedad') return tramiteData.subTipoTramite || '';
  if (key === 'tipoNovedadCodigo') {
    const noveltyOrder = [
      'MODIFICACION_DATOS', 'CORRECCION_DATOS', 'ACTUALIZACION_DOCUMENTO', 'ACTUALIZACION_COMPLEMENTARIOS',
      'TERMINACION_INSCRIPCION', 'REINSCRIPCION', 'INCLUSION_BENEFICIARIOS', 'EXCLUSION_BENEFICIARIOS',
      'INICIO_RELACION', 'TERMINACION_RELACION', 'INSCRIPCION_RETORNO_PAIS', 'VINCULACION_COLECTIVA',
      'DESVINCULACION_COLECTIVA', 'MOVILIDAD', 'TRASLADO', 'FALLECIMIENTO', 'PROTECCION_CESANTE',
      'PREPENSIONADO', 'PENSIONADO', 'INGRESO_CONTRIBUCION_SOLIDARIA', 'RETIRO_CONTRIBUCION_SOLIDARIA',
    ];
    const index = noveltyOrder.indexOf(normalizeComparable(tramiteData.subTipoTramite));
    return index >= 0 ? String(index + 1) : '';
  }
  const isNoveltyDate = key.startsWith('fechaNovedad');
  const date = isNoveltyDate ? (tramiteData.fechaNovedad || '') : (tramiteData.fechaRadicacion || '');
  const parts = parseDateParts(date);
  if (!parts) return '';
  if (key === 'fechaRadicacionDia') return parts.day;
  if (key === 'fechaRadicacionMes') return parts.month;
  if (key === 'fechaRadicacionAnio') return parts.year;
  if (key === 'fechaNovedadDia') return parts.day;
  if (key === 'fechaNovedadMes') return parts.month;
  if (key === 'fechaNovedadAnio') return parts.year;
  return '';
}

export function resolveDataValue(
  source: FieldDataSource,
  key: string,
  empleado: Empleado,
  empresa: Empresa,
  manualFields: Record<string, string>,
  tramiteData: Record<string, string>,
): string {
  if (source === 'manual') return manualFields[key] || '';
  if (source === 'tramite') return resolveTramiteField(key, tramiteData) || manualFields[key] || '';
  if (source === 'empresa') {
    if (key === 'firmaDigitalEmpresa' || key === 'firmaEmpresa') {
      return manualFields[key] || empleado.firmaDigitalEmpresa || '';
    }
    return resolveEmpresaField(key, empresa);
  }
  if (source === 'cotizante') {
    if (key === 'firmaDigitalCotizante' || key === 'firmaCotizante') {
      return manualFields[key] || empleado.firmaDigitalCotizante || resolveEmpleadoField(key, empleado);
    }
    return resolveEmpleadoField(key, empleado);
  }
  if (source === 'familiar') return manualFields[key] || resolveFamiliarField(key, empleado);
  return '';
}

function semanticCheckboxValue(
  key: string,
  empleado: Empleado,
  tramiteData: Record<string, string>,
  manualFields: Record<string, string> = {},
): boolean | undefined {
  const tipoTramite = normalizeComparable(tramiteData.tipoTramite || empleado.tipoAfiliacion);
  const modalidadAfiliacion = normalizeComparable(tramiteData.modalidadAfiliacion || empleado.modalidadAfiliacion);
  const tipoAfiliacion = normalizeComparable(tramiteData.tipoAfiliacion || (empleado.tipoAfiliado === 'BENEFICIARIO' ? 'BENEFICIARIO_ADICIONAL' : 'COTIZANTE_CABEZA'));
  const tipoAfiliado = normalizeComparable(tramiteData.tipoAfiliado || empleado.tipoAfiliado);
  const regimen = normalizeComparable(tramiteData.regimen || empleado.regimen);
  const tipoCotizante = normalizeComparable(tramiteData.tipoCotizante || empleado.tipoCotizante);
  const derivedSubTipo = tipoTramite === 'TRASLADO'
    ? 'TRASLADO'
    : tipoTramite === 'INCLUSION'
      ? 'INCLUSION_BENEFICIARIOS'
      : '';
  const subTipo = normalizeComparable(tramiteData.subTipoTramite || empleado.tipoNovedad || derivedSubTipo);
  const movilidad = normalizeComparable(tramiteData.movilidadRegimen || empleado.movilidadRegimen);
  const traslado = normalizeComparable(tramiteData.trasladoRegimen || empleado.trasladoRegimen);
  const discapacidad = normalizeComparable(empleado.discapacidad);
  const tieneDiscapacidad = Boolean(discapacidad) && !['NO', 'NINGUNA', 'NINGUNO', 'NO APLICA', 'NA'].includes(discapacidad);
  const tieneSisben = typeof empleado.puntajeSisben === 'number' && empleado.puntajeSisben > 0;
  const identidadGenero = normalizeComparable(empleado.identidadGenero || empleado.sexo);
  const checks: Record<string, boolean> = {
    sexoFemenino: normalizeSexValue(empleado.sexo) === 'F',
    sexoMasculino: normalizeSexValue(empleado.sexo) === 'M',
    identidadGeneroFemenino: ['F', 'FEMENINO', 'MUJER'].includes(identidadGenero),
    identidadGeneroMasculino: ['M', 'MASCULINO', 'HOMBRE'].includes(identidadGenero),
    identidadGeneroTrans: normalizeComparable(empleado.identidadGenero).includes('TRANS'),
    identidadGeneroNoBinario: ['NB', 'NO BINARIO', 'NOBINARIO'].includes(normalizeComparable(empleado.identidadGenero)),
    identidadGeneroOtro: Boolean(empleado.identidadGenero) && !['F', 'FEMENINO', 'MUJER', 'M', 'MASCULINO', 'HOMBRE', 'NB', 'NO BINARIO', 'NOBINARIO'].includes(normalizeComparable(empleado.identidadGenero)) && !normalizeComparable(empleado.identidadGenero).includes('TRANS'),
    zonaUrbana: normalizeComparable(empleado.zona).startsWith('U'),
    zonaRural: normalizeComparable(empleado.zona).startsWith('R'),
    discapacidadFisica: normalizeComparable(empleado.discapacidad).includes('FISIC'),
    discapacidadNeurosensorial: normalizeComparable(empleado.discapacidad).includes('NEURO'),
    discapacidadMental: normalizeComparable(empleado.discapacidad).includes('MENTAL'),
    discapacidadSi: tieneDiscapacidad,
    discapacidadNo: !tieneDiscapacidad,
    encuestaSisbenSi: tieneSisben,
    encuestaSisbenNo: !tieneSisben,
    condicionTemporal: normalizeComparable(empleado.condicion).startsWith('TEMP'),
    condicionPermanente: normalizeComparable(empleado.condicion).startsWith('PERM'),
    tipoTramiteAfiliacion: tipoTramite === 'AFILIACION' || tipoTramite === 'NUEVO',
    tipoTramiteNovedad: tipoTramite === 'NOVEDAD' || tipoTramite === 'TRASLADO' || tipoTramite === 'INCLUSION',
    tipoAfiliacionIndividual: modalidadAfiliacion === 'INDIVIDUAL' || !modalidadAfiliacion,
    tipoAfiliacionColectiva: modalidadAfiliacion === 'COLECTIVA',
    tipoAfiliacionInstitucional: modalidadAfiliacion === 'INSTITUCIONAL',
    tipoAfiliacionOficio: modalidadAfiliacion === 'OFICIO',
    tipoAfiliacionCotizante: tipoAfiliacion === 'COTIZANTE_CABEZA',
    tipoAfiliacionBeneficiario: tipoAfiliacion === 'BENEFICIARIO_ADICIONAL',
    regimenContributivo: regimen === 'CONTRIBUTIVO',
    regimenSubsidiado: regimen === 'SUBSIDIADO',
    tipoAfiliadoCotizante: tipoAfiliado === 'COTIZANTE',
    tipoAfiliadoBeneficiario: tipoAfiliado === 'BENEFICIARIO',
    tipoAfiliadoCabezaFamilia: tipoAfiliado === 'CABEZA_FAMILIA',
    tipoCotizanteDependiente: (tipoCotizante.includes('DEPENDIENTE') && !tipoCotizante.includes('INDEPENDIENTE')) || tipoCotizante === '01' || tipoCotizante === 'DEPENDIENTE' || tipoCotizante === '',
    tipoCotizanteIndependiente: tipoCotizante.includes('INDEPENDIENTE') || tipoCotizante === '03',
    tipoCotizantePensionado: tipoCotizante.includes('PENSIONADO') || tipoCotizante === '04',
    novedadModificacionDatos: subTipo === 'MODIFICACION_DATOS',
    novedadCorreccionDatos: subTipo === 'CORRECCION_DATOS',
    novedadActualizacionDoc: subTipo === 'ACTUALIZACION_DOCUMENTO',
    novedadActualizacionDatosComp: subTipo === 'ACTUALIZACION_COMPLEMENTARIOS',
    novedadTerminacionInscripcion: subTipo === 'TERMINACION_INSCRIPCION',
    novedadReinscripcion: subTipo === 'REINSCRIPCION',
    novedadInclusionBeneficiarios: subTipo === 'INCLUSION_BENEFICIARIOS',
    novedadExclusionBeneficiarios: subTipo === 'EXCLUSION_BENEFICIARIOS',
    novedadInicioRelacionLaboral: subTipo === 'INICIO_RELACION' || isTruthyValue(tramiteData.novedadInicioRelacionLaboral) || isTruthyValue(manualFields.novedadInicioRelacionLaboral),
    novedadTerminacionRelacion: subTipo === 'TERMINACION_RELACION',
    novedadInscripcionRetornoPais: subTipo === 'INSCRIPCION_RETORNO_PAIS',
    novedadVinculacionColectiva: subTipo === 'VINCULACION_COLECTIVA',
    novedadDesvinculacionColectiva: subTipo === 'DESVINCULACION_COLECTIVA',
    novedadMovilidad: subTipo === 'MOVILIDAD',
    movilidadContributivo: subTipo === 'MOVILIDAD' && movilidad === 'CONTRIBUTIVO',
    movilidadSubsidiado: subTipo === 'MOVILIDAD' && movilidad === 'SUBSIDIADO',
    novedadTraslado: subTipo === 'TRASLADO' || isTruthyValue(tramiteData.novedadTraslado) || isTruthyValue(manualFields.novedadTraslado),
    trasladoMismoRegimen: ((subTipo === 'TRASLADO' || isTruthyValue(tramiteData.novedadTraslado) || isTruthyValue(manualFields.novedadTraslado)) && (traslado === 'MISMO_REGIMEN' || !traslado)) || isTruthyValue(tramiteData.trasladoMismoRegimen) || isTruthyValue(manualFields.trasladoMismoRegimen),
    trasladoDiferenteRegimen: ((subTipo === 'TRASLADO' || isTruthyValue(tramiteData.novedadTraslado) || isTruthyValue(manualFields.novedadTraslado)) && traslado === 'DIFERENTE_REGIMEN') || isTruthyValue(tramiteData.trasladoDiferenteRegimen) || isTruthyValue(manualFields.trasladoDiferenteRegimen),
    novedadFallecimiento: subTipo === 'FALLECIMIENTO',
    novedadProteccionCesante: subTipo === 'PROTECCION_CESANTE',
    novedadPrepensionado: subTipo === 'PREPENSIONADO',
    novedadPensionado: subTipo === 'PENSIONADO',
    novedadIngresoContribucionSolidaria: subTipo === 'INGRESO_CONTRIBUCION_SOLIDARIA',
    novedadRetiroContribucionSolidaria: subTipo === 'RETIRO_CONTRIBUCION_SOLIDARIA',
  };
  return Object.prototype.hasOwnProperty.call(checks, key) ? checks[key] : undefined;
}

export function resolveCheckboxValue(
  field: PDFMappedField,
  empleado: Empleado,
  empresa: Empresa,
  manualFields: Record<string, string> = {},
  tramiteData: Record<string, string> = {},
): boolean {
  const rule = field.checkboxRule;
  if (rule) {
    if (rule.mode === 'always') return true;
    if (rule.mode === 'truthy' && (!rule.fieldKey || rule.fieldKey === field.fieldKey)) {
      const semantic = semanticCheckboxValue(field.fieldKey, empleado, tramiteData, manualFields);
      if (semantic !== undefined) return semantic;
    }
    const source = rule.source || field.dataSource;
    const key = rule.fieldKey || field.fieldKey;
    const actual = resolveDataValue(source, key, empleado, empresa, manualFields, tramiteData);
    if (rule.mode === 'manual') return isTruthyValue(manualFields[field.fieldKey] ?? field.defaultValue);
    if (rule.mode === 'truthy') return isTruthyValue(actual);
    const matches = normalizeComparable(actual) === normalizeComparable(rule.expectedValue);
    return rule.mode === 'equals' ? matches : !matches;
  }

  if (field.checkboxMatchValue) {
    const actual = resolveDataValue(field.dataSource, field.fieldKey.replace(/Check$/, ''), empleado, empresa, manualFields, tramiteData);
    return normalizeComparable(actual) === normalizeComparable(field.checkboxMatchValue);
  }

  const semantic = semanticCheckboxValue(field.fieldKey, empleado, tramiteData, manualFields);
  if (semantic !== undefined) return semantic;
  const actual = resolveDataValue(field.dataSource, field.fieldKey, empleado, empresa, manualFields, tramiteData);
  return isTruthyValue(actual || field.defaultValue);
}

function parseDateParts(value: string): { day: string; month: string; year: string } | null {
  const text = value.trim();
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return { year: match[1], month: match[2].padStart(2, '0'), day: match[3].padStart(2, '0') };
  match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return { day: match[1].padStart(2, '0'), month: match[2].padStart(2, '0'), year: match[3] };
  match = text.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (match) return { day: match[1], month: match[2], year: match[3] };
  return null;
}

export function formatDateValue(value: string, format = 'DD/MM/YYYY'): string {
  const parts = parseDateParts(value);
  if (!parts) return value;
  return format
    .replace(/YYYY/g, parts.year)
    .replace(/DD/g, parts.day)
    .replace(/MM/g, parts.month);
}

export function formatNumberValue(value: string, format: PDFMappedField['numberFormat']): string {
  if (!format) return value;
  const normalized = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
  const number = Number(normalized);
  if (!Number.isFinite(number)) return value;
  if (format === 'currency') return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(number);
  if (format === 'integer') return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(number));
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
}

export function resolveFieldValue(
  field: PDFMappedField,
  empleado: Empleado,
  empresa: Empresa,
  manualFields: Record<string, string> = {},
  tramiteData: Record<string, string> = {},
): string {
  if (field.fieldType === 'stamp') return field.stampText || field.label || 'SELLO';
  if (field.fieldType === 'checkbox') {
    return resolveCheckboxValue(field, empleado, empresa, manualFields, tramiteData)
      ? (field.checkboxCharacter || 'X')
      : '';
  }
  let value = resolveDataValue(field.dataSource, field.fieldKey, empleado, empresa, manualFields, tramiteData) || field.defaultValue || '';
  if (field.fieldType === 'date' && value) value = formatDateValue(value, field.dateFormat || 'DD/MM/YYYY');
  if (field.fieldType === 'number' && value) value = formatNumberValue(value, field.numberFormat);
  if (field.uppercase && value && !value.startsWith('data:image/')) value = normalizeComparable(value);
  return value;
}
