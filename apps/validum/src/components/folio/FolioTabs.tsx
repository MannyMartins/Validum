import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  MapPin,
  Briefcase,
  Building2,
  Users as UsersIcon,
  FileSignature,
  LucideIcon
} from 'lucide-react';

export interface FolioTabItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: LucideIcon;
  badge?: string | number;
  isCompleted?: boolean;
}

export interface FolioTabsProps {
  tabs: FolioTabItem[];
  activeTab: number;
  onTabChange: (index: number) => void;
  className?: string;
}

// Iconos por defecto estándar para trámites SGSSS si no se especifica icono
const DEFAULT_ICONS: Record<string, LucideIcon> = {
  persona: User,
  entidad: MapPin,
  residencia: MapPin,
  laboral: Briefcase,
  empresa: Building2,
  beneficiarios: UsersIcon,
  documentos: FileSignature,
  firmas: FileSignature
};

export const FolioTabs: React.FC<FolioTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = ''
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className={`relative flex flex-col gap-2.5 ${className}`}>
      {tabs.map((tab, idx) => {
        const isActive = activeTab === idx;
        const isHovered = hoveredIdx === idx;
        const Icon = tab.icon || DEFAULT_ICONS[tab.id] || User;

        return (
          <div
            key={tab.id}
            className="relative flex items-center"
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Botón de la Solapa (Tab) */}
            <motion.button
              type="button"
              onClick={() => onTabChange(idx)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.95 }}
              aria-label={tab.label}
              className={`relative z-20 flex h-12 w-12 items-center justify-center rounded-r-2xl border-y border-r transition-colors ${
                isActive
                  ? 'border-slate-300 bg-[#f8fafc] text-slate-900 shadow-md ring-1 ring-black/5'
                  : 'border-slate-800/90 bg-[#0a1828] text-slate-400 hover:border-slate-700 hover:bg-[#0e2136] hover:text-slate-100'
              }`}
            >
              {/* Indicador de pestaña activa (borde izquierdo iluminado) */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute -left-1 inset-y-2 w-1.5 rounded-r-full bg-cyan-400 shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              {/* Icono central de la sección */}
              <Icon
                className={`h-5 w-5 transition-transform ${
                  isActive ? 'text-slate-900 scale-110' : 'text-slate-400'
                }`}
              />

              {/* Micro-badge de completado */}
              {tab.isCompleted && !isActive && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#c4d600] ring-2 ring-[#0a1828]" />
              )}
            </motion.button>

            {/* Tooltip flotante Shadcn-style al pasar el cursor */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, x: 8, scale: 0.95 }}
                  animate={{ opacity: 1, x: 14, scale: 1 }}
                  exit={{ opacity: 0, x: 6, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="pointer-events-none absolute left-full z-50 flex items-center whitespace-nowrap"
                >
                  <div className="relative rounded-xl border border-slate-700/80 bg-[#070e18]/95 px-3 py-1.5 text-xs font-bold text-slate-100 shadow-2xl backdrop-blur-md">
                    {/* Flecha indicadora del Tooltip */}
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 rotate-45 border-b border-l border-slate-700/80 bg-[#070e18]" />
                    <div className="flex items-center gap-1.5">
                      <span>{tab.label}</span>
                      {tab.badge && (
                        <span className="rounded bg-cyan-400/20 px-1 py-0.2 text-[10px] text-cyan-300">
                          {tab.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};
export default FolioTabs;
