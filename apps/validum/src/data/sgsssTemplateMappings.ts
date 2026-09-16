import type {
  FieldDataSource,
  FormTemplate,
  PDFFieldType,
  PDFMappedField,
} from '../types/formularios';

type Box = { x: number; top: number; width: number; height: number };
type PageSize = { width: number; height: number };

interface PageOneLayout {
  page: number;
  content: { x: number; width: number };
  radication?: Box;
  process: Box;
  basic: Box;
  complement: Box;
  spouse: Box;
  beneficiaryNames: Box;
  beneficiaryIdentity: Box;
  beneficiaryComplement: Box;
  beneficiaryResidence: Box;
  beneficiaryIps?: Box;
  employer?: Box;
}

interface PageTwoLayout {
  page: number;
  content: { x: number; width: number };
  employer?: Box;
  beneficiaryIps?: Box;
  novelties: Box;
  updated: Box;
  declarations: Box;
  solidarity?: Box;
  signatures: Box;
  annexes: Box;
  territorial?: Box;
  official?: Box;
  observations?: Box;
}

interface ExtraField {
  page: number;
  box: Box;
  key: string;
  label: string;
  type?: PDFFieldType;
  source?: FieldDataSource;
  groupId?: string;
}

interface TemplateProfile {
  id: string;
  name: string;
  entity: string;
  description: string;
  assetPath: string;
  fileName: string;
  pageSizes: PageSize[];
  pageOne: PageOneLayout;
  pageTwo: PageTwoLayout;
  extraFields?: ExtraField[];
}

const CURRENT_VERSION = 14;

function inside(region: Box, x: number, top: number, width: number, height: number): Box {
  return {
    x: region.x + region.width * x,
    top: region.top + region.height * top,
    width: region.width * width,
    height: region.height * height,
  };
}

function buildTemplate(profile: TemplateProfile): FormTemplate {
  let sequence = 0;
  const fields: PDFMappedField[] = [];

  const add = (
    page: number,
    box: Box,
    key: string,
    label: string,
    source: FieldDataSource,
    fieldType: PDFFieldType = 'text',
    options: Partial<PDFMappedField> = {},
  ) => {
    const pageSize = profile.pageSizes[page];
    if (!pageSize) throw new Error(`Página ${page + 1} no existe en ${profile.name}`);
    const height = Math.max(2, box.height);
    fields.push({
      id: `${profile.id}-${String(++sequence).padStart(3, '0')}-${key}`,
      x: Number(box.x.toFixed(2)),
      y: Number((pageSize.height - box.top - height).toFixed(2)),
      width: Number(Math.max(2, box.width).toFixed(2)),
      height: Number(height.toFixed(2)),
      page,
      dataSource: source,
      fieldKey: key,
      label,
      fontSize: fieldType === 'checkbox' ? 9 : pageSize.height > 1050 ? 7.5 : 8,
      fontFamily: 'helvetica',
      alignment: fieldType === 'checkbox' ? 'center' : 'left',
      verticalAlignment: 'middle',
      bold: false,
      uppercase: fieldType !== 'stamp',
      color: '#111111',
      fieldType,
      checkboxCharacter: fieldType === 'checkbox' ? 'X' : undefined,
      checkboxRule: fieldType === 'checkbox'
        ? { mode: source === 'manual' ? 'manual' : 'truthy', source, fieldKey: key }
        : undefined,
      isCharacterByCharacter: false,
      padding: fieldType === 'checkbox' ? 0 : 0.8,
      overflowPolicy: 'shrink',
      minFontSize: 5,
      ...options,
    });
  };

  const addCheck = (
    page: number,
    region: Box,
    x: number,
    top: number,
    key: string,
    label: string,
    source: FieldDataSource = 'tramite',
    groupId?: string,
  ) => add(page, inside(region, x, top, 0.018, 0.12), key, label, source, 'checkbox', {
    checkboxRule: { mode: source === 'manual' ? 'manual' : 'truthy', source, fieldKey: key, groupId },
  });

  const addDate = (
    page: number,
    box: Box,
    key: string,
    label: string,
    source: FieldDataSource,
  ) => add(page, box, key, label, source, 'date', {
    dateFormat: 'DDMMYYYY',
    isCharacterByCharacter: true,
    characterCount: 8,
    maxLength: 8,
    stripCharacterSeparators: true,
    alignment: 'center',
    padding: 0,
  });

  const p1 = profile.pageOne;
  const p2 = profile.pageTwo;

  if (p1.radication) addDate(p1.page, p1.radication, 'fechaRadicacion', 'Fecha de radicación', 'tramite');

  // I. Datos del trámite. Las posiciones son relativas a la caja propia de cada EPS.
  addCheck(p1.page, p1.process, 0.035, 0.28, 'tipoTramiteAfiliacion', '1A. Trámite de afiliación');
  addCheck(p1.page, p1.process, 0.035, 0.67, 'tipoTramiteNovedad', '1B. Reporte de novedades');
  addCheck(p1.page, p1.process, 0.31, 0.25, 'tipoAfiliacionIndividual', '2A. Afiliación individual');
  addCheck(p1.page, p1.process, 0.31, 0.67, 'tipoAfiliacionColectiva', '2B. Afiliación colectiva');
  addCheck(p1.page, p1.process, 0.43, 0.67, 'tipoAfiliacionInstitucional', '2C. Afiliación institucional');
  addCheck(p1.page, p1.process, 0.55, 0.67, 'tipoAfiliacionOficio', '2D. Afiliación de oficio');
  addCheck(p1.page, p1.process, 0.43, 0.25, 'tipoAfiliacionCotizante', '2A. Cotizante o cabeza de familia');
  addCheck(p1.page, p1.process, 0.55, 0.25, 'tipoAfiliacionBeneficiario', '2A. Beneficiario o afiliado adicional');
  addCheck(p1.page, p1.process, 0.69, 0.28, 'regimenContributivo', '3A. Régimen contributivo');
  addCheck(p1.page, p1.process, 0.69, 0.67, 'regimenSubsidiado', '3B. Régimen subsidiado');
  addCheck(p1.page, p1.process, 0.82, 0.28, 'contribucionSolidariaSi', '4. Contribución solidaria - Sí', 'manual', 'contribucion-solidaria');
  addCheck(p1.page, p1.process, 0.90, 0.28, 'contribucionSolidariaNo', '4. Contribución solidaria - No', 'manual', 'contribucion-solidaria');
  addCheck(p1.page, p1.process, 0.06, 0.88, 'tipoAfiliadoCotizante', '5A. Afiliado cotizante');
  addCheck(p1.page, p1.process, 0.18, 0.88, 'tipoAfiliadoCabezaFamilia', '5B. Cabeza de familia');
  addCheck(p1.page, p1.process, 0.30, 0.88, 'tipoAfiliadoBeneficiario', '5C. Beneficiario');
  addCheck(p1.page, p1.process, 0.43, 0.88, 'tipoCotizanteDependiente', '6A. Cotizante dependiente');
  addCheck(p1.page, p1.process, 0.56, 0.88, 'tipoCotizanteIndependiente', '6B. Cotizante independiente');
  addCheck(p1.page, p1.process, 0.69, 0.88, 'tipoCotizantePensionado', '6C. Cotizante pensionado');
  add(p1.page, inside(p1.process, 0.83, 0.70, 0.15, 0.24), 'codigoRegistroEps', '7. Código de registro EPS', 'cotizante');

  // II. Datos básicos del cotizante.
  const basic = p1.basic;
  const nameKeys: Array<[string, string]> = [
    ['primerApellido', 'Primer apellido'],
    ['segundoApellido', 'Segundo apellido'],
    ['primerNombre', 'Primer nombre'],
    ['segundoNombre', 'Segundo nombre'],
  ];
  nameKeys.forEach(([key, label], index) => add(p1.page, inside(basic, index * 0.25 + 0.005, 0.15, 0.24, 0.24), key, label, 'cotizante', 'text', { required: key !== 'segundoNombre' && key !== 'segundoApellido' }));
  add(p1.page, inside(basic, 0.005, 0.51, 0.17, 0.20), 'tipoDocumento', 'Tipo de documento', 'cotizante', 'text', { required: true, alignment: 'center' });
  add(p1.page, inside(basic, 0.18, 0.51, 0.25, 0.20), 'numeroDocumento', 'Número de documento', 'cotizante', 'text', { required: true });
  addCheck(p1.page, basic, 0.48, 0.55, 'sexoFemenino', 'Sexo biológico femenino', 'cotizante');
  addCheck(p1.page, basic, 0.54, 0.55, 'sexoMasculino', 'Sexo biológico masculino', 'cotizante');
  addCheck(p1.page, basic, 0.62, 0.55, 'identidadGeneroFemenino', 'Sexo de identificación femenino', 'cotizante');
  addCheck(p1.page, basic, 0.67, 0.55, 'identidadGeneroMasculino', 'Sexo de identificación masculino', 'cotizante');
  addCheck(p1.page, basic, 0.72, 0.55, 'identidadGeneroTrans', 'Sexo de identificación trans', 'cotizante');
  addCheck(p1.page, basic, 0.77, 0.55, 'identidadGeneroNoBinario', 'Sexo de identificación no binario', 'cotizante');
  addCheck(p1.page, basic, 0.82, 0.55, 'identidadGeneroOtro', 'Otro sexo de identificación', 'cotizante');
  add(p1.page, inside(basic, 0.86, 0.51, 0.135, 0.20), 'identidadGeneroCual', 'Cuál sexo de identificación', 'cotizante');
  add(p1.page, inside(basic, 0.005, 0.77, 0.20, 0.20), 'nacionalidad', 'Nacionalidad', 'cotizante');
  add(p1.page, inside(basic, 0.21, 0.77, 0.21, 0.20), 'paisNacimiento', 'País de nacimiento', 'cotizante');
  add(p1.page, inside(basic, 0.43, 0.77, 0.20, 0.20), 'departamentoNacimiento', 'Departamento de nacimiento', 'cotizante');
  add(p1.page, inside(basic, 0.64, 0.77, 0.18, 0.20), 'ciudadNacimiento', 'Municipio de nacimiento', 'cotizante');
  addDate(p1.page, inside(basic, 0.83, 0.77, 0.165, 0.20), 'fechaNacimiento', 'Fecha de nacimiento', 'cotizante');

  // III. Datos complementarios y residencia del cotizante.
  const complement = p1.complement;
  add(p1.page, inside(complement, 0.005, 0.12, 0.14, 0.18), 'etnia', 'Etnia', 'cotizante');
  add(p1.page, inside(complement, 0.15, 0.12, 0.14, 0.18), 'comunidad', '17. Comunidad', 'cotizante');
  add(p1.page, inside(complement, 0.30, 0.12, 0.17, 0.18), 'discapacidad', 'Discapacidad', 'cotizante');
  addCheck(p1.page, complement, 0.34, 0.14, 'discapacidadSi', 'Discapacidad - Sí', 'cotizante', 'discapacidad-cotizante');
  addCheck(p1.page, complement, 0.40, 0.14, 'discapacidadNo', 'Discapacidad - No', 'cotizante', 'discapacidad-cotizante');
  add(p1.page, inside(complement, 0.48, 0.12, 0.12, 0.18), 'condicion', 'Condición', 'cotizante');
  add(p1.page, inside(complement, 0.61, 0.12, 0.15, 0.18), 'puntajeSisben', 'Puntaje / nivel SISBÉN', 'cotizante', 'number');
  addCheck(p1.page, complement, 0.54, 0.14, 'encuestaSisbenSi', 'Encuesta SISBÉN - Sí', 'cotizante', 'sisben-cotizante');
  addCheck(p1.page, complement, 0.59, 0.14, 'encuestaSisbenNo', 'Encuesta SISBÉN - No', 'cotizante', 'sisben-cotizante');
  add(p1.page, inside(complement, 0.77, 0.12, 0.225, 0.18), 'grupoEspecial', 'Grupo de población especial', 'cotizante');
  add(p1.page, inside(complement, 0.005, 0.36, 0.28, 0.16), 'arl', 'Administradora de riesgos laborales', 'cotizante');
  add(p1.page, inside(complement, 0.29, 0.36, 0.25, 0.16), 'administradoraPensiones', 'Administradora de pensiones', 'cotizante');
  add(p1.page, inside(complement, 0.55, 0.36, 0.20, 0.16), 'ibc', 'Ingreso base de cotización', 'cotizante', 'number');
  add(p1.page, inside(complement, 0.76, 0.36, 0.235, 0.16), 'tarifaContribucionSolidaria', 'Tarifa de contribución solidaria', 'manual', 'number');
  add(p1.page, inside(complement, 0.005, 0.58, 0.40, 0.18), 'direccion', 'Dirección de residencia', 'cotizante');
  add(p1.page, inside(complement, 0.41, 0.58, 0.18, 0.18), 'telefonoFijo', 'Teléfono fijo', 'cotizante');
  add(p1.page, inside(complement, 0.60, 0.58, 0.18, 0.18), 'telefono', 'Teléfono celular', 'cotizante');
  add(p1.page, inside(complement, 0.79, 0.58, 0.205, 0.18), 'email', 'Correo electrónico', 'cotizante');
  add(p1.page, inside(complement, 0.005, 0.80, 0.20, 0.17), 'departamentoResidencia', 'Departamento de residencia', 'cotizante');
  add(p1.page, inside(complement, 0.21, 0.80, 0.20, 0.17), 'ciudad', 'Municipio / distrito', 'cotizante');
  add(p1.page, inside(complement, 0.42, 0.80, 0.22, 0.17), 'localidadComuna', 'Localidad / comuna', 'cotizante');
  addCheck(p1.page, complement, 0.68, 0.82, 'zonaUrbana', 'Zona urbana', 'cotizante');
  addCheck(p1.page, complement, 0.78, 0.82, 'zonaRural', 'Zona rural', 'cotizante');
  add(p1.page, inside(complement, 0.84, 0.80, 0.155, 0.17), 'barrio', 'Barrio', 'cotizante');

  // IV. Cónyuge o compañero(a) permanente.
  const spouse = p1.spouse;
  nameKeys.forEach(([suffix, label], index) => {
    const key = suffix.replace('primerApellido', 'Apellido1').replace('segundoApellido', 'Apellido2').replace('primerNombre', 'Nombre1').replace('segundoNombre', 'Nombre2');
    add(p1.page, inside(spouse, index * 0.25 + 0.005, 0.16, 0.24, 0.22), `conyuge${key}`, `Cónyuge - ${label}`, 'familiar');
  });
  add(p1.page, inside(spouse, 0.005, 0.52, 0.17, 0.20), 'conyugeTipoDoc', 'Cónyuge - tipo de documento', 'familiar', 'text', { alignment: 'center' });
  add(p1.page, inside(spouse, 0.18, 0.52, 0.25, 0.20), 'conyugeNumDoc', 'Cónyuge - número de documento', 'familiar');
  addCheck(p1.page, spouse, 0.48, 0.56, 'conyugeSexoFemenino', 'Cónyuge - sexo femenino', 'familiar');
  addCheck(p1.page, spouse, 0.54, 0.56, 'conyugeSexoMasculino', 'Cónyuge - sexo masculino', 'familiar');
  add(p1.page, inside(spouse, 0.61, 0.52, 0.18, 0.20), 'conyugeNacionalidad', 'Cónyuge - nacionalidad', 'familiar');
  addDate(p1.page, inside(spouse, 0.80, 0.52, 0.195, 0.20), 'conyugeFechaNac', 'Cónyuge - fecha de nacimiento', 'familiar');
  add(p1.page, inside(spouse, 0.005, 0.78, 0.29, 0.18), 'conyugePaisNacimiento', 'Cónyuge - país de nacimiento', 'familiar');
  add(p1.page, inside(spouse, 0.30, 0.78, 0.34, 0.18), 'conyugeDepartamentoNacimiento', 'Cónyuge - departamento de nacimiento', 'familiar');
  add(p1.page, inside(spouse, 0.65, 0.78, 0.345, 0.18), 'conyugeMunicipioNacimiento', 'Cónyuge - municipio de nacimiento', 'familiar');

  // Beneficiarios B1-B5. Cada subtabla conserva sus límites reales por EPS.
  for (let number = 1; number <= 5; number += 1) {
    const rowTop = 0.20 + (number - 1) * 0.16;
    nameKeys.forEach(([suffix, label], index) => {
      const key = suffix.replace('primerApellido', 'Apellido1').replace('segundoApellido', 'Apellido2').replace('primerNombre', 'Nombre1').replace('segundoNombre', 'Nombre2');
      add(p1.page, inside(p1.beneficiaryNames, index * 0.25 + 0.005, rowTop, 0.24, 0.14), `beneficiario${number}${key}`, `Beneficiario ${number} - ${label}`, 'familiar');
    });

    const idTop = 0.23 + (number - 1) * 0.15;
    add(p1.page, inside(p1.beneficiaryIdentity, 0.005, idTop, 0.10, 0.13), `beneficiario${number}TipoDoc`, `Beneficiario ${number} - tipo de documento`, 'familiar', 'text', { alignment: 'center' });
    add(p1.page, inside(p1.beneficiaryIdentity, 0.11, idTop, 0.19, 0.13), `beneficiario${number}NumDoc`, `Beneficiario ${number} - número de documento`, 'familiar');
    add(p1.page, inside(p1.beneficiaryIdentity, 0.305, idTop, 0.12, 0.13), `beneficiario${number}Nacionalidad`, `Beneficiario ${number} - nacionalidad`, 'familiar');
    addCheck(p1.page, p1.beneficiaryIdentity, 0.45, idTop + 0.01, `beneficiario${number}SexoFemenino`, `Beneficiario ${number} - sexo femenino`, 'familiar');
    addCheck(p1.page, p1.beneficiaryIdentity, 0.49, idTop + 0.01, `beneficiario${number}SexoMasculino`, `Beneficiario ${number} - sexo masculino`, 'familiar');
    add(p1.page, inside(p1.beneficiaryIdentity, 0.55, idTop, 0.08, 0.13), `beneficiario${number}PaisNacimiento`, `Beneficiario ${number} - país de nacimiento`, 'familiar');
    add(p1.page, inside(p1.beneficiaryIdentity, 0.635, idTop, 0.095, 0.13), `beneficiario${number}DepartamentoNacimiento`, `Beneficiario ${number} - departamento de nacimiento`, 'familiar');
    add(p1.page, inside(p1.beneficiaryIdentity, 0.735, idTop, 0.065, 0.13), `beneficiario${number}MunicipioNacimiento`, `Beneficiario ${number} - municipio de nacimiento`, 'familiar');
    addDate(p1.page, inside(p1.beneficiaryIdentity, 0.81, idTop, 0.185, 0.13), `beneficiario${number}FechaNac`, `Beneficiario ${number} - fecha de nacimiento`, 'familiar');

    const complementTop = 0.23 + (number - 1) * 0.15;
    add(p1.page, inside(p1.beneficiaryComplement, 0.005, complementTop, 0.16, 0.13), `beneficiario${number}Parentesco`, `Beneficiario ${number} - parentesco`, 'familiar');
    add(p1.page, inside(p1.beneficiaryComplement, 0.17, complementTop, 0.13, 0.13), `beneficiario${number}Etnia`, `Beneficiario ${number} - etnia`, 'familiar');
    addCheck(p1.page, p1.beneficiaryComplement, 0.34, complementTop + 0.01, `beneficiario${number}DiscapacidadFisica`, `Beneficiario ${number} - discapacidad física`, 'familiar');
    addCheck(p1.page, p1.beneficiaryComplement, 0.39, complementTop + 0.01, `beneficiario${number}DiscapacidadNeurosensorial`, `Beneficiario ${number} - discapacidad neurosensorial`, 'familiar');
    addCheck(p1.page, p1.beneficiaryComplement, 0.44, complementTop + 0.01, `beneficiario${number}DiscapacidadMental`, `Beneficiario ${number} - discapacidad mental`, 'familiar');
    addCheck(p1.page, p1.beneficiaryComplement, 0.54, complementTop + 0.01, `beneficiario${number}CondicionTemporal`, `Beneficiario ${number} - condición temporal`, 'familiar');
    addCheck(p1.page, p1.beneficiaryComplement, 0.59, complementTop + 0.01, `beneficiario${number}CondicionPermanente`, `Beneficiario ${number} - condición permanente`, 'familiar');
    add(p1.page, inside(p1.beneficiaryComplement, 0.65, complementTop, 0.345, 0.13), `beneficiario${number}ValorUpc`, `Beneficiario ${number} - valor UPC`, 'familiar', 'number');

    const residenceTop = 0.16 + (number - 1) * 0.16;
    add(p1.page, inside(p1.beneficiaryResidence, 0.005, residenceTop, 0.18, 0.14), `beneficiario${number}Departamento`, `Beneficiario ${number} - departamento`, 'familiar');
    add(p1.page, inside(p1.beneficiaryResidence, 0.19, residenceTop, 0.22, 0.14), `beneficiario${number}Municipio`, `Beneficiario ${number} - municipio / distrito`, 'familiar');
    addCheck(p1.page, p1.beneficiaryResidence, 0.45, residenceTop + 0.01, `beneficiario${number}ZonaUrbana`, `Beneficiario ${number} - zona urbana`, 'familiar');
    addCheck(p1.page, p1.beneficiaryResidence, 0.50, residenceTop + 0.01, `beneficiario${number}ZonaRural`, `Beneficiario ${number} - zona rural`, 'familiar');
    add(p1.page, inside(p1.beneficiaryResidence, 0.56, residenceTop, 0.25, 0.14), `beneficiario${number}Telefono`, `Beneficiario ${number} - teléfono`, 'familiar');
    add(p1.page, inside(p1.beneficiaryResidence, 0.82, residenceTop, 0.175, 0.14), `beneficiario${number}ValorUpc`, `Beneficiario ${number} - valor UPC adicional`, 'familiar', 'number');
  }

  const addIpsRows = (page: number, region: Box) => {
    add(page, inside(region, 0.045, 0.015, 0.69, 0.13), 'ipsSeleccionada', 'Cotizante - IPS primaria', 'cotizante');
    add(page, inside(region, 0.745, 0.015, 0.25, 0.13), 'codigoIps', 'Cotizante - código IPS', 'cotizante');
    for (let number = 1; number <= 5; number += 1) {
      const rowTop = 0.17 + (number - 1) * 0.16;
      add(page, inside(region, 0.045, rowTop, 0.69, 0.14), `beneficiario${number}Ips`, `Beneficiario ${number} - IPS primaria`, 'familiar');
      add(page, inside(region, 0.745, rowTop, 0.25, 0.14), `beneficiario${number}CodigoIps`, `Beneficiario ${number} - código IPS`, 'familiar');
    }
  };
  if (p1.beneficiaryIps) addIpsRows(p1.page, p1.beneficiaryIps);
  if (p2.beneficiaryIps) addIpsRows(p2.page, p2.beneficiaryIps);

  const addEmployer = (page: number, employer: Box) => {
    add(page, inside(employer, 0.005, 0.16, 0.34, 0.27), 'razonSocial', '55. Nombre o razón social', 'empresa');
    add(page, inside(employer, 0.35, 0.16, 0.13, 0.27), 'tipoDocumentoEmpresa', '56. Tipo de documento', 'empresa', 'text', { alignment: 'center' });
    add(page, inside(employer, 0.49, 0.16, 0.23, 0.27), 'nitCompleto', '57. Número de identificación', 'empresa');
    add(page, inside(employer, 0.73, 0.16, 0.265, 0.27), 'tipoAportantePagador', '58. Tipo de aportante o pagador', 'empresa');
    add(page, inside(employer, 0.005, 0.58, 0.31, 0.24), 'direccionEmpresa', '59. Dirección del aportante', 'empresa');
    add(page, inside(employer, 0.32, 0.58, 0.16, 0.24), 'telefonoEmpresa', 'Teléfono del aportante', 'empresa');
    add(page, inside(employer, 0.49, 0.58, 0.21, 0.24), 'emailEmpresa', 'Correo del aportante', 'empresa');
    add(page, inside(employer, 0.71, 0.58, 0.14, 0.24), 'departamentoEmpresa', 'Departamento del aportante', 'empresa');
    add(page, inside(employer, 0.86, 0.58, 0.135, 0.24), 'ciudadEmpresa', 'Municipio del aportante', 'empresa');
  };
  if (p1.employer) addEmployer(p1.page, p1.employer);
  if (p2.employer) addEmployer(p2.page, p2.employer);

  // B. Reporte de novedades. Dos columnas, respetando el orden oficial de cada plantilla.
  const noveltyKeys: Array<[string, string]> = [
    ['novedadModificacionDatos', '1. Modificación de datos básicos'],
    ['novedadCorreccionDatos', '2. Corrección de datos básicos'],
    ['novedadActualizacionDoc', '3. Actualización de documento'],
    ['novedadActualizacionDatosComp', '4. Actualización de datos complementarios'],
    ['novedadTerminacionInscripcion', '5. Terminación de inscripción'],
    ['novedadReinscripcion', '6. Reinscripción'],
    ['novedadInclusionBeneficiarios', '7. Inclusión de beneficiarios'],
    ['novedadExclusionBeneficiarios', '8. Exclusión de beneficiarios'],
    ['novedadInicioRelacionLaboral', '9. Inicio de relación laboral'],
    ['novedadTerminacionRelacion', '10. Terminación de relación laboral'],
    ['novedadInscripcionRetornoPais', '11. Inscripción EPS por retorno al país'],
    ['novedadVinculacionColectiva', '12. Vinculación colectiva'],
    ['novedadDesvinculacionColectiva', '13. Desvinculación colectiva'],
    ['novedadMovilidad', '14. Movilidad'],
    ['novedadTraslado', '15. Traslado'],
    ['novedadFallecimiento', '16. Fallecimiento'],
    ['novedadProteccionCesante', '17. Protección al cesante'],
    ['novedadPrepensionado', '18. Pre-pensionado'],
    ['novedadPensionado', '19. Pensionado'],
    ['novedadIngresoContribucionSolidaria', '20. Ingreso a contribución solidaria'],
    ['novedadRetiroContribucionSolidaria', '21. Retiro de contribución solidaria'],
  ];
  noveltyKeys.forEach(([key, label], index) => {
    const column = index < 11 ? 0 : 1;
    const row = index < 11 ? index : index - 11;
    addCheck(p2.page, p2.novelties, column ? 0.54 : 0.015, 0.11 + row * 0.075, key, label);
  });
  addCheck(p2.page, p2.novelties, 0.72, 0.26, 'movilidadContributivo', '14A. Movilidad a contributivo');
  addCheck(p2.page, p2.novelties, 0.88, 0.26, 'movilidadSubsidiado', '14B. Movilidad a subsidiado');
  addCheck(p2.page, p2.novelties, 0.72, 0.335, 'trasladoMismoRegimen', '15A. Traslado mismo régimen');
  addCheck(p2.page, p2.novelties, 0.88, 0.335, 'trasladoDiferenteRegimen', '15B. Traslado diferente régimen');

  // VI. Datos actualizados de la persona sobre la que se reporta la novedad.
  const updated = p2.updated;
  nameKeys.forEach(([key, label], index) => add(p2.page, inside(updated, index * 0.25 + 0.005, 0.18, 0.24, 0.24), key, `Actualizado - ${label}`, 'cotizante'));
  add(p2.page, inside(updated, 0.005, 0.55, 0.15, 0.20), 'tipoDocumento', 'Actualizado - tipo documento', 'cotizante', 'text', { alignment: 'center' });
  add(p2.page, inside(updated, 0.16, 0.55, 0.25, 0.20), 'numeroDocumento', 'Actualizado - número documento', 'cotizante');
  addCheck(p2.page, updated, 0.45, 0.58, 'sexoFemenino', 'Actualizado - sexo femenino', 'cotizante');
  addCheck(p2.page, updated, 0.51, 0.58, 'sexoMasculino', 'Actualizado - sexo masculino', 'cotizante');
  addDate(p2.page, inside(updated, 0.80, 0.55, 0.195, 0.20), 'fechaNacimiento', 'Actualizado - fecha nacimiento', 'cotizante');
  add(p2.page, inside(updated, 0.005, 0.80, 0.30, 0.17), 'epsAnterior', 'EPS anterior', 'tramite');
  addDate(p2.page, inside(updated, 0.31, 0.80, 0.20, 0.17), 'fechaNovedad', 'Fecha de novedad', 'tramite');
  add(p2.page, inside(updated, 0.52, 0.80, 0.22, 0.17), 'motivoTraslado', 'Motivo de traslado', 'tramite');
  add(p2.page, inside(updated, 0.75, 0.80, 0.245, 0.17), 'cajaCompensacionAnterior', 'Caja de compensación o pagador', 'tramite');

  // VII. Declaraciones y autorizaciones.
  const declarationKeys: Array<[string, string]> = [
    ['declaracionDependenciaEconomica', '69. Dependencia económica de beneficiarios'],
    ['declaracionNoObligacionContributivo', '70. No obligación de afiliarse al contributivo'],
    ['declaracionFuerzaMayorDocumentos', '71. Fuerza mayor para entrega de documentos'],
    ['declaracionNoInternacion', '72. No internación en IPS'],
    ['autorizacionHistoriaClinica', '73. Autorización de historia clínica'],
    ['autorizacionReporteInformacion', '74. Autorización de reporte de información'],
    ['autorizacionDatosPersonales', '75. Autorización de datos personales'],
    ['autorizacionNotificaciones', '76. Autorización de correo y mensajes'],
    ['aceptacionContribucionSolidaria', '77. Aceptación de contribución solidaria'],
    ['aceptacionActualizacionTarifas', '78. Aceptación tarifas contribución solidaria'],
  ];
  declarationKeys.forEach(([key, label], index) => addCheck(p2.page, p2.declarations, 0.012, 0.08 + index * 0.092, key, label, 'manual'));

  if (p2.solidarity) {
    const solidarity = p2.solidarity;
    nameKeys.forEach(([key, label], index) => add(p2.page, inside(solidarity, index * 0.25 + 0.005, 0.30, 0.24, 0.23), `responsableSolidaridad${key[0].toUpperCase()}${key.slice(1)}`, `Responsable contribución - ${label}`, 'manual'));
    add(p2.page, inside(solidarity, 0.005, 0.68, 0.20, 0.20), 'responsableSolidaridadTipoDoc', 'Responsable contribución - tipo documento', 'manual');
    add(p2.page, inside(solidarity, 0.21, 0.68, 0.30, 0.20), 'responsableSolidaridadNumDoc', 'Responsable contribución - número documento', 'manual');
  }

  add(p2.page, inside(p2.signatures, 0.005, 0.22, 0.49, 0.62), 'firmaAfiliado', 'Firma del afiliado o cotizante', 'manual');
  add(p2.page, inside(p2.signatures, 0.505, 0.22, 0.49, 0.62), 'firmaEmpleador', 'Firma y sello del empleador o entidad', 'manual');

  const annexKeys: Array<[string, string]> = [
    ['anexoDocumentoIdentidad', '82. Documento de identidad'],
    ['anexoDictamenIncapacidad', '83. Dictamen de incapacidad'],
    ['anexoUnionMarital', '84. Registro civil o unión marital'],
    ['anexoTerminacionUnion', '85. Terminación de unión marital'],
    ['anexoAdopcion', '86. Certificado de adopción'],
    ['anexoCustodia', '87. Orden de custodia'],
    ['anexoPatriaPotestad', '88. Patria potestad / defunción'],
    ['anexoAutorizacionTraslado', '89. Autorización de traslado'],
    ['anexoAfiliacionColectiva', '90. Afiliación colectiva'],
    ['anexoAfiliacionOficio', '91. Afiliación de oficio'],
  ];
  annexKeys.forEach(([key, label], index) => addCheck(p2.page, p2.annexes, 0.012, 0.08 + index * 0.083, key, label, 'manual'));
  const countKeys = ['cantidadAnexoCN', 'cantidadAnexoRC', 'cantidadAnexoTI', 'cantidadAnexoCC', 'cantidadAnexoCE', 'cantidadAnexoPA', 'cantidadAnexoCD', 'cantidadAnexoSC'];
  countKeys.forEach((key, index) => add(p2.page, inside(p2.annexes, 0.50 + index * 0.047, 0.08, 0.038, 0.10), key, `Cantidad ${key.replace('cantidadAnexo', '')}`, 'manual', 'number', { alignment: 'center', padding: 0 }));
  add(p2.page, inside(p2.annexes, 0.89, 0.08, 0.10, 0.10), 'cantidadAnexosTotal', 'Total de anexos', 'manual', 'number', { alignment: 'center' });

  if (p2.territorial) {
    add(p2.page, inside(p2.territorial, 0.005, 0.24, 0.19, 0.50), 'territorialCodigoMunicipio', 'Código municipio entidad territorial', 'manual');
    add(p2.page, inside(p2.territorial, 0.20, 0.24, 0.19, 0.50), 'territorialCodigoDepartamento', 'Código departamento entidad territorial', 'manual');
    add(p2.page, inside(p2.territorial, 0.40, 0.24, 0.18, 0.50), 'territorialFichaSisben', 'Número de ficha SISBÉN', 'manual');
    add(p2.page, inside(p2.territorial, 0.59, 0.24, 0.12, 0.50), 'territorialPuntajeSisben', 'Puntaje SISBÉN territorial', 'manual', 'number');
    add(p2.page, inside(p2.territorial, 0.72, 0.24, 0.10, 0.50), 'territorialNivelSisben', 'Nivel SISBÉN territorial', 'manual');
    addDate(p2.page, inside(p2.territorial, 0.83, 0.24, 0.165, 0.50), 'territorialFechaRadicacion', 'Fecha de radicación territorial', 'manual');
  }

  if (p2.official) {
    const official = p2.official;
    nameKeys.forEach(([key, label], index) => add(p2.page, inside(official, index * 0.25 + 0.005, 0.18, 0.24, 0.25), `funcionario${key[0].toUpperCase()}${key.slice(1)}`, `Funcionario - ${label}`, 'manual'));
    add(p2.page, inside(official, 0.005, 0.56, 0.18, 0.20), 'funcionarioTipoDocumento', 'Funcionario - tipo documento', 'manual');
    add(p2.page, inside(official, 0.19, 0.56, 0.28, 0.20), 'funcionarioNumeroDocumento', 'Funcionario - número documento', 'manual');
    add(p2.page, inside(official, 0.48, 0.56, 0.25, 0.20), 'firmaFuncionario', 'Firma del funcionario', 'manual');
    addDate(p2.page, inside(official, 0.74, 0.56, 0.255, 0.20), 'territorialFechaValidacion', 'Fecha de validación territorial', 'manual');
  }
  if (p2.observations) add(p2.page, inside(p2.observations, 0.005, 0.08, 0.99, 0.84), 'observaciones', 'Observaciones del formulario', 'tramite', 'text', { verticalAlignment: 'top' });

  for (const extra of profile.extraFields || []) {
    const extraSource = extra.source || 'manual';
    add(extra.page, extra.box, extra.key, extra.label, extraSource, extra.type || 'text', extra.type === 'checkbox' ? {
      checkboxRule: { mode: extraSource === 'manual' ? 'manual' : 'truthy', source: extraSource, fieldKey: extra.key, groupId: extra.groupId },
    } : {});
  }

  return {
    id: profile.id,
    name: profile.name,
    entity: profile.entity,
    entityType: 'EPS',
    formType: 'Afiliación y reporte de novedades SGSSS',
    description: profile.description,
    pdfBase64: '',
    pdfAssetPath: profile.assetPath,
    pdfFileName: profile.fileName,
    totalPages: profile.pageSizes.length,
    pageSizes: profile.pageSizes,
    fields,
    mappingStatus: 'ready',
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z',
    version: CURRENT_VERSION,
  };
}

const profiles: TemplateProfile[] = [
  {
    id: 'default-capital-salud-2026', name: 'Capital Salud - Afiliación 2026', entity: 'Capital Salud EPS-S',
    description: 'Formulario blanco oficial de 4 páginas. Páginas 1 y 2 mapeadas; páginas 3 y 4 son instructivo.',
    assetPath: '/templates/capital_salud_afiliacion_2026.pdf', fileName: 'Capital_Salud_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 609.449, height: 779.528 }, { width: 609.449, height: 779.528 }, { width: 609.449, height: 779.528 }, { width: 609.449, height: 779.528 }],
    pageOne: { page: 0, content: { x: 51, width: 528 }, radication: { x: 471, top: 61, width: 106, height: 22 }, process: { x: 51, top: 92, width: 528, height: 56 }, basic: { x: 51, top: 152, width: 528, height: 74 }, complement: { x: 51, top: 232, width: 528, height: 110 }, spouse: { x: 51, top: 355, width: 528, height: 62 }, beneficiaryNames: { x: 51, top: 421, width: 528, height: 45 }, beneficiaryIdentity: { x: 51, top: 468, width: 528, height: 47 }, beneficiaryComplement: { x: 51, top: 518, width: 528, height: 50 }, beneficiaryResidence: { x: 51, top: 571, width: 528, height: 87 }, beneficiaryIps: { x: 51, top: 661, width: 528, height: 54 }, employer: { x: 51, top: 720, width: 528, height: 45 } },
    pageTwo: { page: 1, content: { x: 51, width: 528 }, novelties: { x: 51, top: 96, width: 528, height: 112 }, updated: { x: 51, top: 220, width: 528, height: 56 }, declarations: { x: 51, top: 288, width: 528, height: 104 }, solidarity: { x: 51, top: 402, width: 528, height: 42 }, signatures: { x: 51, top: 452, width: 528, height: 18 }, annexes: { x: 51, top: 482, width: 528, height: 118 }, territorial: { x: 51, top: 612, width: 528, height: 16 }, official: { x: 51, top: 640, width: 528, height: 52 }, observations: { x: 51, top: 696, width: 528, height: 60 } },
  },
  {
    id: 'default-compensar-2026', name: 'Compensar - Afiliación 2026', entity: 'Compensar EPS',
    description: 'Formulario blanco oficial de 5 páginas. Páginas 1 y 2 mapeadas; página 3 incluye autorizaciones; páginas 4 y 5 son instructivo.',
    assetPath: '/templates/compensar_afiliacion_2026.pdf', fileName: 'Compensar_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 637.797, height: 1034.65 }, { width: 637.797, height: 1034.65 }, { width: 637.797, height: 822.047 }, { width: 637.795, height: 1034.65 }, { width: 637.795, height: 1034.65 }],
    pageOne: { page: 0, content: { x: 40, width: 558 }, radication: { x: 430, top: 80, width: 167, height: 38 }, process: { x: 40, top: 122, width: 558, height: 56 }, basic: { x: 40, top: 180, width: 558, height: 62 }, complement: { x: 40, top: 244, width: 558, height: 100 }, spouse: { x: 40, top: 347, width: 558, height: 64 }, beneficiaryNames: { x: 40, top: 413, width: 558, height: 84 }, beneficiaryIdentity: { x: 40, top: 499, width: 558, height: 127 }, beneficiaryComplement: { x: 40, top: 628, width: 558, height: 137 }, beneficiaryResidence: { x: 40, top: 768, width: 558, height: 203 } },
    pageTwo: { page: 1, content: { x: 42, width: 554 }, beneficiaryIps: { x: 42, top: 56, width: 554, height: 104 }, employer: { x: 42, top: 160, width: 554, height: 80 }, novelties: { x: 42, top: 255, width: 554, height: 94 }, updated: { x: 42, top: 366, width: 554, height: 72 }, declarations: { x: 42, top: 454, width: 554, height: 84 }, solidarity: { x: 42, top: 556, width: 554, height: 48 }, signatures: { x: 42, top: 620, width: 554, height: 38 }, annexes: { x: 42, top: 680, width: 554, height: 72 }, territorial: { x: 42, top: 770, width: 554, height: 20 }, official: { x: 42, top: 802, width: 554, height: 92 }, observations: { x: 42, top: 914, width: 554, height: 68 } },
    extraFields: [
      { page: 2, box: { x: 511, top: 132, width: 10, height: 10 }, key: 'compensarCartaDerechosSi', label: 'Compensar - recibió carta de derechos: Sí', type: 'checkbox', groupId: 'compensar-carta-1' },
      { page: 2, box: { x: 548, top: 132, width: 10, height: 10 }, key: 'compensarCartaDerechosNo', label: 'Compensar - recibió carta de derechos: No', type: 'checkbox', groupId: 'compensar-carta-1' },
      { page: 2, box: { x: 511, top: 176, width: 10, height: 10 }, key: 'compensarCartaDesempenoSi', label: 'Compensar - recibió carta de desempeño: Sí', type: 'checkbox', groupId: 'compensar-carta-2' },
      { page: 2, box: { x: 548, top: 176, width: 10, height: 10 }, key: 'compensarCartaDesempenoNo', label: 'Compensar - recibió carta de desempeño: No', type: 'checkbox', groupId: 'compensar-carta-2' },
      { page: 2, box: { x: 108, top: 408, width: 324, height: 18 }, key: 'firmaAfiliadoCartaDerechos', label: 'Firma carta de derechos' },
      { page: 2, box: { x: 105, top: 429, width: 290, height: 15 }, key: 'nombreCompleto', label: 'Nombre para carta de derechos', source: 'cotizante' },
      { page: 2, box: { x: 421, top: 429, width: 150, height: 15 }, key: 'numeroDocumento', label: 'Documento para carta de derechos', source: 'cotizante' },
    ],
  },
  {
    id: 'default-famisanar-2026', name: 'Famisanar - Afiliación 2026', entity: 'Famisanar EPS',
    description: 'Formulario blanco oficial de 3 páginas. Páginas 1 y 2 mapeadas; página 3 incluye carta de derechos, datos personales y donación.',
    assetPath: '/templates/famisanar_afiliacion_2026.pdf', fileName: 'Famisanar_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 612, height: 963.78 }, { width: 612, height: 963.78 }, { width: 612, height: 963.78 }],
    pageOne: { page: 0, content: { x: 37, width: 560 }, radication: { x: 411, top: 73, width: 184, height: 26 }, process: { x: 37, top: 102, width: 560, height: 68 }, basic: { x: 37, top: 172, width: 560, height: 95 }, complement: { x: 37, top: 270, width: 560, height: 120 }, spouse: { x: 37, top: 394, width: 560, height: 92 }, beneficiaryNames: { x: 37, top: 488, width: 560, height: 88 }, beneficiaryIdentity: { x: 37, top: 578, width: 560, height: 84 }, beneficiaryComplement: { x: 37, top: 664, width: 560, height: 100 }, beneficiaryResidence: { x: 37, top: 766, width: 560, height: 172 } },
    pageTwo: { page: 1, content: { x: 52, width: 526 }, beneficiaryIps: { x: 52, top: 45, width: 526, height: 72 }, employer: { x: 52, top: 120, width: 526, height: 62 }, novelties: { x: 52, top: 188, width: 526, height: 92 }, updated: { x: 52, top: 286, width: 526, height: 96 }, declarations: { x: 52, top: 388, width: 526, height: 92 }, solidarity: { x: 52, top: 484, width: 526, height: 76 }, signatures: { x: 52, top: 566, width: 526, height: 42 }, annexes: { x: 52, top: 614, width: 526, height: 126 }, territorial: { x: 52, top: 746, width: 526, height: 52 }, official: { x: 52, top: 804, width: 526, height: 72 }, observations: { x: 52, top: 878, width: 526, height: 48 } },
    extraFields: [
      { page: 2, box: { x: 299, top: 158, width: 10, height: 10 }, key: 'famisanarCartaDerechosSi', label: 'Famisanar - recibió carta de derechos: Sí', type: 'checkbox', groupId: 'famisanar-carta-1' },
      { page: 2, box: { x: 322, top: 158, width: 10, height: 10 }, key: 'famisanarCartaDerechosNo', label: 'Famisanar - recibió carta de derechos: No', type: 'checkbox', groupId: 'famisanar-carta-1' },
      { page: 2, box: { x: 68, top: 451, width: 256, height: 17 }, key: 'firmaAfiliadoCartaDerechos', label: 'Firma de carta de derechos Famisanar' },
      { page: 2, box: { x: 293, top: 573, width: 10, height: 10 }, key: 'famisanarDonacionSi', label: 'Donación de órganos: Sí', type: 'checkbox', groupId: 'famisanar-donacion' },
      { page: 2, box: { x: 348, top: 573, width: 10, height: 10 }, key: 'famisanarDonacionNo', label: 'Donación de órganos: No', type: 'checkbox', groupId: 'famisanar-donacion' },
    ],
  },
  {
    id: 'default-nueva-eps-2026', name: 'Nueva EPS - Afiliación 2026', entity: 'Nueva EPS',
    description: 'Formulario blanco oficial de 2 páginas. El formulario SGSSS completo está mapeado en la página 1; la página 2 contiene autorizaciones propias de Nueva EPS.',
    assetPath: '/templates/nueva_eps_afiliacion_2026.pdf', fileName: 'Nueva_EPS_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 612, height: 1070.64 }, { width: 612, height: 1070.64 }],
    pageOne: { page: 0, content: { x: 35, width: 558 }, radication: { x: 490, top: 102, width: 102, height: 34 }, process: { x: 35, top: 140, width: 558, height: 65 }, basic: { x: 35, top: 206, width: 558, height: 44 }, complement: { x: 35, top: 252, width: 558, height: 60 }, spouse: { x: 35, top: 314, width: 558, height: 52 }, beneficiaryNames: { x: 35, top: 368, width: 558, height: 37 }, beneficiaryIdentity: { x: 35, top: 405, width: 558, height: 38 }, beneficiaryComplement: { x: 35, top: 444, width: 558, height: 30 }, beneficiaryResidence: { x: 35, top: 474, width: 558, height: 42 }, beneficiaryIps: { x: 35, top: 448, width: 558, height: 65 }, employer: { x: 35, top: 513, width: 558, height: 61 } },
    pageTwo: { page: 0, content: { x: 35, width: 558 }, novelties: { x: 35, top: 574, width: 558, height: 84 }, updated: { x: 35, top: 664, width: 558, height: 52 }, declarations: { x: 35, top: 720, width: 558, height: 92 }, signatures: { x: 35, top: 816, width: 558, height: 26 }, annexes: { x: 35, top: 846, width: 558, height: 106 }, territorial: { x: 35, top: 956, width: 558, height: 26 }, official: { x: 35, top: 986, width: 558, height: 34 }, observations: { x: 35, top: 1024, width: 558, height: 30 } },
    extraFields: [
      { page: 1, box: { x: 84, top: 132, width: 225, height: 16 }, key: 'nombreCompleto', label: 'Nueva EPS - nombre autorización', source: 'cotizante' },
      { page: 1, box: { x: 333, top: 132, width: 135, height: 16 }, key: 'numeroDocumento', label: 'Nueva EPS - documento autorización', source: 'cotizante' },
      { page: 1, box: { x: 486, top: 132, width: 105, height: 16 }, key: 'nuevaAutorizacionOtroDocumento', label: 'Nueva EPS - otro documento' },
      { page: 1, box: { x: 174, top: 351, width: 250, height: 18 }, key: 'firmaAfiliadoCartaDerechos', label: 'Nueva EPS - firma carta de derechos' },
      { page: 1, box: { x: 485, top: 545, width: 106, height: 45 }, key: 'selloRadicacion', label: 'Nueva EPS - sello de radicación', type: 'stamp' },
    ],
  },
  {
    id: 'default-proteger-2026', name: 'Proteger EPS - Afiliación 2026', entity: 'Proteger EPS',
    description: 'Formulario blanco oficial de 3 páginas. Páginas 1 y 2 mapeadas; la validación territorial y observaciones continúan en la página 3.',
    assetPath: '/templates/proteger_afiliacion_2026.pdf', fileName: 'Proteger_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 612, height: 1008 }, { width: 612, height: 1008 }, { width: 612, height: 1008 }],
    pageOne: { page: 0, content: { x: 48, width: 526 }, radication: { x: 454, top: 58, width: 119, height: 25 }, process: { x: 48, top: 86, width: 526, height: 90 }, basic: { x: 48, top: 178, width: 526, height: 110 }, complement: { x: 48, top: 290, width: 526, height: 138 }, spouse: { x: 48, top: 430, width: 526, height: 100 }, beneficiaryNames: { x: 48, top: 532, width: 526, height: 68 }, beneficiaryIdentity: { x: 48, top: 602, width: 526, height: 98 }, beneficiaryComplement: { x: 48, top: 702, width: 526, height: 110 }, beneficiaryResidence: { x: 48, top: 814, width: 526, height: 116 } },
    pageTwo: { page: 1, content: { x: 48, width: 526 }, beneficiaryIps: { x: 48, top: 88, width: 526, height: 74 }, employer: { x: 48, top: 160, width: 526, height: 82 }, novelties: { x: 48, top: 250, width: 526, height: 140 }, updated: { x: 48, top: 396, width: 526, height: 60 }, declarations: { x: 48, top: 462, width: 526, height: 140 }, solidarity: { x: 48, top: 608, width: 526, height: 88 }, signatures: { x: 48, top: 704, width: 526, height: 54 }, annexes: { x: 48, top: 764, width: 526, height: 206 } },
    extraFields: [
      { page: 2, box: { x: 48, top: 76, width: 174, height: 25 }, key: 'territorialCodigoMunicipio', label: 'Proteger - código municipio entidad territorial' },
      { page: 2, box: { x: 224, top: 76, width: 174, height: 25 }, key: 'territorialCodigoDepartamento', label: 'Proteger - código departamento entidad territorial' },
      { page: 2, box: { x: 401, top: 76, width: 171, height: 25 }, key: 'territorialNombreInstitucionP3', label: 'Proteger - nombre institución territorial' },
      { page: 2, box: { x: 48, top: 132, width: 130, height: 18 }, key: 'funcionarioPrimerApellido', label: 'Proteger - funcionario primer apellido' },
      { page: 2, box: { x: 180, top: 132, width: 130, height: 18 }, key: 'funcionarioSegundoApellido', label: 'Proteger - funcionario segundo apellido' },
      { page: 2, box: { x: 312, top: 132, width: 130, height: 18 }, key: 'funcionarioPrimerNombre', label: 'Proteger - funcionario primer nombre' },
      { page: 2, box: { x: 444, top: 132, width: 128, height: 18 }, key: 'funcionarioSegundoNombre', label: 'Proteger - funcionario segundo nombre' },
      { page: 2, box: { x: 48, top: 166, width: 120, height: 18 }, key: 'funcionarioTipoDocumento', label: 'Proteger - funcionario tipo documento' },
      { page: 2, box: { x: 170, top: 166, width: 138, height: 18 }, key: 'funcionarioNumeroDocumento', label: 'Proteger - funcionario documento' },
      { page: 2, box: { x: 310, top: 166, width: 132, height: 18 }, key: 'firmaFuncionario', label: 'Proteger - firma funcionario' },
      { page: 2, box: { x: 444, top: 166, width: 128, height: 18 }, key: 'territorialFechaValidacion', label: 'Proteger - fecha validación', type: 'date' },
      { page: 2, box: { x: 48, top: 202, width: 526, height: 218 }, key: 'observaciones', label: 'Observaciones Proteger' },
    ],
  },
  {
    id: 'default-salud-mia-2026', name: 'Salud Mía - Afiliación 2026', entity: 'Salud Mía EPS',
    description: 'Formulario blanco oficial de 4 páginas. Páginas 1 y 2 mapeadas; páginas 3 y 4 son instructivo.',
    assetPath: '/templates/salud_mia_afiliacion_2026.pdf', fileName: 'Salud_Mia_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 927.27, height: 1200 }, { width: 927.27, height: 1200 }, { width: 927.36, height: 1200 }, { width: 927.36, height: 1200 }],
    pageOne: { page: 0, content: { x: 53, width: 821 }, radication: { x: 706, top: 50, width: 168, height: 34 }, process: { x: 53, top: 88, width: 821, height: 106 }, basic: { x: 53, top: 196, width: 821, height: 110 }, complement: { x: 53, top: 308, width: 821, height: 142 }, spouse: { x: 53, top: 452, width: 821, height: 116 }, beneficiaryNames: { x: 53, top: 570, width: 821, height: 104 }, beneficiaryIdentity: { x: 53, top: 676, width: 821, height: 90 }, beneficiaryComplement: { x: 53, top: 768, width: 821, height: 106 }, beneficiaryResidence: { x: 53, top: 876, width: 821, height: 210 }, beneficiaryIps: { x: 53, top: 1090, width: 821, height: 90 } },
    pageTwo: { page: 1, content: { x: 53, width: 821 }, employer: { x: 53, top: 40, width: 821, height: 90 }, novelties: { x: 53, top: 134, width: 821, height: 192 }, updated: { x: 53, top: 330, width: 821, height: 118 }, declarations: { x: 53, top: 452, width: 821, height: 182 }, solidarity: { x: 53, top: 638, width: 821, height: 58 }, signatures: { x: 53, top: 700, width: 821, height: 42 }, annexes: { x: 53, top: 746, width: 821, height: 226 }, territorial: { x: 53, top: 984, width: 821, height: 26 }, official: { x: 53, top: 1016, width: 821, height: 76 }, observations: { x: 53, top: 1098, width: 821, height: 84 } },
  },
  {
    id: 'default-salud-total-2026', name: 'Salud Total - Afiliación 2026', entity: 'Salud Total EPS-S',
    description: 'Formulario blanco oficial de 2 páginas, mapeado sobre su distribución gráfica propia.',
    assetPath: '/templates/salud_total_afiliacion_2026.pdf', fileName: 'Salud_Total_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 612, height: 792 }, { width: 612, height: 792 }],
    pageOne: { page: 0, content: { x: 48, width: 537 }, radication: { x: 461, top: 88, width: 124, height: 44 }, process: { x: 48, top: 136, width: 537, height: 62 }, basic: { x: 48, top: 202, width: 537, height: 56 }, complement: { x: 48, top: 262, width: 537, height: 112 }, spouse: { x: 48, top: 378, width: 537, height: 66 }, beneficiaryNames: { x: 48, top: 448, width: 537, height: 62 }, beneficiaryIdentity: { x: 48, top: 512, width: 537, height: 54 }, beneficiaryComplement: { x: 48, top: 568, width: 537, height: 54 }, beneficiaryResidence: { x: 48, top: 624, width: 537, height: 54 }, beneficiaryIps: { x: 48, top: 672, width: 537, height: 50 }, employer: { x: 48, top: 724, width: 537, height: 54 } },
    pageTwo: { page: 1, content: { x: 48, width: 537 }, novelties: { x: 48, top: 130, width: 537, height: 130 }, updated: { x: 48, top: 264, width: 537, height: 66 }, declarations: { x: 48, top: 334, width: 537, height: 130 }, signatures: { x: 48, top: 468, width: 537, height: 58 }, annexes: { x: 48, top: 530, width: 537, height: 120 }, territorial: { x: 48, top: 654, width: 537, height: 38 }, official: { x: 48, top: 696, width: 537, height: 48 }, observations: { x: 48, top: 748, width: 537, height: 30 } },
  },
  {
    id: 'default-sanitas-2026', name: 'Sanitas - Afiliación 2026', entity: 'EPS Sanitas',
    description: 'Formulario blanco oficial de 2 páginas del SGSSS.',
    assetPath: '/templates/sanitas_afiliacion_2026.pdf', fileName: 'Sanitas_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 603.95, height: 781.58 }, { width: 603.95, height: 781.58 }],
    pageOne: { page: 0, content: { x: 48, width: 542 }, radication: { x: 345, top: 18, width: 140, height: 20 }, process: { x: 48, top: 62, width: 542, height: 58 }, basic: { x: 48, top: 122, width: 542, height: 72 }, complement: { x: 48, top: 196, width: 542, height: 117 }, spouse: { x: 48, top: 316, width: 542, height: 88 }, beneficiaryNames: { x: 48, top: 405, width: 542, height: 84 }, beneficiaryIdentity: { x: 48, top: 490, width: 542, height: 78 }, beneficiaryComplement: { x: 48, top: 570, width: 542, height: 56 }, beneficiaryResidence: { x: 48, top: 628, width: 542, height: 103 } },
    pageTwo: { page: 1, content: { x: 48, width: 542 }, beneficiaryIps: { x: 48, top: 28, width: 542, height: 78 }, employer: { x: 48, top: 106, width: 542, height: 78 }, novelties: { x: 48, top: 186, width: 542, height: 92 }, updated: { x: 48, top: 282, width: 542, height: 76 }, declarations: { x: 48, top: 370, width: 542, height: 90 }, solidarity: { x: 48, top: 462, width: 542, height: 26 }, signatures: { x: 48, top: 490, width: 542, height: 36 }, annexes: { x: 48, top: 526, width: 542, height: 86 }, territorial: { x: 48, top: 614, width: 542, height: 18 }, official: { x: 48, top: 636, width: 542, height: 50 }, observations: { x: 48, top: 688, width: 542, height: 36 } },
    extraFields: [
      { page: 1, box: { x: 48, top: 736, width: 260, height: 16 }, key: 'ejecutivoComercial', label: 'Doc. y nombre del Ejecutivo Comercial', source: 'tramite' },
      { page: 1, box: { x: 310, top: 736, width: 130, height: 16 }, key: 'fechaSelloRadicacion', label: 'Fecha en sello de radicación', source: 'tramite' },
    ],
  },
  {
    id: 'default-sos-2026', name: 'SOS - Afiliación 2026', entity: 'Servicio Occidental de Salud SOS EPS',
    description: 'Formulario blanco oficial de 3 páginas. Páginas 1 y 2 mapeadas; página 3 incluye carta de derechos, tratamiento de datos y convivencia.',
    assetPath: '/templates/sos_afiliacion_2026.pdf', fileName: 'SOS_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 612, height: 1008 }, { width: 612, height: 1008 }, { width: 612, height: 936 }],
    pageOne: { page: 0, content: { x: 40, width: 549 }, radication: { x: 418, top: 92, width: 171, height: 22 }, process: { x: 40, top: 116, width: 549, height: 70 }, basic: { x: 40, top: 188, width: 549, height: 64 }, complement: { x: 40, top: 254, width: 549, height: 106 }, spouse: { x: 40, top: 362, width: 549, height: 70 }, beneficiaryNames: { x: 40, top: 434, width: 549, height: 70 }, beneficiaryIdentity: { x: 40, top: 506, width: 549, height: 64 }, beneficiaryComplement: { x: 40, top: 572, width: 549, height: 78 }, beneficiaryResidence: { x: 40, top: 652, width: 549, height: 164 }, beneficiaryIps: { x: 40, top: 806, width: 549, height: 68 }, employer: { x: 40, top: 876, width: 549, height: 72 } },
    pageTwo: { page: 1, content: { x: 48, width: 542 }, novelties: { x: 48, top: 74, width: 542, height: 154 }, updated: { x: 48, top: 232, width: 542, height: 70 }, declarations: { x: 48, top: 304, width: 542, height: 110 }, solidarity: { x: 48, top: 418, width: 542, height: 44 }, signatures: { x: 48, top: 466, width: 542, height: 36 }, annexes: { x: 48, top: 506, width: 542, height: 204 }, territorial: { x: 48, top: 716, width: 542, height: 36 }, official: { x: 48, top: 760, width: 542, height: 78 }, observations: { x: 48, top: 842, width: 542, height: 78 } },
    extraFields: [
      { page: 2, box: { x: 288, top: 82, width: 10, height: 10 }, key: 'sosCartaElectronicaSi', label: 'SOS - carta electrónica: Sí', type: 'checkbox', groupId: 'sos-carta' },
      { page: 2, box: { x: 345, top: 82, width: 10, height: 10 }, key: 'sosCartaElectronicaNo', label: 'SOS - carta electrónica: No', type: 'checkbox', groupId: 'sos-carta' },
      { page: 2, box: { x: 139, top: 111, width: 405, height: 14 }, key: 'email', label: 'SOS - correo de carta de derechos', source: 'cotizante' },
      { page: 2, box: { x: 199, top: 688, width: 226, height: 14 }, key: 'firmaAfiliadoCartaDerechos', label: 'SOS - firma autorización de datos' },
      { page: 2, box: { x: 199, top: 708, width: 226, height: 14 }, key: 'numeroDocumento', label: 'SOS - documento autorización de datos', source: 'cotizante' },
      { page: 2, box: { x: 62, top: 836, width: 244, height: 15 }, key: 'firmaCotizanteConvivencia', label: 'SOS - firma cotizante convivencia' },
      { page: 2, box: { x: 331, top: 836, width: 216, height: 15 }, key: 'firmaCompaneroConvivencia', label: 'SOS - firma compañero convivencia' },
    ],
  },
  {
    id: 'default-sura-2026', name: 'Sura - Afiliación 2026', entity: 'EPS Sura',
    description: 'Formulario blanco oficial de 2 páginas con numeración y distribución propias de EPS Sura.',
    assetPath: '/templates/sura_afiliacion_2026.pdf', fileName: 'Sura_Afiliacion_2026_Blanco.pdf',
    pageSizes: [{ width: 600, height: 800.785 }, { width: 600, height: 800.785 }],
    pageOne: { page: 0, content: { x: 50, width: 536 }, radication: { x: 405, top: 66, width: 180, height: 25 }, process: { x: 50, top: 84, width: 536, height: 67 }, basic: { x: 50, top: 154, width: 536, height: 52 }, complement: { x: 50, top: 208, width: 536, height: 92 }, spouse: { x: 50, top: 302, width: 536, height: 74 }, beneficiaryNames: { x: 50, top: 378, width: 536, height: 76 }, beneficiaryIdentity: { x: 50, top: 456, width: 536, height: 61 }, beneficiaryComplement: { x: 50, top: 518, width: 536, height: 64 }, beneficiaryResidence: { x: 50, top: 584, width: 536, height: 64 }, beneficiaryIps: { x: 50, top: 652, width: 536, height: 64 }, employer: { x: 50, top: 720, width: 536, height: 50 } },
    pageTwo: { page: 1, content: { x: 50, width: 536 }, novelties: { x: 50, top: 96, width: 536, height: 140 }, updated: { x: 50, top: 240, width: 536, height: 72 }, declarations: { x: 50, top: 316, width: 536, height: 120 }, signatures: { x: 50, top: 440, width: 536, height: 32 }, annexes: { x: 50, top: 476, width: 536, height: 162 }, territorial: { x: 50, top: 642, width: 536, height: 36 }, official: { x: 50, top: 682, width: 536, height: 52 }, observations: { x: 50, top: 738, width: 536, height: 34 } },
    extraFields: [
      { page: 0, box: { x: 486, top: 178, width: 95, height: 16 }, key: 'estadoCivil', label: 'Sura - estado civil', source: 'cotizante' },
    ],
  },
];

export const SGSSS_2026_TEMPLATES: FormTemplate[] = profiles.map(buildTemplate);
