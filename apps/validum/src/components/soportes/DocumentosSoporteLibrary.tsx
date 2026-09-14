import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Search,
  Filter,
  UploadCloud,
  FileText,
  Scan,
  Download,
  Trash2,
  Eye,
  Grid,
  List,
  UserCheck,
  Sparkles,
  CheckCircle2,
  HardDrive,
  FileCheck,
  RefreshCw,
  Plus,
  X,
  FileImage,
  Tag,
  Clock,
  Layers
} from 'lucide-react';
import { useValidum } from '../../context/ValidumContext';
import type { SoporteDocumento, CategoriaSoporte } from '../../types/soporte';
import {
  fetchDocumentosSoporte,
  uploadDocumentoSoporte,
  deleteDocumentoSoporte,
  updateDocumentoMetadata,
  getDocumentoBlob,
  isSupabaseConfigured
} from '../../lib/supabaseClient';
import { LookScannedStudio } from '../scanner/LookScannedStudio';

const CATEGORIAS: ('Todas' | CategoriaSoporte)[] = [
  'Todas',
  'Identificación',
  'Certificado Bancario',
  'RUT',
  'Contrato',
  'Seguridad Social',
  'Formulario Firmado',
  'Afiliación EPS',
  'Otro'
];

export const DocumentosSoporteLibrary: React.FC = () => {
  const { empleados, empresa } = useValidum();

  // Estados de datos
  const [documentos, setDocumentos] = useState<SoporteDocumento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoria, setSelectedCategoria] = useState<'Todas' | CategoriaSoporte>('Todas');
  const [formatFilter, setFormatFilter] = useState<'all' | 'pdf' | 'img'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Carga masiva (Drag & Drop)
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadCategory, setUploadCategory] = useState<CategoriaSoporte>('Identificación');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal de LookScanned Studio
  const [scannerDoc, setScannerDoc] = useState<{
    file: Blob | string;
    nombre: string;
  } | null>(null);

  // Modal de Visor de Documento
  const [previewDoc, setPreviewDoc] = useState<{
    doc: SoporteDocumento;
    blobUrl: string;
  } | null>(null);

  // Modal de Asociación con Cotizante
  const [associatingDoc, setAssociatingDoc] = useState<SoporteDocumento | null>(null);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string>('');

  // Cargar lista de documentos
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await fetchDocumentosSoporte();
      setDocumentos(data);
    } catch (err) {
      console.error('Error cargando documentos de soporte:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    return () => {
      if (previewDoc?.blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewDoc.blobUrl);
      }
    };
  }, [previewDoc]);

  // Manejo de subida de archivos
  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const fileList = Array.from(files);
      let count = 0;

      for (const file of fileList) {
        const allowedTypes = new Set(['application/pdf', 'image/png', 'image/jpeg']);
        if (!allowedTypes.has(file.type)) {
          throw new Error(`El archivo "${file.name}" no es PDF, PNG o JPEG.`);
        }
        if (file.size > 25 * 1024 * 1024) {
          throw new Error(`El archivo "${file.name}" supera el límite de 25 MB.`);
        }
        await uploadDocumentoSoporte({
          file,
          nombre: file.name,
          categoria: uploadCategory,
          metadata: {
            empresa_id: empresa.nit || undefined,
            tags: [uploadCategory.toLowerCase()]
          }
        });
        count++;
        setUploadProgress(Math.round((count / fileList.length) * 100));
      }

      await loadDocuments();
    } catch (err) {
      console.error('Error en carga masiva:', err);
      alert(err instanceof Error ? err.message : 'Error subiendo uno o más archivos.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Abrir en LookScanned Studio
  const handleOpenScanner = async (doc: SoporteDocumento) => {
    try {
      const blob = await getDocumentoBlob(doc);
      if (blob) {
        setScannerDoc({
          file: blob,
          nombre: doc.nombre
        });
      } else if (doc.publicUrl) {
        setScannerDoc({
          file: doc.publicUrl,
          nombre: doc.nombre
        });
      } else {
        alert('No se pudo cargar el archivo binario del documento.');
      }
    } catch (err) {
      console.error('Error preparando archivo para escáner:', err);
    }
  };

  // Previsualizar documento
  const handlePreview = async (doc: SoporteDocumento) => {
    try {
      const blob = await getDocumentoBlob(doc);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewDoc({ doc, blobUrl: url });
      } else if (doc.publicUrl) {
        setPreviewDoc({ doc, blobUrl: doc.publicUrl });
      }
    } catch (err) {
      console.error('Error visualizando documento:', err);
    }
  };

  // Descargar documento
  const handleDownload = async (doc: SoporteDocumento) => {
    try {
      const blob = await getDocumentoBlob(doc);
      if (!blob && !doc.publicUrl) return;

      const url = blob ? URL.createObjectURL(blob) : doc.publicUrl!;
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nombre;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (blob) URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error descargando documento:', err);
    }
  };

  // Eliminar documento
  const handleDelete = async (doc: SoporteDocumento) => {
    if (!confirm(`¿Estás seguro de eliminar "${doc.nombre}"?`)) return;
    try {
      await deleteDocumentoSoporte(doc.id, doc.storage_path);
      setDocumentos(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error('Error eliminando documento:', err);
      alert('No se pudo eliminar el documento. Verifica la conexión e inténtalo nuevamente.');
    }
  };

  // Asociar con un Cotizante / Empleado
  const handleSaveAssociation = async () => {
    if (!associatingDoc) return;
    const empleado = empleados.find(e => e.id === selectedEmpleadoId || e.cedula === selectedEmpleadoId);

    try {
      await updateDocumentoMetadata(associatingDoc.id, {
        metadata: {
          ...associatingDoc.metadata,
          cotizante_id: empleado ? empleado.id : null,
          cotizante_nombre: empleado ? `${empleado.nombres} ${empleado.apellidos}`.trim() : null
        }
      });
      setAssociatingDoc(null);
      await loadDocuments();
    } catch (err) {
      console.error('Error asociando cotizante:', err);
      alert('No se pudo guardar la asociación. Verifica la conexión e inténtalo nuevamente.');
    }
  };

  // Filtros combinados
  const filteredDocumentos = useMemo(() => {
    return documentos.filter(doc => {
      const matchSearch =
        doc.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.metadata.cotizante_nombre || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat =
        selectedCategoria === 'Todas' || doc.categoria === selectedCategoria;

      const matchFormat =
        formatFilter === 'all'
          ? true
          : formatFilter === 'pdf'
          ? doc.tipo_archivo === 'pdf'
          : doc.tipo_archivo !== 'pdf';

      return matchSearch && matchCat && matchFormat;
    });
  }, [documentos, searchTerm, selectedCategoria, formatFilter]);

  // Estadísticas rápidas
  const totalBytes = documentos.reduce((acc, d) => acc + (d.tamano_bytes || 0), 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  const scannedCount = documentos.filter(d => d.metadata.efecto_escaner_aplicado).length;

  return (
    <div className="space-y-6 select-none">
      
      {/* ── HEADER PRINCIPAL ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0f182a] border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase mb-1">
            <FolderOpen className="w-4 h-4" />
            EXPEDIENTE & REPOSITORIO DIGITAL
          </div>
          <h1 className="font-serif text-3xl font-bold text-slate-100">
            Biblioteca de Documentos Soporte
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestiona identificaciones, certificados, RUT y formularios digitalizados con almacenamiento seguro en Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#070e1a] px-3.5 py-2 text-xs text-slate-300">
            <span className={`h-2.5 w-2.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span>{isSupabaseConfigured ? 'Supabase configurado' : 'Almacén Local Activo'}</span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-2xl bg-[#c4d600] px-4 py-2.5 text-xs font-black text-[#0b132b] shadow-xl hover:bg-[#d6e800] transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Subir Documentos
          </button>
        </div>
      </div>

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f182a] border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 text-cyan-400 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-serif">{documentos.length}</div>
            <div className="text-xs text-slate-400">Total Documentos</div>
          </div>
        </div>

        <div className="bg-[#0f182a] border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-serif">{totalMB} MB</div>
            <div className="text-xs text-slate-400">Espacio Utilizado</div>
          </div>
        </div>

        <div className="bg-[#0f182a] border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 text-amber-400 flex items-center justify-center">
            <Scan className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-serif">{scannedCount}</div>
            <div className="text-xs text-slate-400">Con Efecto Escáner</div>
          </div>
        </div>

        <div className="bg-[#0f182a] border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-400/10 text-indigo-400 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-serif">
              {documentos.filter(d => d.metadata.cotizante_id).length}
            </div>
            <div className="text-xs text-slate-400">Vinculados a Cotizantes</div>
          </div>
        </div>
      </div>

      {/* ── ZONA DRAG & DROP DE CARGA MASIVA ── */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-3xl border-2 border-dashed p-6 transition-all ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/30'
            : 'border-slate-800 bg-[#0c1424] hover:border-slate-700'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={e => e.target.files && handleUploadFiles(e.target.files)}
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <UploadCloud className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-white">
                Arrastra y suelta tus archivos aquí
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Soporta PDFs múltiples e imágenes (PNG, JPG). Tamaño máximo 25 MB por archivo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#060c18] px-3 py-2 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Categoría destino:</span>
              <select
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value as CategoriaSoporte)}
                className="bg-transparent text-xs font-bold text-cyan-300 outline-none"
              >
                {CATEGORIAS.filter(c => c !== 'Todas').map(c => (
                  <option key={c} value={c} className="bg-slate-900 text-slate-100">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Examinar
            </button>
          </div>
        </div>

        {isUploading && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-cyan-300 font-bold">
              <span>Guardando documentos...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ── */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0f182a] p-3 rounded-2xl border border-slate-800">
          
          {/* Buscador reactivo */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, categoría o cotizante..."
              className="w-full rounded-xl border border-slate-800 bg-[#060c18] pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {/* Filtro de Formato */}
            <div className="flex rounded-xl bg-[#060c18] p-1 border border-slate-800 text-xs">
              <button
                onClick={() => setFormatFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  formatFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFormatFilter('pdf')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  formatFilter === 'pdf' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                PDF
              </button>
              <button
                onClick={() => setFormatFilter('img')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  formatFilter === 'img' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                Imágenes
              </button>
            </div>

            {/* Alternador de Modo de Vista */}
            <div className="flex rounded-xl bg-[#060c18] p-1 border border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-500'
                }`}
                title="Vista en Cuadrícula"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-500'
                }`}
                title="Vista en Tabla"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Píldoras de Categoría */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIAS.map(cat => {
            const isSelected = selectedCategoria === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategoria(cat)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[#c4d600] text-[#0b132b] shadow-md'
                    : 'border border-slate-800 bg-[#091322] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LISTADO DE DOCUMENTOS (Grid o Tabla) ── */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan-400 mb-2" />
          <p className="text-sm">Cargando biblioteca de documentos...</p>
        </div>
      ) : filteredDocumentos.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-[#0f182a] border border-slate-800">
          <FolderOpen className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-bold text-slate-300 text-sm">No se encontraron documentos</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'No hay archivos que coincidan con la búsqueda actual.'
              : 'Esta categoría aún no tiene soportes. Sube tu primer archivo en el panel superior.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISTA EN GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDocumentos.map(doc => {
            const isPdf = doc.tipo_archivo === 'pdf';
            const sizeKB = (doc.tamano_bytes / 1024).toFixed(0);

            return (
              <motion.div
                key={doc.id}
                layout
                className="group relative rounded-3xl border border-slate-800 bg-[#0c1524] p-4 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/5 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail / Header Card */}
                  <div className="relative mb-3 h-36 w-full overflow-hidden rounded-2xl bg-[#060c18] border border-slate-800/80 flex items-center justify-center">
                    {isPdf ? (
                      <div className="flex flex-col items-center text-slate-500 group-hover:text-cyan-400 transition-colors">
                        <FileText className="h-12 w-12 mb-1" />
                        <span className="font-mono text-[10px] uppercase font-bold text-slate-400">PDF Document</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-slate-500 group-hover:text-emerald-400 transition-colors">
                        <FileImage className="h-12 w-12 mb-1" />
                        <span className="font-mono text-[10px] uppercase font-bold text-slate-400">Imagen</span>
                      </div>
                    )}

                    {/* Badges superiores */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className="rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-slate-700 backdrop-blur-md">
                        {doc.categoria}
                      </span>
                    </div>

                    {doc.metadata.efecto_escaner_aplicado && (
                      <div className="absolute top-2 right-2">
                        <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400 border border-emerald-500/40 backdrop-blur-md">
                          <Sparkles className="h-2.5 w-2.5" /> Escaneado
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Nombre y Detalles */}
                  <h4 className="font-bold text-xs text-slate-100 truncate" title={doc.nombre}>
                    {doc.nombre}
                  </h4>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{sizeKB} KB</span>
                    <span>{new Date(doc.created_at).toLocaleDateString('es-CO')}</span>
                  </div>

                  {/* Cotizante Vinculado */}
                  {doc.metadata.cotizante_nombre && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-slate-900/60 p-1.5 text-[11px] text-slate-300 border border-slate-800">
                      <UserCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{doc.metadata.cotizante_nombre}</span>
                    </div>
                  )}
                </div>

                {/* Acciones Rápidas */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1">
                  <button
                    onClick={() => handlePreview(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleOpenScanner(doc)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                    title="Escanear con LookScanned"
                  >
                    <Scan className="h-3 w-3" />
                    <span>Escanear</span>
                  </button>

                  <button
                    onClick={() => {
                      setAssociatingDoc(doc);
                      const linked = empleados.find(emp => emp.id === doc.metadata.cotizante_id || emp.cedula === doc.metadata.cotizante_id);
                      setSelectedEmpleadoId(linked?.id || '');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
                    title="Vincular a Cotizante"
                  >
                    <UserCheck className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#c4d600] hover:bg-slate-800"
                    title="Descargar"
                  >
                    <Download className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* VISTA EN TABLA */
        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-[#0c1524]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#091220] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">Documento</th>
                <th className="p-3.5">Categoría</th>
                <th className="p-3.5">Cotizante Vinculado</th>
                <th className="p-3.5">Tamaño</th>
                <th className="p-3.5">Estado</th>
                <th className="p-3.5">Fecha</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDocumentos.map(doc => (
                <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3.5 font-bold text-slate-200">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-400" />
                      <span className="truncate max-w-[220px]">{doc.nombre}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                      {doc.categoria}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-400">
                    {doc.metadata.cotizante_nombre ? (
                      <span className="text-cyan-300 font-medium">
                        {doc.metadata.cotizante_nombre}
                      </span>
                    ) : (
                      <span className="text-slate-600">Sin vincular</span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-400 font-mono">
                    {(doc.tamano_bytes / 1024).toFixed(0)} KB
                  </td>
                  <td className="p-3.5">
                    {doc.metadata.efecto_escaner_aplicado ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                        <Sparkles className="h-2.5 w-2.5" /> Escaneado
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                        Original
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-400 font-mono">
                    {new Date(doc.created_at).toLocaleDateString('es-CO')}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handlePreview(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenScanner(doc)}
                        className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20"
                        title="Escanear"
                      >
                        <Scan className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setAssociatingDoc(doc);
                          const linked = empleados.find(emp => emp.id === doc.metadata.cotizante_id || emp.cedula === doc.metadata.cotizante_id);
                          setSelectedEmpleadoId(linked?.id || '');
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300"
                        title="Vincular"
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#c4d600]"
                        title="Descargar"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: LOOKSCANNED STUDIO ── */}
      {scannerDoc && (
        <LookScannedStudio
          sourceFile={scannerDoc.file}
          sourceFileName={scannerDoc.nombre}
          onClose={() => setScannerDoc(null)}
          onSavedToLibrary={() => {
            loadDocuments();
            setScannerDoc(null);
          }}
        />
      )}

      {/* ── MODAL: VISOR DE DOCUMENTO ── */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-800 bg-[#091322] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#060c18] px-6 py-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">{previewDoc.doc.nombre}</h3>
                  <span className="text-[11px] text-slate-400">{previewDoc.doc.categoria}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const doc = previewDoc.doc;
                    setPreviewDoc(null);
                    handleOpenScanner(doc);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors"
                >
                  <Scan className="h-3.5 w-3.5" />
                  Escanear
                </button>

                <button
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#050a14] p-4 flex items-center justify-center overflow-hidden">
              {previewDoc.doc.tipo_archivo === 'pdf' ? (
                <iframe
                  src={previewDoc.blobUrl}
                  title="Visor PDF"
                  className="h-full w-full rounded-xl border border-slate-800"
                />
              ) : (
                <img
                  src={previewDoc.blobUrl}
                  alt={previewDoc.doc.nombre}
                  className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ASOCIAR A COTIZANTE ── */}
      {associatingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#091322] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <UserCheck className="h-4 w-4" />
                <span>Asociar Documento a Cotizante</span>
              </div>
              <button
                onClick={() => setAssociatingDoc(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Vincula el archivo <strong className="text-slate-200">{associatingDoc.nombre}</strong> con un empleado del directorio para anexarlo automáticamente en sus formularios de afiliación.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Selecciona el Cotizante
                </label>
                <select
                  value={selectedEmpleadoId}
                  onChange={e => setSelectedEmpleadoId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#060c18] px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
                >
                  <option value="">-- Ninguno (Desvincular) --</option>
                  {empleados.map(emp => (
                    <option key={emp.id || emp.cedula} value={emp.id}>
                      {emp.nombres} {emp.apellidos} ({emp.tipoDocumento || 'CC'}: {emp.cedula})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssociatingDoc(null)}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssociation}
                  className="rounded-xl bg-cyan-400 px-5 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300"
                >
                  Guardar Asociación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DocumentosSoporteLibrary;
