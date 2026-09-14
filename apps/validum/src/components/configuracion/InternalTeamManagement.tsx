import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MailPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCog,
  UserX,
  UsersRound,
} from 'lucide-react';
import {
  changeOrganizationMemberRole,
  inviteOrganizationMember,
  loadOrganizationTeam,
  OrganizationMember,
  OrganizationRole,
  revokeOrganizationMember,
  TeamSnapshot,
} from '../../lib/teamRepository';

type EditableRole = 'admin' | 'operator' | 'auditor';

const roleLabels: Record<OrganizationRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  operator: 'Operador',
  auditor: 'Auditor',
  analyst: 'Operador (anterior)',
  viewer: 'Auditor (anterior)',
};

const statusLabels = {
  active: 'Activo',
  invited: 'Invitado',
  revoked: 'Revocado',
};

const roleDescriptions: Record<EditableRole, string> = {
  admin: 'Gestiona usuarios, empresas, afiliados, plantillas y formularios.',
  operator: 'Registra afiliados y genera o ajusta formularios PDF.',
  auditor: 'Consulta información y evidencias, sin modificar registros.',
};

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export const InternalTeamManagement: React.FC = () => {
  const [snapshot, setSnapshot] = useState<TeamSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EditableRole>('operator');

  const canManage = snapshot?.currentRole === 'owner' || snapshot?.currentRole === 'admin';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await loadOrganizationTeam());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el equipo interno.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    if (!term) return snapshot?.members || [];
    return (snapshot?.members || []).filter(member =>
      `${member.fullName} ${member.email} ${roleLabels[member.role]} ${statusLabels[member.status]}`
        .toLocaleLowerCase('es')
        .includes(term)
    );
  }, [search, snapshot]);

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!snapshot || !canManage || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await inviteOrganizationMember({
        organizationId: snapshot.organizationId,
        fullName: fullName.trim(),
        email: email.trim(),
        role,
      });
      setFullName('');
      setEmail('');
      setRole('operator');
      setNotice(result.invitationWasSent
        ? 'Invitación enviada. El acceso quedó registrado hasta que la persona complete su primer ingreso.'
        : 'La cuenta ya existía y quedó vinculada. La persona puede iniciar sesión con ese correo.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar la invitación.');
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (member: OrganizationMember) => {
    if (!snapshot || !canManage || member.isCurrentUser || member.role === 'owner') return;
    const confirmed = window.confirm(`¿Revocar el acceso de ${member.fullName}? Dejará de acceder a los datos de esta organización.`);
    if (!confirmed) return;
    setChangingUserId(member.userId);
    setError(null);
    setNotice(null);
    try {
      await revokeOrganizationMember(snapshot.organizationId, member.userId);
      setNotice(`Se revocó el acceso de ${member.fullName}.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo revocar el acceso.');
    } finally {
      setChangingUserId(null);
    }
  };

  const changeRole = async (member: OrganizationMember, nextRole: EditableRole) => {
    if (!snapshot || !canManage || member.role === 'owner') return;
    setChangingUserId(member.userId);
    setError(null);
    try {
      await changeOrganizationMemberRole(snapshot.organizationId, member.userId, nextRole);
      setNotice(`Rol actualizado para ${member.fullName}.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el rol.');
    } finally {
      setChangingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="theme-surface rounded-3xl border p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="theme-accent-soft rounded-2xl p-3"><UsersRound className="h-7 w-7" /></span>
            <div>
              <p className="theme-accent text-[11px] font-extrabold uppercase tracking-[0.18em]">Administración interna</p>
              <h1 className="theme-text mt-1 font-serif text-2xl font-extrabold sm:text-3xl">Usuarios y permisos</h1>
              <p className="theme-muted mt-2 max-w-2xl text-xs leading-5">
                Gestiona a las personas que operan Validum. Este equipo es independiente del directorio de afiliados que alimenta los formularios EPS.
              </p>
            </div>
          </div>
          <div className="theme-surface-soft flex items-center gap-3 rounded-2xl border px-4 py-3">
            <ShieldCheck className="theme-accent h-5 w-5" />
            <div>
              <p className="theme-text text-xs font-extrabold">Aislamiento por organización</p>
              <p className="theme-muted text-[10px]">API privada + PostgreSQL aislado</p>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
          <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-300">
          <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{notice}</span></div>
        </div>
      )}

      <div className="grid gap-6 2xl:grid-cols-[380px_1fr]">
        <form onSubmit={submitInvite} className="theme-surface h-fit space-y-5 rounded-3xl border p-6">
          <div>
            <div className="flex items-center gap-2"><MailPlus className="theme-accent h-5 w-5" /><h2 className="theme-text text-base font-extrabold">Invitar usuario</h2></div>
            <p className="theme-muted mt-1 text-[11px] leading-5">Validum enviará un enlace de un solo uso para crear la contraseña.</p>
          </div>

          {!canManage && !loading && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300">
              Tu rol permite consultar el equipo, pero no enviar invitaciones ni cambiar accesos.
            </div>
          )}

          <label className="theme-muted block text-[10px] font-bold uppercase tracking-wider">
            Nombre completo
            <input required maxLength={120} disabled={!canManage || submitting} value={fullName} onChange={event => setFullName(event.target.value)} className="theme-input mt-2 w-full rounded-xl border px-3 py-3 text-xs outline-none" placeholder="Ej. Laura Gómez" />
          </label>
          <label className="theme-muted block text-[10px] font-bold uppercase tracking-wider">
            Correo institucional
            <input required type="email" maxLength={254} disabled={!canManage || submitting} value={email} onChange={event => setEmail(event.target.value)} className="theme-input mt-2 w-full rounded-xl border px-3 py-3 text-xs outline-none" placeholder="laura@empresa.com" />
          </label>
          <label className="theme-muted block text-[10px] font-bold uppercase tracking-wider">
            Rol y permisos
            <select disabled={!canManage || submitting} value={role} onChange={event => setRole(event.target.value as EditableRole)} className="theme-input mt-2 w-full rounded-xl border px-3 py-3 text-xs outline-none">
              <option value="admin">Administrador</option>
              <option value="operator">Operador</option>
              <option value="auditor">Auditor</option>
            </select>
          </label>
          <p className="theme-muted min-h-10 rounded-xl border border-current/10 p-3 text-[10px] leading-4">{roleDescriptions[role]}</p>
          <button type="submit" disabled={!canManage || submitting} className="theme-accent-button flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
            {submitting ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </form>

        <section className="theme-surface min-w-0 rounded-3xl border p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-current/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="theme-text flex items-center gap-2 text-base font-extrabold"><UserRoundCog className="theme-accent h-5 w-5" /> Equipo registrado</h2>
              <p className="theme-muted mt-1 text-[11px]">{snapshot?.members.length || 0} usuarios vinculados a esta organización.</p>
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1 sm:w-64">
                <Search className="theme-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input value={search} onChange={event => setSearch(event.target.value)} className="theme-input w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs outline-none" placeholder="Buscar usuario…" />
              </div>
              <button type="button" onClick={() => void refresh()} disabled={loading} className="theme-control rounded-xl border p-2.5" title="Actualizar"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
          </div>

          {loading ? (
            <div className="theme-muted flex min-h-56 items-center justify-center gap-3 text-xs"><RefreshCw className="h-5 w-5 animate-spin" /> Cargando equipo…</div>
          ) : visibleMembers.length === 0 ? (
            <div className="theme-muted flex min-h-56 flex-col items-center justify-center gap-2 text-center text-xs"><UsersRound className="h-8 w-8 opacity-50" /> No hay usuarios que coincidan con la búsqueda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="theme-muted text-[9px] font-extrabold uppercase tracking-wider">
                    <th className="px-3 py-4">Usuario</th><th className="px-3 py-4">Rol</th><th className="px-3 py-4">Estado</th><th className="px-3 py-4">Último hito</th><th className="px-3 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-current/10">
                  {visibleMembers.map(member => {
                    const changing = changingUserId === member.userId;
                    const editable = canManage && member.role !== 'owner' && member.active;
                    return (
                      <tr key={member.userId} className="theme-row transition-colors">
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <span className="theme-accent-soft flex h-9 w-9 items-center justify-center rounded-xl text-xs font-extrabold">{member.fullName.slice(0, 2).toUpperCase()}</span>
                            <div className="min-w-0"><p className="theme-text truncate text-xs font-extrabold">{member.fullName}{member.isCurrentUser ? ' (tú)' : ''}</p><p className="theme-muted mt-0.5 truncate text-[10px]">{member.email || 'Correo no disponible'}</p></div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          {editable ? (
                            <select value={member.role === 'analyst' ? 'operator' : member.role === 'viewer' ? 'auditor' : member.role} disabled={changing} onChange={event => void changeRole(member, event.target.value as EditableRole)} className="theme-input rounded-lg border px-2 py-2 text-[10px] font-bold">
                              <option value="admin">Administrador</option><option value="operator">Operador</option><option value="auditor">Auditor</option>
                            </select>
                          ) : <span className="theme-text text-[11px] font-bold">{roleLabels[member.role]}</span>}
                        </td>
                        <td className="px-3 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase ${member.status === 'active' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : member.status === 'invited' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}>{member.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{statusLabels[member.status]}</span></td>
                        <td className="theme-muted px-3 py-4 text-[10px]">{formatDate(member.acceptedAt || member.invitedAt || member.revokedAt)}</td>
                        <td className="px-3 py-4 text-right">
                          <button type="button" onClick={() => void revoke(member)} disabled={!editable || member.isCurrentUser || changing} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-2.5 py-2 text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-30"><UserX className="h-3.5 w-3.5" /> Revocar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
