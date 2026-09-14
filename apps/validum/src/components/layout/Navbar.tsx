import React from 'react';
import { 
  Search, 
  LogOut, 
  User
} from 'lucide-react';
import { useValidum } from '../../context/ValidumContext';
import { ValidumLogo } from '../common/ValidumLogo';
import { ThemeSwitcher } from '../common/ThemeSwitcher';

export const Navbar: React.FC = () => {
  const { userSession, logout, searchTerm, setSearchTerm, activeTab, setActiveTab } = useValidum();

  return (
    <header className="theme-navbar h-16 backdrop-blur-md border-b px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-all">
      
      {/* Left section: Official Company Logo & Badge */}
      <div className="flex items-center gap-4">
        <ValidumLogo variant="full" theme="dark" size="sm" />

        {/* Quick Link to Landing Page */}
        <button
          onClick={() => setActiveTab('landing')}
          className="hidden xl:flex items-center gap-1.5 bg-[#c4d600]/10 hover:bg-[#c4d600]/20 text-[#c4d600] border border-[#c4d600]/30 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all"
        >
          <span>🌐 Sitio Web</span>
        </button>

        {/* Back to Forms Button */}
        {activeTab !== 'autofill' && (
          <button
            onClick={() => setActiveTab('autofill')}
            className="flex items-center gap-1.5 bg-[#c4d600] text-[#0f2537] hover:bg-[#d2e300] font-bold px-3.5 py-1.5 rounded-xl text-xs transition-all shadow-md active:scale-95"
          >
            <span>← Volver a Formularios</span>
          </button>
        )}
      </div>

      {/* Center: Quick Global Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cédula, cotizante o planilla PILA..."
            className="w-full bg-[#0a1824] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#c4d600] transition-colors"
          />
        </div>
      </div>

      {/* Right section: User Menu */}
      <div className="flex items-center gap-3 sm:gap-4">
        <ThemeSwitcher />
        {/* User Session Profile */}
        <div className="flex items-center gap-3 border-l border-slate-800 pl-3 sm:pl-4">
          <div className="w-8 h-8 rounded-xl bg-[#c4d600]/10 border border-[#c4d600]/30 flex items-center justify-center text-[#c4d600] font-bold text-xs">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:block text-left">
            <div className="font-semibold text-slate-200 text-xs truncate max-w-[140px]">
              {userSession?.nombre || 'Johan Manuel'}
            </div>
            <div className="text-[10px] text-[#c4d600] font-mono font-bold">
              {userSession?.rol || 'Administrador'}
            </div>
          </div>
          
          <button
            onClick={logout}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 transition-colors ml-1"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>

    </header>
  );
};
