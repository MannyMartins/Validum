import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Filter,
  Inbox,
  LoaderCircle,
  Mail,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import { useValidum } from '../../context/ValidumContext';
import {
  CorrespondenceCategory,
  CorrespondenceFilters,
  CorrespondenceItem,
  CorrespondencePriority,
  CorrespondenceStatus,
  loadCorrespondence,
  loadCorrespondenceDetail,
  loadCorrespondenceSummary,
  updateCorrespondence,
} from '../../lib/correspondenceRepository';
import { loadOrganizationTeam, OrganizationMember } from '../../lib/teamRepository';

const categories: CorrespondenceCategory[] = ['Términos jurídicos', 'Cobros Jurídicos', 'Consulta General', 'Soporte Operativo'];
const priorities: CorrespondencePriority[] = ['Urgente', 'Moderado', 'Respuesta Ligera'];
const statuses: CorrespondenceStatus[] = ['pendiente', 'en_revision', 'respondido', 'archivado'];
const statusLabels: Record<CorrespondenceStatus, string> = {
  pendiente: 'Pendiente', en_revision: 'En revisión', respondido: 'Respondido', archivado: 'Archivado',
};

const priorityStyle: Record<CorrespondencePriority, string> = {
  Urgente: 'border-rose-500/40 bg-rose-500/15 text-rose-400',
  Moderado: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
  'Respuesta Ligera': 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function PriorityBadge({ value }: { value: CorrespondencePriority }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase ${priorityStyle[value]}`}>{value}</span>;
}

export const CorrespondenceDashboard: React.FC = () => {
  const { userSession } = useValidum();
  const canEdit = userSession?.rol !== 'Auditor';
  const [filters, setFilters] = useState<CorrespondenceFilters>({ pagina: 1, limite: 20 });
  const [items, setItems] = useState<CorrespondenceItem[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof loadCorrespondenceSummary>> | null>(null);
  const [pagination, setPagination] = useState({ pagina: 1, limite: 20, total: 0, paginas: 1 });
  const [selected, setSelected] = useState<CorrespondenceItem | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [edit, setEdit] = useState({ estado: 'pendiente' as CorrespondenceStatus, asignado_a: '', notas_internas: '', propuesta_respuesta: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, counts] = await Promise.all([loadCorrespondence(filters), loadCorrespondenceSummary()]);
      setItems(list.items);
      setPagination(list.paginacion);
      setSummary(counts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la correspondencia.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    void loadOrganizationTeam().then(snapshot => setMembers(snapshot.members.filter(member => member.active))).catch(() => setMembers([]));
  }, []);

  const applyFilter = <K extends keyof CorrespondenceFilters>(key: K, value: CorrespondenceFilters[K]) => {
    setFilters(current => ({ ...current, [key]: value || undefined, pagina: 1 }));
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await loadCorrespondenceDetail(id);
      setSelected(detail);
      setEdit({
        estado: detail.estado,
        asignado_a: detail.asignado_a?.id || '',
        notas_internas: detail.notasInternas || '',
        propuesta_respuesta: detail.propuestaRespuesta || '',
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el correo.');
    } finally {
      setDetailLoading(false);
    }
  };

  const save = async () => {
    if (!selected || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCorrespondence(selected.id, {
        estado: edit.estado,
        asignado_a: edit.asignado_a || null,
        notas_internas: edit.notas_internas || null,
        propuesta_respuesta: edit.propuesta_respuesta,
      });
      setSelected(updated);
      setNotice('Cambios guardados.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const activeFilterCount = useMemo(() => Object.entries(filters).filter(([key, value]) => !['pagina', 'limite'].includes(key) && value !== undefined && value !== '').length, [filters]);

  if (selected) {
    const documents = Array.isArray(selected.documentosRequeridos) ? selected.documentosRequeridos : [];
    return (
      <div className="space-y-5">
        <button onClick={() => { setSelected(null); setNotice(null); }} className="theme-control inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"><ArrowLeft className="h-4 w-4" /> Volver al listado</button>
        {error && <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">{error}</div>}
        {notice && <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-300">{notice}</div>}
        <header className="theme-surface rounded-3xl border p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><PriorityBadge value={selected.prioridad} /><span className="theme-accent-soft rounded-full px-3 py-1 text-[9px] font-extrabold uppercase">{selected.categoria}</span>{selected.alertaInmediata && <span className="rounded-full bg-rose-500 px-3 py-1 text-[9px] font-extrabold text-white">ALERTA INMEDIATA</span>}</div>
              <h1 className="theme-text mt-4 break-words font-serif text-2xl font-extrabold">{selected.asunto || 'Sin asunto'}</h1>
              <p className="theme-muted mt-2 text-xs">Recibido el {formatDate(selected.fechaRecepcion)} en {selected.cuentaDestino}</p>
            </div>
            <div className="theme-surface-soft rounded-2xl border px-4 py-3 text-xs"><p className="theme-text font-extrabold">{selected.remitenteNombre}</p><p className="theme-muted mt-1">{selected.remitenteCorreo}</p></div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <section className="theme-surface rounded-3xl border p-6">
              <h2 className="theme-text text-sm font-extrabold">Resumen de IA</h2><p className="theme-muted mt-3 whitespace-pre-wrap text-sm leading-6">{selected.resumen}</p>
              {selected.errorClasificacion && <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300"><AlertTriangle className="h-4 w-4 shrink-0" />La clasificación requirió valores de respaldo. Revisa el correo antes de responder.</div>}
            </section>
            <section className="theme-surface rounded-3xl border p-6"><h2 className="theme-text text-sm font-extrabold">Documentos requeridos</h2>{documents.length ? <ul className="theme-muted mt-3 space-y-2 text-xs">{documents.map((document, index) => <li key={`${document}-${index}`} className="theme-surface-soft rounded-xl border px-3 py-2">{document}</li>)}</ul> : <p className="theme-muted mt-3 text-xs">No se identificaron documentos requeridos.</p>}</section>
            <section className="theme-surface rounded-3xl border p-6"><h2 className="theme-text text-sm font-extrabold">Cuerpo original</h2><div className="theme-surface-soft theme-text mt-3 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-2xl border p-4 text-xs leading-6">{selected.cuerpo || 'El correo no contiene texto plano.'}</div></section>
          </div>

          <aside className="space-y-5">
            <section className="theme-surface rounded-3xl border p-5">
              <h2 className="theme-text flex items-center gap-2 text-sm font-extrabold"><UserRound className="theme-accent h-4 w-4" /> Datos relacionados</h2>
              <dl className="mt-4 space-y-3 text-xs"><div><dt className="theme-muted text-[9px] font-bold uppercase">Identificación</dt><dd className="theme-text mt-1 font-semibold">{selected.identificacion || 'No identificada'}</dd></div><div><dt className="theme-muted text-[9px] font-bold uppercase">Empresa</dt><dd className="theme-text mt-1 font-semibold">{selected.empresaRelacionada || 'No identificada'}</dd></div><div><dt className="theme-muted text-[9px] font-bold uppercase">Hilo de Gmail</dt><dd className="theme-text mt-1 break-all font-mono text-[10px]">{selected.gmailThreadId || '—'}</dd></div></dl>
            </section>
            <section className="theme-surface space-y-4 rounded-3xl border p-5">
              <div><h2 className="theme-text text-sm font-extrabold">Gestión interna</h2>{!canEdit && <p className="mt-1 text-[10px] text-amber-400">Tu rol permite consultar, pero no modificar.</p>}</div>
              <label className="theme-muted block text-[9px] font-bold uppercase">Estado<select disabled={!canEdit} value={edit.estado} onChange={event => setEdit(current => ({ ...current, estado: event.target.value as CorrespondenceStatus }))} className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-xs">{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
              <label className="theme-muted block text-[9px] font-bold uppercase">Asignado a<select disabled={!canEdit} value={edit.asignado_a} onChange={event => setEdit(current => ({ ...current, asignado_a: event.target.value }))} className="theme-input mt-2 w-full rounded-xl border px-3 py-2.5 text-xs"><option value="">Sin asignar</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}</select></label>
              <label className="theme-muted block text-[9px] font-bold uppercase">Notas internas<textarea disabled={!canEdit} rows={5} value={edit.notas_internas} onChange={event => setEdit(current => ({ ...current, notas_internas: event.target.value }))} className="theme-input mt-2 w-full resize-y rounded-xl border p-3 text-xs" placeholder="Notas visibles solo para el equipo…" /></label>
            </section>
            <section className="theme-surface rounded-3xl border p-5">
              <div className="flex items-center justify-between gap-2"><h2 className="theme-text text-sm font-extrabold">Propuesta de respuesta</h2><button type="button" onClick={() => void navigator.clipboard.writeText(edit.propuesta_respuesta).then(() => setNotice('Respuesta copiada.'))} className="theme-control inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-bold"><Clipboard className="h-3.5 w-3.5" /> Copiar</button></div>
              <textarea disabled={!canEdit} rows={12} value={edit.propuesta_respuesta} onChange={event => setEdit(current => ({ ...current, propuesta_respuesta: event.target.value }))} className="theme-input mt-3 w-full resize-y rounded-xl border p-3 text-xs leading-5" />
              <button type="button" disabled={!canEdit || saving} onClick={() => void save()} className="theme-accent-button mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="theme-surface rounded-3xl border p-6 sm:p-8"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-4"><span className="theme-accent-soft rounded-2xl p-3"><Inbox className="h-7 w-7" /></span><div><p className="theme-accent text-[11px] font-extrabold uppercase tracking-[0.18em]">Bandeja jurídica</p><h1 className="theme-text mt-1 font-serif text-2xl font-extrabold sm:text-3xl">Correspondencia</h1><p className="theme-muted mt-2 text-xs">Correos clasificados por IA desde las cuentas conectadas en n8n.</p></div></div><button onClick={() => void refresh()} disabled={loading} className="theme-control inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button></div></header>

      {summary && summary.alertas_pendientes > 0 && <button onClick={() => applyFilter('alerta_inmediata', true)} className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-left text-rose-300"><AlertTriangle className="h-5 w-5 shrink-0" /><span className="text-xs font-bold">{summary.alertas_pendientes} {summary.alertas_pendientes === 1 ? 'correo requiere' : 'correos requieren'} atención inmediata y sigue pendiente.</span></button>}
      {error && <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{categories.map(category => <button key={category} onClick={() => applyFilter('categoria', filters.categoria === category ? undefined : category)} className={`theme-surface rounded-2xl border p-4 text-left transition ${filters.categoria === category ? 'theme-selected-card' : ''}`}><p className="theme-muted text-[9px] font-extrabold uppercase tracking-wider">Categoría</p><p className="theme-text mt-2 text-xs font-bold">{category}</p><p className="theme-accent mt-2 text-2xl font-black">{summary?.por_categoria[category] || 0}</p></button>)}</section>
      <section className="grid gap-3 sm:grid-cols-3">{priorities.map(priority => <button key={priority} onClick={() => applyFilter('prioridad', filters.prioridad === priority ? undefined : priority)} className={`theme-surface flex items-center justify-between rounded-2xl border p-4 ${filters.prioridad === priority ? 'theme-selected-card' : ''}`}><PriorityBadge value={priority} /><span className="theme-text text-xl font-black">{summary?.por_prioridad[priority] || 0}</span></button>)}</section>

      <section className="theme-surface rounded-3xl border p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="theme-text flex items-center gap-2 text-sm font-extrabold"><Filter className="theme-accent h-4 w-4" /> Filtros {activeFilterCount > 0 && <span className="theme-accent-soft rounded-full px-2 py-0.5 text-[9px]">{activeFilterCount}</span>}</h2>{activeFilterCount > 0 && <button onClick={() => { setFilters({ pagina: 1, limite: 20 }); setSearchDraft(''); }} className="theme-accent text-[10px] font-bold">Limpiar filtros</button>}</div>
        <form onSubmit={event => { event.preventDefault(); applyFilter('busqueda', searchDraft); }} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2"><Search className="theme-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><input value={searchDraft} onChange={event => setSearchDraft(event.target.value)} className="theme-input w-full rounded-xl border py-3 pl-9 pr-3 text-xs" placeholder="Asunto, remitente, identificación o empresa…" /></div>
          <select value={filters.categoria || ''} onChange={event => applyFilter('categoria', event.target.value as CorrespondenceCategory)} className="theme-input rounded-xl border px-3 py-3 text-xs"><option value="">Todas las categorías</option>{categories.map(value => <option key={value}>{value}</option>)}</select>
          <select value={filters.prioridad || ''} onChange={event => applyFilter('prioridad', event.target.value as CorrespondencePriority)} className="theme-input rounded-xl border px-3 py-3 text-xs"><option value="">Todas las prioridades</option>{priorities.map(value => <option key={value}>{value}</option>)}</select>
          <select value={filters.estado || ''} onChange={event => applyFilter('estado', event.target.value as CorrespondenceStatus)} className="theme-input rounded-xl border px-3 py-3 text-xs"><option value="">Todos los estados</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select>
          <input value={filters.cuenta_destino || ''} onChange={event => applyFilter('cuenta_destino', event.target.value)} className="theme-input rounded-xl border px-3 py-3 text-xs" placeholder="Cuenta de Gmail receptora" />
          <input type="date" value={filters.fecha_desde || ''} onChange={event => applyFilter('fecha_desde', event.target.value)} className="theme-input rounded-xl border px-3 py-3 text-xs" title="Fecha inicial" />
          <input type="date" value={filters.fecha_hasta || ''} onChange={event => applyFilter('fecha_hasta', event.target.value)} className="theme-input rounded-xl border px-3 py-3 text-xs" title="Fecha final" />
        </form>
      </section>

      <section className="theme-surface overflow-hidden rounded-3xl border">
        {loading || detailLoading ? <div className="theme-muted flex min-h-64 items-center justify-center gap-3 text-xs"><LoaderCircle className="h-5 w-5 animate-spin" /> Cargando correspondencia…</div> : items.length === 0 ? <div className="theme-muted flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-xs"><Mail className="h-10 w-10 opacity-40" /><div><p className="theme-text font-bold">No hay correos para mostrar</p><p className="mt-1">Ajusta los filtros o espera la próxima ingesta de n8n.</p></div></div> : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left"><thead><tr className="theme-muted text-[9px] font-extrabold uppercase tracking-wider"><th className="px-5 py-4">Correo</th><th className="px-4 py-4">Categoría</th><th className="px-4 py-4">Prioridad</th><th className="px-4 py-4">Estado</th><th className="px-4 py-4">Recibido</th></tr></thead><tbody className="divide-y divide-current/10">{items.map(item => <tr key={item.id} onClick={() => void openDetail(item.id)} className="theme-row cursor-pointer transition"><td className="px-5 py-4"><div className="flex items-start gap-3">{item.alertaInmediata && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}<div className="min-w-0"><p className="theme-text max-w-md truncate text-xs font-extrabold">{item.asunto || 'Sin asunto'}</p><p className="theme-muted mt-1 max-w-md truncate text-[10px]">{item.remitenteNombre} · {item.remitenteCorreo}</p><p className="theme-muted mt-1 max-w-md truncate text-[10px]">{item.resumen}</p></div></div></td><td className="theme-text px-4 py-4 text-[10px] font-semibold">{item.categoria}</td><td className="px-4 py-4"><PriorityBadge value={item.prioridad} /></td><td className="px-4 py-4"><span className="theme-accent-soft rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase">{statusLabels[item.estado]}</span></td><td className="theme-muted whitespace-nowrap px-4 py-4 text-[10px]">{formatDate(item.fechaRecepcion)}</td></tr>)}</tbody></table></div>}
        <div className="flex flex-col gap-3 border-t border-current/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="theme-muted text-[10px]">{pagination.total} correos · Página {pagination.pagina} de {pagination.paginas}</p><div className="flex gap-2"><button disabled={pagination.pagina <= 1} onClick={() => setFilters(current => ({ ...current, pagina: Math.max(1, pagination.pagina - 1) }))} className="theme-control rounded-lg border p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><button disabled={pagination.pagina >= pagination.paginas} onClick={() => setFilters(current => ({ ...current, pagina: Math.min(pagination.paginas, pagination.pagina + 1) }))} className="theme-control rounded-lg border p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div></div>
      </section>
    </div>
  );
};
