export type TipoDocumento = 'CC' | 'CE' | 'NIT' | 'PASAPORTE';

export interface Empresa {
  id?: string;
  nit: string;
  dv: string;
  razonSocial: string;
  direccion: string;
  ciudad: string;
  departamento?: string;
  telefono: string;
  email: string;
  emailContacto?: string;
  operadorPila: 'Aportes en Línea' | 'Soi' | 'Mi Planilla' | 'Asopagos' | 'Enlace Operativo' | 'Simple';
  arl: 'Positiva' | 'Sura' | 'SURA' | 'Colpatria' | 'Alfa' | 'Bolívar' | 'Equidad' | 'Liberty';
  nivelRiesgoArl: 1 | 2 | 3 | 4 | 5;
  claseRiesgoPrincipal?: string;
  representanteLegal: string;
  cedulaRepresentante: string;
  tipoDocumento?: string;
  actividadEconomica?: string;
  nombreComercial?: string;
  contactoRecursosHumanos?: string;
  tipoAportantePagador?: string;
  totalEmpleados?: number;
}

export interface Empleado {
  id: string;
  cedula: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  salarioBase: number;
  ibc: number;
  tipoCotizante: string;
  eps: string;
  afp: string;
  ccf: string;
  arl: string;
  riesgoArl: 1 | 2 | 3 | 4 | 5;
  nivelRiesgoArl?: number;
  estado: string;
  estadoEps?: string;
  emailCotizante: string;
  telefonoCotizante: string;
  /** Teléfono fijo separado cuando el formulario lo solicita. */
  telefonoFijo?: string;

  // ── Campos expandidos para formularios SGSSS ──
  /** Primer apellido (desglosado) */
  primerApellido?: string;
  /** Segundo apellido (desglosado) */
  segundoApellido?: string;
  /** Primer nombre (desglosado) */
  primerNombre?: string;
  /** Segundo nombre (desglosado) */
  segundoNombre?: string;
  /** Sexo: 'F' = Femenino, 'M' = Masculino */
  sexo?: 'F' | 'M';
  /** Fecha de nacimiento (DD/MM/YYYY) */
  fechaNacimiento?: string;
  /** Etnia */
  etnia?: string;
  /** Comunidad étnica o indígena */
  comunidad?: string;
  /** Discapacidad */
  discapacidad?: string;
  /** Puntaje SISBÉN */
  puntajeSisben?: number;
  /** Grupo de población especial */
  grupoEspecial?: string;
  /** Condición de discapacidad o clasificación adicional solicitada por la entidad */
  condicion?: string;
  /** Dirección de residencia */
  direccion?: string;
  /** Barrio */
  barrio?: string;
  /** Zona: 'U' = Urbana, 'R' = Rural */
  zona?: 'U' | 'R';
  /** Ciudad / Municipio de residencia */
  ciudadResidencia?: string;
  /** Departamento de residencia */
  departamentoResidencia?: string;
  /** Código del municipio DANE */
  codigoMunicipio?: string;
  /** Código del departamento DANE */
  codigoDepartamento?: string;
  /** Código EPS */
  codigoEps?: string;
  /** Código tipo cotizante */
  tipoCotizanteCodigo?: string;
  /** Subtipo cotizante */
  subtipoCotizante?: string;
  /** IPS primaria y código seleccionados para los formularios que los soliciten */
  ipsSeleccionada?: string;
  codigoIps?: string;
  /** Identidad de género declarada para formularios que la soliciten. */
  identidadGenero?: string;
  /** Estado civil cuando la EPS lo solicita en su versión propia. */
  estadoCivil?: string;
  nacionalidad?: string;
  paisNacimiento?: string;
  departamentoNacimiento?: string;
  ciudadNacimiento?: string;
  paisExpedicion?: string;
  departamentoExpedicion?: string;
  ciudadExpedicion?: string;
  fechaExpedicion?: string;
  tipoResidencia?: string;
  localidadComuna?: string;
  tipoAfiliacion?: 'NUEVO' | 'NOVEDAD' | 'TRASLADO' | 'INCLUSION' | 'AFILIACION';
  empresaId?: string;
  firmaDigitalCotizante?: string;
  firmaDigitalEmpresa?: string;
  modalidadAfiliacion?: 'INDIVIDUAL' | 'COLECTIVA' | 'INSTITUCIONAL' | 'OFICIO';
  regimen?: 'CONTRIBUTIVO' | 'SUBSIDIADO';
  tipoAfiliado?: 'COTIZANTE' | 'CABEZA_FAMILIA' | 'BENEFICIARIO';
  codigoRegistroEps?: string;
  tipoNovedad?: string;
  movilidadRegimen?: 'CONTRIBUTIVO' | 'SUBSIDIADO' | '';
  trasladoRegimen?: 'MISMO_REGIMEN' | 'DIFERENTE_REGIMEN' | '';
  fechaNovedad?: string;
  epsAnterior?: string;
  motivoTraslado?: string;
  cajaCompensacionAnterior?: string;
  solicitudSat?: string;
  beneficiarios?: Beneficiario[];
  documentos?: DocumentoAdjunto[];
}

/** Persona a cargo incluida en una solicitud de afiliación. */
export interface Beneficiario {
  id: string;
  parentesco: string;
  tipoDocumento: string;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  fechaNacimiento: string;
  sexo?: 'F' | 'M';
  nacionalidad?: string;
  paisNacimiento?: string;
  departamentoNacimiento?: string;
  municipioNacimiento?: string;
  etnia?: string;
  discapacidad?: string;
  condicion?: string;
  municipio?: string;
  zona?: 'U' | 'R';
  departamento?: string;
  telefono?: string;
  valorUpc?: string;
  ipsSeleccionada?: string;
  codigoIps?: string;
  identidadGenero?: string;
  fechaExpedicion?: string;
}

/** Metadatos del soporte. El archivo permanece localmente en el navegador. */
export interface DocumentoAdjunto {
  id: string;
  nombre: string;
  tipo: string;
  tamanio: number;
  categoria: 'COTIZANTE' | 'CONYUGE' | 'BENEFICIARIO' | 'REGISTRO_CIVIL' | 'AUTORIZACION_TRASLADO' | 'RETIRO_EPS' | 'OTRO';
  beneficiarioId?: string;
  creadoEn: string;
}

export type TipoNovedad = 'IGE' | 'ATE' | 'LMA' | 'VAC' | 'SLN';

export interface Novedad {
  id: string;
  empleadoId: string;
  nombreEmpleado?: string;
  empleadoNombre?: string;
  empleadoDocumento?: string;
  tipo: TipoNovedad;
  fechaInicio: string;
  fechaFin: string;
  diasTotal: number;
  dias?: number;
  entidadEmisora?: string;
  entidadRadicada?: string;
  diagnosticoCie10?: string;
  descripcion?: string;
  numeroRadicado?: string;
  estadoRadicacion: string;
  estado?: string;
  valorSubsidioEstimado: number;
  montoLiquidado?: number;
}

export interface InconsistenciaPILA {
  id: string;
  empleadoId: string;
  nombreEmpleado: string;
  codigoRegla: string;
  descripcion: string;
  gravedad: 'ALTA' | 'MEDIA' | 'BAJA';
  sugerenciaCorreccion: string;
}

export interface PlanillaPILA {
  id: string;
  periodo: string;
  numeroPlanilla: string;
  tipoPlanilla?: string;
  totalCotizantes: number;
  valorSalud: number;
  valorPension: number;
  valorArl: number;
  valorCcf: number;
  totalAportes: number;
  totalIbc?: number;
  totalSalud?: number;
  totalPension?: number;
  totalArl?: number;
  totalCcf?: number;
  totalGeneral?: number;
  estadoPago: string;
  estado?: string;
  fechaLimitePago: string;
  fechaVencimiento?: string;
  fechaAuditoria?: string;
  inconsistencias?: InconsistenciaPILA[];
}

export interface UserSession {
  nombre: string;
  email: string;
  rol: 'Propietario' | 'Administrador' | 'Operador' | 'Auditor' | 'Líder SST' | 'Contador' | 'Empleado';
  empresaActual: Empresa;
}
