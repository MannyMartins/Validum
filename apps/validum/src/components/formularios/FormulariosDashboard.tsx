import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Zap, 
  Library, 
  Plus, 
  Download, 
  Clock, 
  LayoutDashboard, 
  FolderOpen, 
  Scan, 
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { useTemplateStorage } from '../../hooks/useTemplateStorage';
import PDFTemplateDesigner from './PDFTemplateDesigner';
import { PDFAutoFiller } from './PDFAutoFiller';
import { TemplateLibrary } from './TemplateLibrary';
import { DocumentosSoporteLibrary } from '../soportes/DocumentosSoporteLibrary';
import { LookScannedStudio } from '../scanner/LookScannedStudio';
import type { FormTemplate, GeneratedForm } from '../../types/formularios';

type ViewState = 'dashboard' | 'designer' | 'autofiller' | 'library' | 'soportes' | 'scanner';

export const FormulariosDashboard: React.FC = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | undefined>(undefined);
  const [preselectedTemplateId, setPreselectedTemplateId] = useState<string | undefined>(undefined);
  const [scannerSource, setScannerSource] = useState<{ file: string | File; name: string } | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const { templates, generatedForms, saveTemplate, stats, storageError } = useTemplateStorage();

  const handleBack = () => {
    setView('dashboard');
    setEditingTemplate(undefined);
    setPreselectedTemplateId(undefined);
    setScannerSource(null);
  };

  const handleEditTemplate = (template: FormTemplate) => {
    setEditingTemplate(template);
    setView('designer');
  };

  const handleSelectTemplate = (template: FormTemplate) => {
    setPreselectedTemplateId(template.id);
    setView('autofiller');
  };

  const handleSaveTemplate = async (template: FormTemplate) => {
    try {
      await saveTemplate(template);
      handleBack();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar la plantilla.');
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(undefined);
    setView('designer');
  };

  const handleScanFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScannerSource({ file, name: file.name });
      setView('scanner');
    }
  };

  const handleScanRecentForm = (form: GeneratedForm) => {
    if (!form.pdfResultBase64) return;
    setScannerSource({
      file: form.pdfResultBase64,
      name: `${form.templateName}_${form.empleadoNombre}.pdf`
    });
    setView('scanner');
  };

  const handleDownloadForm = (form: GeneratedForm) => {
    if (!form.pdfResultBase64) return;
    try {
      const cleanBase64 = form.pdfResultBase64.replace(/^data:application\/pdf;base64,/, '');
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date(form.generatedAt).toISOString().split('T')[0];
      a.download = `${form.templateName.replace(/\s+/g, '_')}_${form.empleadoNombre.replace(/\s+/g, '_')}_${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar formulario:', err);
    }
  };

  // --- Sub-view rendering ---

  if (view === 'designer') {
    return (
      <PDFTemplateDesigner
        template={editingTemplate}
        onSave={handleSaveTemplate}
        onCancel={handleBack}
      />
    );
  }

  if (view === 'autofiller') {
    return (
      <PDFAutoFiller
        templates={templates}
        onBack={handleBack}
        preselectedTemplateId={preselectedTemplateId}
      />
    );
  }

  if (view === 'library') {
    return (
      <TemplateLibrary
        onSelectTemplate={handleSelectTemplate}
        onEditTemplate={handleEditTemplate}
        onBack={handleBack}
      />
    );
  }

  if (view === 'soportes') {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0c1825] px-4 py-2 text-xs font-bold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
        </button>
        <DocumentosSoporteLibrary />
      </div>
    );
  }

  if (view === 'scanner') {
    return (
      <LookScannedStudio
        sourceFile={scannerSource?.file}
        sourceFileName={scannerSource?.name || 'documento.pdf'}
        onClose={handleBack}
      />
    );
  }

  // --- Dashboard main view ---

  const recentForms = generatedForms.slice(0, 5);

  return (
    <div className="space-y-6">
      
      {/* Input oculto para abrir archivo en LookScanned */}
      <input
        ref={scanInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={handleScanFileSelected}
      />

      {storageError && (
        <div role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          No se pudo abrir el almacenamiento local: {storageError}. No se confirmará ningún guardado hasta resolverlo.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0f182a] border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            MOTOR UNIVERSAL DE FORMULARIOS
          </div>
          <h1 className="font-serif text-3xl font-bold text-slate-100">
            Mapeo y Auto-Llenado de PDFs
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sube cualquier formulario PDF, configura los campos visualmente y genera documentos pre-diligenciados en segundos.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0f182a] border border-slate-800 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-lime-400/10 text-lime-400 flex items-center justify-center">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-serif">{stats.totalTemplates}</div>
            <div className="text-xs text-slate-400">Plantillas Guardadas</div>
          </div>
        </div>

        <div className="bg-[#0f182a] border border-slate-800 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-serif">{stats.generatedThisMonth}</div>
            <div className="text-xs text-slate-400">Generados Este Mes</div>
          </div>
        </div>

        <div className="bg-[#0f182a] border border-slate-800 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 text-cyan-400 flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-serif">
              {Object.keys(stats.templatesByEntity).length}
            </div>
            <div className="text-xs text-slate-400">Entidades Configuradas</div>
          </div>
        </div>
      </div>

      {/* Quick Actions (Tarjetas de Acciones Principales) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          onClick={handleNewTemplate}
          className="group p-5 rounded-3xl bg-[#0f182a] border border-slate-800 hover:border-lime-400/50 transition-all text-left flex flex-col justify-between"
        >
          <div>
            <div className="w-11 h-11 rounded-2xl bg-lime-400/10 text-lime-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <div className="font-bold text-slate-100 text-sm mb-1">📄 Nueva Plantilla</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Mapea coordenadas de campos en formularios de EPS/ARL.
            </div>
          </div>
        </button>

        <button
          onClick={() => setView('autofiller')}
          className="group p-5 rounded-3xl bg-[#0f182a] border border-slate-800 hover:border-amber-500/50 transition-all text-left flex flex-col justify-between"
        >
          <div>
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <div className="font-bold text-slate-100 text-sm mb-1">⚡ Rellenar Formulario</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Genera PDFs auto-diligenciados para cualquier cotizante.
            </div>
          </div>
        </button>

        <button
          onClick={() => setView('library')}
          className="group p-5 rounded-3xl bg-[#0f182a] border border-slate-800 hover:border-cyan-400/50 transition-all text-left flex flex-col justify-between"
        >
          <div>
            <div className="w-11 h-11 rounded-2xl bg-cyan-400/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Library className="w-5 h-5" />
            </div>
            <div className="font-bold text-slate-100 text-sm mb-1">📚 Plantillas</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Organiza y administra tus plantillas guardadas.
            </div>
          </div>
        </button>

        {/* TARJETA 4: Biblioteca de Documentos Soporte */}
        <button
          onClick={() => setView('soportes')}
          className="group p-5 rounded-3xl bg-[#0f182a] border border-slate-800 hover:border-emerald-500/50 transition-all text-left flex flex-col justify-between"
        >
          <div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="font-bold text-slate-100 text-sm mb-1">📁 Documentos Soporte</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Repositorio de cédulas, RUT y certificados en Supabase.
            </div>
          </div>
        </button>

        {/* TARJETA 5: Efecto Escáner LookScanned */}
        <button
          onClick={() => scanInputRef.current?.click()}
          className="group p-5 rounded-3xl bg-[#0f182a] border border-slate-800 hover:border-cyan-400/50 transition-all text-left flex flex-col justify-between"
        >
          <div>
            <div className="w-11 h-11 rounded-2xl bg-cyan-400/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Scan className="w-5 h-5" />
            </div>
            <div className="font-bold text-slate-100 text-sm mb-1">🖨️ Efecto Escáner</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Aplica aspecto escaneado realista a cualquier PDF o imagen.
            </div>
          </div>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="p-6 rounded-3xl bg-[#0f182a] border border-slate-800">
        <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase mb-4">
          <Clock className="w-4 h-4" />
          ACTIVIDAD RECIENTE
        </div>

        {recentForms.length === 0 ? (
          <div className="text-center py-10">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-slate-700" />
            <p className="text-sm text-slate-500">
              Aún no has generado ningún formulario. ¡Crea tu primera plantilla para comenzar!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentForms.map((form) => (
              <div
                key={form.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/50 border border-slate-800"
              >
                <div>
                  <div className="font-bold text-sm text-slate-100">{form.templateName}</div>
                  <div className="text-xs text-slate-400">
                    {form.empleadoNombre} · {new Date(form.generatedAt).toLocaleDateString('es-CO')}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleScanRecentForm(form)}
                    className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-xl hover:bg-emerald-400/20 transition-colors flex items-center gap-1.5 cursor-pointer border border-emerald-500/20"
                    title="Abrir en LookScanned Studio"
                  >
                    <Scan className="w-3.5 h-3.5" />
                    Escanear
                  </button>

                  <button
                    onClick={() => handleDownloadForm(form)}
                    className="text-xs font-bold text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-xl hover:bg-lime-400/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
