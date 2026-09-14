import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  MapPin,
  Briefcase,
  Building2,
  Users as UsersIcon,
  FileSignature,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  X,
  FileText,
  Check,
  ShieldCheck,
  CheckCircle,
  Building,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useValidum } from '../../context/ValidumContext';
import { Empleado, Empresa, Beneficiario, DocumentoAdjunto } from '../../types/validum';
import { eliminarSoporte, guardarSoporte } from '../../lib/documentStorage';
import { InteractiveFolioLayout } from '../folio/InteractiveFolioLayout';
import { EnhancedSignatureField } from '../folio/EnhancedSignatureField';

// ── Listas Maestras SGSSS ──
const DOCUMENT_TYPES = ['CC', 'CE', 'TI', 'RC', 'PA', 'PEP', 'PPT'];
const GENDER_IDENTITIES = ['FEMENINO', 'MASCULINO', 'TRANSGÉNERO', 'NO BINARIO', 'OTRO'];
const EPS_LIST = [
  'Sanitas', 'Nueva EPS', 'Salud Total', 'Salud Mía', 'Famisanar',
  'Compensar', 'Proteger EPS', 'SOS', 'Sura', 'Capital Salud',
  'Coosalud', 'Aliansalud', 'Mutual Ser', 'Savia Salud'
];
const ARL_LIST = ['Positiva', 'Sura', 'SURA', 'Colpatria', 'Alfa', 'Bolívar', 'Equidad', 'Liberty'];
const AFP_LIST = ['Porvenir', 'Protección', 'Colfondos', 'Skandia', 'Colpensiones', 'Fondo Solidario'];
const COMPANY_DOC_TYPES = ['NIT', 'CC', 'CE'];

const MOTIVOS_TRASLADO = [
  'Cambio de residencia a un municipio donde la EPS no tiene cobertura',
  'Insatisfacción con los servicios prestados por la EPS',
  'Libre elección de EPS por cumplimiento de permanencia mínima (1 año)',
  'Fusión, liquidación o revocatoria de autorización de la EPS',
  'Unificación del núcleo familiar en una misma EPS',
  'Otro motivo contemplado en la ley'
];

const NOVEDADES_SGSSS = [
  ['MODIFICACION_DATOS', 'Modificación de datos básicos'],
  ['CORRECCION_DATOS', 'Corrección de datos básicos'],
  ['ACTUALIZACION_DOCUMENTO', 'Actualización del documento de identidad'],
  ['ACTUALIZACION_COMPLEMENTARIOS', 'Actualización de datos complementarios'],
  ['TERMINACION_INSCRIPCION', 'Terminación de inscripción en la EPS'],
  ['REINSCRIPCION', 'Reinscripción en la EPS'],
  ['INCLUSION_BENEFICIARIOS', 'Inclusión de beneficiarios'],
  ['EXCLUSION_BENEFICIARIOS', 'Exclusión de beneficiarios'],
  ['INICIO_RELACION', 'Inicio de relación laboral'],
  ['TERMINACION_RELACION', 'Terminación de relación laboral'],
  ['MOVILIDAD', 'Movilidad entre regímenes'],
  ['FALLECIMIENTO', 'Fallecimiento'],
  ['PROTECCION_CESANTE', 'Protección al cesante'],
  ['PREPENSIONADO', 'Prepensionado'],
  ['PENSIONADO', 'Pensionado'],
] as const;

export interface FolioFormData {
  // Sección 1: Persona
  tipoDocumento: string;
  cedula: string;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  sexo: 'F' | 'M';
  identidadGenero: string;
  nacionalidad: string;
  fechaNacimiento: string;

  // Sección 2: Residencia & IPS
  eps: string;
  paisNacimiento: string;
  departamentoNacimiento: string;
  ciudadNacimiento: string;
  paisExpedicion: string;
  departamentoExpedicion: string;
  ciudadExpedicion: string;
  fechaExpedicion: string;
  departamentoResidencia: string;
  ciudadResidencia: string;
  direccion: string;
  barrio: string;
  residenciaZona: 'CABECERA MUNICIPAL (U)' | 'RURAL (R)';
  telefonoCotizante: string;
  emailCotizante: string;
  ipsSeleccionada: string;
  codigoIps: string;

  // Sección 3: Datos Laborales
  tipoAfiliacion: 'NUEVO' | 'NOVEDAD' | 'TRASLADO' | 'INCLUSION';
  tipoNovedad: string;
  tipoCotizante: 'DEPENDIENTE' | 'INDEPENDIENTE';
  solicitudSat: 'NO' | 'SÍ';
  arl: string;
  afp: string;
  salarioBase: number;
  cargo: string;
  fechaIngreso: string;
  epsAnterior: string;
  motivoTraslado: string;

  // Sección 4: Empresa
  empresaId?: string;
  empresaTipoDoc: string;
  empresaNumeroDoc: string;
  empresaDv: string;
  empresaRazonSocial: string;
  empresaDepartamento: string;
  empresaCiudad: string;
  empresaDireccion: string;
  empresaTelefono: string;
  empresaCorreo: string;
  empresaContactoRRHH: string;

  // Sección 5: Beneficiarios
  beneficiarios: Beneficiario[];

  // Sección 6: Firmas
  firmaDigitalCotizante: string;
  firmaDigitalEmpresa: string;
  /** Soportes ya guardados, necesarios para conservarlos al editar un expediente. */
  documentos?: DocumentoAdjunto[];
}

type DocumentoPendiente = { meta: DocumentoAdjunto; file: File };

interface AffiliationFolioFormProps {
  initialData?: Partial<FolioFormData>;
  initialEmployeeId?: string | null;
  onClose?: () => void;
  onSuccess?: (savedEmpleado: Empleado) => void;
}

const SECTIONS = [
  { id: 'persona', label: 'Persona', shortLabel: 'Persona', icon: User, desc: 'Identidad y nacimiento' },
  { id: 'entidad', label: 'Residencia & IPS', shortLabel: 'Entidad', icon: MapPin, desc: 'Ubicación y cobertura' },
  { id: 'laboral', label: 'Datos Laborales', shortLabel: 'Laboral', icon: Briefcase, desc: 'Novedad y cotización' },
  { id: 'empresa', label: 'Empresa', shortLabel: 'Empresa', icon: Building2, desc: 'Aportante y NIT' },
  { id: 'beneficiarios', label: 'Beneficiarios', shortLabel: 'Beneficiarios', icon: UsersIcon, desc: 'Núcleo familiar' },
  { id: 'documentos', label: 'Documentos & Firmas', shortLabel: 'Documentos', icon: FileSignature, desc: 'Soportes y firmas' }
];

export const AffiliationFolioForm: React.FC<AffiliationFolioFormProps> = ({
  initialData,
  initialEmployeeId,
  onClose,
  onSuccess
}) => {
  const { empresa, empresas, empleados, addEmpleado, updateEmpleado, setEmpresa } = useValidum();
  const [activeSection, setActiveSection] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);

  // Documentos adjuntos
  const [documentos, setDocumentos] = useState<DocumentoAdjunto[]>(initialData?.documentos || []);
  const [pendientes, setPendientes] = useState<DocumentoPendiente[]>([]);
  const [removedDocumentIds, setRemovedDocumentIds] = useState<string[]>([]);

  // Estado del Formulario
  const [form, setForm] = useState<FolioFormData>(() => ({
    tipoDocumento: initialData?.tipoDocumento || 'CC',
    cedula: initialData?.cedula || '',
    primerNombre: initialData?.primerNombre || '',
    segundoNombre: initialData?.segundoNombre || '',
    primerApellido: initialData?.primerApellido || '',
    segundoApellido: initialData?.segundoApellido || '',
    sexo: initialData?.sexo || 'F',
    identidadGenero: initialData?.identidadGenero || (initialData?.sexo === 'M' ? 'MASCULINO' : 'FEMENINO'),
    nacionalidad: initialData?.nacionalidad || 'COLOMBIANA',
    fechaNacimiento: initialData?.fechaNacimiento || '',

    eps: initialData?.eps || 'Sanitas',
    paisNacimiento: initialData?.paisNacimiento || 'COLOMBIA',
    departamentoNacimiento: initialData?.departamentoNacimiento || '',
    ciudadNacimiento: initialData?.ciudadNacimiento || '',
    paisExpedicion: initialData?.paisExpedicion || 'COLOMBIA',
    departamentoExpedicion: initialData?.departamentoExpedicion || '',
    ciudadExpedicion: initialData?.ciudadExpedicion || '',
    fechaExpedicion: initialData?.fechaExpedicion || '',
    departamentoResidencia: initialData?.departamentoResidencia || '',
    ciudadResidencia: initialData?.ciudadResidencia || '',
    direccion: initialData?.direccion || '',
    barrio: initialData?.barrio || '',
    residenciaZona: initialData?.residenciaZona || 'CABECERA MUNICIPAL (U)',
    telefonoCotizante: initialData?.telefonoCotizante || '',
    emailCotizante: initialData?.emailCotizante || '',
    ipsSeleccionada: initialData?.ipsSeleccionada || '',
    codigoIps: initialData?.codigoIps || '',

    tipoAfiliacion: initialData?.tipoAfiliacion || 'NUEVO',
    tipoNovedad: initialData?.tipoNovedad || 'MODIFICACION_DATOS',
    tipoCotizante: initialData?.tipoCotizante || 'DEPENDIENTE',
    solicitudSat: initialData?.solicitudSat || 'NO',
    arl: initialData?.arl || empresa?.arl || 'Positiva',
    afp: initialData?.afp || 'Porvenir',
    salarioBase: initialData?.salarioBase || 1750905,
    cargo: initialData?.cargo || '',
    fechaIngreso: initialData?.fechaIngreso || new Date().toISOString().split('T')[0],
    epsAnterior: initialData?.epsAnterior || '',
    motivoTraslado: initialData?.motivoTraslado || MOTIVOS_TRASLADO[0],

    empresaId: initialData?.empresaId || empresa?.id || '',
    empresaTipoDoc: initialData?.empresaTipoDoc || empresa?.tipoDocumento || 'NIT',
    empresaNumeroDoc: initialData?.empresaNumeroDoc || empresa?.nit || '',
    empresaDv: initialData?.empresaDv ?? empresa?.dv ?? '',
    empresaRazonSocial: initialData?.empresaRazonSocial || empresa?.razonSocial || '',
    empresaDepartamento: initialData?.empresaDepartamento || empresa?.departamento || '',
    empresaCiudad: initialData?.empresaCiudad || empresa?.ciudad || '',
    empresaDireccion: initialData?.empresaDireccion || empresa?.direccion || '',
    empresaTelefono: initialData?.empresaTelefono || empresa?.telefono || '',
    empresaCorreo: initialData?.empresaCorreo || empresa?.email || empresa?.emailContacto || '',
    empresaContactoRRHH: initialData?.empresaContactoRRHH || empresa?.contactoRecursosHumanos || '',

    beneficiarios: initialData?.beneficiarios || [],
    firmaDigitalCotizante: initialData?.firmaDigitalCotizante || '',
    firmaDigitalEmpresa: initialData?.firmaDigitalEmpresa || ''
  }));

  const update = <K extends keyof FolioFormData>(key: K, value: FolioFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // Cálculo de progreso de cada sección
  const sectionProgress = useMemo(() => {
    const p1Valid = Boolean(form.cedula && form.primerNombre && form.primerApellido && form.fechaNacimiento);
    const p2Valid = Boolean(form.eps && form.direccion && form.telefonoCotizante && form.emailCotizante);
    const p3Valid = Boolean(form.cargo && form.salarioBase > 0 && form.fechaIngreso && (form.tipoAfiliacion !== 'TRASLADO' || form.epsAnterior));
    const p4Valid = Boolean(form.empresaNumeroDoc && form.empresaRazonSocial);
    // Los beneficiarios son opcionales; una lista vacía también es una sección válida.
    const p5Valid = true;
    const p6Valid = Boolean(form.firmaDigitalCotizante);

    return [
      p1Valid ? 100 : form.cedula || form.primerNombre ? 50 : 0,
      p2Valid ? 100 : form.direccion || form.telefonoCotizante ? 50 : 0,
      p3Valid ? 100 : form.cargo ? 50 : 0,
      p4Valid ? 100 : form.empresaNumeroDoc ? 60 : 0,
      p5Valid ? 100 : 50,
      p6Valid ? 100 : form.firmaDigitalCotizante ? 50 : 0
    ];
  }, [form]);

  // Selección de empresa guardada
  const handleCompanySelect = (id: string) => {
    if (!id) {
      setForm(prev => ({
        ...prev,
        empresaId: undefined,
        empresaTipoDoc: 'NIT',
        empresaNumeroDoc: '',
        empresaDv: '',
        empresaRazonSocial: '',
        empresaDepartamento: '',
        empresaCiudad: '',
        empresaDireccion: '',
        empresaTelefono: '',
        empresaCorreo: '',
        empresaContactoRRHH: '',
      }));
      return;
    }
    const selected = empresas.find(e => e.id === id);
    if (!selected) return;
    setForm(prev => ({
      ...prev,
      empresaId: selected.id,
      empresaTipoDoc: selected.tipoDocumento || 'NIT',
      empresaNumeroDoc: selected.nit,
      empresaDv: selected.dv || '',
      empresaRazonSocial: selected.razonSocial,
      empresaDepartamento: selected.departamento || '',
      empresaCiudad: selected.ciudad || '',
      empresaDireccion: selected.direccion || '',
      empresaTelefono: selected.telefono || '',
      empresaCorreo: selected.email || selected.emailContacto || '',
      empresaContactoRRHH: selected.contactoRecursosHumanos || '',
      arl: selected.arl || prev.arl
    }));
  };

  // Manejo de Beneficiarios
  const addBeneficiary = () => {
    const newBen: Beneficiario = {
      id: crypto.randomUUID(),
      parentesco: 'CONYUGE',
      tipoDocumento: 'CC',
      numeroDocumento: '',
      primerNombre: '',
      primerApellido: '',
      fechaNacimiento: '',
      sexo: 'F',
      identidadGenero: 'FEMENINO',
      nacionalidad: 'COLOMBIANA',
      paisNacimiento: 'COLOMBIA'
    };
    update('beneficiarios', [...form.beneficiarios, newBen]);
  };

  const updateBeneficiary = (index: number, key: keyof Beneficiario, value: string) => {
    const list = [...form.beneficiarios];
    list[index] = { ...list[index], [key]: value };
    update('beneficiarios', list);
  };

  const removeBeneficiary = (index: number) => {
    update('beneficiarios', form.beneficiarios.filter((_, i) => i !== index));
  };

  // Manejo de archivos
  const addFile = (files: FileList | null, categoria: DocumentoAdjunto['categoria']) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowedTypes = new Set(['application/pdf', 'image/png', 'image/jpeg']);
    if (!allowedTypes.has(file.type)) {
      alert('El soporte debe ser un archivo PDF, PNG o JPEG.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert('El soporte supera el tamaño máximo permitido de 25 MB.');
      return;
    }
    const previous = documentos.find(item => item.categoria === categoria);
    const previousWasPending = previous && pendientes.some(item => item.meta.id === previous.id);
    if (previous && !previousWasPending) {
      setRemovedDocumentIds(current => current.includes(previous.id) ? current : [...current, previous.id]);
    }
    const meta: DocumentoAdjunto = {
      id: crypto.randomUUID(),
      nombre: file.name,
      tipo: file.type,
      tamanio: file.size,
      categoria,
      creadoEn: new Date().toISOString()
    };
    setDocumentos(prev => [...prev.filter(d => d.categoria !== categoria), meta]);
    setPendientes(prev => [...prev.filter(p => p.meta.categoria !== categoria), { meta, file }]);
  };

  const removeFile = (categoria: DocumentoAdjunto['categoria']) => {
    const existing = documentos.find(item => item.categoria === categoria);
    if (!existing) return;
    const wasPending = pendientes.some(item => item.meta.id === existing.id);
    if (!wasPending) {
      setRemovedDocumentIds(current => current.includes(existing.id) ? current : [...current, existing.id]);
    }
    setDocumentos(current => current.filter(item => item.id !== existing.id));
    setPendientes(current => current.filter(item => item.meta.id !== existing.id));
  };

  // Guardar Radicación Folio con validación exhaustiva
  const handleSaveFolio = async () => {
    // 1. Validación Solapa 1: Persona
    if (!form.cedula.trim()) {
      alert('⚠️ Campo requerido: Digite el número de documento de identidad en la solapa "Persona".');
      setActiveSection(0);
      return;
    }
    if (!form.primerNombre.trim() || !form.primerApellido.trim()) {
      alert('⚠️ Campos requeridos: Ingrese el primer nombre y primer apellido en la solapa "Persona".');
      setActiveSection(0);
      return;
    }
    if (!form.fechaNacimiento) {
      alert('⚠️ Campo requerido: Seleccione la fecha de nacimiento en la solapa "Persona".');
      setActiveSection(0);
      return;
    }

    // 2. Validación Solapa 2: Residencia & IPS
    if (!form.direccion.trim()) {
      alert('⚠️ Campo requerido: Digite la dirección de residencia en la solapa "Residencia & IPS".');
      setActiveSection(1);
      return;
    }
    if (!form.telefonoCotizante.trim()) {
      alert('⚠️ Campo requerido: Digite un teléfono de contacto en la solapa "Residencia & IPS".');
      setActiveSection(1);
      return;
    }

    // 3. Validación Solapa 3: Datos Laborales
    if (!form.cargo.trim()) {
      alert('⚠️ Campo requerido: Ingrese el cargo u ocupación en la solapa "Datos Laborales".');
      setActiveSection(2);
      return;
    }
    if (form.tipoAfiliacion === 'TRASLADO' && !form.epsAnterior.trim()) {
      alert('⚠️ Campo requerido: Indique la EPS anterior para el trámite de traslado en "Datos Laborales".');
      setActiveSection(2);
      return;
    }

    const incompleteBeneficiary = form.beneficiarios.find(beneficiary =>
      !beneficiary.tipoDocumento ||
      !beneficiary.numeroDocumento.trim() ||
      !beneficiary.primerNombre.trim() ||
      !beneficiary.primerApellido.trim() ||
      !beneficiary.fechaNacimiento
    );
    if (incompleteBeneficiary) {
      alert('⚠️ Completa documento, nombre, apellido y fecha de nacimiento de cada beneficiario agregado.');
      setActiveSection(4);
      return;
    }

    // 4. Validación Solapa 4: Empresa
    if (!form.empresaNumeroDoc.trim() || !form.empresaRazonSocial.trim()) {
      alert('⚠️ Campos requeridos: Indique el NIT y Razón Social de la empresa aportante en la solapa "Empresa".');
      setActiveSection(3);
      return;
    }

    // 5. Validación Solapa 6: Firmas Digitales
    if (!form.firmaDigitalCotizante) {
      alert('⚠️ Firma requerida: El cotizante / afiliado debe firmar digitalmente en la solapa "Documentos & Firmas".');
      setActiveSection(5);
      return;
    }

    setIsSaving(true);
    const savedPendingIds: string[] = [];
    let employeeCommitted = false;
    try {
      let resolvedEmpresaId = form.empresaId;
      if (form.empresaNumeroDoc.trim()) {
        const nitClean = form.empresaNumeroDoc.trim();
        const existingComp = empresas.find(e => e.id === form.empresaId) || empresas.find(e => e.nit === nitClean);
        const compPayload: Empresa = {
          id: existingComp?.id || resolvedEmpresaId || `emp-${crypto.randomUUID()}`,
          nit: nitClean,
          dv: form.empresaDv.trim() || existingComp?.dv || '',
          razonSocial: form.empresaRazonSocial.trim(),
          direccion: form.empresaDireccion.trim(),
          ciudad: form.empresaCiudad.trim(),
          departamento: form.empresaDepartamento.trim(),
          telefono: form.empresaTelefono || '',
          email: form.empresaCorreo || '',
          emailContacto: form.empresaCorreo || '',
          contactoRecursosHumanos: form.empresaContactoRRHH || '',
          operadorPila: existingComp?.operadorPila || 'Aportes en Línea',
          arl: (form.arl as Empresa['arl']) || 'Positiva',
          nivelRiesgoArl: existingComp?.nivelRiesgoArl || 1,
          representanteLegal: existingComp?.representanteLegal || '',
          cedulaRepresentante: existingComp?.cedulaRepresentante || '',
          tipoDocumento: form.empresaTipoDoc || 'NIT',
          actividadEconomica: existingComp?.actividadEconomica,
          nombreComercial: existingComp?.nombreComercial,
          tipoAportantePagador: existingComp?.tipoAportantePagador,
          claseRiesgoPrincipal: existingComp?.claseRiesgoPrincipal,
          totalEmpleados: existingComp?.totalEmpleados,
        };

        await setEmpresa(compPayload);
        resolvedEmpresaId = compPayload.id;
      }

      const empleadoId = initialEmployeeId || crypto.randomUUID();
      const existingEmployee = initialEmployeeId ? empleados.find(item => item.id === initialEmployeeId) : undefined;

      // Los archivos deben existir antes de que el expediente los referencie. Si algo
      // posterior falla, se eliminan únicamente los archivos creados en este intento.
      for (const item of pendientes) {
        await guardarSoporte(item.meta.id, item.file);
        savedPendingIds.push(item.meta.id);
      }

      const empleadoPayload: Empleado = {
        ...(existingEmployee || {}),
        id: empleadoId,
        cedula: form.cedula.trim(),
        tipoDocumento: form.tipoDocumento,
        numeroDocumento: form.cedula.trim(),
        nombres: `${form.primerNombre.trim()} ${form.segundoNombre.trim()}`.trim(),
        apellidos: `${form.primerApellido.trim()} ${form.segundoApellido.trim()}`.trim(),
        primerNombre: form.primerNombre.trim(),
        segundoNombre: form.segundoNombre.trim(),
        primerApellido: form.primerApellido.trim(),
        segundoApellido: form.segundoApellido.trim(),
        sexo: form.sexo,
        identidadGenero: form.identidadGenero,
        nacionalidad: form.nacionalidad,
        fechaNacimiento: form.fechaNacimiento,

        eps: form.eps,
        paisNacimiento: form.paisNacimiento,
        departamentoNacimiento: form.departamentoNacimiento,
        ciudadNacimiento: form.ciudadNacimiento,
        paisExpedicion: form.paisExpedicion,
        departamentoExpedicion: form.departamentoExpedicion,
        ciudadExpedicion: form.ciudadExpedicion,
        fechaExpedicion: form.fechaExpedicion,
        departamentoResidencia: form.departamentoResidencia,
        ciudadResidencia: form.ciudadResidencia,
        direccion: form.direccion,
        barrio: form.barrio,
        zona: form.residenciaZona === 'CABECERA MUNICIPAL (U)' ? 'U' : 'R',
        telefonoCotizante: form.telefonoCotizante,
        emailCotizante: form.emailCotizante,
        ipsSeleccionada: form.ipsSeleccionada,
        codigoIps: form.codigoIps,

        tipoAfiliacion: form.tipoAfiliacion,
        tipoCotizante: form.tipoCotizante,
        solicitudSat: form.solicitudSat,
        arl: form.arl,
        afp: form.afp,
        salarioBase: Number(form.salarioBase) || 1750905,
        ibc: Number(form.salarioBase) || 1750905,
        cargo: form.cargo,
        fechaIngreso: form.fechaIngreso,
        epsAnterior: form.epsAnterior,
        motivoTraslado: form.motivoTraslado,
        tipoNovedad: form.tipoAfiliacion === 'TRASLADO'
          ? 'TRASLADO'
          : form.tipoAfiliacion === 'INCLUSION'
            ? 'INCLUSION_BENEFICIARIOS'
            : form.tipoAfiliacion === 'NUEVO'
              ? 'INICIO_RELACION'
              : form.tipoNovedad,

        empresaId: resolvedEmpresaId,
        beneficiarios: form.beneficiarios,
        documentos: documentos,
        firmaDigitalCotizante: form.firmaDigitalCotizante,
        firmaDigitalEmpresa: form.firmaDigitalEmpresa,

        ccf: existingEmployee?.ccf || 'Compensar',
        departamento: form.departamentoResidencia || existingEmployee?.departamento || '',
        riesgoArl: existingEmployee?.riesgoArl || 1,
        estado: existingEmployee?.estado || 'ACTIVO',
        estadoEps: existingEmployee?.estadoEps || 'RADICADO'
      };

      if (initialEmployeeId) {
        await updateEmpleado(initialEmployeeId, empleadoPayload);
      } else {
        await addEmpleado(empleadoPayload);
      }
      employeeCommitted = true;

      await Promise.allSettled(removedDocumentIds.map(id => eliminarSoporte(id)));

      if (onSuccess) {
        onSuccess(empleadoPayload);
      } else if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error al radicar folio:', error);
      if (!employeeCommitted) {
        await Promise.allSettled(savedPendingIds.map(id => eliminarSoporte(id)));
      }
      alert('Ocurrió un error al guardar el expediente.');
    } finally {
      setIsSaving(false);
    }
  };

  const goToSection = (nextIdx: number) => {
    setDirection(nextIdx > activeSection ? 1 : -1);
    setActiveSection(nextIdx);
  };

  return (
    <InteractiveFolioLayout
      title="Documento folio"
      subtitle={`Sección ${activeSection + 1} de ${SECTIONS.length}: ${SECTIONS[activeSection].label} — ${SECTIONS[activeSection].desc}`}
      documentCode={`EXP-SGSSS-${new Date().getFullYear()}`}
      statusText="Listo para radicar"
      tabs={SECTIONS}
      activeTab={activeSection}
      onTabChange={goToSection}
      sectionProgress={sectionProgress}
      onClose={onClose}
      summaryCard={
        <div className="rounded-2xl border border-slate-800/80 bg-[#070e17] p-3.5 text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Trámite actual:</span>
            <span className="font-bold text-cyan-300">{form.tipoAfiliacion}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>EPS seleccionada:</span>
            <span className="font-bold text-[#c4d600]">{form.eps}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Beneficiarios:</span>
            <span className="font-mono font-bold text-white">{form.beneficiarios.length}</span>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={activeSection === 0}
            onClick={() => goToSection(activeSection - 1)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>

          <div className="flex items-center gap-2.5">
            {activeSection < SECTIONS.length - 1 ? (
              <button
                type="button"
                onClick={() => goToSection(activeSection + 1)}
                className="flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-cyan-300 transition-all active:scale-95"
              >
                Continuar <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveFolio}
                className="flex items-center gap-2 rounded-xl bg-[#c4d600] px-7 py-3 text-xs font-black text-[#0b132b] shadow-xl hover:bg-[#d6e800] transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isSaving ? 'Radicando...' : 'Radicar y Guardar Folio'}
              </button>
            )}
          </div>
        </div>
      }
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={activeSection}
          custom={direction}
                    initial={{ opacity: 0, x: direction * 25 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -25 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="w-full"
                  >
                    
                    {/* ══════════════════════════════════════════════════════
                        SECCIÓN 1: PERSONA (Datos de identidad y nacimiento)
                       ══════════════════════════════════════════════════════ */}
                    {activeSection === 0 && (
                      <div className="grid gap-5 md:grid-cols-2">
                        {/* Cuadrante 1: Identificación */}
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-cyan-800">
                              Identificación
                            </span>
                            <User className="h-4 w-4 text-cyan-600" />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              Tipo documento *
                              <select
                                value={form.tipoDocumento}
                                onChange={e => update('tipoDocumento', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                              >
                                {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Número documento *
                              <input
                                value={form.cedula}
                                onChange={e => update('cedula', e.target.value)}
                                placeholder="DIGITE NÚMERO"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              Sexo biológico *
                              <select
                                value={form.sexo}
                                onChange={e => update('sexo', e.target.value as 'F' | 'M')}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="F">Femenino (F)</option>
                                <option value="M">Masculino (M)</option>
                              </select>
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Identidad género
                              <select
                                value={form.identidadGenero}
                                onChange={e => update('identidadGenero', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                              >
                                {GENDER_IDENTITIES.map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                            </label>
                          </div>
                        </div>

                        {/* Cuadrante 2: Nombres y Apellidos */}
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-cyan-800">
                              Nombres y Apellidos
                            </span>
                            <FileText className="h-4 w-4 text-cyan-600" />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              Primer nombre *
                              <input
                                value={form.primerNombre}
                                onChange={e => update('primerNombre', e.target.value)}
                                placeholder="DIGITE PRIMER NOMBRE"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-slate-600">
                              Segundo nombre
                              <input
                                value={form.segundoNombre}
                                onChange={e => update('segundoNombre', e.target.value)}
                                placeholder="OPCIONAL"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              Primer apellido *
                              <input
                                value={form.primerApellido}
                                onChange={e => update('primerApellido', e.target.value)}
                                placeholder="DIGITE PRIMER APELLIDO"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-slate-600">
                              Segundo apellido
                              <input
                                value={form.segundoApellido}
                                onChange={e => update('segundoApellido', e.target.value)}
                                placeholder="OPCIONAL"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Cuadrante 3: Nacimiento */}
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-slate-700">
                              Nacimiento
                            </span>
                            <Calendar className="h-4 w-4 text-slate-500" />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              Fecha nacimiento *
                              <input
                                type="date"
                                value={form.fechaNacimiento}
                                onChange={e => update('fechaNacimiento', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              País nacimiento
                              <input
                                value={form.paisNacimiento}
                                onChange={e => update('paisNacimiento', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Nacionalidad
                              <input
                                value={form.nacionalidad}
                                onChange={e => update('nacionalidad', e.target.value)}
                                placeholder="COLOMBIANA"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              Departamento nac.
                              <input
                                value={form.departamentoNacimiento}
                                onChange={e => update('departamentoNacimiento', e.target.value)}
                                placeholder="Departamento"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-slate-600">
                              Ciudad nac.
                              <input
                                value={form.ciudadNacimiento}
                                onChange={e => update('ciudadNacimiento', e.target.value)}
                                placeholder="Ciudad / Municipio"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Cuadrante 4: Expedición de documento */}
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-slate-700">
                              Expedición Documento
                            </span>
                            <CheckCircle2 className="h-4 w-4 text-slate-500" />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              Fecha expedición
                              <input
                                type="date"
                                value={form.fechaExpedicion}
                                onChange={e => update('fechaExpedicion', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              País expedición
                              <input
                                value={form.paisExpedicion}
                                onChange={e => update('paisExpedicion', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              Departamento exp.
                              <input
                                value={form.departamentoExpedicion}
                                onChange={e => update('departamentoExpedicion', e.target.value)}
                                placeholder="Departamento"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-slate-600">
                              Ciudad expedición
                              <input
                                value={form.ciudadExpedicion}
                                onChange={e => update('ciudadExpedicion', e.target.value)}
                                placeholder="Ciudad / Municipio"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        SECCIÓN 2: RESIDENCIA & IPS (Ubicación, contacto y entidad)
                       ══════════════════════════════════════════════════════ */}
                    {activeSection === 1 && (
                      <div className="grid gap-5 md:grid-cols-2">
                        {/* Entidad de Salud (EPS) */}
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-cyan-800">
                              Entidad de Salud
                            </span>
                            <ShieldCheck className="h-4 w-4 text-cyan-600" />
                          </div>

                          <label className="block text-xs font-semibold text-slate-600">
                            EPS Destino de la Solicitud *
                            <select
                              value={form.eps}
                              onChange={e => update('eps', e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                            >
                              {EPS_LIST.map(eps => <option key={eps} value={eps}>{eps}</option>)}
                            </select>
                          </label>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              IPS Primaria asignada
                              <input
                                value={form.ipsSeleccionada}
                                onChange={e => update('ipsSeleccionada', e.target.value)}
                                placeholder="Nombre centro de atención"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-slate-600">
                              Código IPS (MinSalud)
                              <input
                                value={form.codigoIps}
                                onChange={e => update('codigoIps', e.target.value)}
                                placeholder="Opcional"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Contacto Directo */}
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-cyan-800">
                              Contacto del Cotizante
                            </span>
                            <MapPin className="h-4 w-4 text-cyan-600" />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              Teléfono celular *
                              <input
                                value={form.telefonoCotizante}
                                onChange={e => update('telefonoCotizante', e.target.value)}
                                placeholder="300 123 4567"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Correo electrónico *
                              <input
                                type="email"
                                value={form.emailCotizante}
                                onChange={e => update('emailCotizante', e.target.value)}
                                placeholder="correo@ejemplo.com"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>

                          <label className="block text-xs font-semibold text-slate-600">
                            Zona de residencia *
                            <select
                              value={form.residenciaZona}
                              onChange={e => update('residenciaZona', e.target.value as FolioFormData['residenciaZona'])}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                            >
                              <option value="CABECERA MUNICIPAL (U)">Cabecera Municipal (Urbana)</option>
                              <option value="RURAL (R)">Rural (R)</option>
                            </select>
                          </label>
                        </div>

                        {/* Dirección y Ubicación Domiciliaria */}
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-4 md:col-span-2">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-slate-700">
                              Dirección de Domicilio
                            </span>
                            <MapPin className="h-4 w-4 text-slate-500" />
                          </div>

                          <div className="grid gap-3 md:grid-cols-4">
                            <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
                              Dirección completa *
                              <input
                                value={form.direccion}
                                onChange={e => update('direccion', e.target.value)}
                                placeholder="Ej: Carrera 15 # 85-32 Apto 401"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Barrio *
                              <input
                                value={form.barrio}
                                onChange={e => update('barrio', e.target.value)}
                                placeholder="Nombre barrio"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Ciudad residencia *
                              <input
                                value={form.ciudadResidencia}
                                onChange={e => update('ciudadResidencia', e.target.value)}
                                placeholder="Ciudad"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        SECCIÓN 3: DATOS LABORALES (Tipo de novedad, cargo, salario)
                       ══════════════════════════════════════════════════════ */}
                    {activeSection === 2 && (
                      <div className="space-y-5">
                        {/* Selector de Trámite / Novedad */}
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Naturaleza del trámite SGSSS *
                          </span>
                          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                            {(['NUEVO', 'TRASLADO', 'NOVEDAD', 'INCLUSION'] as const).map(tipo => {
                              const isSelected = form.tipoAfiliacion === tipo;
                              return (
                                <button
                                  key={tipo}
                                  type="button"
                                  onClick={() => update('tipoAfiliacion', tipo)}
                                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-extrabold transition-all ${
                                    isSelected
                                      ? 'bg-slate-900 text-[#c4d600] shadow-md ring-2 ring-slate-900'
                                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {tipo === 'NUEVO' && 'Ingreso Nuevo'}
                                  {tipo === 'TRASLADO' && 'Traslado EPS'}
                                  {tipo === 'NOVEDAD' && 'Novedad'}
                                  {tipo === 'INCLUSION' && 'Inclusión'}
                                  {isSelected && <Check className="h-3.5 w-3.5" />}
                                </button>
                              );
                            })}
                          </div>

                          {/* Animación condicional para TRASLADO */}
                          <AnimatePresence>
                            {form.tipoAfiliacion === 'TRASLADO' && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mt-4 overflow-hidden rounded-xl border border-cyan-200 bg-cyan-50/50 p-4"
                              >
                                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-cyan-900">
                                  <Clock className="h-4 w-4 text-cyan-600" />
                                  <span>Parámetros obligatorios de Traslado entre EPS</span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <label className="block text-xs font-semibold text-slate-700">
                                    EPS Anterior *
                                    <select
                                      value={form.epsAnterior}
                                      onChange={e => update('epsAnterior', e.target.value)}
                                      className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                    >
                                      <option value="">Seleccione EPS de origen...</option>
                                      {EPS_LIST.filter(e => e !== form.eps).map(eps => (
                                        <option key={eps} value={eps}>{eps}</option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="block text-xs font-semibold text-slate-700">
                                    Motivo legal de traslado *
                                    <select
                                      value={form.motivoTraslado}
                                      onChange={e => update('motivoTraslado', e.target.value)}
                                      className="mt-1 w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                    >
                                      {MOTIVOS_TRASLADO.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {form.tipoAfiliacion === 'NOVEDAD' && (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <label className="block text-xs font-semibold text-slate-700">
                                Tipo específico de novedad *
                                <select
                                  value={form.tipoNovedad}
                                  onChange={e => update('tipoNovedad', e.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                >
                                  {NOVEDADES_SGSSS.map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Administradoras y Salario */}
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-3">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Administradoras
                            </span>

                            <label className="block text-xs font-semibold text-slate-600">
                              ARL Asignada *
                              <select
                                value={form.arl}
                                onChange={e => update('arl', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              >
                                {ARL_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                              </select>
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Fondo de Pensiones (AFP) *
                              <select
                                value={form.afp}
                                onChange={e => update('afp', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              >
                                {AFP_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </label>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-3">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Condiciones Laborales
                            </span>

                            <label className="block text-xs font-semibold text-slate-600">
                              Tipo de Cotizante *
                              <select
                                value={form.tipoCotizante}
                                onChange={e => update('tipoCotizante', e.target.value as FolioFormData['tipoCotizante'])}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              >
                                <option value="DEPENDIENTE">Dependiente (Empleado)</option>
                                <option value="INDEPENDIENTE">Independiente</option>
                              </select>
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Cargo a desempeñar *
                              <input
                                value={form.cargo}
                                onChange={e => update('cargo', e.target.value)}
                                placeholder="Ej: Analista de Operaciones"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-3">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Compensación & Fechas
                            </span>

                            <label className="block text-xs font-semibold text-slate-600">
                              Salario Base / IBC Mensual *
                              <div className="relative mt-1">
                                <DollarSign className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <input
                                  type="number"
                                  min="0"
                                  value={form.salarioBase}
                                  onChange={e => update('salarioBase', Number(e.target.value))}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-8 pr-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                                />
                              </div>
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Fecha efectiva de ingreso *
                              <input
                                type="date"
                                value={form.fechaIngreso}
                                onChange={e => update('fechaIngreso', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        SECCIÓN 4: EMPRESA (NIT, Razón Social, Aportante)
                       ══════════════════════════════════════════════════════ */}
                    {activeSection === 3 && (
                      <div className="space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                          <div>
                            <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-cyan-800">
                              Empresa Aportante
                            </span>
                            <p className="mt-1 text-xs text-slate-500">
                              Puedes seleccionar una empresa guardada o digitar una nueva para que se archive automáticamente.
                            </p>
                          </div>

                          {empresas.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">Cargar:</span>
                              <select
                                value={form.empresaId || ''}
                                onChange={e => handleCompanySelect(e.target.value)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              >
                                <option value="">+ Registrar una empresa nueva</option>
                                {empresas.map(emp => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.razonSocial} (NIT: {emp.nit})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-3">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Identificación Tributaria
                            </span>

                            <label className="block text-xs font-semibold text-slate-600">
                              Tipo documento
                              <select
                                value={form.empresaTipoDoc}
                                onChange={e => update('empresaTipoDoc', e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              >
                                {COMPANY_DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Número NIT / Documento *
                              <input
                                value={form.empresaNumeroDoc}
                                onChange={e => {
                                  const val = e.target.value;
                                  const match = empresas.find(item => item.nit === val.trim());
                                  if (match) {
                                    handleCompanySelect(match.id!);
                                  } else {
                                    setForm(current => ({ ...current, empresaId: undefined, empresaNumeroDoc: val }));
                                  }
                                }}
                                placeholder="Ej: 901234567"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Dígito de verificación
                              <input
                                value={form.empresaDv}
                                maxLength={1}
                                inputMode="numeric"
                                onChange={e => update('empresaDv', e.target.value.replace(/\D/g, '').slice(0, 1))}
                                placeholder="DV"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Razón Social completa *
                              <input
                                value={form.empresaRazonSocial}
                                onChange={e => update('empresaRazonSocial', e.target.value)}
                                placeholder="Nombre legal de la compañía"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-3">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Sede y Localización
                            </span>

                            <label className="block text-xs font-semibold text-slate-600">
                              Departamento
                              <input
                                value={form.empresaDepartamento}
                                onChange={e => update('empresaDepartamento', e.target.value)}
                                placeholder="Departamento"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Ciudad
                              <input
                                value={form.empresaCiudad}
                                onChange={e => update('empresaCiudad', e.target.value)}
                                placeholder="Ciudad / Municipio"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Dirección comercial
                              <input
                                value={form.empresaDireccion}
                                onChange={e => update('empresaDireccion', e.target.value)}
                                placeholder="Dirección sede principal"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-3">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Contacto y RRHH
                            </span>

                            <label className="block text-xs font-semibold text-slate-600">
                              Teléfono empresarial
                              <input
                                value={form.empresaTelefono}
                                onChange={e => update('empresaTelefono', e.target.value)}
                                placeholder="PBX o móvil"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Correo electrónico nómina
                              <input
                                type="email"
                                value={form.empresaCorreo}
                                onChange={e => update('empresaCorreo', e.target.value)}
                                placeholder="nomina@empresa.com"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>

                            <label className="block text-xs font-semibold text-slate-600">
                              Encargado Recursos Humanos
                              <input
                                value={form.empresaContactoRRHH}
                                onChange={e => update('empresaContactoRRHH', e.target.value)}
                                placeholder="Nombre contacto RRHH"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        SECCIÓN 5: BENEFICIARIOS (Núcleo Familiar)
                       ══════════════════════════════════════════════════════ */}
                    {activeSection === 4 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                          <div>
                            <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-cyan-800">
                              Núcleo Familiar Dependiente
                            </span>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Agrega a las personas a cargo que quedarán amparadas bajo este cotizante.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={addBeneficiary}
                            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-[#c4d600] shadow-sm hover:bg-slate-800 transition-colors"
                          >
                            <Plus className="h-4 w-4" /> Agregar Beneficiario
                          </button>
                        </div>

                        {form.beneficiarios.length === 0 ? (
                          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                            <UsersIcon className="mx-auto h-8 w-8 text-slate-400 opacity-60" />
                            <p className="mt-2 text-xs font-bold text-slate-700">Sin beneficiarios agregados</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Si el cotizante se afilia individualmente, puedes continuar al siguiente paso sin agregar beneficiarios.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <AnimatePresence>
                              {form.beneficiarios.map((ben, idx) => (
                                <motion.div
                                  key={ben.id}
                                  initial={{ opacity: 0, y: 15 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm space-y-3"
                                >
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                                      Beneficiario #{idx + 1}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeBeneficiary(idx)}
                                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Quitar
                                    </button>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-4">
                                    <label className="block text-xs font-semibold text-slate-600">
                                      Parentesco *
                                      <select
                                        value={ben.parentesco}
                                        onChange={e => updateBeneficiary(idx, 'parentesco', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                      >
                                        <option value="CONYUGE">Cónyuge / Compañero(a)</option>
                                        <option value="HIJO(A)">Hijo(a)</option>
                                        <option value="PADRE / MADRE">Padre / Madre</option>
                                        <option value="HERMANO(A)">Hermano(a)</option>
                                        <option value="OTRO">Otro Familiar</option>
                                      </select>
                                    </label>

                                    <label className="block text-xs font-semibold text-slate-600">
                                      Tipo doc. *
                                      <select
                                        value={ben.tipoDocumento}
                                        onChange={e => updateBeneficiary(idx, 'tipoDocumento', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                      >
                                        {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                      </select>
                                    </label>

                                    <label className="block text-xs font-semibold text-slate-600">
                                      Número doc. *
                                      <input
                                        value={ben.numeroDocumento}
                                        onChange={e => updateBeneficiary(idx, 'numeroDocumento', e.target.value)}
                                        placeholder="Número"
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                      />
                                    </label>

                                    <label className="block text-xs font-semibold text-slate-600">
                                      Sexo
                                      <select
                                        value={ben.sexo || 'F'}
                                        onChange={e => updateBeneficiary(idx, 'sexo', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                      >
                                        <option value="F">Femenino</option>
                                        <option value="M">Masculino</option>
                                      </select>
                                    </label>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <label className="block text-xs font-semibold text-slate-600">
                                      Primer nombre *
                                      <input
                                        value={ben.primerNombre}
                                        onChange={e => updateBeneficiary(idx, 'primerNombre', e.target.value)}
                                        placeholder="Primer nombre"
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                      />
                                    </label>

                                    <label className="block text-xs font-semibold text-slate-600">
                                      Primer apellido *
                                      <input
                                        value={ben.primerApellido}
                                        onChange={e => updateBeneficiary(idx, 'primerApellido', e.target.value)}
                                        placeholder="Primer apellido"
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                      />
                                    </label>

                                    <label className="block text-xs font-semibold text-slate-600">
                                      Fecha nacimiento *
                                      <input
                                        type="date"
                                        value={ben.fechaNacimiento}
                                        onChange={e => updateBeneficiary(idx, 'fechaNacimiento', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                                      />
                                    </label>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        SECCIÓN 6: DOCUMENTOS & FIRMAS DIGITALES
                       ══════════════════════════════════════════════════════ */}
                    {activeSection === 5 && (
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm space-y-4">
                          <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-cyan-800">
                            Carga de Soportes Oficiales
                          </span>

                          <div className="grid gap-3 sm:grid-cols-2">
                            {/* Soporte 1: Cotizante */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="block text-xs font-bold text-slate-700">
                                  Documento de Identidad del Cotizante *
                                </span>
                                {documentos.some(d => d.categoria === 'COTIZANTE') && (
                                  <button
                                    type="button"
                                    onClick={() => removeFile('COTIZANTE')}
                                    className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs font-semibold text-slate-600 hover:border-cyan-500 hover:text-cyan-600 transition-colors">
                                <Upload className="h-4 w-4 text-cyan-600" />
                                <span className="truncate max-w-[200px]">
                                  {documentos.find(d => d.categoria === 'COTIZANTE')?.nombre || 'Adjuntar PDF o Imagen'}
                                </span>
                                <input
                                  type="file"
                                  accept="application/pdf,image/png,image/jpeg"
                                  className="hidden"
                                  onChange={e => addFile(e.target.files, 'COTIZANTE')}
                                />
                              </label>
                            </div>

                            {/* Soporte 2: Traslado */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="block text-xs font-bold text-slate-700">
                                  Autorización Traslado {form.tipoAfiliacion === 'TRASLADO' && <span className="text-cyan-600">*</span>}
                                </span>
                                {documentos.some(d => d.categoria === 'AUTORIZACION_TRASLADO') && (
                                  <button
                                    type="button"
                                    onClick={() => removeFile('AUTORIZACION_TRASLADO')}
                                    className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs font-semibold text-slate-600 hover:border-cyan-500 hover:text-cyan-600 transition-colors">
                                <Upload className="h-4 w-4 text-cyan-600" />
                                <span className="truncate max-w-[200px]">
                                  {documentos.find(d => d.categoria === 'AUTORIZACION_TRASLADO')?.nombre || 'Adjuntar soporte firmado'}
                                </span>
                                <input
                                  type="file"
                                  accept="application/pdf,image/png,image/jpeg"
                                  className="hidden"
                                  onChange={e => addFile(e.target.files, 'AUTORIZACION_TRASLADO')}
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Firmas Digitales con Caligrafía Fluida y Modo Dual */}
                        <div className="grid gap-4 md:grid-cols-2">
                          <EnhancedSignatureField
                            label="Firma Digital del Afiliado / Cotizante"
                            value={form.firmaDigitalCotizante}
                            onChange={sig => update('firmaDigitalCotizante', sig)}
                            required
                            penColor="#0B132B"
                          />

                          <EnhancedSignatureField
                            label="Firma Digital de la Empresa (Representante / RRHH)"
                            value={form.firmaDigitalEmpresa}
                            onChange={sig => update('firmaDigitalEmpresa', sig)}
                            penColor="#0B132B"
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
    </InteractiveFolioLayout>
  );
};
export default AffiliationFolioForm;
