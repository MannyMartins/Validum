import React, { useState, useMemo } from 'react';
import { ArrowLeft, Search, Edit3, Copy, Download, Trash2, Zap, FileText, Plus, Library } from 'lucide-react';
import { useTemplateStorage } from '../../hooks/useTemplateStorage';
import type { FormTemplate, EntityType } from '../../types/formularios';

interface TemplateLibraryProps {
  onSelectTemplate: (template: FormTemplate) => void;
  onEditTemplate: (template: FormTemplate) => void;
  onBack: () => void;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  onSelectTemplate,
  onEditTemplate,
  onBack
}) => {
  const { templates, deleteTemplate, duplicateTemplate, exportTemplate } = useTemplateStorage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntity, setFilterEntity] = useState<EntityType | 'TODAS'>('TODAS');

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo duplicar la plantilla.');
    }
  };

  const handleExport = (template: FormTemplate) => {
    const json = exportTemplate(template.id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${template.name.toLowerCase().replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            template.entity.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEntity = filterEntity === 'TODAS' || template.entityType === filterEntity;
      return matchesSearch && matchesEntity;
    });
  }, [templates, searchTerm, filterEntity]);

  const getEntityBadgeStyle = (type: EntityType) => {
    switch (type) {
      case 'EPS': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'ARL': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'AFP': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'CCF': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="w-full h-full bg-[#0a1824] p-6 lg:p-8 overflow-y-auto font-sans text-slate-300">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-3 rounded-2xl bg-[#0f182a] border border-slate-800 hover:border-lime-400/50 hover:text-lime-400 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-serif font-bold text-white flex items-center gap-3">
              <Library className="w-8 h-8 text-cyan-400" />
              Biblioteca de Plantillas
            </h1>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-[#0f182a] border border-slate-800 rounded-3xl p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar plantilla por nombre o entidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-lime-400/50 transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {(['TODAS', 'EPS', 'ARL', 'AFP', 'CCF', 'OTRO'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterEntity(type)}
                className={`px-4 py-2 text-sm font-bold rounded-xl border transition-colors ${
                  filterEntity === type 
                    ? 'bg-lime-400/20 text-lime-400 border-lime-400/50' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Grid of Templates */}
        {filteredTemplates.length === 0 ? (
          <div className="bg-[#0f182a] border border-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
            <FileText className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No se encontraron plantillas</h3>
            <p className="text-slate-400 mb-6 max-w-md">
              {templates.length === 0 
                ? "Aún no tienes plantillas guardadas. Crea tu primera plantilla para comenzar a automatizar formularios."
                : "No hay plantillas que coincidan con tu búsqueda."}
            </p>
            {templates.length === 0 && (
              <button 
                onClick={onBack}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-2xl transition-colors"
              >
                <Plus className="w-5 h-5" />
                Crear primera plantilla
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredTemplates.map(template => (
              <div key={template.id} className="bg-[#0f182a] border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row gap-5 hover:border-slate-700 transition-colors group">
                
                {/* Thumbnail */}
                <div className="sm:w-32 h-32 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                  {template.thumbnailBase64 ? (
                    <img src={template.thumbnailBase64} alt={`Miniatura ${template.name}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <FileText className="w-10 h-10 text-slate-700" />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-bold text-lg text-white truncate" title={template.name}>
                        {template.name}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider shrink-0 ${getEntityBadgeStyle(template.entityType)}`}>
                        {template.entityType}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-400 truncate mb-3">{template.entity}</p>
                    {(template.mappingStatus || (template.fields.length ? 'ready' : 'draft')) === 'draft' && (
                      <p className="mb-3 inline-flex rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-300">
                        Pendiente de mapear con PDF en blanco
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-4 font-mono">
                      <span>{template.formType}</span>
                      <span>•</span>
                      <span>{template.fields.length} campos</span>
                      <span>•</span>
                      <span>{new Date(template.updatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => onSelectTemplate(template)}
                      disabled={(template.mappingStatus || (template.fields.length ? 'ready' : 'draft')) !== 'ready'}
                      title={(template.mappingStatus || (template.fields.length ? 'ready' : 'draft')) !== 'ready' ? 'Primero edita y calibra esta plantilla.' : 'Generar formulario'}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      Usar
                    </button>
                    <button 
                      onClick={() => onEditTemplate(template)}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3 py-2 rounded-xl transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Editar
                    </button>
                    <button 
                      onClick={() => void handleDuplicate(template.id)}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3 py-2 rounded-xl transition-colors ml-auto"
                      title="Duplicar"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleExport(template)}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3 py-2 rounded-xl transition-colors"
                      title="Exportar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm('¿Está seguro de eliminar esta plantilla?')) {
                          void deleteTemplate(template.id).catch(error => {
                            alert(error instanceof Error ? error.message : 'No se pudo eliminar la plantilla.');
                          });
                        }
                      }}
                      className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs px-3 py-2 rounded-xl transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
