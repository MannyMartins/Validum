import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Empresa, Empleado, Novedad, PlanillaPILA, InconsistenciaPILA, UserSession } from '../types/validum';
import { mockEmpresa, mockEmpresas, mockEmpresaNexus, mockEmpresaValidum, mockEmpleados, mockNovedades, mockPlanillas, mockInconsistencias } from '../data/mockData';
import { migrateLegacyLocalStorage } from '../lib/validumStorage';
import {
  deleteCompany,
  deleteEmployee,
  loadActiveCompanyId,
  loadCompanies,
  loadEmployees,
  migrateLocalWorkspaceToApi,
  saveActiveCompanyId,
  saveCompanies,
  saveEmployees,
} from '../lib/backendRepository';
import { clearApiSession, completeApiPasswordSetup, currentApiUser, hasApiSession, isApiConfigured, loginApi, requestApiPasswordReset } from '../lib/apiClient';

export type ActiveTab = 
  | 'landing'
  | 'dashboard' 
  | 'empleados' 
  | 'novedades' 
  | 'pila' 
  | 'autofill' 
  | 'calculadora' 
  | 'contratos' 
  | 'certificados' 
  | 'chatbot' 
  | 'portal-empleado'
  | 'calendario-nit'
  | 'analitica-ausentismo'
  | 'liquidaciones'
  | 'soportes'
  | 'equipo'
  | 'configuracion';

interface ValidumContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isDataLoading: boolean;
  dataError: string | null;
  userSession: UserSession | null;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  empresas: Empresa[];
  empresa: Empresa;
  setEmpresa: (empresa: Empresa) => Promise<void>;
  selectEmpresa: (id: string) => Promise<void>;
  deleteEmpresa: (id: string) => Promise<void>;
  empleados: Empleado[];
  addEmpleado: (empleado: Empleado) => Promise<void>;
  addEmpleados: (empleados: Empleado[]) => Promise<void>;
  updateEmpleado: (id: string, empleado: Partial<Empleado>) => Promise<void>;
  deleteEmpleado: (id: string) => Promise<void>;
  novedades: Novedad[];
  addNovedad: (novedad: Novedad) => void;
  planillas: PlanillaPILA[];
  inconsistencias: InconsistenciaPILA[];
  login: (email: string, contrasena: string) => Promise<boolean>;
  needsPasswordSetup: boolean;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordSetup: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const ValidumContext = createContext<ValidumContextType | undefined>(undefined);

const emptyCompany = (): Empresa => ({
  nit: '', dv: '', razonSocial: '', direccion: '', ciudad: '', departamento: '', telefono: '', email: '',
  operadorPila: 'Aportes en Línea', arl: 'Positiva', nivelRiesgoArl: 1,
  representanteLegal: '', cedulaRepresentante: '', tipoDocumento: 'NIT',
});

export const ValidumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(hasApiSession());
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(new URLSearchParams(window.location.search).get('setupToken'));
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(hasApiSession());
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('autofill');
  const [empresas, setEmpresas] = useState<Empresa[]>(mockEmpresas);
  const empresasRef = useRef<Empresa[]>(mockEmpresas);
  const [empresa, setEmpresaState] = useState<Empresa>(mockEmpresa);
  const [empleados, setEmpleados] = useState<Empleado[]>(mockEmpleados);
  const empleadosRef = useRef<Empleado[]>(mockEmpleados);
  const [novedades, setNovedades] = useState<Novedad[]>(mockNovedades);
  const [planillas] = useState<PlanillaPILA[]>(mockPlanillas);
  const [inconsistencias] = useState<InconsistenciaPILA[]>(mockInconsistencias);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (!isApiConfigured() || !hasApiSession()) {
      setIsAuthenticated(false);
      setIsAuthLoading(false);
      return;
    }
    let active = true;
    void currentApiUser()
      .then(user => {
        if (!active) return;
        const roles: Record<string, UserSession['rol']> = { owner: 'Propietario', admin: 'Administrador', operator: 'Operador', analyst: 'Operador', auditor: 'Auditor', viewer: 'Auditor' };
        setIsAuthenticated(true);
        setUserSession({ nombre: user.fullName, email: user.email, rol: roles[user.role] || 'Auditor', empresaActual: empresa });
      })
      .catch(error => {
        console.error('No se pudo restaurar la sesión del API:', error);
        clearApiSession();
        if (active) { setIsAuthenticated(false); setUserSession(null); }
      })
      .finally(() => { if (active) setIsAuthLoading(false); });
    return () => { active = false; };
  // La empresa activa se sincroniza por separado para no reinstalar el listener.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El directorio local usa IndexedDB para admitir expedientes y plantillas grandes.
  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    let active = true;
    setIsDataLoading(true);
    setDataError(null);
    void (async () => {
      try {
        await migrateLegacyLocalStorage();
        await migrateLocalWorkspaceToApi();
        const [storedCompanies, activeCompanyId, storedEmployees] = await Promise.all([loadCompanies(), loadActiveCompanyId(), loadEmployees()]);
        if (!active) return;

        let currentCompanies: Empresa[] = storedCompanies && storedCompanies.length > 0 ? [...storedCompanies] : [...mockEmpresas];

        // Asegurar que NEXUS ENLACE SAS esté registrada en la lista de empresas para rellenar formularios
        const nexusExists = currentCompanies.some(item => item.nit === '902082045' || item.razonSocial?.toUpperCase().includes('NEXUS'));
        if (!nexusExists) {
          currentCompanies.push(mockEmpresaNexus);
          await saveCompanies(currentCompanies);
        }

        // Asegurar que Validum también esté registrada en la lista
        const validumExists = currentCompanies.some(item => item.nit === '900543890' || item.razonSocial?.toUpperCase().includes('VALIDUM'));
        if (!validumExists) {
          currentCompanies.unshift(mockEmpresaValidum);
          await saveCompanies(currentCompanies);
        }

        // En un tenant nuevo la lista inicial tambien debe existir en la base de
        // datos; mostrar mocks sin persistirlos rompería la FK al crear cotizantes.
        if (!storedCompanies || storedCompanies.length === 0) {
          await saveCompanies(currentCompanies);
        }

        empresasRef.current = currentCompanies;
        setEmpresas(currentCompanies);
        const activeCompany = currentCompanies.find(item => item.id === activeCompanyId) || currentCompanies[0] || mockEmpresa;
        if (activeCompany) setEmpresaState(activeCompany);
        if (storedEmployees) {
          empleadosRef.current = storedEmployees;
          setEmpleados(storedEmployees);
        }
      } catch (error) {
        console.error('No se pudo cargar el directorio local:', error);
        if (active) setDataError(error instanceof Error ? error.message : 'No se pudo inicializar el repositorio de datos.');
      } finally {
        if (active) setIsDataLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isAuthLoading, isAuthenticated]);

  const setEmpresa = async (next: Empresa) => {
    const matchingId = next.id || empresasRef.current.find(item => item.nit && item.nit === next.nit)?.id;
    const normalized = { ...next, id: matchingId || crypto.randomUUID() };
    const exists = empresasRef.current.some(item => item.id === normalized.id);
    const companies = exists
      ? empresasRef.current.map(item => item.id === normalized.id ? normalized : item)
      : [normalized, ...empresasRef.current];
    await Promise.all([saveCompanies(companies), saveActiveCompanyId(normalized.id)]);
    empresasRef.current = companies;
    setEmpresas(companies);
    setEmpresaState(normalized);
    setUserSession(current => current ? { ...current, empresaActual: normalized } : current);
  };

  const selectEmpresa = async (id: string) => {
    const selected = empresasRef.current.find(item => item.id === id);
    if (!selected?.id) return;
    await saveActiveCompanyId(selected.id);
    setEmpresaState(selected);
    setUserSession(current => current ? { ...current, empresaActual: selected } : current);
  };

  const deleteEmpresa = async (id: string) => {
    const companies = empresasRef.current.filter(item => item.id !== id);
    const nextActive = empresa.id === id ? companies[0] : empresa;
    await Promise.all([deleteCompany(id), saveActiveCompanyId(nextActive.id || '')]);
    empresasRef.current = companies;
    setEmpresas(companies);
    setEmpresaState(nextActive.id ? nextActive : emptyCompany());
    setUserSession(current => current ? { ...current, empresaActual: nextActive.id ? nextActive : emptyCompany() } : current);
  };

  const addEmpleado = async (nuevo: Empleado) => {
    const next = [nuevo, ...empleadosRef.current];
    await saveEmployees(next);
    empleadosRef.current = next;
    setEmpleados(next);
  };

  const addEmpleados = async (nuevos: Empleado[]) => {
    const next = [...nuevos, ...empleadosRef.current];
    await saveEmployees(next);
    empleadosRef.current = next;
    setEmpleados(next);
  };

  const updateEmpleado = async (id: string, actualizado: Partial<Empleado>) => {
    const next = empleadosRef.current.map(emp => emp.id === id ? { ...emp, ...actualizado } : emp);
    await saveEmployees(next);
    empleadosRef.current = next;
    setEmpleados(next);
  };

  const deleteEmpleado = async (id: string) => {
    const next = empleadosRef.current.filter(emp => emp.id !== id);
    await deleteEmployee(id);
    empleadosRef.current = next;
    setEmpleados(next);
  };

  const addNovedad = (nueva: Novedad) => {
    setNovedades(prev => [nueva, ...prev]);
  };

  const login = async (email: string, contrasena: string) => {
    try {
      const user = await loginApi(email.trim(), contrasena);
      const roles: Record<string, UserSession['rol']> = { owner: 'Propietario', admin: 'Administrador', operator: 'Operador', analyst: 'Operador', auditor: 'Auditor', viewer: 'Auditor' };
      setUserSession({ nombre: user.fullName, email: user.email, rol: roles[user.role] || 'Auditor', empresaActual: empresa });
      setIsAuthenticated(true);
      return true;
    } catch (error) { console.warn('Inicio de sesión rechazado por el API:', error); return false; }
  };

  const requestPasswordReset = async (email: string) => {
    await requestApiPasswordReset(email.trim());
  };

  const completePasswordSetup = async (password: string) => {
    const token = new URLSearchParams(window.location.search).get('setupToken');
    if (!token) throw new Error('El enlace de configuración no contiene un token válido.');
    const user = await completeApiPasswordSetup(token, password);
    const roles: Record<string, UserSession['rol']> = { owner: 'Propietario', admin: 'Administrador', operator: 'Operador', analyst: 'Operador', auditor: 'Auditor', viewer: 'Auditor' };
    setNeedsPasswordSetup(false);
    setIsAuthenticated(true);
    setUserSession({ nombre: user.fullName, email: user.email, rol: roles[user.role] || 'Auditor', empresaActual: empresa });
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const logout = async () => {
    clearApiSession();
    setIsAuthenticated(false);
    setUserSession(null);
  };

  return (
    <ValidumContext.Provider value={{
      isAuthenticated,
      isAuthLoading,
      isDataLoading,
      dataError,
      userSession,
      activeTab,
      setActiveTab,
      empresas,
      empresa,
      setEmpresa,
      selectEmpresa,
      deleteEmpresa,
      empleados,
      addEmpleado,
      addEmpleados,
      updateEmpleado,
      deleteEmpleado,
      novedades,
      addNovedad,
      planillas,
      inconsistencias,
      login,
      needsPasswordSetup,
      requestPasswordReset,
      completePasswordSetup,
      logout,
      searchTerm,
      setSearchTerm,
    }}>
      {children}
    </ValidumContext.Provider>
  );
};

export const useValidum = () => {
  const context = useContext(ValidumContext);
  if (!context) {
    throw new Error('useValidum debe usarse dentro de un ValidumProvider');
  }
  return context;
};
