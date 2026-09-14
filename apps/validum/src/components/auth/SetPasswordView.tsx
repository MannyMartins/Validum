import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useValidum } from '../../context/ValidumContext';
import { ValidumLogo } from '../common/ValidumLogo';

export const SetPasswordView: React.FC = () => {
  const { completePasswordSetup } = useValidum();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmation) return setError('Las contraseñas no coinciden.');
    setError('');
    setSaving(true);
    try {
      await completePasswordSetup(password);
    } catch (setupError) {
      console.error(setupError);
      setError('No fue posible guardar la contraseña. Solicita un enlace nuevo desde la pantalla de ingreso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-city-overlay bg-texture-dots flex items-center justify-center p-6">
      <div className="w-full max-w-[480px] rounded-3xl border-2 border-[#c4d600] bg-[#f7f5ed] p-8 text-[#0f2537] shadow-2xl">
        <div className="mb-6 flex justify-center border-b border-[#dfdbc9] pb-5">
          <ValidumLogo variant="full" theme="light" size="lg" />
        </div>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f2537] text-[#c4d600]">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-3xl font-bold">Crea tu contraseña</h1>
        <p className="mt-2 text-sm text-slate-600">Tu invitación ya fue validada. Define una contraseña segura para terminar de activar el acceso.</p>
        {error && <div className="mt-5 rounded-xl border border-red-300 bg-red-100 p-3 text-xs font-medium text-red-800">{error}</div>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          {[{ label: 'NUEVA CONTRASEÑA', value: password, setter: setPassword }, { label: 'CONFIRMAR CONTRASEÑA', value: confirmation, setter: setConfirmation }].map(field => (
            <label key={field.label} className="block text-[11px] font-mono font-bold tracking-[0.16em]">
              {field.label}
              <span className="relative mt-1.5 block">
                <input type={showPassword ? 'text' : 'password'} value={field.value} onChange={event => field.setter(event.target.value)} className="w-full rounded-2xl border border-[#dcd8cb] bg-white px-4 py-3.5 pr-12 text-sm outline-none focus:ring-2 focus:ring-[#0f2537]" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(current => !current)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" aria-label="Mostrar u ocultar contraseña">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
          ))}
          <button type="submit" disabled={saving} className="w-full rounded-2xl border border-[#c4d600]/50 bg-[#0f2537] px-6 py-4 font-bold text-white disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar contraseña y entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
