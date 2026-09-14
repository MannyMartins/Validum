import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, Check, Edit3, Plus, Save, Trash2 } from 'lucide-react';
import { useValidum } from '../../context/ValidumContext';
import type { Empresa } from '../../types/validum';

const emptyCompany = (): Empresa => ({
  nit: '', dv: '', razonSocial: '', direccion: '', ciudad: '', departamento: '', telefono: '', email: '',
  operadorPila: 'Aportes en Línea', arl: 'Positiva', nivelRiesgoArl: 1,
  representanteLegal: '', cedulaRepresentante: '', tipoDocumento: 'NIT',
  actividadEconomica: '', contactoRecursosHumanos: '', tipoAportantePagador: '', claseRiesgoPrincipal: 'Riesgo I (0.522%)',
});

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0a1824] p-3 text-xs text-slate-100 outline-none focus:border-[#c4d600]';


export const ConfiguracionEmpresa: React.FC = () => {
  const { empresas, empresa, setEmpresa, selectEmpresa, deleteEmpresa, setActiveTab } = useValidum();
  const [formData, setFormData] = useState<Empresa>(() => empresa.id ? { ...empresa } : emptyCompany());
  const [editingId, setEditingId] = useState<string | null>(empresa.id || null);
  const [creating, setCreating] = useState(!empresa.id);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!creating && !editingId && empresa.id) {
      setEditingId(empresa.id);
      setFormData({ ...empresa });
    }
  }, [creating, editingId, empresa]);

  const update = <K extends keyof Empresa>(key: K, value: Empresa[K]) => setFormData(current => ({ ...current, [key]: value }));

  const beginNew = () => {
    setCreating(true);
    setEditingId(null);
    setFormData(emptyCompany());
    setSaved(false);
  };

  const editCompany = (item: Empresa) => {
    setCreating(false);
    setEditingId(item.id || null);
    setFormData({ ...item });
    setSaved(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.razonSocial.trim() && !formData.nit.trim()) {
      alert('Escribe al menos la razón social o el NIT para identificar la empresa.');
      return;
    }
    try {
      await setEmpresa({ ...formData, id: editingId || formData.id });
      setCreating(false);
      setEditingId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar la empresa.');
    }
  };

  const makeActive = async (item: Empresa) => {
    if (!item.id) return;
    await selectEmpresa(item.id);
    editCompany(item);
  };

  const removeCompany = async (item: Empresa) => {
    if (!item.id || !window.confirm(`¿Eliminar la empresa ${item.razonSocial || item.nit}?`)) return;
    await deleteEmpresa(item.id);
    if (editingId === item.id) beginNew();
  };

  return (
    <div className="space-y-6">
      <button onClick={() => setActiveTab('autofill')} className="flex w-fit items-center gap-2 rounded-lg px-2 py-1 text-xs font-bold text-[#c4d600] hover:bg-slate-900/60">
        <ArrowLeft className="h-4 w-4" /> Volver al Módulo de Formularios
      </button>

      <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-[#0f182a] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#c4d600]"><Building2 className="h-4 w-4" /> Empresas y aportantes</div>
          <h1 className="font-serif text-3xl font-bold text-slate-100">Registro de Empresas</h1>
          <p className="mt-1 text-xs text-slate-400">Guarda varias empresas y elige cuál se usará al rellenar cada formulario.</p>
        </div>
        <button type="button" onClick={beginNew} className="flex items-center justify-center gap-2 rounded-xl bg-[#c4d600] px-5 py-3 text-xs font-extrabold text-[#0f2537]">
          <Plus className="h-4 w-4" /> Registrar nueva empresa
        </button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-3 rounded-3xl border border-slate-800 bg-[#0f182a] p-4">
          <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Empresas registradas ({empresas.length})</p>
          {!empresas.length && <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">Aún no hay empresas. Usa “Registrar nueva empresa”.</div>}
          {empresas.map(item => {
            const active = item.id === empresa.id;
            const editing = item.id === editingId;
            return (
              <div key={item.id} className={`rounded-2xl border p-4 ${editing ? 'border-[#c4d600]/60 bg-[#c4d600]/5' : 'border-slate-700 bg-[#0a1824]'}`}>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-slate-800 p-2 text-[#c4d600]"><Building2 className="h-5 w-5" /></div>
                  <button type="button" onClick={() => editCompany(item)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-bold text-slate-100">{item.razonSocial || 'Empresa sin razón social'}</p>
                    <p className="mt-1 text-[11px] text-slate-400">NIT {item.nit || 'sin registrar'}{item.dv ? `-${item.dv}` : ''}</p>
                  </button>
                  {active && <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[9px] font-bold uppercase text-emerald-300">En uso</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void makeActive(item)} disabled={active} className="flex-1 rounded-lg border border-slate-700 px-2 py-2 text-[10px] font-bold text-slate-300 disabled:border-emerald-500/20 disabled:text-emerald-300">{active ? 'Seleccionada' : 'Usar en formularios'}</button>
                  <button type="button" title="Editar empresa" onClick={() => editCompany(item)} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><Edit3 className="h-4 w-4" /></button>
                  <button type="button" title="Eliminar empresa" onClick={() => void removeCompany(item)} className="rounded-lg border border-rose-500/20 p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </aside>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-800 bg-[#0f182a] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <p className="text-lg font-bold text-white">{editingId ? 'Editar empresa' : 'Nueva empresa'}</p>
              <p className="mt-1 text-[11px] text-slate-400">Los campos pueden dejarse vacíos mientras definimos contigo la lista obligatoria definitiva.</p>
            </div>
            <div className="flex items-center gap-2">
              {saved && <span className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300"><Check className="h-4 w-4" /> Empresa guardada</span>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[11px] font-mono text-slate-400">RAZÓN SOCIAL / NOMBRE EMPRESA<input className={inputClass} value={formData.razonSocial} onChange={e => update('razonSocial', e.target.value)} /></label>
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-2 text-[11px] font-mono text-slate-400">NIT<input className={`${inputClass} font-mono`} value={formData.nit} onChange={e => update('nit', e.target.value)} /></label>
              <label className="text-[11px] font-mono text-slate-400">DV<input className={`${inputClass} text-center font-mono`} value={formData.dv} onChange={e => update('dv', e.target.value)} /></label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[11px] font-mono text-slate-400">OPERADOR PILA PRINCIPAL<select className={inputClass} value={formData.operadorPila} onChange={e => update('operadorPila', e.target.value as Empresa['operadorPila'])}><option>Aportes en Línea</option><option>Enlace Operativo</option><option value="Soi">PILA SOI</option><option>Mi Planilla</option><option>Asopagos</option><option>Simple</option></select></label>
            <label className="text-[11px] font-mono text-slate-400">CLASE DE RIESGO ARL<select className={inputClass} value={formData.claseRiesgoPrincipal || ''} onChange={e => update('claseRiesgoPrincipal', e.target.value)}><option value="">Sin definir</option><option value="Riesgo I (0.522%)">Clase de riesgo I (0.522%)</option><option value="Riesgo II (1.044%)">Clase de riesgo II (1.044%)</option><option value="Riesgo III (2.436%)">Clase de riesgo III (2.436%)</option><option value="Riesgo IV (4.350%)">Clase de riesgo IV (4.350%)</option><option value="Riesgo V (6.960%)">Clase de riesgo V (6.960%)</option></select></label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[11px] font-mono text-slate-400">DIRECCIÓN<input className={inputClass} value={formData.direccion} onChange={e => update('direccion', e.target.value)} /></label>
            <label className="text-[11px] font-mono text-slate-400">CORREO<input type="email" className={inputClass} value={formData.email} onChange={e => update('email', e.target.value)} /></label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-[11px] font-mono text-slate-400">DEPARTAMENTO<input className={inputClass} value={formData.departamento || ''} onChange={e => update('departamento', e.target.value)} /></label>
            <label className="text-[11px] font-mono text-slate-400">CIUDAD / MUNICIPIO<input className={inputClass} value={formData.ciudad} onChange={e => update('ciudad', e.target.value)} /></label>
            <label className="text-[11px] font-mono text-slate-400">TELÉFONO<input className={inputClass} value={formData.telefono} onChange={e => update('telefono', e.target.value)} /></label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[11px] font-mono text-slate-400">REPRESENTANTE LEGAL<input className={inputClass} value={formData.representanteLegal} onChange={e => update('representanteLegal', e.target.value)} /></label>
            <label className="text-[11px] font-mono text-slate-400">DOCUMENTO DEL REPRESENTANTE<input className={inputClass} value={formData.cedulaRepresentante} onChange={e => update('cedulaRepresentante', e.target.value)} /></label>
            <label className="text-[11px] font-mono text-slate-400">ACTIVIDAD ECONÓMICA<input className={inputClass} value={formData.actividadEconomica || ''} onChange={e => update('actividadEconomica', e.target.value)} /></label>
            <label className="text-[11px] font-mono text-slate-400">CONTACTO DE RECURSOS HUMANOS<input className={inputClass} value={formData.contactoRecursosHumanos || ''} onChange={e => update('contactoRecursosHumanos', e.target.value)} /></label>
            <label className="text-[11px] font-mono text-slate-400">TIPO DE APORTANTE O PAGADOR<input className={inputClass} value={formData.tipoAportantePagador || ''} onChange={e => update('tipoAportantePagador', e.target.value)} placeholder="Ej. EMPLEADOR" /></label>
          </div>

          <div className="flex justify-end border-t border-slate-800 pt-4">
            <button type="submit" className="flex items-center gap-2 rounded-xl bg-[#c4d600] px-6 py-3 text-xs font-extrabold text-[#0f2537] shadow-lg shadow-[#c4d600]/15"><Save className="h-4 w-4" /> Guardar empresa</button>
          </div>
        </form>
      </div>
    </div>
  );
};
