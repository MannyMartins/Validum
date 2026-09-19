import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Mail,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  disconnectMailbox,
  loadMailboxes,
  MailboxAccount,
  MailboxList,
  MailboxStatus,
  startMailboxConnection,
  syncMailboxesNow,
  updateMailbox,
  testMailboxClassifier,
} from '../../lib/correspondenceRepository';

const statusStyle: Record<MailboxStatus, string> = {
  conectada: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
  pausada: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
  desconectada: 'border-rose-500/40 bg-rose-500/15 text-rose-400',
};

const statusLabel: Record<MailboxStatus, string> = {
  conectada: 'Conectada',
  pausada: 'Pausada',
  desconectada: 'Desconectada',
};

function formatDate(value?: string | null) {
  if (!value) return 'Nunca';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export const MailboxAccountsPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const [data, setData] = useState<MailboxList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await loadMailboxes());
    } catch (error) {
      setMessage({ tone: 'error', text: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Al volver del consentimiento de Google el callback añade estos parámetros.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const estado = params.get('cuenta_estado');
    if (!estado) return;
    const detalle = params.get('cuenta_detalle') || '';
    if (estado === 'ok') setMessage({ tone: 'ok', text: `Cuenta ${detalle} conectada correctamente.` });
    else if (estado === 'cancelado') setMessage({ tone: 'error', text: 'La autorización fue cancelada en Google.' });
    else setMessage({ tone: 'error', text: detalle || 'No se pudo conectar la cuenta.' });
    params.delete('cuenta_estado');
    params.delete('cuenta_detalle');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    void refresh();
  }, [refresh]);

  const connect = async () => {
    setMessage(null);
    try {
      const { url } = await startMailboxConnection();
      // A popup opened after an awaited request can be blocked by the browser.
      window.location.assign(url);
    } catch (error) {
      setMessage({ tone: 'error', text: (error as Error).message });
    }
  };

  const act = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setMessage(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setMessage({ tone: 'error', text: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const syncNow = async () => {
    setBusyId('sync');
    setMessage(null);
    try {
      const { resultados } = await syncMailboxesNow();
      const nuevos = resultados.reduce((total, row) => total + row.nuevos, 0);
      const fallidas = resultados.filter(row => row.error).length;
      setMessage({
        tone: fallidas ? 'error' : 'ok',
        text: `Revisión terminada: ${nuevos} correo(s) nuevo(s)${fallidas ? `, ${fallidas} cuenta(s) con error` : ''}.`,
      });
      await refresh();
    } catch (error) {
      setMessage({ tone: 'error', text: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const testModel = async () => {
    setBusyId('test');
    setMessage(null);
    try {
      const { clasificacion } = await testMailboxClassifier();
      setMessage(clasificacion.error_parseo
        ? { tone: 'error', text: 'La prueba no consiguió una clasificación. Revisa la clave y la cuota de Gemini; no se guardó ningún correo.' }
        : { tone: 'ok', text: `Prueba ficticia: ${clasificacion.categoria} · ${clasificacion.prioridad}. ${clasificacion.resumen} No se guardó ningún registro.` });
    } catch (error) {
      setMessage({ tone: 'error', text: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Cargando cuentas de correo…
      </div>
    );
  }

  const accounts = data?.items || [];
  const sinConfigurar = data && (!data.configuracion.google_configurado || !data.configuracion.clave_cifrado_valida);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Cuentas de correo</h2>
          <p className="text-xs text-slate-400">
            {data?.configuracion.lectura_habilitada
              ? 'La lectura de los buzones está habilitada.'
              : 'Modo de prueba: la lectura de Gmail está desactivada.'}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button type="button" onClick={testModel} disabled={Boolean(busyId)}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50">
              {busyId === 'test' ? 'Probando…' : 'Probar con correo ficticio'}
            </button>
            <button
              type="button"
              onClick={syncNow}
              disabled={Boolean(busyId) || !accounts.length || !data?.configuracion.lectura_habilitada}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50"
            >
              {busyId === 'sync' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Revisar ahora
            </button>
            <button
              type="button"
              onClick={connect}
              disabled={Boolean(sinConfigurar)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Conectar cuenta
            </button>
          </div>
        )}
      </header>

      {sinConfigurar && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Falta configurar la conexión con Google en el servidor. Revisa las variables GOOGLE_OAUTH_CLIENT_ID,
          GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI y CORRESPONDENCIA_TOKEN_KEY.
        </p>
      )}

      {message && (
        <p
          className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
            message.tone === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}
        >
          {message.tone === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {message.text}
        </p>
      )}

      {!accounts.length ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
          <Mail className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm font-semibold text-slate-300">Todavía no hay buzones conectados</p>
          <p className="mt-1 text-xs text-slate-500">
            Conecta cada cuenta por separado. En la ventana de Google elige &quot;Usar otra cuenta&quot; para no repetir la misma.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map(account => (
            <MailboxRow
              key={account.id}
              account={account}
              canManage={canManage}
              busy={busyId === account.id}
              onToggle={() => act(account.id, () => updateMailbox(account.id, { activa: account.estado !== 'conectada' }))}
              onDisconnect={() => act(account.id, () => disconnectMailbox(account.id))}
              onReconnect={connect}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

const MailboxRow: React.FC<{
  account: MailboxAccount;
  canManage: boolean;
  busy: boolean;
  onToggle: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}> = ({ account, canManage, busy, onToggle, onDisconnect, onReconnect }) => (
  <li className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Mail className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate">{account.direccion}</span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${statusStyle[account.estado]}`}>
            {statusLabel[account.estado]}
          </span>
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Última revisión: {formatDate(account.ultimaSincronizacion)} · {account.correosProcesados ?? 0} correo(s) procesado(s)
        </p>
        {account.ultimoError && (
          <p className="mt-1 text-[11px] text-rose-400">{account.ultimoError}</p>
        )}
      </div>

      {canManage && (
        <div className="flex shrink-0 items-center gap-2">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin text-slate-500" />}
          {account.estado === 'desconectada' ? (
            <button
              type="button"
              onClick={onReconnect}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-slate-500"
            >
              Reconectar
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              disabled={busy}
              title={account.estado === 'conectada' ? 'Pausar revisión' : 'Reanudar revisión'}
              className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-slate-500 disabled:opacity-50"
            >
              {account.estado === 'conectada' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            title="Desvincular (conserva los correos ya guardados)"
            className="rounded-lg border border-slate-700 p-1.5 text-rose-400 hover:border-rose-500/60 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  </li>
);
