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
  migrateLocalWorkspaceToSupabase,
  saveActiveCompanyId,
  saveCompanies,
  saveEmployees,
} from '../lib/backendRepository';
import { clearActiveOrganizationCache, getActiveOrganizationId, isSupabaseConfigured, supabase } from '../lib/supabaseClient';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!isSupabaseConfigured);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const flowType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
    return flowType === 'invite' || flowType === 'recovery';
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [userSession, setUserSession] = useState<UserSession | null>(isSupabaseConfigured ? null : {
    nombre: 'Johan Manuel',
    email: 'johan.manuel@validum.com.co',
    rol: 'Administrador',
    empresaActual: mockEmpresa,
  });
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
    if (!supabase || !isSupabaseConfigured) {
      setIsAuthLoading(false);
      return;
    }

    let active = true;
    const applyUser = (user: { email?: string; user_metadata?: Record<string, unknown> } | null) => {
      if (!active) return;
      setIsAuthenticated(Boolean(user));
      setUserSession(user ? {
        nombre: String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'),
        email: user.email || '',
        rol: 'Administrador',
        empresaActual: empresa,
      } : null);
      setIsAuthLoading(false);
    };

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        applyUser(data.session?.user || null);
      })
      .catch(error => {
        console.error('No se pudo restaurar la sesion de Supabase:', error);
        applyUser(null);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      clearActiveOrganizationCache();
      const flowType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
      if (event === 'PASSWORD_RECOVERY' || flowType === 'invite' || flowType === 'recovery') {
        setNeedsPasswordSetup(Boolean(session));
      }
      applyUser(session?.user || null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
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
        await migrateLocalWorkspaceToSupabase();
        const [storedCompanies, activeCompanyId, storedEmployees] = await Promise.all([loadCompanies(), loadActiveCompanyId(), loadEmployees()]);
        if (!active) return;

        if (supabase && isSupabaseConfigured) {
          const organizationId = await getActiveOrganizationId();
          const { data: authData } = await supabase.auth.getUser();
          const { data: membership } = authData.user
            ? await supabase.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', authData.user.id).maybeSingle()
            : { data: null };
          const roleNames: Record<string, UserSession['rol']> = {
            owner: 'Propietario',
            admin: 'Administrador',
            operator: 'Operador',
            analyst: 'Operador',
            auditor: 'Auditor',
            viewer: 'Auditor',
          };
          if (membership?.role) {
            setUserSession(current => current ? { ...current, rol: roleNames[membership.role] || 'Auditor' } : current);
          }
        }
        
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
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: contrasena });
      if (error) {
        console.warn('Inicio de sesion rechazado por Supabase:', error.message);
        return false;
      }
      return true;
    }
    setIsAuthenticated(true);
    setUserSession({
      nombre: 'Johan Manuel',
      email: email,
      rol: 'Administrador',
      empresaActual: empresa,
    });
    return true;
  };

  const requestPasswordReset = async (email: string) => {
    if (!supabase || !isSupabaseConfigured) throw new Error('Supabase no está configurado.');
    const redirectTo = new URL('/', window.location.origin).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw error;
  };

  const completePasswordSetup = async (password: string) => {
    if (!supabase || !isSupabaseConfigured) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setNeedsPasswordSetup(false);
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  };

  const logout = async () => {
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clearActiveOrganizationCache();
    }
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
