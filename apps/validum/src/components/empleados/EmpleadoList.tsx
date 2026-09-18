import React, { useMemo, useState } from 'react';
import { ArrowLeft, Beaker, Check, ChevronLeft, ChevronRight, Edit, FileSpreadsheet, Loader2, Plus, Search, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { useValidum } from '../../context/ValidumContext';
import { eliminarSoporte, guardarSoporte, ordenDocumentos } from '../../lib/documentStorage';
import type { Beneficiario, DocumentoAdjunto, Empleado, Empresa } from '../../types/validum';
import { SignaturePad } from '../formularios/SignaturePad';
import { BulkImportModal } from './BulkImportModal';
import { AffiliationFolioForm } from './AffiliationFolioForm';
import { buildTestSubjects, TEST_SUBJECT_PREFIX } from '../../data/testSubjects';

const EPS_LIST = [
  'Sanitas', 'Nueva EPS', 'Salud Total', 'Salud Mía', 'Famisanar',
  'Compensar', 'Proteger EPS', 'SOS', 'Sura', 'Capital Salud',
  'Coosalud', 'Aliansalud', 'Mutual Ser', 'Savia Salud'
];

const DOCUMENT_TYPES = ['CC', 'CE', 'TI', 'RC', 'PA', 'PPT', 'CD', 'SC'];
const COMPANY_DOC_TYPES = ['NIT', 'CC', 'CE', 'PASAPORTE'];
const GENDER_IDENTITIES = [
  'MASCULINO', 'FEMENINO', 'TRANSGÉNERO', 'NO BINARIO', 'OTRO', 'PREFIERO NO DECIR'
];
const ARL_LIST = ['Positiva', 'Sura', 'SURA', 'Colpatria', 'Alfa', 'Bolívar', 'Equidad', 'Liberty'];
const AFP_LIST = ['Porvenir', 'Protección', 'Colfondos', 'Skandia', 'Colpensiones', 'Fondo Solidario'];

const MOTIVOS_TRASLADO = [
  'Cambio de residencia a un municipio donde la EPS no tiene cobertura',
  'Insatisfacción con los servicios prestados por la EPS',
  'Libre elección de EPS por cumplimiento de permanencia mínima (1 año)',
  'Fusión, liquidación o revocatoria de autorización de la EPS',
  'Unificación del núcleo familiar en una misma EPS',
  'Otro motivo contemplado en la ley'
];

const steps = [
  'Persona',
  'Entidad, residencia e IPS',
  'Datos laborales',
  'Empresa',
  'Beneficiarios',
  'Documentos'
];

type FormData = {
  // Paso 1: Persona
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

  // Paso 2: Entidad, residencia e IPS
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
  localidadComuna: string;
  direccion: string;
  barrio: string;
  residenciaZona: 'CABECERA MUNICIPAL (U)' | 'RURAL (R)';
  telefonoCotizante: string;
  emailCotizante: string;
  ipsSeleccionada: string;
  codigoIps: string;

  // Paso 3: Datos laborales y afiliación
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

  // Paso 4: Empresa
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

  // Paso 5: Beneficiarios
  beneficiarios: Beneficiario[];

  // Paso 6: Firmas
  firmaDigitalCotizante: string;
  firmaDigitalEmpresa: string;
};

type DocumentoPendiente = { meta: DocumentoAdjunto; file: File };

const fresh = (defaultCompany?: Empresa): FormData => ({
  tipoDocumento: 'CC',
  cedula: '',
  primerNombre: '',
  segundoNombre: '',
  primerApellido: '',
  segundoApellido: '',
  sexo: 'F',
  identidadGenero: 'FEMENINO',
  nacionalidad: 'COLOMBIANA',
  fechaNacimiento: '',

  eps: 'Sanitas',
  paisNacimiento: 'COLOMBIA',
  departamentoNacimiento: '',
  ciudadNacimiento: '',
  paisExpedicion: 'COLOMBIA',
  departamentoExpedicion: '',
  ciudadExpedicion: '',
  fechaExpedicion: '',
  departamentoResidencia: '',
  ciudadResidencia: '',
  localidadComuna: '',
  direccion: '',
  barrio: '',
  residenciaZona: 'CABECERA MUNICIPAL (U)',
  telefonoCotizante: '',
  emailCotizante: '',
  ipsSeleccionada: '',
  codigoIps: '',

  tipoAfiliacion: 'NUEVO',
  tipoNovedad: 'MODIFICACION_DATOS',
  tipoCotizante: 'DEPENDIENTE',
  solicitudSat: 'NO',
  arl: defaultCompany?.arl || 'Positiva',
  afp: 'Porvenir',
  salarioBase: 1750905,
  cargo: '',
  fechaIngreso: new Date().toISOString().split('T')[0],
  epsAnterior: '',
  motivoTraslado: MOTIVOS_TRASLADO[0],

  empresaId: defaultCompany?.id,
  empresaTipoDoc: defaultCompany?.tipoDocumento || 'NIT',
  empresaNumeroDoc: defaultCompany?.nit || '',
  empresaDv: defaultCompany?.dv || '',
  empresaRazonSocial: defaultCompany?.razonSocial || '',
  empresaDepartamento: defaultCompany?.departamento || '',
  empresaCiudad: defaultCompany?.ciudad || '',
  empresaDireccion: defaultCompany?.direccion || '',
  empresaTelefono: defaultCompany?.telefono || '',
  empresaCorreo: defaultCompany?.email || defaultCompany?.emailContacto || '',
  empresaContactoRRHH: defaultCompany?.contactoRecursosHumanos || '',

  beneficiarios: [],
  firmaDigitalCotizante: '',
  firmaDigitalEmpresa: '',
});

const Input = ({ label, required, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) => (
  <label className="block text-xs font-semibold text-slate-300">
    {label}{required && <span className="text-[#c4d600] font-bold"> *</span>}
    <input
      {...props}
      required={required}
      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0a1824] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-[#c4d600] focus:ring-1 focus:ring-[#c4d600] disabled:opacity-50"
    />
  </label>
);

const Select = ({ label, children, required, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-slate-300">
    {label}{required && <span className="text-[#c4d600] font-bold"> *</span>}
    <select
      {...props}
      required={required}
      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0a1824] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-[#c4d600] focus:ring-1 focus:ring-[#c4d600] disabled:opacity-50"
    >
      {children}
    </select>
  </label>
);

export const EmpleadoList: React.FC = () => {
  const {
    empleados,
    addEmpleado,
    addEmpleados,
    updateEmpleado,
    deleteEmpleado,
    empresa,
    empresas,
    setEmpresa,
    selectEmpresa,
    setActiveTab
  } = useValidum();

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(fresh(empresa));
  const [documentos, setDocumentos] = useState<DocumentoAdjunto[]>([]);
  const [pendientes, setPendientes] = useState<DocumentoPendiente[]>([]);
  const [removedDocumentIds, setRemovedDocumentIds] = useState<string[]>([]);
  const [isCreatingTests, setIsCreatingTests] = useState(false);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm(old => ({ ...old, [key]: value }));

  const filtered = useMemo(() =>
    empleados.filter(item =>
      `${item.nombres} ${item.apellidos} ${item.cedula}`.toLowerCase().includes(search.toLowerCase())
    ),
  [empleados, search]);

  const newAffiliate = () => {
    setForm(fresh(empresa));
    setDocumentos([]);
    setPendientes([]);
    setRemovedDocumentIds([]);
    setEditing(null);
    setStep(0);
    setOpen(true);
  };

  const createTestSubjects = async () => {
    const candidates = buildTestSubjects(empresa);
    const existingIds = new Set(empleados.map(item => item.id));
    const missing = candidates.filter(item => !existingIds.has(item.id));
    if (!missing.length) {
      alert('Los sujetos de prueba de las 10 EPS ya están creados. Búscalos por la palabra PRUEBA.');
      return;
    }
    if (!window.confirm(`Se crearán ${missing.length} cotizantes sintéticos, cada uno con cónyuge, hijo e hija. ¿Continuar?`)) return;
    setIsCreatingTests(true);
    try {
      await addEmpleados(missing);
      setSearch('PRUEBA');
      alert(`Se crearon ${missing.length} sujetos de prueba. Todos tienen identificadores que empiezan por ${TEST_SUBJECT_PREFIX}.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudieron crear los sujetos de prueba.');
    } finally {
      setIsCreatingTests(false);
    }
  };

  const edit = (item: Empleado) => {
    setEditing(item.id);
    setStep(0);
    setDocumentos(item.documentos || []);
    setPendientes([]);
    setRemovedDocumentIds([]);

    const itemCompany = item.empresaId ? empresas.find(e => e.id === item.empresaId) : empresa;

    setForm({
      ...fresh(itemCompany || empresa),
      tipoDocumento: item.tipoDocumento || 'CC',
      cedula: item.numeroDocumento || item.cedula,
      primerNombre: item.primerNombre || item.nombres.split(' ')[0] || '',
      segundoNombre: item.segundoNombre || '',
      primerApellido: item.primerApellido || item.apellidos.split(' ')[0] || '',
      segundoApellido: item.segundoApellido || '',
      sexo: item.sexo || 'F',
      identidadGenero: item.identidadGenero || (item.sexo === 'M' ? 'MASCULINO' : 'FEMENINO'),
      nacionalidad: item.nacionalidad || 'COLOMBIANA',
      fechaNacimiento: item.fechaNacimiento || '',

      eps: item.eps,
      paisNacimiento: item.paisNacimiento || 'COLOMBIA',
      departamentoNacimiento: item.departamentoNacimiento || '',
      ciudadNacimiento: item.ciudadNacimiento || '',
      paisExpedicion: item.paisExpedicion || 'COLOMBIA',
      departamentoExpedicion: item.departamentoExpedicion || '',
      ciudadExpedicion: item.ciudadExpedicion || '',
      fechaExpedicion: item.fechaExpedicion || '',
      departamentoResidencia: item.departamentoResidencia || '',
      ciudadResidencia: item.ciudadResidencia || '',
      localidadComuna: item.localidadComuna || '',
      direccion: item.direccion || '',
      barrio: item.barrio || '',
      residenciaZona: item.zona === 'R' ? 'RURAL (R)' : 'CABECERA MUNICIPAL (U)',
      telefonoCotizante: item.telefonoCotizante || '',
      emailCotizante: item.emailCotizante || '',
      ipsSeleccionada: item.ipsSeleccionada || '',
      codigoIps: item.codigoIps || '',

      tipoAfiliacion: (['NUEVO', 'NOVEDAD', 'TRASLADO', 'INCLUSION'].includes(item.tipoAfiliacion || '')
        ? item.tipoAfiliacion
        : (item.tipoAfiliacion === 'AFILIACION' ? 'NUEVO' : 'NOVEDAD')) as FormData['tipoAfiliacion'],
      tipoNovedad: item.tipoNovedad || 'MODIFICACION_DATOS',
      tipoCotizante: (item.tipoCotizante?.includes('INDEPENDIENTE') ? 'INDEPENDIENTE' : 'DEPENDIENTE'),
      solicitudSat: (item.solicitudSat === 'SÍ' || item.solicitudSat === 'SI') ? 'SÍ' : 'NO',
      arl: item.arl || itemCompany?.arl || 'Positiva',
      afp: item.afp || 'Porvenir',
      salarioBase: item.salarioBase || 1750905,
      cargo: item.cargo || '',
      fechaIngreso: item.fechaIngreso || new Date().toISOString().split('T')[0],
      epsAnterior: item.epsAnterior || '',
      motivoTraslado: item.motivoTraslado || MOTIVOS_TRASLADO[0],

      empresaId: itemCompany?.id,
      empresaTipoDoc: itemCompany?.tipoDocumento || 'NIT',
      empresaNumeroDoc: itemCompany?.nit || '',
      empresaDv: itemCompany?.dv || '',
      empresaRazonSocial: itemCompany?.razonSocial || '',
      empresaDepartamento: itemCompany?.departamento || '',
      empresaCiudad: itemCompany?.ciudad || '',
      empresaDireccion: itemCompany?.direccion || '',
      empresaTelefono: itemCompany?.telefono || '',
      empresaCorreo: itemCompany?.email || itemCompany?.emailContacto || '',
      empresaContactoRRHH: itemCompany?.contactoRecursosHumanos || '',

      beneficiarios: item.beneficiarios || [],
      firmaDigitalCotizante: item.firmaDigitalCotizante || '',
      firmaDigitalEmpresa: item.firmaDigitalEmpresa || '',
    });
    setOpen(true);
  };

  const handleCompanySelect = (selectedId: string) => {
    if (!selectedId) return;
    const target = empresas.find(e => e.id === selectedId);
    if (target) {
      setForm(old => ({
        ...old,
        empresaId: target.id,
        empresaTipoDoc: target.tipoDocumento || 'NIT',
        empresaNumeroDoc: target.nit,
        empresaDv: target.dv || '',
        empresaRazonSocial: target.razonSocial,
        empresaDepartamento: target.departamento || '',
        empresaCiudad: target.ciudad,
        empresaDireccion: target.direccion,
        empresaTelefono: target.telefono,
        empresaCorreo: target.email || target.emailContacto || '',
        empresaContactoRRHH: target.contactoRecursosHumanos || '',
      }));
    }
  };

  const addCategorizedFile = (files: FileList | null, categoria: DocumentoAdjunto['categoria']) => {
    if (!files || files.length === 0) return;
    const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg']);
    const file = files[0];
    if (!allowed.has(file.type)) {
      alert(`El archivo ${file.name} no es PDF, PNG o JPEG permitido.`);
      return;
    }
    const meta: DocumentoAdjunto = {
      id: crypto.randomUUID(),
      nombre: file.name,
      tipo: file.type,
      tamanio: file.size,
      categoria,
      creadoEn: new Date().toISOString(),
    };
    // Reemplaza o agrega el documento de esa categoría
    setPendientes(old => [...old.filter(p => p.meta.categoria !== categoria), { meta, file }]);
    setDocumentos(old => [...old.filter(d => d.categoria !== categoria), meta]);
  };

  const removeAffiliate = async (item: Empleado) => {
    if (!window.confirm(`¿Eliminar a ${item.nombres} ${item.apellidos} y sus soportes guardados?`)) return;
    try {
      await deleteEmpleado(item.id);
      const cleanup = await Promise.allSettled((item.documentos || []).map(d => eliminarSoporte(d.id)));
      if (cleanup.some(r => r.status === 'rejected')) {
        console.warn('Algunos archivos del expediente quedaron pendientes de limpieza local.');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo eliminar el expediente completo.');
    }
  };

  const addBeneficiary = () => {
    update('beneficiarios', [
      ...form.beneficiarios,
      {
        id: `ben-${crypto.randomUUID()}`,
        parentesco: 'HIJO(A)',
        tipoDocumento: 'TI',
        numeroDocumento: '',
        primerNombre: '',
        segundoNombre: '',
        primerApellido: '',
        segundoApellido: '',
        fechaNacimiento: '',
        fechaExpedicion: '',
        sexo: 'F',
        identidadGenero: 'FEMENINO',
        nacionalidad: form.nacionalidad,
        paisNacimiento: 'COLOMBIA',
        departamentoNacimiento: '',
        municipioNacimiento: '',
        etnia: '06',
        discapacidad: 'NINGUNA',
        condicion: '',
        municipio: form.ciudadResidencia || '',
        zona: form.residenciaZona.startsWith('R') ? 'R' : 'U',
        departamento: form.departamentoResidencia || '',
        telefono: form.telefonoCotizante || '',
        valorUpc: '',
        ipsSeleccionada: form.ipsSeleccionada || '',
        codigoIps: form.codigoIps || '',
      }
    ]);
  };

  const changeBeneficiary = (index: number, key: keyof Beneficiario, value: string) => {
    update('beneficiarios', form.beneficiarios.map((item, current) => current === index ? { ...item, [key]: value } : item));
  };

  const save = async () => {
    // Validaciones principales
    if (!form.tipoDocumento || !form.cedula.trim()) {
      alert('Debes indicar tipo y número de documento del cotizante.');
      setStep(0);
      return;
    }
    if (!form.primerNombre.trim() || !form.primerApellido.trim()) {
      alert('Debes ingresar primer nombre y primer apellido del cotizante.');
      setStep(0);
      return;
    }
    if (!form.eps) {
      alert('Debes seleccionar la entidad de salud (EPS).');
      setStep(1);
      return;
    }
    if (!form.empresaNumeroDoc.trim() || !form.empresaRazonSocial.trim()) {
      alert('Debes completar el número de documento / NIT y la razón social de la empresa.');
      setStep(3);
      return;
    }

    // Validar beneficiarios si existen
    if (form.beneficiarios.length > 0) {
      const incompleteBen = form.beneficiarios.find(b =>
        !b.tipoDocumento || !b.numeroDocumento?.trim() || !b.primerNombre?.trim() || !b.primerApellido?.trim()
      );
      if (incompleteBen) {
        alert('Completa los campos obligatorios de los beneficiarios agregados (Documento, Primer nombre y Primer apellido).');
        setStep(4);
        return;
      }
    }

    let committed = false;
    try {
      // 1. Guardar o sincronizar la empresa
      const companyData: Empresa = {
        id: form.empresaId || crypto.randomUUID(),
        nit: form.empresaNumeroDoc.trim(),
        dv: form.empresaDv.trim(),
        tipoDocumento: form.empresaTipoDoc || 'NIT',
        razonSocial: form.empresaRazonSocial.trim(),
        departamento: form.empresaDepartamento.trim(),
        ciudad: form.empresaCiudad.trim(),
        direccion: form.empresaDireccion.trim(),
        telefono: form.empresaTelefono.trim(),
        email: form.empresaCorreo.trim(),
        emailContacto: form.empresaCorreo.trim(),
        contactoRecursosHumanos: form.empresaContactoRRHH.trim(),
        operadorPila: empresa?.operadorPila || 'Aportes en Línea',
        arl: (form.arl as Empresa['arl']) || empresa?.arl || 'Positiva',
        nivelRiesgoArl: 1,
        representanteLegal: empresa?.representanteLegal || '',
        cedulaRepresentante: empresa?.cedulaRepresentante || '',
      };

      await setEmpresa(companyData);
      await selectEmpresa(companyData.id!);

      // 2. Guardar archivos locales pendientes
      await Promise.all(pendientes.map(item => guardarSoporte(item.meta.id, item.file)));

      // 3. Mapear Empleado para persistencia
      const employeeData: Empleado = {
        id: editing || `afi-${crypto.randomUUID()}`,
        cedula: form.cedula.trim(),
        numeroDocumento: form.cedula.trim(),
        tipoDocumento: form.tipoDocumento,
        primerNombre: form.primerNombre.trim(),
        segundoNombre: form.segundoNombre.trim(),
        primerApellido: form.primerApellido.trim(),
        segundoApellido: form.segundoApellido.trim(),
        nombres: `${form.primerNombre} ${form.segundoNombre}`.trim(),
        apellidos: `${form.primerApellido} ${form.segundoApellido}`.trim(),
        sexo: form.sexo,
        identidadGenero: form.identidadGenero,
        fechaNacimiento: form.fechaNacimiento,
        nacionalidad: 'COLOMBIANA',

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
        localidadComuna: form.localidadComuna,
        direccion: form.direccion,
        barrio: form.barrio,
        zona: form.residenciaZona.startsWith('R') ? 'R' : 'U',
        telefonoCotizante: form.telefonoCotizante,
        emailCotizante: form.emailCotizante,
        ipsSeleccionada: form.ipsSeleccionada,
        codigoIps: form.codigoIps,

        tipoAfiliacion: form.tipoAfiliacion,
        modalidadAfiliacion: 'INDIVIDUAL',
        regimen: 'CONTRIBUTIVO',
        tipoAfiliado: 'COTIZANTE',
        tipoCotizante: form.tipoCotizante,
        solicitudSat: form.solicitudSat,
        arl: form.arl,
        afp: form.afp,
        ccf: 'Compensar',
        salarioBase: Number(form.salarioBase),
        ibc: Number(form.salarioBase),
        cargo: form.cargo,
        departamento: form.empresaDepartamento,
        fechaIngreso: form.fechaIngreso,
        riesgoArl: 1,
        estado: 'Activo',

        epsAnterior: form.tipoAfiliacion === 'TRASLADO' ? form.epsAnterior : '',
        motivoTraslado: form.tipoAfiliacion === 'TRASLADO' ? form.motivoTraslado : '',
        tipoNovedad: form.tipoAfiliacion === 'TRASLADO'
          ? 'TRASLADO'
          : form.tipoAfiliacion === 'INCLUSION'
            ? 'INCLUSION_BENEFICIARIOS'
            : form.tipoAfiliacion === 'NOVEDAD'
              ? form.tipoNovedad
              : 'INICIO_RELACION',

        empresaId: companyData.id,
        beneficiarios: form.tipoAfiliacion === 'NOVEDAD' ? [] : form.beneficiarios,
        documentos,
        firmaDigitalCotizante: form.firmaDigitalCotizante,
        firmaDigitalEmpresa: form.firmaDigitalEmpresa,
      };

      if (editing) {
        await updateEmpleado(editing, employeeData);
      } else {
        await addEmpleado(employeeData);
      }

      committed = true;
      const cleanup = await Promise.allSettled(removedDocumentIds.map(id => eliminarSoporte(id)));
      if (cleanup.some(result => result.status === 'rejected')) {
        console.warn('Algunos soportes eliminados quedaron pendientes de limpieza local.');
      }
      setOpen(false);
    } catch (error) {
      if (!committed) await Promise.allSettled(pendientes.map(item => eliminarSoporte(item.meta.id)));
      alert(error instanceof Error ? error.message : 'No se pudo guardar la solicitud.');
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={() => setActiveTab('autofill')} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-bold text-[#c4d600] hover:bg-slate-900">
        <ArrowLeft className="h-4 w-4" />Volver a Formularios
      </button>

      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-[#c4d600]/30 bg-[#0f2537] p-6 shadow-xl md:flex-row md:items-center">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#c4d600]/40 bg-[#c4d600]/10 text-[#c4d600]">
            <Users />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-slate-100">Directorio de Afiliados</h1>
            <p className="mt-1 text-xs text-slate-400">Datos maestros para diligenciar formularios oficiales.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void createTestSubjects()}
            disabled={isCreatingTests}
            className="rounded-xl border border-cyan-500/40 px-4 py-2.5 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-500/10 disabled:opacity-50"
          >
            {isCreatingTests ? <Loader2 className="mr-2 inline w-4 animate-spin" /> : <Beaker className="mr-2 inline w-4" />}
            Crear sujetos de prueba
          </button>
          <button onClick={() => setImportOpen(true)} className="rounded-xl border border-[#c4d600]/40 px-4 py-2.5 text-xs font-bold text-[#c4d600] hover:bg-[#c4d600]/10 transition-colors">
            <FileSpreadsheet className="mr-2 inline w-4" />Importar afiliados
          </button>
          <button onClick={newAffiliate} className="flex items-center gap-2 rounded-xl bg-[#c4d600] px-5 py-2.5 text-xs font-black text-[#0f2537] shadow-lg shadow-[#c4d600]/20 hover:bg-[#d6e800] transition-all active:scale-95">
            <UserPlus className="w-4 h-4" />Nueva solicitud de afiliación
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-[#0f2537] p-6">
        <div className="relative mb-5 max-w-sm">
          <Search className="absolute left-3 top-3 w-4 text-slate-500" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por nombre o documento"
            className="w-full rounded-xl border border-slate-700 bg-[#0a1824] py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-[#c4d600]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a1824] uppercase text-slate-400">
              <tr>
                <th className="p-3">Documento</th>
                <th className="p-3">Afiliado</th>
                <th className="p-3">Trámite / EPS</th>
                <th className="p-3">Empresa</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {filtered.map(item => (
                <tr key={item.id}>
                  <td className="p-3 font-semibold">{item.tipoDocumento || 'CC'} {item.cedula}</td>
                  <td className="p-3">
                    <b>{item.nombres} {item.apellidos}</b><br />
                    <span className="text-slate-500">{item.cargo || 'Sin cargo registrado'}</span>
                  </td>
                  <td className="p-3">
                    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-300 mr-1.5">{item.tipoAfiliacion || 'NUEVO'}</span>
                    <span className="text-[#c4d600] font-semibold">{item.eps}</span>
                  </td>
                  <td className="p-3 text-slate-400">
                    {empresas.find(e => e.id === item.empresaId)?.razonSocial || empresa.razonSocial || 'Empresa activa'}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => edit(item)} className="mr-2 rounded-lg p-2 text-[#c4d600] hover:bg-slate-800">
                      <Edit className="w-4" />
                    </button>
                    <button onClick={() => void removeAffiliate(item)} className="rounded-lg p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                      <Trash2 className="w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BulkImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />

      {/* Libreta Digital / Digital Folio Interactivo de Afiliación */}
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md">
          <AffiliationFolioForm
            initialData={editing ? { ...form, documentos } : undefined}
            initialEmployeeId={editing}
            onClose={() => setOpen(false)}
            onSuccess={() => {
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
};
