import React from 'react';
import { 
  Wand2,
  Users, 
  Settings, 
  Library,
  FileSpreadsheet,
  Clock,
  FolderOpen,
  ShieldCheck,
  Inbox,
} from 'lucide-react';
import { useValidum, ActiveTab } from '../../context/ValidumContext';
import { ValidumLogo } from '../common/ValidumLogo';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useValidum();

  const menuItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { 
      id: 'autofill', 
      label: 'Auto-Rellenar Formular.', 
      icon: <Wand2 className="w-4 h-4 text-[#c4d600]" />, 
      badge: 'PRINCIPAL' 
    },
    { 
      id: 'soportes', 
      label: 'Documentos Soporte', 
      icon: <FolderOpen className="w-4 h-4 text-emerald-400" />,
      badge: 'NUEVO' 
    },
    { 
      id: 'empleados', 
      label: 'Directorio de Afiliados', 
      icon: <Users className="w-4 h-4" /> 
    },
    { 
      id: 'configuracion', 
      label: 'Empresas', 
      icon: <Settings className="w-4 h-4" /> 
    },
    {
      id: 'correspondencia',
      label: 'Correspondencia',
      icon: <Inbox className="w-4 h-4 text-sky-400" />,
      badge: 'NUEVO',
    },
    {
      id: 'equipo',
      label: 'Usuarios y Permisos',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: 'INTERNO',
    },
  ];

  return (
    <aside className="theme-sidebar w-64 border-r flex flex-col justify-between hidden md:flex min-h-[calc(100vh-4rem)] p-4 select-none">
      <div className="space-y-6">
        
        {/* Brand Banner */}
        <div className="px-4 py-4 rounded-2xl bg-gradient-to-r from-[#0a1824] via-[#0f2537] to-[#16324a] border border-[#c4d600]/30 shadow-lg">
          <ValidumLogo variant="full" theme="dark" size="md" />
          <p className="text-[10px] text-slate-400 font-mono mt-1 text-center">Gestor Universal de Formularios</p>
        </div>

        {/* Focused Navigation Menu */}
        <nav className="space-y-1.5 overflow-y-auto pr-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase px-3 py-1 font-bold">
            Módulos Principales
          </div>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-[#c4d600] text-[#0f2537] shadow-lg shadow-[#c4d600]/20 font-bold border border-[#c4d600]'
                    : 'text-slate-300 hover:bg-[#16324a] hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-[#0f2537]' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      isActive
                        ? 'bg-[#0f2537] text-[#c4d600]'
                        : 'bg-[#c4d600]/20 text-[#c4d600]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 rounded-2xl bg-[#0a1824] border border-slate-800 text-[10px] font-mono text-slate-400 text-center">
        <span>Suite Formularios EPS v3.0</span>
      </div>
    </aside>
  );
};
