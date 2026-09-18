import React, { useEffect, useMemo, useState } from 'react';
import { 
  Zap, 
  ArrowLeft, 
  Download, 
  Printer, 
  Save, 
  FileText, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Upload,
  X,
  Building2,
  Check,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  FileCheck2,
  Scan,
  PenTool,
} from 'lucide-react';
import { LookScannedStudio } from '../scanner/LookScannedStudio';
import { useValidum } from '../../context/ValidumContext';
import { useTemplateStorage } from '../../hooks/useTemplateStorage';
import { fillPDFTemplate, inspectPDFTemplate, anexarSoportesAPdf } from '../../lib/pdfEngine';
import { obtenerSoporte, ordenDocumentos } from '../../lib/documentStorage';
import { resolveDataValue } from '../../lib/mappingUtils';
import type { FormTemplate } from '../../types/formularios';
import type { Empleado } from '../../types/validum';
import { SignaturePad } from './SignaturePad';

interface PDFAutoFillerProps {
  templates: FormTemplate[];
  onBack: () => void;
  preselectedTemplateId?: string;
}

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

function pdfBase64ToBlob(base64: string): Blob {
  const binary = atob(base64.replace(/^data:application\/pdf;base64,/, ''));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new Blob([bytes], { type: 'application/pdf' });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function normalizeEpsName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/EPS-?S?/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function isTemplateCompatibleWithEmployee(template: FormTemplate, employee: Empleado): boolean {
  const employeeEps = normalizeEpsName(employee.eps || '');
  if (!employeeEps) return true;
  const templateEps = normalizeEpsName(`${template.entity} ${template.name}`);
  return templateEps.includes(employeeEps) || employeeEps.includes(templateEps);
}

function draftKey(templateId: string, employeeId: string): string {
  return `validum_autofill_draft_v1:${templateId}:${employeeId}`;
}

function effectiveTemplatePageCount(template: FormTemplate): number {
  return normalizeEpsName(`${template.entity} ${template.name}`).includes('SANITAS') ? 2 : template.totalPages;
}

function usesGeneralSgsssRules(template?: FormTemplate): boolean {
  return Boolean(template && template.entityType === 'EPS');
}

const GENERAL_SGSSS_DECLARATIONS = [
  'declaracionDependenciaEconomica',
  'declaracionNoObligacionContributivo',
  'autorizacionHistoriaClinica',
  'autorizacionReporteInformacion',
  'autorizacionDatosPersonales',
  'autorizacionNotificaciones',
] as const;

const GENERAL_SGSSS_ALWAYS_BLANK = new Set([
  'etnia', 'comunidad', 'discapacidad', 'discapacidadSi', 'discapacidadNo',
  'condicion', 'condicionTemporal', 'condicionPermanente',
  'encuestaSisbenSi', 'encuestaSisbenNo', 'puntajeSisben', 'grupoEspecial',
  'tarifaContribucionSolidaria',
]);

function generalSgsssGenerationTemplate(template: FormTemplate, values: Record<string, string>): FormTemplate {
  if (!usesGeneralSgsssRules(template)) return template;
  const isNoveltyReport = values.tipoTramiteSeccionI === 'REPORTE_NOVEDADES';
  const alwaysChecked = new Set([
    isNoveltyReport ? 'tipoTramiteNovedad' : 'tipoTramiteAfiliacion',
    'tipoAfiliacionCotizante',
    'regimenContributivo', 'contribucionSolidariaNo',
  ]);
  const alwaysUnchecked = new Set([
    isNoveltyReport ? 'tipoTramiteAfiliacion' : 'tipoTramiteNovedad',
    'tipoAfiliacionIndividual', 'tipoAfiliacionColectiva',
    'tipoAfiliacionInstitucional', 'tipoAfiliacionOficio', 'tipoAfiliacionBeneficiario',
    'regimenSubsidiado', 'contribucionSolidariaSi',
  ]);
  return {
    ...template,
    fields: template.fields.map(field => {
        if (field.fieldKey === 'selloRadicacion' && !values.selloRadicacion) {
          return { ...field, fieldType: 'text' as const, dataSource: 'manual' as const };
        }
        if (GENERAL_SGSSS_ALWAYS_BLANK.has(field.fieldKey)) {
          return field.fieldType === 'checkbox'
            ? { ...field, checkboxRule: { mode: 'equals' as const, source: 'manual' as const, fieldKey: '__sanitas_unchecked__', expectedValue: 'X' } }
            : { ...field, dataSource: 'manual' as const };
        }
        if (alwaysChecked.has(field.fieldKey)) {
          return { ...field, checkboxRule: { mode: 'always' as const } };
        }
        if (alwaysUnchecked.has(field.fieldKey)) {
          return {
            ...field,
            checkboxRule: { mode: 'equals' as const, source: 'manual' as const, fieldKey: '__sanitas_unchecked__', expectedValue: 'X' },
          };
        }
        if (field.fieldKey === 'selloRadicacion') {
          return { ...field, stampText: values.selloRadicacion };
        }
        return field;
      }),
  };
}

function buildOperationalDefaults(template?: FormTemplate, employee?: Empleado): Record<string, string> {
  if (!template) return {};
  const mappedKeys = new Set(template.fields.map(field => field.fieldKey));
  const values: Record<string, string> = {};
  if (usesGeneralSgsssRules(template)) values.tipoTramiteSeccionI = 'AFILIACION';
  const defaultChecks = usesGeneralSgsssRules(template) ? [
    'contribucionSolidariaNo',
    ...GENERAL_SGSSS_DECLARATIONS,
    'anexoDocumentoIdentidad',
  ] : [
    'contribucionSolidariaNo',
    'declaracionDependenciaEconomica',
    'declaracionNoObligacionContributivo',
    'declaracionNoInternacion',
    'autorizacionHistoriaClinica',
    'autorizacionReporteInformacion',
    'autorizacionDatosPersonales',
    'anexoDocumentoIdentidad',
  ];
  defaultChecks.forEach(key => {
    if (mappedKeys.has(key)) values[key] = 'X';
  });

  const rawDocumentType = (employee?.tipoDocumento || 'CC').toUpperCase().replace(/[^A-Z]/g, '');
  const documentType = rawDocumentType === 'PASAPORTE' ? 'PA' : rawDocumentType;
  const quantityKey = `cantidadAnexo${documentType}`;
  if (mappedKeys.has(quantityKey)) values[quantityKey] = '1';
  if (mappedKeys.has('cantidadAnexosTotal')) values.cantidadAnexosTotal = '1';
  return values;
}

export const PDFAutoFiller: React.FC<PDFAutoFillerProps> = ({
  templates,
  onBack,
  preselectedTemplateId
}) => {
  const { empleados, empresas, empresa, setActiveTab } = useValidum();
  const { saveGeneratedForm } = useTemplateStorage();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(preselectedTemplateId);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string>('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Form values
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [tramiteValues, setTramiteValues] = useState<Record<string, string>>({
    tipoTramite: 'AFILIACION',
    modalidadAfiliacion: 'INDIVIDUAL',
    tipoAfiliacion: 'COTIZANTE_CABEZA',
    regimen: 'CONTRIBUTIVO',
    tipoAfiliado: 'COTIZANTE',
    tipoCotizante: 'DEPENDIENTE',
    subTipoTramite: 'INICIO_RELACION',
    solicitudSat: 'NO',
  });

  // Copiar de principal toggle
  const [copiarDePrincipal, setCopiarDePrincipal] = useState(true);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdfBase64, setGeneratedPdfBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentPdfBase64, setCurrentPdfBase64] = useState<string | null>(null);
  const [currentPdfName, setCurrentPdfName] = useState<string>('');
  const [currentPdfError, setCurrentPdfError] = useState<string>('');
  const [isInspectingPdf, setIsInspectingPdf] = useState(false);
  const [isScanStudioOpen, setIsScanStudioOpen] = useState(false);
  const [activeSignature, setActiveSignature] = useState<'cotizante' | 'empresa' | null>(null);

  // Seleccionados
  const selectedTemplate = useMemo(() => 
    templates.find(t => t.id === selectedTemplateId),
  [templates, selectedTemplateId]);

  const selectedEmpleado = useMemo(() => 
    empleados.find(e => e.id === selectedEmpleadoId),
  [empleados, selectedEmpleadoId]);

  const templateSearchOptions = useMemo(() => templates.map(template => ({
    id: template.id,
    label: `${template.name} · ${template.entity}`,
  })), [templates]);

  const employeeSearchOptions = useMemo(() => empleados.map(employee => ({
    id: employee.id,
    label: `${employee.nombres} ${employee.apellidos} · ${employee.cedula} · ${employee.eps}`,
  })), [empleados]);

  const employeeCompany = useMemo(
    () => selectedEmpleado?.empresaId ? empresas.find(item => item.id === selectedEmpleado.empresaId) : undefined,
    [empresas, selectedEmpleado]
  );

  const selectedEmpresa = copiarDePrincipal ? (employeeCompany || empresa) : empresa;

  // Si no hay empleado seleccionado, sugerir el primero
  useEffect(() => {
    if (!selectedEmpleadoId && empleados.length > 0) {
      setSelectedEmpleadoId(empleados[0].id);
    }
  }, [empleados, selectedEmpleadoId]);

  useEffect(() => {
    const selected = templateSearchOptions.find(option => option.id === selectedTemplateId);
    if (selected) setTemplateSearch(selected.label);
  }, [selectedTemplateId, templateSearchOptions]);

  useEffect(() => {
    const selected = employeeSearchOptions.find(option => option.id === selectedEmpleadoId);
    if (selected) setEmployeeSearch(selected.label);
  }, [employeeSearchOptions, selectedEmpleadoId]);

  // Si no hay plantilla seleccionada, buscar una compatible o la primera
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      if (selectedEmpleado) {
        const match = templates.find(t => t.entity.toLowerCase().includes(selectedEmpleado.eps.toLowerCase()) || t.name.toLowerCase().includes(selectedEmpleado.eps.toLowerCase()));
        if (match) setSelectedTemplateId(match.id);
        else setSelectedTemplateId(templates[0].id);
      } else {
        setSelectedTemplateId(templates[0].id);
      }
    }
  }, [templates, selectedTemplateId, selectedEmpleado]);

  // Sincronizar tramiteValues cuando cambia el empleado
  useEffect(() => {
    if (!selectedEmpleado) return;
    const isTraslado = (selectedEmpleado.tipoAfiliacion || '').toUpperCase() === 'TRASLADO' || (selectedEmpleado.tipoNovedad || '').toUpperCase() === 'TRASLADO';
    setTramiteValues(current => ({
      ...current,
      tipoTramite: (selectedEmpleado.tipoAfiliacion === 'NUEVO' || selectedEmpleado.tipoAfiliacion === 'AFILIACION')
        ? 'AFILIACION'
        : selectedEmpleado.tipoAfiliacion || 'NOVEDAD',
      tipoCotizante: selectedEmpleado.tipoCotizante || 'DEPENDIENTE',
      modalidadAfiliacion: selectedEmpleado.modalidadAfiliacion || 'INDIVIDUAL',
      tipoAfiliacion: selectedEmpleado.tipoAfiliado === 'BENEFICIARIO' ? 'BENEFICIARIO_ADICIONAL' : 'COTIZANTE_CABEZA',
      regimen: selectedEmpleado.regimen || 'CONTRIBUTIVO',
      tipoAfiliado: selectedEmpleado.tipoAfiliado || 'COTIZANTE',
      subTipoTramite: selectedEmpleado.tipoNovedad || (selectedEmpleado.tipoAfiliacion === 'TRASLADO' ? 'TRASLADO' : (selectedEmpleado.tipoAfiliacion === 'INCLUSION' ? 'INCLUSION_BENEFICIARIOS' : 'INICIO_RELACION')),
      solicitudSat: selectedEmpleado.solicitudSat || 'NO',
      epsAnterior: isTraslado ? (selectedEmpleado.epsAnterior || '') : '',
      motivoTraslado: isTraslado ? (selectedEmpleado.motivoTraslado || '') : '',
      cajaCompensacionAnterior: selectedEmpleado.cajaCompensacionAnterior || '',
      fechaNovedad: selectedEmpleado.fechaNovedad || selectedEmpleado.fechaIngreso || new Date().toISOString().slice(0, 10),
      codigoRegistroEpsTramite: selectedEmpleado.codigoRegistroEps || '',
    }));
  }, [selectedEmpleado]);

  useEffect(() => {
    setGeneratedPdfBase64(null);
    setSaveSuccess(false);
    const defaults = buildOperationalDefaults(selectedTemplate, selectedEmpleado);
    if (!selectedTemplate || !selectedEmpleado) {
      setManualValues(defaults);
      return;
    }
    try {
      const rawDraft = localStorage.getItem(draftKey(selectedTemplate.id, selectedEmpleado.id));
      if (!rawDraft) {
        setManualValues(defaults);
        return;
      }
      const draft = JSON.parse(rawDraft) as {
        manualValues?: Record<string, string>;
        tramiteValues?: Record<string, string>;
      };
      setManualValues({ ...defaults, ...(draft.manualValues || {}) });
      if (draft.tramiteValues) {
        setTramiteValues(current => ({ ...current, ...draft.tramiteValues }));
      }
    } catch {
      setManualValues(defaults);
    }
  }, [selectedEmpleado, selectedEmpleadoId, selectedTemplate, selectedTemplateId]);

  useEffect(() => {
    setCurrentPdfBase64(null);
    setCurrentPdfName('');
    setCurrentPdfError('');
  }, [selectedTemplateId]);

  useEffect(() => {
    setGeneratedPdfBase64(null);
    setSaveSuccess(false);
  }, [manualValues, tramiteValues]);

  useEffect(() => {
    if (!generatedPdfBase64) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(pdfBase64ToBlob(generatedPdfBase64));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [generatedPdfBase64]);

  useEffect(() => {
    if (!activeSignature) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveSignature(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeSignature]);

  // Cálculo de secciones completas (0/5)
  const completedSections = useMemo(() => {
    let count = 0;
    // Sec 1: Datos personales
    if (selectedEmpleado && selectedEmpleado.cedula && selectedEmpleado.primerNombre && selectedEmpleado.primerApellido) {
      count++;
    }
    // Sec 2: Entidad y residencia
    if (selectedEmpleado && selectedEmpleado.eps && selectedEmpleado.direccion) {
      count++;
    }
    // Sec 3: Datos laborales
    if (selectedEmpleado && selectedEmpleado.cargo && selectedEmpleado.salarioBase > 0) {
      count++;
    }
    // Sec 4: Empresa
    if (selectedEmpresa && selectedEmpresa.nit && selectedEmpresa.razonSocial) {
      count++;
    }
    // Sec 5: Beneficiarios / Documentos
    if (selectedEmpleado && (selectedEmpleado.tipoAfiliacion === 'NOVEDAD' || selectedEmpleado.beneficiarios?.length !== undefined)) {
      count++;
    }
    return count;
  }, [selectedEmpleado, selectedEmpresa]);

  const handleGenerate = async () => {
    if (!selectedTemplate || !selectedEmpleado) {
      alert('Por favor selecciona una plantilla y un empleado.');
      return;
    }
    if (!isTemplateCompatibleWithEmployee(selectedTemplate, selectedEmpleado)) {
      alert(`La plantilla seleccionada corresponde a ${selectedTemplate.entity}, pero el afiliado está registrado en ${selectedEmpleado.eps}. Selecciona la plantilla de la misma EPS.`);
      return;
    }
    if (!selectedEmpresa?.nit || !selectedEmpresa.razonSocial) {
      alert('El afiliado no tiene una empresa aportante completa asociada. Corrige el expediente antes de generar.');
      return;
    }
    const requiredCotizante = [
      ['tipo de documento', selectedEmpleado.tipoDocumento],
      ['número de documento', selectedEmpleado.numeroDocumento || selectedEmpleado.cedula],
      ['primer nombre', selectedEmpleado.primerNombre || selectedEmpleado.nombres],
      ['primer apellido', selectedEmpleado.primerApellido || selectedEmpleado.apellidos],
      ['fecha de nacimiento', selectedEmpleado.fechaNacimiento],
      ['nacionalidad', selectedEmpleado.nacionalidad],
      ['sexo', selectedEmpleado.sexo],
      ['departamento de residencia', selectedEmpleado.departamentoResidencia],
      ['ciudad de residencia', selectedEmpleado.ciudadResidencia],
      ['dirección', selectedEmpleado.direccion],
      ['teléfono', selectedEmpleado.telefonoCotizante],
    ].filter(([, value]) => !String(value || '').trim());
    if (requiredCotizante.length) {
      alert(`Faltan datos obligatorios del cotizante: ${requiredCotizante.map(([label]) => label).join(', ')}. Completa el expediente antes de radicar.`);
      return;
    }
    if (!cotizanteSignature) {
      alert('Falta la firma del afiliado / cotizante. Abre la ventana de firma antes de generar el formulario.');
      setActiveSignature('cotizante');
      return;
    }

    setIsGenerating(true);
    setSaveSuccess(false);
    try {
      // Defensa inmediata para copias antiguas que guardaron Sanitas como un
      // formulario de tres páginas. No se envían al motor campos de esa página.
      const effectivePageCount = effectiveTemplatePageCount(selectedTemplate);
      const currentTemplate: FormTemplate = {
        ...selectedTemplate,
        totalPages: effectivePageCount,
        pageSizes: selectedTemplate.pageSizes?.slice(0, effectivePageCount),
        fields: selectedTemplate.fields.filter(field => field.page >= 0 && field.page < effectivePageCount),
      };
      const selectedPdfTemplate: FormTemplate = currentPdfBase64 ? {
        ...currentTemplate,
        pdfBase64: currentPdfBase64,
        pdfAssetPath: undefined,
        pdfFileName: currentPdfName || currentTemplate.pdfFileName,
      } : currentTemplate;

      const primaryProcess = (tramiteValues.tipoTramite || '').trim().toUpperCase();
      const isTraslado = primaryProcess
        ? primaryProcess === 'TRASLADO'
        : (tramiteValues.subTipoTramite || '').trim().toUpperCase() === 'TRASLADO';
      const effectiveTramiteValues = {
        ...tramiteValues,
        ...(usesGeneralSgsssRules(selectedTemplate) ? {
          tipoTramite: manualValues.tipoTramiteSeccionI === 'REPORTE_NOVEDADES' ? 'NOVEDAD' : 'AFILIACION',
          tipoAfiliacion: 'COTIZANTE_CABEZA',
          regimen: 'CONTRIBUTIVO',
        } : {}),
        epsAnterior: isTraslado ? (tramiteValues.epsAnterior || '') : '',
        motivoTraslado: isTraslado ? (tramiteValues.motivoTraslado || '') : '',
      };
      const effectiveManualValues = {
        ...manualValues,
        ...(usesGeneralSgsssRules(selectedTemplate) ? {
          declaracionFuerzaMayorDocumentos: '',
          declaracionNoInternacion: '',
          aceptacionContribucionSolidaria: '',
          aceptacionActualizacionTarifas: '',
          ...Object.fromEntries([...GENERAL_SGSSS_ALWAYS_BLANK].map(key => [key, ''])),
          ...Object.fromEntries(GENERAL_SGSSS_DECLARATIONS.map(key => [key, 'X'])),
        } : {}),
        ...(isTraslado ? {} : { motivoTraslado: '', epsAnterior: '' }),
      };
      const activeTemplate = generalSgsssGenerationTemplate(selectedPdfTemplate, effectiveManualValues);

      let base64Pdf = await fillPDFTemplate(
        activeTemplate,
        selectedEmpleado,
        selectedEmpresa,
        effectiveManualValues,
        effectiveTramiteValues
      );

      const registros = ordenDocumentos(selectedEmpleado.documentos || []);
      const archivos = (await Promise.all(registros.map(item => obtenerSoporte(item.id)))).filter((item): item is File => Boolean(item));
      if (archivos.length > 0) {
        base64Pdf = await anexarSoportesAPdf(base64Pdf, archivos);
      }

      setGeneratedPdfBase64(base64Pdf);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(error instanceof Error ? error.message : 'Error al generar el formulario.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedPdfBase64 || !selectedTemplate || !selectedEmpleado) return;
    try {
      const blob = pdfBase64ToBlob(generatedPdfBase64);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      const filename = `${selectedTemplate.name.replace(/\s+/g, '_')}_${selectedEmpleado.nombres.replace(/\s+/g, '_')}_${date}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    }
  };

  const handlePrint = () => {
    if (!previewUrl) return;
    const printWindow = window.open(previewUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleSaveToHistory = async () => {
    if (!generatedPdfBase64 || !selectedTemplate || !selectedEmpleado) return;
    try {
      await saveGeneratedForm({
        id: crypto.randomUUID(),
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        empleadoId: selectedEmpleado.id,
        empleadoNombre: `${selectedEmpleado.nombres} ${selectedEmpleado.apellidos}`,
        generatedAt: new Date().toISOString(),
        pdfResultBase64: generatedPdfBase64,
        manualFields: manualValues,
        tramiteFields: tramiteValues,
        sourcePdfFileName: currentPdfName || selectedTemplate.pdfFileName,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving to history:", error);
      alert("Error al guardar en el historial.");
    }
  };

  const handleCurrentPdfUpload = async (file?: File) => {
    if (!file || !selectedTemplate) return;
    setIsInspectingPdf(true);
    setCurrentPdfError('');
    try {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Selecciona una copia oficial en formato PDF.');
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const base64 = bytesToBase64(bytes);
      const inspection = await inspectPDFTemplate(base64);
      if (inspection.populatedAcroFieldCount > 0) {
        throw new Error('Esta copia contiene campos interactivos ya diligenciados. Usa una copia oficial limpia.');
      }
      const requiredPageCount = effectiveTemplatePageCount(selectedTemplate);
      if (inspection.pageCount !== requiredPageCount) {
        throw new Error(`La copia tiene ${inspection.pageCount} páginas y el mapeo requiere ${requiredPageCount}.`);
      }
      if (selectedTemplate.pageSizes?.length) {
        const incompatiblePage = selectedTemplate.pageSizes.slice(0, requiredPageCount).findIndex((expected, index) => {
          const actual = inspection.pageSizes[index];
          return !actual || Math.abs(expected.width - actual.width) > 2 || Math.abs(expected.height - actual.height) > 2;
        });
        if (incompatiblePage >= 0) {
          throw new Error(`La página ${incompatiblePage + 1} no tiene el tamaño del formulario configurado. No se aplicará este mapeo.`);
        }
      }
      if (selectedTemplate.layoutFingerprint && inspection.layoutFingerprint && selectedTemplate.layoutFingerprint !== inspection.layoutFingerprint) {
        throw new Error('La distribución de esta copia no coincide con la versión configurada de la plantilla.');
      }
      setCurrentPdfBase64(base64);
      setCurrentPdfName(file.name);
    } catch (error) {
      setCurrentPdfBase64(null);
      setCurrentPdfName(file.name);
      setCurrentPdfError(error instanceof Error ? error.message : 'No se pudo validar este PDF.');
    } finally {
      setIsInspectingPdf(false);
    }
  };

  const handleSaveDraft = () => {
    if (!selectedTemplate || !selectedEmpleado) {
      alert('Selecciona una plantilla y un afiliado antes de guardar el borrador.');
      return;
    }
    try {
      localStorage.setItem(draftKey(selectedTemplate.id, selectedEmpleado.id), JSON.stringify({
        manualValues,
        tramiteValues,
        updatedAt: new Date().toISOString(),
      }));
      alert('Borrador guardado en este equipo. Se recuperará al volver a elegir esta plantilla y este afiliado.');
    } catch {
      alert('No se pudo guardar el borrador. El almacenamiento del equipo puede estar lleno.');
    }
  };

  const cotizanteSignature = manualValues.firmaDigitalCotizante || selectedEmpleado?.firmaDigitalCotizante || '';
  const empresaSignature = manualValues.firmaDigitalEmpresa || selectedEmpleado?.firmaDigitalEmpresa || '';
  const identityDocument = selectedEmpleado?.documentos?.find(document => document.categoria === 'COTIZANTE');
  const otherDocumentCount = Math.max(0, (selectedEmpleado?.documentos?.length || 0) - (identityDocument ? 1 : 0));

  return (
    <div className="w-full space-y-5 select-none font-sans text-slate-100">
      
      {/* ── BARRA SUPERIOR EMPRESARIAL ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#c4d600]/20 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0c1825] text-slate-300 transition hover:border-[#c4d600] hover:text-[#c4d600]"
            title="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#c4d600] animate-pulse" />
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase font-sans">
                VALIDUM <span className="text-[#c4d600]">·</span> NUEVA SOLICITUD DE AFILIACIÓN
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Generador unificado de formularios oficiales SGSSS con validación y firma interactiva
            </p>
          </div>
        </div>

        {/* Selector activo de Plantilla y Empleado en Barra */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#0c1825] px-3 py-1.5 shadow-inner">
            <span className="text-[10px] font-bold uppercase text-[#c4d600]">Plantilla:</span>
            <input
              type="search"
              list="validum-template-options"
              value={templateSearch}
              onChange={event => {
                const value = event.target.value;
                setTemplateSearch(value);
                const match = templateSearchOptions.find(option => option.label === value);
                if (match) setSelectedTemplateId(match.id);
              }}
              onBlur={() => {
                const selected = templateSearchOptions.find(option => option.id === selectedTemplateId);
                if (selected) setTemplateSearch(selected.label);
              }}
              placeholder="Buscar EPS o plantilla"
              aria-label="Buscar EPS o plantilla"
              className="w-[250px] bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-500"
            />
            <datalist id="validum-template-options">
              {templateSearchOptions.map(option => <option key={option.id} value={option.label} />)}
            </datalist>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#0c1825] px-3 py-1.5 shadow-inner">
            <span className="text-[10px] font-bold uppercase text-[#c4d600]">Afiliado:</span>
            <input
              type="search"
              list="validum-employee-options"
              value={employeeSearch}
              onChange={event => {
                const value = event.target.value;
                setEmployeeSearch(value);
                const match = employeeSearchOptions.find(option => option.label === value);
                if (match) setSelectedEmpleadoId(match.id);
              }}
              onBlur={() => {
                const selected = employeeSearchOptions.find(option => option.id === selectedEmpleadoId);
                if (selected) setEmployeeSearch(selected.label);
              }}
              placeholder="Nombre, documento o EPS"
              aria-label="Buscar afiliado por nombre, documento o EPS"
              className="w-[300px] bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-500"
            />
            <datalist id="validum-employee-options">
              {employeeSearchOptions.map(option => <option key={option.id} value={option.label} />)}
            </datalist>
          </div>
        </div>
      </div>

      {/* ── BARRA DE PROGRESO DE SECCIONES (Idéntica a captura) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-[#c4d600]/30 bg-[#0b1724]/90 px-5 py-3 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Secciones completas:</span>
          <span className="text-xs font-extrabold text-[#c4d600]">{completedSections} / 5</span>
        </div>

        {/* Línea de progreso interactiva con nodos */}
        <div className="flex-1 max-w-2xl mx-2 flex items-center relative">
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8ba100] to-[#c4d600] transition-all duration-500 rounded-full"
              style={{ width: `${(completedSections / 5) * 100}%` }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-1">
            {[1, 2, 3, 4, 5].map(stepNum => {
              const isDone = stepNum <= completedSections;
              return (
                <div
                  key={stepNum}
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all shadow-md ${
                    isDone
                      ? 'bg-[#c4d600] text-[#0b1724] ring-2 ring-[#c4d600]/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isDone ? <Check className="h-3 w-3 stroke-[3]" /> : stepNum}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#c4d600]">
          <ShieldCheck className="h-4 w-4" /> Formulario Oficial MinSalud
        </div>
      </div>

      {/* La configuración se reutiliza sobre una copia limpia del mismo formulario. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-[#0c1825] px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-200">
            <FileCheck2 className="h-4 w-4 text-[#c4d600]" />
            Copia oficial a diligenciar
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {currentPdfBase64
              ? `${currentPdfName} · validado para este mapeo`
              : `Se usará la copia base de ${selectedTemplate?.name || 'la plantilla seleccionada'}. Puedes cargar otra copia limpia de la misma versión.`}
          </p>
          {currentPdfError && (
            <p className="mt-1 text-[11px] font-bold text-rose-400">{currentPdfError}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {currentPdfBase64 && (
            <button
              type="button"
              onClick={() => {
                setCurrentPdfBase64(null);
                setCurrentPdfName('');
                setCurrentPdfError('');
              }}
              className="rounded-xl border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800"
            >
              Usar copia base
            </button>
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#c4d600]/40 bg-[#c4d600]/10 px-4 py-2 text-[11px] font-black text-[#c4d600] hover:bg-[#c4d600]/20">
            {isInspectingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isInspectingPdf ? 'Validando...' : 'Cargar copia vigente'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={isInspectingPdf || !selectedTemplate}
              className="hidden"
              onChange={event => {
                void handleCurrentPdfUpload(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {/* ── GRID PRINCIPAL DE 6 TARJETAS (ESTRUCTURA DE TU CAPTURA) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* 1. DATOS PERSONALES */}
        <div className="rounded-2xl border border-[#c4d600]/30 bg-[#091522] p-4 shadow-xl hover:border-[#c4d600]/60 transition">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#c4d600]">
              1. DATOS PERSONALES
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
              {selectedEmpleado?.tipoDocumento || 'CC'}
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Tipo documento *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-semibold text-slate-200">
                  {selectedEmpleado?.tipoDocumento || 'CC'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Número documento *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-mono font-bold text-white truncate">
                  {selectedEmpleado?.numeroDocumento || selectedEmpleado?.cedula || 'SIN DOCUMENTO'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Primer nombre *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-bold text-slate-200 truncate">
                  {selectedEmpleado?.primerNombre || selectedEmpleado?.nombres.split(' ')[0] || '---'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Segundo nombre</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs text-slate-300 truncate">
                  {selectedEmpleado?.segundoNombre || selectedEmpleado?.nombres.split(' ').slice(1).join(' ') || '---'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Primer apellido *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-bold text-slate-200 truncate">
                  {selectedEmpleado?.primerApellido || selectedEmpleado?.apellidos.split(' ')[0] || '---'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Segundo apellido</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs text-slate-300 truncate">
                  {selectedEmpleado?.segundoApellido || selectedEmpleado?.apellidos.split(' ').slice(1).join(' ') || '---'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Sexo *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-semibold text-slate-200">
                  {selectedEmpleado?.sexo === 'M' ? 'MASCULINO' : 'FEMENINO'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Identidad de género *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-semibold text-slate-200 truncate">
                  {selectedEmpleado?.identidadGenero || (selectedEmpleado?.sexo === 'M' ? 'MASCULINO' : 'FEMENINO')}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Fecha nacimiento *</label>
              <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-mono font-bold text-white">
                {selectedEmpleado?.fechaNacimiento || 'DD/MM/AAAA'}
              </div>
            </div>
          </div>
        </div>

        {/* 2. ENTIDAD Y RESIDENCIA */}
        <div className="rounded-2xl border border-[#c4d600]/30 bg-[#091522] p-4 shadow-xl hover:border-[#c4d600]/60 transition">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#c4d600]">
              2. ENTIDAD Y RESIDENCIA
            </h3>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
              {selectedEmpleado?.eps || 'EPS'}
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Entidad de salud (EPS) *</label>
              <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-bold text-[#c4d600]">
                {selectedEmpleado?.eps || 'Sanitas'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Depto/Ciudad Nacimiento *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs text-slate-200 truncate">
                  {[selectedEmpleado?.departamentoNacimiento, selectedEmpleado?.ciudadNacimiento].filter(Boolean).join(' / ') || 'BOGOTÁ D.C.'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Depto/Ciudad Expedición *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs text-slate-200 truncate">
                  {[selectedEmpleado?.departamentoExpedicion, selectedEmpleado?.ciudadExpedicion].filter(Boolean).join(' / ') || 'BOGOTÁ D.C.'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Ciudad Residencia *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs text-slate-200 truncate">
                  {selectedEmpleado?.ciudadResidencia || 'BOGOTÁ'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Fecha expedición</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-mono text-slate-300 truncate">
                  {selectedEmpleado?.fechaExpedicion || 'DD/MM/AAAA'}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Dirección y Barrio *</label>
              <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs text-slate-200 truncate">
                {[selectedEmpleado?.direccion, selectedEmpleado?.barrio].filter(Boolean).join(' · ') || 'Dirección registrada'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Residencia *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-semibold text-slate-200 truncate">
                  {selectedEmpleado?.zona === 'R' ? 'RURAL (R)' : 'CABECERA MUNICIPAL (U)'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Correo electrónico</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-mono text-slate-300 truncate">
                  {selectedEmpleado?.emailCotizante || 'cotizante@email.com'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. DATOS LABORALES Y AFILIACIÓN */}
        <div className="rounded-2xl border border-[#c4d600]/30 bg-[#091522] p-4 shadow-xl hover:border-[#c4d600]/60 transition">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#c4d600]">
              3. DATOS LABORALES Y AFILIACIÓN
            </h3>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
              {tramiteValues.tipoTramite || 'AFILIACIÓN'}
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Tipo de Solicitud *</label>
                <select
                  value={tramiteValues.tipoTramite}
                  onChange={e => {
                    const tipoTramite = e.target.value;
                    setTramiteValues(current => ({
                      ...current,
                      tipoTramite,
                      epsAnterior: tipoTramite === 'TRASLADO' ? current.epsAnterior : '',
                      motivoTraslado: tipoTramite === 'TRASLADO' ? current.motivoTraslado : '',
                      subTipoTramite: tipoTramite === 'TRASLADO'
                        ? 'TRASLADO'
                        : tipoTramite === 'INCLUSION'
                          ? 'INCLUSION_BENEFICIARIOS'
                          : tipoTramite === 'AFILIACION'
                            ? 'INICIO_RELACION'
                            : current.tipoTramite === 'NOVEDAD'
                              ? current.subTipoTramite || 'MODIFICACION_DATOS'
                              : 'MODIFICACION_DATOS',
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-bold text-[#c4d600] outline-none focus:border-[#c4d600]"
                >
                  <option value="AFILIACION">NUEVO (Afiliación)</option>
                  <option value="NOVEDAD">NOVEDAD</option>
                  <option value="TRASLADO">TRASLADO</option>
                  <option value="INCLUSION">INCLUSIÓN</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Categoría / Cotizante *</label>
                <select
                  value={tramiteValues.tipoCotizante}
                  onChange={e => setTramiteValues(v => ({ ...v, tipoCotizante: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-[#c4d600]"
                >
                  <option value="DEPENDIENTE">DEPENDIENTE</option>
                  <option value="INDEPENDIENTE">INDEPENDIENTE</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">ARL *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-semibold text-slate-200 truncate">
                  {selectedEmpleado?.arl || selectedEmpresa?.arl || 'Positiva'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Fondo Pensiones *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-semibold text-slate-200 truncate">
                  {selectedEmpleado?.afp || 'Porvenir'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Salario / IBC *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-400">
                  {selectedEmpleado?.salarioBase
                    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(selectedEmpleado.salarioBase)
                    : '$ 1.750.905'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Fecha ingreso *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-mono font-bold text-white">
                  {selectedEmpleado?.fechaIngreso || new Date().toISOString().split('T')[0]}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Cargo registrado *</label>
              <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-bold text-slate-200 truncate">
                {selectedEmpleado?.cargo || 'Empleado'}
              </div>
            </div>

            {/* Campos condicionales si es TRASLADO */}
            {tramiteValues.tipoTramite === 'TRASLADO' && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 space-y-2">
                <label className="block text-[10px] font-bold text-amber-300 uppercase">EPS Anterior</label>
                <input
                  type="text"
                  placeholder="DIGITE EPS ANTERIOR"
                  value={tramiteValues.epsAnterior || ''}
                  onChange={e => setTramiteValues(v => ({ ...v, epsAnterior: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-[#060e18] px-2 py-1 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>
            )}

            {tramiteValues.tipoTramite === 'NOVEDAD' && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-2.5 space-y-2">
                <label className="block text-[10px] font-bold text-cyan-300 uppercase">Tipo específico de novedad</label>
                <select
                  value={tramiteValues.subTipoTramite || 'MODIFICACION_DATOS'}
                  onChange={e => setTramiteValues(values => ({ ...values, subTipoTramite: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-[#060e18] px-2 py-1 text-xs text-white outline-none focus:border-cyan-400"
                >
                  {NOVEDADES_SGSSS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 4. DATOS DE EMPRESA */}
        <div className="rounded-2xl border border-[#c4d600]/30 bg-[#091522] p-4 shadow-xl hover:border-[#c4d600]/60 transition">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#c4d600]">
              4. DATOS DE EMPRESA
            </h3>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 cursor-pointer">
              <span>Copiar de principal</span>
              <input
                type="checkbox"
                checked={copiarDePrincipal}
                onChange={e => setCopiarDePrincipal(e.target.checked)}
                className="accent-[#c4d600] rounded"
              />
            </label>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Tipo doc. empresa</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-bold text-slate-200">
                  {selectedEmpresa?.tipoDocumento || 'NIT'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Número documento *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-mono font-bold text-white truncate">
                  {selectedEmpresa?.nit ? `${selectedEmpresa.nit}${selectedEmpresa.dv ? `-${selectedEmpresa.dv}` : ''}` : 'Sin NIT asociado'}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Razón Social *</label>
              <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-bold text-[#c4d600] truncate">
                {selectedEmpresa?.razonSocial || 'Sin empresa asociada'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Departamento *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs text-slate-200 truncate">
                  {selectedEmpresa?.departamento || 'Sin departamento'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Ciudad *</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs text-slate-200 truncate">
                  {selectedEmpresa?.ciudad || 'Sin ciudad'}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Dirección de la empresa *</label>
              <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs text-slate-200 truncate">
                {selectedEmpresa?.direccion || 'Sin dirección registrada'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-mono text-slate-300 truncate">
                  {selectedEmpresa?.telefono || 'Sin teléfono'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Correo empresa</label>
                <div className="mt-1 rounded-xl border border-slate-700 bg-[#060e18] px-2.5 py-1.5 text-xs font-mono text-slate-300 truncate">
                  {selectedEmpresa?.email || selectedEmpresa?.emailContacto || 'Sin correo'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. BENEFICIARIOS */}
        <div className="rounded-2xl border border-[#c4d600]/30 bg-[#091522] p-4 shadow-xl hover:border-[#c4d600]/60 transition">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#c4d600]">
              5. BENEFICIARIOS
            </h3>
            <button
              onClick={() => setActiveTab('empleados')}
              className="rounded-lg bg-[#c4d600]/20 border border-[#c4d600]/40 px-2.5 py-1 text-[10px] font-bold text-[#c4d600] hover:bg-[#c4d600] hover:text-[#0b1724] transition"
            >
              Añadir Beneficiario
            </button>
          </div>

          <div className="space-y-2.5">
            {selectedEmpleado?.beneficiarios && selectedEmpleado.beneficiarios.length > 0 ? (
              <div className="space-y-2">
                {selectedEmpleado.beneficiarios.map((ben, idx) => (
                  <div key={ben.id || idx} className="rounded-xl border border-slate-800 bg-[#060e18] p-2.5 text-xs">
                    <div className="flex justify-between items-center text-[10px] font-bold text-[#c4d600]">
                      <span>{ben.parentesco || 'BENEFICIARIO'}</span>
                      <span className="font-mono text-slate-400">{ben.tipoDocumento} {ben.numeroDocumento}</span>
                    </div>
                    <p className="font-bold text-white mt-1">{ben.primerNombre} {ben.primerApellido}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-500">
                <p className="text-xs">Sin beneficiarios registrados.</p>
                <p className="text-[10px] text-slate-500 mt-1">El cotizante se afiliará de manera individual.</p>
              </div>
            )}
          </div>
        </div>

        {usesGeneralSgsssRules(selectedTemplate) && (
          <details open className="rounded-2xl border border-[#c4d600]/35 bg-[#091522] p-4 shadow-xl lg:col-span-2">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-[#c4d600]">
              Especificaciones del formulario
            </summary>
            <p className="mt-2 text-[10px] text-slate-400">
              Esta elección controla únicamente el tipo de trámite de la sección I. La novedad específica conserva la configuración propia de cada EPS.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ['AFILIACION', 'Afiliación', 'Marca únicamente “A. Afiliación”'],
                ['REPORTE_NOVEDADES', 'Reporte de novedades', 'Marca únicamente “B. Reporte de novedades”'],
              ].map(([value, label, description]) => {
                const selected = (manualValues.tipoTramiteSeccionI || 'AFILIACION') === value;
                return (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-xl border p-3 transition ${selected ? 'border-[#c4d600] bg-[#c4d600]/10' : 'border-slate-700 bg-[#060e18] hover:border-slate-500'}`}
                  >
                    <span className="flex items-center gap-2 text-xs font-black text-white">
                      <input
                        type="radio"
                        name="sanitas-tipo-tramite-seccion-i"
                        value={value}
                        checked={selected}
                        onChange={() => setManualValues(values => ({ ...values, tipoTramiteSeccionI: value }))}
                        className="accent-[#c4d600]"
                      />
                      {label}
                    </span>
                    <span className="mt-1 block pl-5 text-[10px] text-slate-400">{description}</span>
                  </label>
                );
              })}
            </div>
          </details>
        )}

        {/* Campos operativos que solo se imprimen cuando el asesor los diligencia. */}
        <details className="rounded-2xl border border-cyan-500/30 bg-[#091522] p-4 shadow-xl lg:col-span-2">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-cyan-300">
            Datos adicionales de radicación (opcionales)
          </summary>
          <p className="mt-2 text-[10px] text-slate-400">
            Observaciones, ejecutivo comercial, fecha de novedad, caja de compensación y sello. Los campos vacíos no se imprimen.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[10px] font-bold uppercase text-slate-400">
              66. Fecha de novedad
              <input
                type="date"
                value={tramiteValues.fechaNovedad || ''}
                onChange={event => setTramiteValues(values => ({ ...values, fechaNovedad: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#060e18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              68. Caja de compensación
              <input
                value={tramiteValues.cajaCompensacionAnterior || ''}
                onChange={event => setTramiteValues(values => ({ ...values, cajaCompensacionAnterior: event.target.value }))}
                placeholder="Opcional"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#060e18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              Documento del ejecutivo
              <input
                value={manualValues.ejecutivoComercialDocumento || ''}
                onChange={event => setManualValues(values => ({ ...values, ejecutivoComercialDocumento: event.target.value }))}
                placeholder="CC / número"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#060e18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              Nombre del ejecutivo
              <input
                value={manualValues.ejecutivoComercialNombre || ''}
                onChange={event => setManualValues(values => ({ ...values, ejecutivoComercialNombre: event.target.value }))}
                placeholder="Nombre completo"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#060e18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-400 sm:col-span-2 lg:col-span-3">
              Observaciones del funcionario
              <textarea
                value={manualValues.observaciones || ''}
                onChange={event => setManualValues(values => ({ ...values, observaciones: event.target.value }))}
                rows={2}
                placeholder="Escriba únicamente cuando sea necesario"
                className="mt-1 w-full resize-y rounded-xl border border-slate-700 bg-[#060e18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="flex items-center gap-2 self-end rounded-xl border border-slate-700 bg-[#060e18] px-3 py-2 text-[10px] font-bold uppercase text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(manualValues.selloRadicacion)}
                onChange={event => setManualValues(values => ({ ...values, selloRadicacion: event.target.checked ? 'RADICADO' : '' }))}
                className="accent-[#c4d600]"
              />
              Imprimir sello de radicación
            </label>
          </div>
        </details>

        {/* 6. DOCUMENTOS Y FIRMAS (IDÉNTICO A CAPTURA DERECHA INFERIOR) */}
        <div className="rounded-2xl border border-[#c4d600]/30 bg-[#091522] p-4 shadow-xl hover:border-[#c4d600]/60 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#c4d600]">
                DOCUMENTOS Y FIRMAS
              </h3>
              <span className="text-[10px] font-bold text-slate-400">
                {selectedEmpleado?.documentos?.length || 0} soportes
              </span>
            </div>

            {/* Resumen de documentos: la carga se administra desde el expediente. */}
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveTab('empleados')}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-700 bg-[#060e18] p-3 text-left transition hover:border-[#c4d600]/60"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${identityDocument ? 'bg-[#c4d600]/15 text-[#c4d600]' : 'bg-slate-800 text-slate-400'}`}>
                  {identityDocument ? <CheckCircle2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-200">Documento de identidad</p>
                  <p className="truncate text-[9px] text-slate-500">{identityDocument?.nombre || 'Agregar desde el expediente'}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('empleados')}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-700 bg-[#060e18] p-3 text-left transition hover:border-[#c4d600]/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-200">Otros soportes</p>
                  <p className="text-[9px] text-slate-500">{otherDocumentCount ? `${otherDocumentCount} archivo(s) adicional(es)` : 'Ningún archivo adicional'}</p>
                </div>
              </button>
            </div>

            {/* Las firmas se capturan en una ventana amplia para evitar controles comprimidos. */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setActiveSignature('cotizante')}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[#060e18] p-3 text-left transition hover:border-cyan-500/60"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${cotizanteSignature ? 'border-emerald-500/40 bg-white' : 'border-slate-700 bg-slate-800'}`}>
                    {cotizanteSignature
                      ? <img src={cotizanteSignature} alt="Firma del cotizante" className="h-full w-full object-contain" />
                      : <PenTool className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-200">Firma del cotizante *</p>
                    <p className={`text-[9px] ${cotizanteSignature ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {cotizanteSignature ? 'Firma registrada' : 'Pendiente de firma'}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold text-cyan-300">
                  {cotizanteSignature ? 'Editar' : 'Firmar'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSignature('empresa')}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[#060e18] p-3 text-left transition hover:border-cyan-500/60"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${empresaSignature ? 'border-emerald-500/40 bg-white' : 'border-slate-700 bg-slate-800'}`}>
                    {empresaSignature
                      ? <img src={empresaSignature} alt="Firma de la empresa" className="h-full w-full object-contain" />
                      : <PenTool className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-200">Firma de la empresa</p>
                    <p className={`text-[9px] ${empresaSignature ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {empresaSignature ? 'Firma registrada' : 'Opcional'}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold text-cyan-300">
                  {empresaSignature ? 'Editar' : 'Firmar'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTONES PRINCIPALES DE ACCIÓN INFERIORES (GUARDAR BORRADOR / RADICAR SOLICITUD) ── */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={handleSaveDraft}
          className="w-full sm:w-auto rounded-xl border border-slate-700 bg-[#0c1825] px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
        >
          GUARDAR BORRADOR
        </button>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !selectedTemplate || !selectedEmpleado}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#c4d600] px-8 py-3 text-xs font-black uppercase tracking-wider text-[#091522] shadow-lg shadow-[#c4d600]/20 transition hover:bg-[#d6e800] hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              PROCESANDO FORMULARIO...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 stroke-[2.5]" />
              RADICAR SOLICITUD
            </>
          )}
        </button>
      </div>

      {/* ── VISTA PREVIA Y DESCARGA SI SE GENERÓ EL PDF ── */}
      {generatedPdfBase64 && (
        <div className="mt-6 rounded-3xl border border-[#c4d600]/40 bg-[#091522] p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#c4d600]/20 text-[#c4d600]">
                <FileCheck2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Formulario Generado con Éxito
                </h3>
                <p className="text-xs text-slate-400">
                  Documento oficial listo para radicación electrónica o impresión
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsScanStudioOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition"
              >
                <Scan className="h-4 w-4" /> Efecto Escáner LookScanned
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
              >
                <Download className="h-4 w-4" /> Descargar PDF
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
              >
                <Printer className="h-4 w-4" /> Imprimir
              </button>

              <button
                onClick={handleSaveToHistory}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  saveSuccess
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-[#c4d600] text-[#091522] hover:bg-[#d6e800]'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Guardado en Historial
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Guardar en Historial
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="w-full h-[650px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <iframe
              src={previewUrl || undefined}
              className="w-full h-full border-none"
              title="Vista previa del formulario PDF"
            />
          </div>
        </div>
      )}

      {/* Ventana amplia de captura para mouse, lápiz óptico o tableta. */}
      {activeSignature && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-700 bg-[#0c1825] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h3 className="text-base font-black text-white">
                  {activeSignature === 'cotizante' ? 'Firma del afiliado / cotizante' : 'Firma de la empresa'}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Usa el mouse, una pantalla táctil, lápiz óptico o carga una imagen de firma.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSignature(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Cerrar ventana de firma"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <SignaturePad
                label={activeSignature === 'cotizante' ? 'Firma Digital del Cotizante' : 'Firma Digital de la Empresa'}
                required={activeSignature === 'cotizante'}
                value={activeSignature === 'cotizante' ? cotizanteSignature : empresaSignature}
                onChange={signature => {
                  if (activeSignature === 'cotizante') {
                    setManualValues(values => ({ ...values, firmaDigitalCotizante: signature, firmaCotizante: signature }));
                  } else {
                    setManualValues(values => ({ ...values, firmaDigitalEmpresa: signature, firmaEmpresa: signature }));
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-end border-t border-slate-800 bg-[#091522] px-5 py-4">
              <button
                type="button"
                onClick={() => setActiveSignature(null)}
                className="rounded-xl bg-[#c4d600] px-6 py-2.5 text-xs font-black text-[#091522] hover:bg-[#d6e800]"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal LookScanned Studio */}
      {isScanStudioOpen && generatedPdfBase64 && (
        <LookScannedStudio
          sourceFile={generatedPdfBase64}
          sourceFileName={`${selectedTemplate?.name || 'formulario'}_${selectedEmpleado?.primerNombre || 'cotizante'}.pdf`}
          onClose={() => setIsScanStudioOpen(false)}
        />
      )}
    </div>
  );
};
