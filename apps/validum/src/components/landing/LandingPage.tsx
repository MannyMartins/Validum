import React, { useState } from 'react';
import { ValidumLogo } from '../common/ValidumLogo';
import { 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Building2, 
  Lock, 
  Award, 
  Calculator, 
  Sparkles, 
  Users, 
  FileSpreadsheet,
  DollarSign,
  ChevronRight,
  PhoneCall,
  X,
  TrendingUp,
  HelpCircle,
  Play
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');
  const [cotizantesCount, setCotizantesCount] = useState<number>(35);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  const [demoForm, setDemoForm] = useState({
    nombre: '',
    empresa: '',
    email: '',
    telefono: '',
    cotizantes: '25-50',
  });

  // ROI Calculator estimations
  const multaEstimadaUGPP = cotizantesCount * 1250000;
  const ahorroEstimadoValidum = Math.round(multaEstimadaUGPP * 0.95);

  const formatCop = (val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitted(true);
    setTimeout(() => {
      setDemoSubmitted(false);
      setIsDemoModalOpen(false);
      onEnterApp();
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-city-overlay bg-texture-dots text-slate-100 font-sans selection:bg-[#c4d600]/30 selection:text-[#c4d600]">
      
      {/* Public Header Bar */}
      <header className="h-20 border-b border-slate-800/80 bg-[#0f182a]/95 backdrop-blur-md px-6 sm:px-12 flex items-center justify-between sticky top-0 z-40">
        <ValidumLogo variant="full" theme="dark" size="md" />

        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-300">
          <a href="#caracteristicas" className="hover:text-[#c4d600] transition-colors">Características</a>
          <a href="#calculadora-roi" className="hover:text-[#c4d600] transition-colors">Calculadora Ahorro</a>
          <a href="#planes" className="hover:text-[#c4d600] transition-colors">Planes y Precios</a>
          <a href="#preguntas" className="hover:text-[#c4d600] transition-colors">Preguntas Frecuentes</a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="hidden sm:flex bg-[#0f2537] hover:bg-[#16324a] text-slate-200 border border-[#c4d600]/40 px-4 py-2.5 rounded-xl text-xs font-semibold items-center gap-2 transition-all"
          >
            <PhoneCall className="w-3.5 h-3.5 text-[#c4d600]" />
            <span>Solicitar Demo</span>
          </button>

          <button
            onClick={onEnterApp}
            className="bg-[#c4d600] hover:bg-[#d2e300] text-[#0f2537] font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-[#c4d600]/20 active:scale-95 border border-[#c4d600]"
          >
            <span>Ingresar a la Plataforma</span>
            <ArrowRight className="w-4 h-4 text-[#0f2537]" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 sm:px-12 py-24 sm:py-32 max-w-6xl mx-auto text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-[#c4d600]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 bg-[#0f2537] border border-[#c4d600] px-4 py-1.5 rounded-full text-xs font-mono text-[#c4d600] font-bold mb-6 shadow-md">
          <Sparkles className="w-4 h-4 text-[#c4d600]" />
          <span>NORMATIVA COLOMBIA 2026 · RESOLUCIÓN 2388 PILA</span>
        </div>

        <h1 className="font-serif text-4xl sm:text-6xl font-bold text-slate-100 tracking-tight leading-[1.1] mb-6">
          Cero Sanciones UGPP y Control Total de la Seguridad Social de tu Empresa
        </h1>

        <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed mb-10 font-sans">
          Validum Grupo Empresarial ofrece la solución SaaS integral que audita automáticamente tus planillas PILA, gestiona radicación de incapacidades EPS/ARL y expide Paz y Salvos con firma digital en segundos.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onEnterApp}
            className="w-full sm:w-auto bg-[#c4d600] hover:bg-[#d2e300] text-[#0f2537] font-extrabold px-8 py-4 rounded-2xl text-sm flex items-center justify-center gap-3 transition-all shadow-xl shadow-[#c4d600]/20 active:scale-95 border border-[#c4d600]"
          >
            <span>Probar la Plataforma Ahora (Demo Interactiva)</span>
            <ArrowRight className="w-5 h-5 text-[#0f2537]" />
          </button>

          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="w-full sm:w-auto bg-[#0f2537] hover:bg-[#16324a] text-slate-200 border border-[#c4d600]/40 font-semibold px-8 py-4 rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 text-[#c4d600] fill-[#c4d600]" />
            <span>Agendar Demostración Comercial</span>
          </button>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section id="caracteristicas" className="px-6 sm:px-12 py-16 bg-[#0f182a]/60 border-y border-slate-800">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl font-bold text-slate-100">
              ¿Por qué las empresas líderes eligen Validum?
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Diseñado para departamentos de Gestión Humana, Contadores y Líderes de Seguridad y Salud en el Trabajo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="p-6 rounded-3xl bg-[#0f182a] border border-slate-800 space-y-3 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-slate-100">Motor de Auditoría PILA</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Verificación normativa en tiempo real de tarifas ARL (Riesgos I a V), topes de cotización e inconsistencias de IBC antes del pago al operador.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-3xl bg-[#0f182a] border border-slate-800 space-y-3 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-slate-100">Certificados Paz y Salvo PDF</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Expedición instantánea de constancias de cumplimiento normativo (Ley 789 y Ley 828) indispensables para licitaciones públicas y contratación.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-3xl bg-[#0f182a] border border-slate-800 space-y-3 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-slate-100">Carga Masiva Excel</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Importación en 1-clic de nóminas masivas desde archivos Excel o CSV con validación previa de documentos y afiliaciones EPS/AFP.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Interactive ROI Calculator Section */}
      <section id="calculadora-roi" className="px-6 sm:px-12 py-20 max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">CALCULADORA DE AHORRO CORPORATIVO</span>
          <h2 className="font-serif text-3xl font-bold text-slate-100">
            Calcula cuánto dinero ahorra tu empresa evitando errores en PILA
          </h2>
        </div>

        <div className="p-8 rounded-3xl bg-[#0f182a] border border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-2">NÚMERO DE EMPLEADOS / COTIZANTES EN TU EMPRESA</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={5}
                  max={250}
                  step={5}
                  value={cotizantesCount}
                  onChange={(e) => setCotizantesCount(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-2xl font-bold text-amber-400 shrink-0 w-16 text-right">{cotizantesCount}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Las fiscalizaciones de la UGPP imponen sanciones de hasta el 200% sobre los aportes inexactos o extemporáneos. La auditoría preventiva de Validum elimina el 100% de los errores de tarifa.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-[#16243d] border border-amber-500/30 space-y-4">
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase">RIESGO DE SANCIONES SIN AUDITORÍA PREVENTIVA</div>
              <div className="text-2xl font-mono font-bold text-red-400">{formatCop(multaEstimadaUGPP)}</div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <div className="text-[10px] font-mono text-amber-400 font-bold uppercase">AHORRO NETO ESTIMADO CON VALIDUM SAAS</div>
              <div className="text-3xl font-serif font-bold text-emerald-400 mt-1">{formatCop(ahorroEstimadoValidum)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans Section */}
      <section id="planes" className="px-6 sm:px-12 py-20 max-w-6xl mx-auto space-y-12">
        
        <div className="text-center space-y-3">
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
            PLANES & SUSCRIPCIONES SAAS
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-100">
            Planes a la medida de cada empresa
          </h2>

          {/* Billing Switcher */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => setBillingPeriod('MONTHLY')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                billingPeriod === 'MONTHLY' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
              }`}
            >
              Pago Mensual
            </button>
            <button
              onClick={() => setBillingPeriod('ANNUAL')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                billingPeriod === 'ANNUAL' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
              }`}
            >
              <span>Pago Anual</span>
              <span className="bg-emerald-500 text-slate-950 text-[9px] px-1.5 py-0.5 rounded font-bold">AHORRA 20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Plan PYME */}
          <div className="p-8 rounded-3xl bg-[#0f182a] border border-slate-800 space-y-6 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="space-y-4">
              <div className="text-slate-400 font-mono text-xs font-bold uppercase">Plan PYME</div>
              <div className="text-3xl font-serif font-bold text-slate-100">
                {billingPeriod === 'ANNUAL' ? '$119.000' : '$149.000'} <span className="text-xs font-sans text-slate-400 font-normal">COP / mes</span>
              </div>
              <p className="text-xs text-slate-400">Ideal para pequeñas empresas de hasta 25 empleados.</p>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-2 font-mono">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Hasta 25 Cotizantes</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Motor Auditor PILA</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Paz y Salvo PDF</li>
              </ul>
            </div>
            <button
              onClick={onEnterApp}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl text-xs transition-colors"
            >
              Probar Demo Gratis
            </button>
          </div>

          {/* Plan PRO (Featured) */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-[#16243d] to-[#0f182a] border-2 border-amber-500/50 space-y-6 flex flex-col justify-between shadow-2xl relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-bold text-[10px] px-3 py-0.5 rounded-full font-mono uppercase">
              MÁS POPULAR
            </div>
            <div className="space-y-4">
              <div className="text-amber-400 font-mono text-xs font-bold uppercase">Plan PRO empresarial</div>
              <div className="text-3xl font-serif font-bold text-slate-100">
                {billingPeriod === 'ANNUAL' ? '$279.000' : '$349.000'} <span className="text-xs font-sans text-slate-400 font-normal">COP / mes</span>
              </div>
              <p className="text-xs text-slate-300">Para medianas empresas en crecimiento de hasta 100 cotizantes.</p>
              <ul className="space-y-2.5 text-xs text-slate-200 pt-2 font-mono">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Hasta 100 Cotizantes</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Carga Masiva Excel / CSV</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Auto-Rellenado de Formularios</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Certificados QR Firma Digital</li>
              </ul>
            </div>
            <button
              onClick={onEnterApp}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl text-xs transition-colors shadow-lg shadow-amber-500/20"
            >
              Iniciar Ahora en la App
            </button>
          </div>

          {/* Plan ENTERPRISE */}
          <div className="p-8 rounded-3xl bg-[#0f182a] border border-slate-800 space-y-6 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="space-y-4">
              <div className="text-slate-400 font-mono text-xs font-bold uppercase">Plan Enterprise & Contable</div>
              <div className="text-3xl font-serif font-bold text-slate-100">
                {billingPeriod === 'ANNUAL' ? '$550.000' : '$690.000'} <span className="text-xs font-sans text-slate-400 font-normal">COP / mes</span>
              </div>
              <p className="text-xs text-slate-400">Cotizantes ilimitados y multi-empresa para firmas contables.</p>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-2 font-mono">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Cotizantes Ilimitados</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Multi-Empresa (Hasta 10 NITs)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Chatbot IA Comercial Integrado</li>
              </ul>
            </div>
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl text-xs transition-colors"
            >
              Solicitar Cotización Enterprise
            </button>
          </div>

        </div>

      </section>

      {/* Demo Modal */}
      {isDemoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0f182a] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <h3 className="font-serif text-2xl font-bold text-slate-100">
                Solicitar Demostración Comercial
              </h3>
              <button onClick={() => setIsDemoModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {demoSubmitted ? (
              <div className="text-center py-8 space-y-3 text-emerald-400">
                <CheckCircle2 className="w-12 h-12 mx-auto" />
                <h4 className="font-serif text-xl font-bold">¡Solicitud Recibida!</h4>
                <p className="text-xs text-slate-300 font-mono">Un especialista en seguridad social se pondrá en contacto contigo. Redirigiendo a la App...</p>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-mono text-slate-400 mb-1">NOMBRE Y APELLIDO *</label>
                  <input
                    type="text"
                    required
                    value={demoForm.nombre}
                    onChange={(e) => setDemoForm({ ...demoForm, nombre: e.target.value })}
                    placeholder="Ej: Carlos Mendoza"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-mono text-slate-400 mb-1">EMPRESA / RAZÓN SOCIAL *</label>
                  <input
                    type="text"
                    required
                    value={demoForm.empresa}
                    onChange={(e) => setDemoForm({ ...demoForm, empresa: e.target.value })}
                    placeholder="Ej: Tecnologías Validum S.A.S."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-slate-400 mb-1">CORREO CORPORATIVO *</label>
                    <input
                      type="email"
                      required
                      value={demoForm.email}
                      onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                      placeholder="nombre@empresa.com"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-slate-400 mb-1">TELÉFONO DE CONTACTO</label>
                    <input
                      type="tel"
                      value={demoForm.telefono}
                      onChange={(e) => setDemoForm({ ...demoForm, telefono: e.target.value })}
                      placeholder="+57 300 123 4567"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsDemoModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                  >
                    Enviar Solicitud
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* Footer */}
      <footer id="contacto" className="border-t border-slate-800/80 bg-[#0f182a] px-6 sm:px-12 py-10 text-center text-xs font-mono text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            © 2026 VALIDUM SOFTWARE SAAS · Todos los derechos reservados
          </div>
          <div className="flex items-center gap-6">
            <span>Soporte: soporte@validum.com.co</span>
            <span>Tel: +57 (601) 745-8920</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
