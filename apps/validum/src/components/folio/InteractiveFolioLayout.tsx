import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ShieldCheck, X, Check, Clock, LucideIcon } from 'lucide-react';
import { FolioTabs, FolioTabItem } from './FolioTabs';

export interface InteractiveFolioLayoutProps {
  title?: string;
  subtitle?: string;
  documentCode?: string;
  statusText?: string;
  tabs: FolioTabItem[];
  activeTab: number;
  onTabChange: (index: number) => void;
  sectionProgress?: number[];
  onClose?: () => void;
  summaryCard?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const InteractiveFolioLayout: React.FC<InteractiveFolioLayoutProps> = ({
  title = 'Documento folio',
  subtitle,
  documentCode,
  statusText = 'Listo para radicar',
  tabs,
  activeTab,
  onTabChange,
  sectionProgress,
  onClose,
  summaryCard,
  footer,
  children,
  className = ''
}) => {
  const currentTab = tabs[activeTab] || tabs[0];
  const docYear = new Date().getFullYear();
  const resolvedDocCode = documentCode || `EXP-SGSSS-${docYear}`;

  return (
    <div className={`relative flex min-h-screen w-full flex-col items-center justify-start bg-[#060c18] p-3 text-slate-100 md:p-6 lg:p-8 ${className}`}>
      {/* Background Micro-Grid & Glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-[#c4d600]/10 blur-3xl" />

      {/* Top Header Bar */}
      <header className="relative z-10 mb-6 flex w-full max-w-7xl items-center justify-between rounded-2xl border border-slate-800/80 bg-[#0a1526]/80 px-5 py-3.5 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-[#c4d600]/20 text-cyan-300 shadow-md">
            <Sparkles className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-black tracking-wider text-white">VALIDUM</span>
              <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-400/30">
                FOLIO DIGITAL INTERACTIVO
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sistema de captura y radicación digital de expedientes oficiales EPS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-slate-800 bg-[#070e1a] px-3 py-1.5 text-xs text-slate-300 md:flex">
            <ShieldCheck className="h-4 w-4 text-[#c4d600]" />
            <span>Resolución 768 MinSalud</span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-400 hover:border-slate-500 hover:text-white transition-colors"
              title="Cerrar libreta"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace: Left Index + Right Notebook Binder */}
      <div className="relative z-10 flex w-full max-w-7xl flex-col gap-6 lg:flex-row lg:items-start">
        
        {/* ── PANEL IZQUIERDO: INDEX (Progreso y Navegación) ── */}
        <aside className="w-full shrink-0 rounded-3xl border border-slate-800/80 bg-[#091424]/90 p-5 backdrop-blur-2xl shadow-2xl lg:w-72">
          <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="font-serif text-base font-bold text-white">Index</h2>
              <p className="text-[11px] text-slate-400">Navegación del expediente</p>
            </div>
            <span className="rounded-lg bg-slate-800/80 px-2 py-1 text-xs font-mono font-bold text-cyan-300">
              {activeTab + 1}/{tabs.length}
            </span>
          </div>

          <nav className="flex flex-col gap-2.5">
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isCurrent = activeTab === idx;
              const progress = sectionProgress ? sectionProgress[idx] ?? 0 : (tab.isCompleted ? 100 : isCurrent ? 50 : 0);
              const isCompleted = progress === 100 || Boolean(tab.isCompleted);

              return (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(idx)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative flex w-full flex-col overflow-hidden rounded-2xl p-3 text-left transition-all ${
                    isCurrent
                      ? 'border border-cyan-400/80 bg-gradient-to-r from-cyan-950/50 to-slate-900 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                      : isCompleted
                        ? 'border border-[#c4d600]/40 bg-[#c4d600]/10 text-slate-200 hover:border-[#c4d600]/70'
                        : 'border border-slate-800/80 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                          isCurrent
                            ? 'bg-cyan-400 text-slate-950 shadow-sm'
                            : isCompleted
                              ? 'bg-[#c4d600] text-[#0b132b]'
                              : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {Icon && <Icon className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className={`text-xs font-bold leading-tight ${isCurrent ? 'text-white' : isCompleted ? 'text-slate-100' : 'text-slate-300'}`}>
                          {tab.label}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {isCompleted ? 'Sección completada' : isCurrent ? 'Editando ahora' : 'Pendiente por diligenciar'}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isCompleted ? (
                        <span className="flex items-center gap-1 rounded-full bg-[#c4d600]/20 px-2 py-0.5 text-[10px] font-extrabold text-[#c4d600]">
                          <Check className="h-3 w-3" /> Listo
                        </span>
                      ) : isCurrent ? (
                        <span className="flex items-center gap-1 rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-extrabold text-cyan-300 animate-pulse">
                          <Clock className="h-3 w-3" /> En curso
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso de la sección */}
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4 }}
                      className={`h-full rounded-full ${
                        isCompleted
                          ? 'bg-[#c4d600]'
                          : isCurrent
                            ? 'bg-gradient-to-r from-cyan-400 to-[#c4d600]'
                            : 'bg-slate-700'
                      }`}
                    />
                  </div>
                </motion.button>
              );
            })}
          </nav>

          {/* Tarjeta de Resumen opcional */}
          {summaryCard && (
            <div className="mt-5">
              {summaryCard}
            </div>
          )}
        </aside>

        {/* ── CENTRO / DERECHA: LA LIBRETA DIGITAL (FOLIO CON ANILLAS Y SOLAPAS) ── */}
        <main className="relative flex-1">
          
          {/* Base posterior de encuadernación (Binder Cover oscuro y realista) */}
          <div className="relative rounded-[32px] border border-slate-700/80 bg-gradient-to-b from-[#0b1728] via-[#091322] to-[#070e19] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.85)] md:p-5">
            
            {/* ANILLAS METÁLICAS SUPERIORES */}
            <div className="absolute -top-5 left-8 right-8 z-30 flex justify-around pointer-events-none">
              {[0, 1, 2, 3].map(ringIdx => (
                <div key={ringIdx} className="relative flex flex-col items-center">
                  <div className="h-3 w-4 rounded-full bg-slate-950/90 shadow-inner ring-1 ring-slate-700" />
                  <div className="relative -mt-1.5 h-12 w-3.5 rounded-full border border-slate-400 bg-gradient-to-r from-slate-400 via-white to-slate-500 shadow-xl">
                    <div className="absolute inset-y-1 left-0.5 w-1 rounded-full bg-white/70 blur-[0.5px]" />
                  </div>
                  <div className="-mt-1 h-3 w-4 rounded-full bg-slate-400/20 blur-[1px]" />
                </div>
              ))}
            </div>

            {/* PESTAÑAS LATERALES DERECHAS (FolioTabs con Tooltip Shadcn flotante) */}
            <div className="absolute -right-3 top-16 z-30 md:-right-6">
              <FolioTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={onTabChange}
              />
            </div>

            {/* PILA DE HOJAS SUBYACENTES */}
            <div className="absolute inset-x-5 inset-y-4 rounded-2xl bg-slate-200/90 shadow-sm translate-y-1 pointer-events-none" />
            <div className="absolute inset-x-4 inset-y-3 rounded-2xl bg-slate-100/95 shadow-md translate-y-0.5 pointer-events-none" />

            {/* HOJA ACTIVA DE LA LIBRETA */}
            <div className="relative z-20 min-h-[640px] rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 text-slate-800 shadow-xl md:p-8">
              
              {/* Encabezado de la Hoja */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-serif text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                      {title}
                    </h1>
                    <span className="rounded-md bg-slate-900 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[#c4d600]">
                      {resolvedDocCode}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {subtitle || (
                      <>
                        Sección {activeTab + 1} de {tabs.length}:{' '}
                        <span className="font-bold text-slate-800">{currentTab.label}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">Estado:</span>
                  <span className="flex items-center gap-1 rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-800 border border-cyan-300/60">
                    <Check className="h-3.5 w-3.5 text-cyan-600" /> {statusText}
                  </span>
                </div>
              </div>

              {/* Contenedor del contenido (Children) */}
              <div className="relative min-h-[460px]">
                {children}
              </div>

              {/* Footer de navegación / acciones */}
              {footer && (
                <div className="mt-8 border-t border-slate-200 pt-4">
                  {footer}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
export default InteractiveFolioLayout;
