// ============================================================
// CATÁLOGO DE CAMPOS DISPONIBLES PARA MAPEO
// Organizado por categoría según la estructura del SGSSS
// ============================================================

import type { FieldCatalogCategory, FieldCatalogItem } from '../types/formularios';

const FAMILY_FIELD_PARTS: Array<[string, string, FieldCatalogItem['type']]> = [
  ['Apellido1', 'Primer apellido', 'text'],
  ['Apellido2', 'Segundo apellido', 'text'],
  ['Nombre1', 'Primer nombre', 'text'],
  ['Nombre2', 'Segundo nombre', 'text'],
  ['TipoDoc', 'Tipo de documento', 'text'],
  ['NumDoc', 'Número de documento', 'text'],
  ['Sexo', 'Sexo', 'text'],
  ['SexoFemenino', 'Sexo femenino', 'checkbox'],
  ['SexoMasculino', 'Sexo masculino', 'checkbox'],
  ['FechaNac', 'Fecha de nacimiento', 'date'],
  ['Parentesco', 'Parentesco', 'text'],
  ['Etnia', 'Código de etnia', 'text'],
  ['Nacionalidad', 'Nacionalidad', 'text'],
  ['PaisNacimiento', 'País de nacimiento', 'text'],
  ['DepartamentoNacimiento', 'Departamento de nacimiento', 'text'],
  ['MunicipioNacimiento', 'Municipio de nacimiento', 'text'],
  ['DiscapacidadFisica', 'Discapacidad física', 'checkbox'],
  ['DiscapacidadNeurosensorial', 'Discapacidad neurosensorial', 'checkbox'],
  ['DiscapacidadMental', 'Discapacidad mental', 'checkbox'],
  ['CondicionTemporal', 'Discapacidad temporal', 'checkbox'],
  ['CondicionPermanente', 'Discapacidad permanente', 'checkbox'],
  ['Municipio', 'Municipio / distrito de residencia', 'text'],
  ['ZonaUrbana', 'Zona urbana', 'checkbox'],
  ['ZonaRural', 'Zona rural', 'checkbox'],
  ['Departamento', 'Departamento de residencia', 'text'],
  ['Telefono', 'Teléfono fijo o celular', 'text'],
  ['ValorUpc', 'Valor UPC del afiliado adicional', 'number'],
  ['Ips', 'IPS primaria', 'text'],
  ['CodigoIps', 'Código de la IPS', 'text'],
];

function beneficiaryCatalogFields(count: number): FieldCatalogItem[] {
  return Array.from({ length: count }, (_, index) => index + 1).flatMap(number =>
    FAMILY_FIELD_PARTS.map(([suffix, label, type]) => ({
      key: `beneficiario${number}${suffix}`,
      label: `Beneficiario ${number} - ${label}`,
      source: 'familiar' as const,
      type,
      example: type === 'checkbox' ? 'X' : suffix === 'TipoDoc' ? 'TI' : suffix === 'Parentesco' ? 'HIJO/A' : '',
    }))
  );
}

/**
 * Catálogo maestro de todos los campos que se pueden vincular
 * a una posición sobre un formulario PDF. Cada campo representa
 * un dato que existe (o puede existir) en el sistema Validum.
 */
export const FIELD_CATALOG: FieldCatalogCategory[] = [
  // ──────────────────────────────────────────────────────────
  // DATOS BÁSICOS DEL COTIZANTE
  // ──────────────────────────────────────────────────────────
  {
    id: 'cotizante-basico',
    name: 'Datos Básicos del Cotizante',
    icon: 'User',
    fields: [
      { key: 'nombreCompleto', label: 'Nombres y apellidos completos', source: 'cotizante', type: 'text', example: 'SANDRA CATALINA PRADO SANTOS' },
      { key: 'primerApellido', label: 'Primer Apellido', source: 'cotizante', type: 'text', example: 'PRADO' },
      { key: 'segundoApellido', label: 'Segundo Apellido', source: 'cotizante', type: 'text', example: 'SANTOS' },
      { key: 'primerNombre', label: 'Primer Nombre', source: 'cotizante', type: 'text', example: 'SANDRA' },
      { key: 'segundoNombre', label: 'Segundo Nombre', source: 'cotizante', type: 'text', example: 'CATALINA' },
      { key: 'tipoDocumento', label: 'Tipo de Documento', source: 'cotizante', type: 'text', example: 'CC', description: 'CC, CE, TI, PA, RC, etc.' },
      { key: 'numeroDocumento', label: 'Número de Documento', source: 'cotizante', type: 'text', example: '52881469' },
      { key: 'sexo', label: 'Sexo', source: 'cotizante', type: 'text', example: 'F', description: 'F = Femenino, M = Masculino' },
      { key: 'sexoFemenino', label: 'Sexo Femenino (Check)', source: 'cotizante', type: 'checkbox', example: 'X', description: 'Marca si el sexo es Femenino' },
      { key: 'sexoMasculino', label: 'Sexo Masculino (Check)', source: 'cotizante', type: 'checkbox', example: 'X', description: 'Marca si el sexo es Masculino' },
      { key: 'fechaNacimiento', label: 'Fecha de Nacimiento', source: 'cotizante', type: 'date', example: '15/03/1985' },
      { key: 'identidadGenero', label: 'Identidad de Género', source: 'cotizante', type: 'text', example: '' },
      { key: 'identidadGeneroFemenino', label: 'Identidad de género femenina (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'identidadGeneroMasculino', label: 'Identidad de género masculina (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'identidadGeneroTrans', label: 'Identidad de género trans (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'identidadGeneroNoBinario', label: 'Identidad de género no binaria (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'identidadGeneroOtro', label: 'Otra identidad de género (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'identidadGeneroCual', label: 'Otra identidad de género - cuál', source: 'cotizante', type: 'text', example: '' },
      { key: 'estadoCivil', label: 'Estado civil', source: 'cotizante', type: 'text', example: 'SOLTERO(A)' },
      { key: 'nacionalidad', label: 'Nacionalidad', source: 'cotizante', type: 'text', example: 'COLOMBIANA', description: 'Nacionalidad declarada por la persona' },
      { key: 'paisNacimiento', label: 'País de Nacimiento', source: 'cotizante', type: 'text', example: 'COLOMBIA' },
      { key: 'departamentoNacimiento', label: 'Departamento de Nacimiento', source: 'cotizante', type: 'text', example: 'CUNDINAMARCA' },
      { key: 'ciudadNacimiento', label: 'Ciudad de Nacimiento', source: 'cotizante', type: 'text', example: 'BOGOTÁ' },
      { key: 'paisExpedicion', label: 'País de Expedición', source: 'cotizante', type: 'text', example: 'COLOMBIA' },
      { key: 'departamentoExpedicion', label: 'Departamento de Expedición', source: 'cotizante', type: 'text', example: 'CUNDINAMARCA' },
      { key: 'ciudadExpedicion', label: 'Ciudad de Expedición', source: 'cotizante', type: 'text', example: 'BOGOTÁ' },
      { key: 'fechaExpedicion', label: 'Fecha de Expedición', source: 'cotizante', type: 'date', example: '20/03/2003' },
      { key: 'email', label: 'Correo Electrónico', source: 'cotizante', type: 'text', example: 'sandra.prado@email.com' },
      { key: 'telefono', label: 'Teléfono / Celular', source: 'cotizante', type: 'text', example: '3005047926' },
      { key: 'telefonoFijo', label: 'Teléfono Fijo', source: 'cotizante', type: 'text', example: '6015550101' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // DATOS COMPLEMENTARIOS DEL COTIZANTE
  // ──────────────────────────────────────────────────────────
  {
    id: 'cotizante-complementario',
    name: 'Datos Complementarios',
    icon: 'ClipboardList',
    fields: [
      { key: 'etnia', label: 'Etnia', source: 'cotizante', type: 'text', example: 'NINGUNO' },
      { key: 'discapacidad', label: 'Discapacidad', source: 'cotizante', type: 'text', example: 'NINGUNA' },
      { key: 'discapacidadSi', label: 'Discapacidad: Sí (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'discapacidadNo', label: 'Discapacidad: No (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'discapacidadFisica', label: 'Discapacidad Física (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'discapacidadNeurosensorial', label: 'Discapacidad Neurosensorial (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'discapacidadMental', label: 'Discapacidad Mental (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'condicionTemporal', label: 'Condición Temporal (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'condicionPermanente', label: 'Condición Permanente (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'puntajeSisben', label: 'Puntaje SISBÉN', source: 'cotizante', type: 'number', example: '0' },
      { key: 'encuestaSisbenSi', label: 'Encuesta SISBÉN: Sí (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'encuestaSisbenNo', label: 'Encuesta SISBÉN: No (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'grupoEspecial', label: 'Grupo de Población Especial', source: 'cotizante', type: 'text', example: 'N/A' },
      { key: 'condicion', label: 'Condición', source: 'cotizante', type: 'text', example: 'N/A' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // DATOS DE UBICACIÓN DEL COTIZANTE
  // ──────────────────────────────────────────────────────────
  {
    id: 'cotizante-ubicacion',
    name: 'Ubicación y Residencia',
    icon: 'MapPin',
    fields: [
      { key: 'direccion', label: 'Dirección de Residencia', source: 'cotizante', type: 'text', example: 'CL 100 10 02' },
      { key: 'barrio', label: 'Barrio', source: 'cotizante', type: 'text', example: 'BARRIO HOGARES' },
      { key: 'ciudad', label: 'Ciudad / Municipio', source: 'cotizante', type: 'text', example: 'BOGOTA' },
      { key: 'departamentoResidencia', label: 'Departamento', source: 'cotizante', type: 'text', example: 'BOGOTA' },
      { key: 'localidadComuna', label: 'Localidad / Comuna', source: 'cotizante', type: 'text', example: 'CENTRO' },
      { key: 'zonaUrbana', label: 'Zona Urbana (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'zonaRural', label: 'Zona Rural (Check)', source: 'cotizante', type: 'checkbox', example: 'X' },
      { key: 'codigoMunicipio', label: 'Código del Municipio', source: 'cotizante', type: 'text', example: '11001' },
      { key: 'codigoDepartamento', label: 'Código del Departamento', source: 'cotizante', type: 'text', example: '11' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // DATOS LABORALES Y DE SEGURIDAD SOCIAL
  // ──────────────────────────────────────────────────────────
  {
    id: 'seguridad-social',
    name: 'Seguridad Social y Laboral',
    icon: 'ShieldCheck',
    fields: [
      { key: 'eps', label: 'EPS', source: 'cotizante', type: 'text', example: 'FAMISANAR' },
      { key: 'codigoEps', label: 'Código de la EPS', source: 'cotizante', type: 'text', example: 'EPS023' },
      { key: 'arl', label: 'ARL', source: 'cotizante', type: 'text', example: 'ARL SURA' },
      { key: 'afp', label: 'Fondo de Pensiones (AFP)', source: 'cotizante', type: 'text', example: 'PORVENIR' },
      { key: 'ccf', label: 'Caja de Compensación (CCF)', source: 'cotizante', type: 'text', example: 'COMPENSAR' },
      { key: 'tipoCotizante', label: 'Tipo de Cotizante', source: 'cotizante', type: 'text', example: 'DEPENDIENTE', description: 'Dependiente, Independiente, etc.' },
      { key: 'tipoCotizanteCodigo', label: 'Código Tipo Cotizante', source: 'cotizante', type: 'text', example: '01' },
      { key: 'subtipoCotizante', label: 'Subtipo de Cotizante', source: 'cotizante', type: 'text', example: '00' },
      { key: 'tipoAfiliacion', label: 'Tipo de Trámite Registrado', source: 'cotizante', type: 'text', example: 'AFILIACION' },
      { key: 'solicitudSat', label: 'Solicitud SAT', source: 'cotizante', type: 'text', example: 'NO' },
      { key: 'ibc', label: 'IBC (Ingreso Base de Cotización)', source: 'cotizante', type: 'number', example: '1750000' },
      { key: 'ibcFormateado', label: 'IBC Formateado', source: 'cotizante', type: 'text', example: '$1.750.000', description: 'Con formato de moneda colombiana' },
      { key: 'riesgoArl', label: 'Nivel de Riesgo ARL', source: 'cotizante', type: 'text', example: 'I', description: 'I, II, III, IV o V' },
      { key: 'riesgoArlNumero', label: 'Nivel Riesgo ARL (Número)', source: 'cotizante', type: 'number', example: '1' },
      { key: 'cargo', label: 'Cargo', source: 'cotizante', type: 'text', example: 'ANALISTA DE NÓMINA' },
      { key: 'departamentoLaboral', label: 'Departamento Laboral', source: 'cotizante', type: 'text', example: 'RECURSOS HUMANOS' },
      { key: 'fechaIngreso', label: 'Fecha de Ingreso', source: 'cotizante', type: 'date', example: '01/06/2024' },
      { key: 'salarioBase', label: 'Salario Base', source: 'cotizante', type: 'number', example: '1750000' },
      { key: 'salarioBaseFormateado', label: 'Salario Base Formateado', source: 'cotizante', type: 'text', example: '$1.750.000' },
      { key: 'administradoraPensiones', label: 'Administradora de Pensiones', source: 'cotizante', type: 'text', example: 'NINGUNO' },
      { key: 'ipsSeleccionada', label: 'IPS Primaria Seleccionada', source: 'cotizante', type: 'text', example: 'IPS PRIMARIA BOGOTÁ' },
      { key: 'codigoIps', label: 'Código de la IPS', source: 'cotizante', type: 'text', example: '' },
      { key: 'codigoRegistroEps', label: 'Código asignado por la EPS', source: 'cotizante', type: 'text', example: '', description: 'Casillas reservadas para registro de la EPS' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // DATOS DEL EMPLEADOR / EMPRESA
  // ──────────────────────────────────────────────────────────
  {
    id: 'empresa',
    name: 'Datos del Empleador / Aportante',
    icon: 'Building2',
    fields: [
      { key: 'razonSocial', label: 'Razón Social', source: 'empresa', type: 'text', example: 'VALIDUM GRUPO EMPRESARIAL S.A.S.' },
      { key: 'nit', label: 'NIT (sin DV)', source: 'empresa', type: 'text', example: '900543890' },
      { key: 'dv', label: 'Dígito de Verificación (DV)', source: 'empresa', type: 'text', example: '3' },
      { key: 'nitCompleto', label: 'NIT Completo (con DV)', source: 'empresa', type: 'text', example: '900543890-3' },
      { key: 'tipoDocumentoEmpresa', label: 'Tipo Documento Empresa', source: 'empresa', type: 'text', example: 'NIT', description: 'NIT, CC del representante, etc.' },
      { key: 'direccionEmpresa', label: 'Dirección Empresa', source: 'empresa', type: 'text', example: 'CRA 15 # 93-47 OF. 301' },
      { key: 'ciudadEmpresa', label: 'Ciudad Empresa', source: 'empresa', type: 'text', example: 'BOGOTÁ' },
      { key: 'departamentoEmpresa', label: 'Departamento Empresa', source: 'empresa', type: 'text', example: 'CUNDINAMARCA' },
      { key: 'telefonoEmpresa', label: 'Teléfono Empresa', source: 'empresa', type: 'text', example: '6011234567' },
      { key: 'emailEmpresa', label: 'Email Empresa', source: 'empresa', type: 'text', example: 'rrhh@validum.com.co' },
      { key: 'representanteLegal', label: 'Representante Legal', source: 'empresa', type: 'text', example: 'JOHAN MANUEL RODRÍGUEZ' },
      { key: 'cedulaRepresentante', label: 'Cédula Representante', source: 'empresa', type: 'text', example: '79543210' },
      { key: 'operadorPila', label: 'Operador PILA', source: 'empresa', type: 'text', example: 'APORTES EN LÍNEA' },
      { key: 'actividadEconomica', label: 'Actividad Económica', source: 'empresa', type: 'text', example: '7020' },
      { key: 'nombreComercial', label: 'Nombre o Razón Social (corto)', source: 'empresa', type: 'text', example: 'VALIDUM' },
      { key: 'contactoRecursosHumanos', label: 'Contacto de Recursos Humanos', source: 'empresa', type: 'text', example: 'NÓMINA Y CONTRATACIÓN' },
      { key: 'tipoAportantePagador', label: 'Tipo de Aportante o Pagador', source: 'empresa', type: 'text', example: 'EMPLEADOR' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // DATOS DEL TRÁMITE / FORMULARIO
  // ──────────────────────────────────────────────────────────
  {
    id: 'tramite',
    name: 'Datos del Trámite',
    icon: 'FileText',
    fields: [
      { key: 'fechaRadicacion', label: 'Fecha de Radicación', source: 'tramite', type: 'date', example: '24/08/2026' },
      { key: 'fechaRadicacionDia', label: 'Día de Radicación', source: 'tramite', type: 'text', example: '24' },
      { key: 'fechaRadicacionMes', label: 'Mes de Radicación', source: 'tramite', type: 'text', example: '08' },
      { key: 'fechaRadicacionAnio', label: 'Año de Radicación', source: 'tramite', type: 'text', example: '2026' },
      { key: 'contribucionSolidariaSi', label: 'Contribución solidaria: Sí (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'contribucionSolidariaNo', label: 'Contribución solidaria: No (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'tarifaContribucionSolidaria', label: 'Tarifa de contribución solidaria', source: 'manual', type: 'number', example: '0' },
      { key: 'tipoTramiteAfiliacion', label: 'Tipo Trámite: Afiliación (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoTramiteNovedad', label: 'Tipo Trámite: Novedad (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoAfiliacionIndividual', label: 'Afiliación Individual (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoAfiliacionColectiva', label: 'Afiliación Colectiva (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoAfiliacionInstitucional', label: 'Afiliación Institucional (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoAfiliacionOficio', label: 'Afiliación de Oficio (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoAfiliacionCotizante', label: 'Cotizante o Cabeza Familia (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoAfiliacionBeneficiario', label: 'Beneficiario o Adicional (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'regimenContributivo', label: 'Régimen Contributivo (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'regimenSubsidiado', label: 'Régimen Subsidiado (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoAfiliadoCotizante', label: 'Afiliado Cotizante (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoAfiliadoBeneficiario', label: 'Afiliado Beneficiario (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoAfiliadoCabezaFamilia', label: 'Afiliado Cabeza de Familia (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoCotizanteDependiente', label: 'Cotizante Dependiente (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoCotizanteIndependiente', label: 'Cotizante Independiente (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'tipoCotizantePensionado', label: 'Cotizante Pensionado (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'codigoRegistroEpsTramite', label: 'Código registrado por la EPS', source: 'tramite', type: 'text', example: '' },
      { key: 'numeroRadicado', label: 'Número de Radicado', source: 'tramite', type: 'text', example: 'RAD-2026-001234' },
      { key: 'observaciones', label: 'Observaciones', source: 'tramite', type: 'text', example: '' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // DATOS DEL NÚCLEO FAMILIAR
  // ──────────────────────────────────────────────────────────
  {
    id: 'familiar',
    name: 'Datos del Núcleo Familiar',
    icon: 'Users',
    fields: [
      { key: 'conyugeApellido1', label: 'Cónyuge - Primer Apellido', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeApellido2', label: 'Cónyuge - Segundo Apellido', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeNombre1', label: 'Cónyuge - Primer Nombre', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeNombre2', label: 'Cónyuge - Segundo Nombre', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeTipoDoc', label: 'Cónyuge - Tipo Documento', source: 'familiar', type: 'text', example: 'CC' },
      { key: 'conyugeNumDoc', label: 'Cónyuge - Número Documento', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeSexo', label: 'Cónyuge - Sexo', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeSexoFemenino', label: 'Cónyuge - Sexo femenino (Check)', source: 'familiar', type: 'checkbox', example: 'X' },
      { key: 'conyugeSexoMasculino', label: 'Cónyuge - Sexo masculino (Check)', source: 'familiar', type: 'checkbox', example: 'X' },
      { key: 'conyugeFechaNac', label: 'Cónyuge - Fecha Nacimiento', source: 'familiar', type: 'date', example: '' },
      { key: 'conyugeParentesco', label: 'Cónyuge - Parentesco', source: 'familiar', type: 'text', example: 'CP' },
      { key: 'conyugeEtnia', label: 'Cónyuge - Código de etnia', source: 'familiar', type: 'text', example: '01' },
      { key: 'conyugeDiscapacidadFisica', label: 'Cónyuge - Discapacidad física (Check)', source: 'familiar', type: 'checkbox', example: 'X' },
      { key: 'conyugeDiscapacidadNeurosensorial', label: 'Cónyuge - Discapacidad neurosensorial (Check)', source: 'familiar', type: 'checkbox', example: 'X' },
      { key: 'conyugeDiscapacidadMental', label: 'Cónyuge - Discapacidad mental (Check)', source: 'familiar', type: 'checkbox', example: 'X' },
      { key: 'conyugeCondicionTemporal', label: 'Cónyuge - Condición temporal (Check)', source: 'familiar', type: 'checkbox', example: 'X' },
      { key: 'conyugeCondicionPermanente', label: 'Cónyuge - Condición permanente (Check)', source: 'familiar', type: 'checkbox', example: 'X' },
      { key: 'conyugeMunicipio', label: 'Cónyuge - Municipio / distrito', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeZonaUrbana', label: 'Cónyuge - Zona urbana (Check)', source: 'familiar', type: 'checkbox', example: 'X' },
      { key: 'conyugeZonaRural', label: 'Cónyuge - Zona rural (Check)', source: 'familiar', type: 'checkbox', example: 'X' },
      { key: 'conyugeDepartamento', label: 'Cónyuge - Departamento', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeTelefono', label: 'Cónyuge - Teléfono', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeValorUpc', label: 'Cónyuge - Valor UPC adicional', source: 'familiar', type: 'number', example: '' },
      { key: 'conyugeIps', label: 'Cónyuge - IPS primaria', source: 'familiar', type: 'text', example: '' },
      { key: 'conyugeCodigoIps', label: 'Cónyuge - Código IPS', source: 'familiar', type: 'text', example: '' },
      ...beneficiaryCatalogFields(10),
    ],
  },

  // ──────────────────────────────────────────────────────────
  // NOVEDADES (Sección VI del formulario SGSSS)
  // ──────────────────────────────────────────────────────────
  {
    id: 'novedades',
    name: 'Reporte de Novedades',
    icon: 'AlertCircle',
    fields: [
      { key: 'tipoNovedad', label: '40. Tipo de novedad (valor)', source: 'tramite', type: 'text', example: 'INICIO_RELACION' },
      { key: 'tipoNovedadCodigo', label: '40. Código del tipo de novedad', source: 'tramite', type: 'number', example: '9' },
      { key: 'novedadModificacionDatos', label: 'Nov. 1: Modificación datos básicos (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadCorreccionDatos', label: 'Nov. 2: Corrección datos (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadActualizacionDoc', label: 'Nov. 3: Actualización documento (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadActualizacionDatosComp', label: 'Nov. 4: Actualización datos complementarios (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadTerminacionInscripcion', label: 'Nov. 5: Terminación inscripción EPS (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadReinscripcion', label: 'Nov. 6: Reinscripción EPS (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadInclusionBeneficiarios', label: 'Nov. 7: Inclusión beneficiarios (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadExclusionBeneficiarios', label: 'Nov. 8: Exclusión beneficiarios (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadInicioRelacionLaboral', label: 'Nov. 9: Inicio relación laboral (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadTerminacionRelacion', label: 'Nov. 10: Terminación relación (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadInscripcionRetornoPais', label: 'Nov. 11: Inscripción EPS por retorno al país (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadVinculacionColectiva', label: 'Nov. 12: Vinculación colectiva (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadDesvinculacionColectiva', label: 'Nov. 13: Desvinculación colectiva (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadMovilidad', label: 'Nov. 14: Movilidad (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'movilidadContributivo', label: 'Nov. 14A: Movilidad a régimen contributivo (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'movilidadSubsidiado', label: 'Nov. 14B: Movilidad a régimen subsidiado (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadTraslado', label: 'Nov. 15: Traslado (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'trasladoMismoRegimen', label: 'Nov. 15A: Traslado en el mismo régimen (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'trasladoDiferenteRegimen', label: 'Nov. 15B: Traslado a diferente régimen (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadFallecimiento', label: 'Nov. 16: Reporte de fallecimiento (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadProteccionCesante', label: 'Nov. 17: Protección al cesante (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadPrepensionado', label: 'Nov. 18: Calidad de pre-pensionado (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadPensionado', label: 'Nov. 19: Calidad de pensionado (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadIngresoContribucionSolidaria', label: 'Nov. 20: Ingreso a contribución solidaria (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'novedadRetiroContribucionSolidaria', label: 'Nov. 21: Retiro de contribución solidaria (Check)', source: 'tramite', type: 'checkbox', example: 'X' },
      { key: 'fechaNovedad', label: 'Fecha de Novedad', source: 'tramite', type: 'date', example: '24/08/2026' },
      { key: 'fechaNovedadDia', label: 'Día de la Novedad', source: 'tramite', type: 'text', example: '24' },
      { key: 'fechaNovedadMes', label: 'Mes de la Novedad', source: 'tramite', type: 'text', example: '08' },
      { key: 'fechaNovedadAnio', label: 'Año de la Novedad', source: 'tramite', type: 'text', example: '2026' },
      { key: 'motivoTraslado', label: 'Motivo de Traslado', source: 'tramite', type: 'text', example: '' },
      { key: 'epsAnterior', label: 'EPS Anterior', source: 'tramite', type: 'text', example: '' },
      { key: 'cajaCompensacionAnterior', label: 'Caja de Compensación Anterior', source: 'tramite', type: 'text', example: '' },
      { key: 'pagadorPensionesAnterior', label: 'Pagador de Pensiones', source: 'tramite', type: 'text', example: '' },
    ],
  },

  {
    id: 'declaraciones-autorizaciones',
    name: 'Declaraciones, Autorizaciones y Firmas',
    icon: 'FileCheck',
    fields: [
      { key: 'declaracionDependenciaEconomica', label: '46. Dependencia económica de beneficiarios (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'declaracionNoObligacionContributivo', label: '47. No obligación de régimen contributivo/especial (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'declaracionFuerzaMayorDocumentos', label: '48. Fuerza mayor para entregar documentos (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'declaracionNoInternacion', label: '49. No internación en IPS (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'autorizacionHistoriaClinica', label: '50. Autorización de historia clínica (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'autorizacionReporteInformacion', label: '51. Autorización de reporte de información (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'autorizacionDatosPersonales', label: '52. Autorización de datos personales (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'autorizacionNotificaciones', label: '53. Autorización de correo/SMS (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'firmaAfiliado', label: '54. Firma del afiliado / cotizante', source: 'manual', type: 'text', example: '' },
      { key: 'firmaEmpleador', label: '55. Firma del empleador / aportante', source: 'manual', type: 'text', example: '' },
    ],
  },

  {
    id: 'anexos-sgsss',
    name: 'Anexos del Formulario SGSSS',
    icon: 'Paperclip',
    fields: [
      { key: 'anexoDocumentoIdentidad', label: '56. Copia de documento de identidad (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'cantidadAnexoCN', label: '56. Cantidad CN', source: 'manual', type: 'number', example: '0' },
      { key: 'cantidadAnexoRC', label: '56. Cantidad RC', source: 'manual', type: 'number', example: '0' },
      { key: 'cantidadAnexoTI', label: '56. Cantidad TI', source: 'manual', type: 'number', example: '0' },
      { key: 'cantidadAnexoCC', label: '56. Cantidad CC', source: 'manual', type: 'number', example: '1' },
      { key: 'cantidadAnexoCE', label: '56. Cantidad CE', source: 'manual', type: 'number', example: '0' },
      { key: 'cantidadAnexoPA', label: '56. Cantidad PA', source: 'manual', type: 'number', example: '0' },
      { key: 'cantidadAnexoCD', label: '56. Cantidad CD', source: 'manual', type: 'number', example: '0' },
      { key: 'cantidadAnexoSC', label: '56. Cantidad SC', source: 'manual', type: 'number', example: '0' },
      { key: 'cantidadAnexosTotal', label: '56. Cantidad total de anexos', source: 'manual', type: 'number', example: '1' },
      { key: 'anexoDictamenIncapacidad', label: '57. Dictamen de incapacidad permanente (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'anexoUnionMarital', label: '58. Registro civil de matrimonio/unión marital (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'anexoTerminacionUnion', label: '59. Terminación de matrimonio/unión marital (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'anexoAdopcion', label: '60. Certificado de adopción (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'anexoCustodia', label: '61. Orden de custodia (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'anexoPatriaPotestad', label: '62. Patria potestad/defunción/ausencia (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'anexoAutorizacionTraslado', label: '63. Autorización de traslado Supersalud (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'anexoAfiliacionColectiva', label: '64. Certificación de afiliación colectiva (Check)', source: 'manual', type: 'checkbox', example: 'X' },
      { key: 'anexoAfiliacionOficio', label: '65. Acto de afiliación de oficio (Check)', source: 'manual', type: 'checkbox', example: 'X' },
    ],
  },

  {
    id: 'entidad-territorial',
    name: 'Entidad Territorial y Radicación',
    icon: 'Landmark',
    fields: [
      { key: 'territorialCodigoMunicipio', label: '66. Código de municipio de entidad territorial', source: 'manual', type: 'text', example: '' },
      { key: 'territorialCodigoDepartamento', label: '66. Código de departamento de entidad territorial', source: 'manual', type: 'text', example: '' },
      { key: 'territorialFichaSisben', label: '67. Número de ficha SISBÉN', source: 'manual', type: 'text', example: '' },
      { key: 'territorialPuntajeSisben', label: '67. Puntaje SISBÉN territorial', source: 'manual', type: 'number', example: '' },
      { key: 'territorialNivelSisben', label: '67. Nivel SISBÉN', source: 'manual', type: 'text', example: '' },
      { key: 'territorialFechaRadicacion', label: '68. Fecha de radicación territorial', source: 'manual', type: 'date', example: '' },
      { key: 'territorialFechaValidacion', label: '69. Fecha de validación', source: 'manual', type: 'date', example: '' },
      { key: 'funcionarioPrimerApellido', label: '70. Funcionario - Primer apellido', source: 'manual', type: 'text', example: '' },
      { key: 'funcionarioSegundoApellido', label: '70. Funcionario - Segundo apellido', source: 'manual', type: 'text', example: '' },
      { key: 'funcionarioPrimerNombre', label: '70. Funcionario - Primer nombre', source: 'manual', type: 'text', example: '' },
      { key: 'funcionarioSegundoNombre', label: '70. Funcionario - Segundo nombre', source: 'manual', type: 'text', example: '' },
      { key: 'funcionarioTipoDocumento', label: '70. Funcionario - Tipo de documento', source: 'manual', type: 'text', example: '' },
      { key: 'funcionarioNumeroDocumento', label: '70. Funcionario - Número de documento', source: 'manual', type: 'text', example: '' },
      { key: 'firmaFuncionario', label: '71. Firma del funcionario', source: 'manual', type: 'text', example: '' },
      { key: 'observacionesTerritoriales', label: 'Observaciones del formulario', source: 'manual', type: 'text', example: '' },
      { key: 'ejecutivoComercialNombre', label: 'Nombre del ejecutivo comercial', source: 'manual', type: 'text', example: '' },
      { key: 'ejecutivoComercialDocumento', label: 'Documento del ejecutivo comercial', source: 'manual', type: 'text', example: '' },
      { key: 'selloRadicacion', label: 'Sello de radicación', source: 'manual', type: 'stamp', example: 'RADICADO' },
      { key: 'stickerProcesamiento', label: 'Sticker de procesamiento', source: 'manual', type: 'text', example: '' },
    ],
  },

  {
    id: 'consentimientos-eps',
    name: 'Cartas, Autorizaciones y Anexos de EPS',
    icon: 'ShieldCheck',
    fields: [
      { key: 'firmaAfiliadoCartaDerechos', label: 'Firma de carta de derechos y deberes', source: 'manual', type: 'text' },
      { key: 'compensarCartaDerechosSi', label: 'Compensar - carta de derechos: Sí', source: 'manual', type: 'checkbox' },
      { key: 'compensarCartaDerechosNo', label: 'Compensar - carta de derechos: No', source: 'manual', type: 'checkbox' },
      { key: 'compensarCartaDesempenoSi', label: 'Compensar - carta de desempeño: Sí', source: 'manual', type: 'checkbox' },
      { key: 'compensarCartaDesempenoNo', label: 'Compensar - carta de desempeño: No', source: 'manual', type: 'checkbox' },
      { key: 'famisanarCartaDerechosSi', label: 'Famisanar - carta de derechos: Sí', source: 'manual', type: 'checkbox' },
      { key: 'famisanarCartaDerechosNo', label: 'Famisanar - carta de derechos: No', source: 'manual', type: 'checkbox' },
      { key: 'famisanarDonacionSi', label: 'Famisanar - donación de órganos: Sí', source: 'manual', type: 'checkbox' },
      { key: 'famisanarDonacionNo', label: 'Famisanar - donación de órganos: No', source: 'manual', type: 'checkbox' },
      { key: 'sanitasCartaDerechosSi', label: 'Sanitas - carta de derechos: Sí', source: 'manual', type: 'checkbox' },
      { key: 'sanitasCartaDerechosNo', label: 'Sanitas - carta de derechos: No', source: 'manual', type: 'checkbox' },
      { key: 'firmaAutorizacionDatosSanitas', label: 'Sanitas - firma autorización de datos', source: 'manual', type: 'text' },
      { key: 'nombreAutorizacionDatosSanitas', label: 'Sanitas - nombre autorización de datos', source: 'manual', type: 'text' },
      { key: 'documentoAutorizacionDatosSanitas', label: 'Sanitas - documento autorización de datos', source: 'manual', type: 'text' },
      { key: 'sosCartaElectronicaSi', label: 'SOS - carta electrónica: Sí', source: 'manual', type: 'checkbox' },
      { key: 'sosCartaElectronicaNo', label: 'SOS - carta electrónica: No', source: 'manual', type: 'checkbox' },
      { key: 'firmaCotizanteConvivencia', label: 'SOS - firma del cotizante en convivencia', source: 'manual', type: 'text' },
      { key: 'firmaCompaneroConvivencia', label: 'SOS - firma del compañero en convivencia', source: 'manual', type: 'text' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // CAMPOS MANUALES (texto libre al momento de rellenar)
  // ──────────────────────────────────────────────────────────
  {
    id: 'manual',
    name: 'Campos Manuales (Texto Libre)',
    icon: 'PenTool',
    fields: [
      { key: 'manual_1', label: 'Campo Manual 1', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
      { key: 'manual_2', label: 'Campo Manual 2', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
      { key: 'manual_3', label: 'Campo Manual 3', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
      { key: 'manual_4', label: 'Campo Manual 4', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
      { key: 'manual_5', label: 'Campo Manual 5', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
      { key: 'manual_6', label: 'Campo Manual 6', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
      { key: 'manual_7', label: 'Campo Manual 7', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
      { key: 'manual_8', label: 'Campo Manual 8', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
      { key: 'manual_9', label: 'Campo Manual 9', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
      { key: 'manual_10', label: 'Campo Manual 10', source: 'manual', type: 'text', description: 'Se solicita al usuario al momento de generar' },
    ],
  },
];

/**
 * Obtiene todos los campos planos del catálogo (sin categorías)
 */
export function getAllCatalogFields() {
  return FIELD_CATALOG.flatMap(cat => cat.fields);
}

/**
 * Busca un campo en el catálogo por su clave
 */
export function findCatalogField(key: string) {
  return getAllCatalogFields().find(f => f.key === key);
}

/**
 * Busca campos en el catálogo por término de búsqueda
 */
export function searchCatalogFields(term: string) {
  const lower = term.toLowerCase();
  return getAllCatalogFields().filter(
    f => f.label.toLowerCase().includes(lower)
      || f.key.toLowerCase().includes(lower)
      || f.description?.toLowerCase().includes(lower)
  );
}
