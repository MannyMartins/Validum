import React from 'react';
import { ValidumProvider, useValidum } from './context/ValidumContext';
import { LoginView } from './components/auth/LoginView';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { EmpleadoList } from './components/empleados/EmpleadoList';
import { ConfiguracionEmpresa } from './components/configuracion/ConfiguracionEmpresa';
import { FormulariosDashboard } from './components/formularios/FormulariosDashboard';
import { DocumentosSoporteLibrary } from './components/soportes/DocumentosSoporteLibrary';
import { LandingPage } from './components/landing/LandingPage';
import { InternalTeamManagement } from './components/configuracion/InternalTeamManagement';
import { SetPasswordView } from './components/auth/SetPasswordView';
import { CorrespondenceDashboard } from './components/correspondencia/CorrespondenceDashboard';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isAuthLoading, isDataLoading, dataError, needsPasswordSetup, activeTab, setActiveTab, logout } = useValidum();

  React.useEffect(() => {
    if (isAuthenticated && new URLSearchParams(window.location.search).has('cuenta_estado')) {
      setActiveTab('correspondencia');
    }
  }, [isAuthenticated, setActiveTab]);

  if (isAuthLoading) {
    return (
      <div className="theme-app-shell min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="h-5 w-5 rounded-full border-2 border-[#c4d600] border-t-transparent animate-spin" />
          Verificando sesión segura…
        </div>
      </div>
    );
  }

  if (needsPasswordSetup) {
    return <SetPasswordView />;
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  if (isDataLoading) {
    return (
      <div className="theme-app-shell min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="h-5 w-5 rounded-full border-2 border-[#c4d600] border-t-transparent animate-spin" />
          Cargando información segura…
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="theme-app-shell min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-2xl border border-red-500/40 bg-slate-950/70 p-6 shadow-2xl">
          <h1 className="text-xl font-bold text-white">No se pudo abrir el repositorio seguro</h1>
          <p className="mt-2 text-sm text-slate-300">
            Verifica la conexión con el API de Validum y que PostgreSQL, Redis y el almacenamiento privado estén disponibles en Railway.
          </p>
          <pre className="mt-4 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-red-200 whitespace-pre-wrap">{dataError}</pre>
          <div className="mt-5 flex gap-3">
            <button onClick={() => window.location.reload()} className="rounded-xl bg-[#c4d600] px-4 py-2 text-sm font-bold text-[#071926]">
              Reintentar
            </button>
            <button onClick={() => void logout()} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'landing') {
    return <LandingPage onEnterApp={() => setActiveTab('dashboard')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'autofill':
        return <FormulariosDashboard />;
      case 'soportes':
        return <DocumentosSoporteLibrary />;
      case 'empleados':
        return <EmpleadoList />;
      case 'correspondencia':
        return <CorrespondenceDashboard />;
      case 'configuracion':
        return <ConfiguracionEmpresa />;
      case 'equipo':
        return <InternalTeamManagement />;
      default:
        return <FormulariosDashboard />;
    }
  };

  return (
    <div className="theme-app-shell min-h-screen bg-city-overlay bg-texture-dots flex flex-col font-sans selection:bg-[#c4d600]/30 selection:text-[#c4d600]">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <ValidumProvider>
      <MainLayout />
    </ValidumProvider>
  );
}

export default App;
