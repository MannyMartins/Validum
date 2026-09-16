import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, ArrowRight, Facebook, ShieldCheck, Building2 } from 'lucide-react';
import { useValidum } from '../../context/ValidumContext';
import { ValidumLogo } from '../common/ValidumLogo';

export const LoginView: React.FC = () => {
  const { login, requestPasswordReset } = useValidum();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [message, setMessage] = useState('');

  const handleRecovery = async () => {
    if (!usuario.trim()) {
      setError('Ingresa primero el correo que recibió la invitación.');
      return;
    }
    setError('');
    setMessage('');
    setIsRecovering(true);
    try {
      await requestPasswordReset(usuario);
      setMessage('Te enviamos un enlace nuevo. Ábrelo una sola vez y mantenlo abierto hasta crear tu contraseña.');
    } catch (recoveryError) {
      console.error(recoveryError);
      setError('No fue posible enviar el enlace. Revisa el correo o inténtalo nuevamente en unos minutos.');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) {
      setError('Por favor ingresa tu usuario o correo corporativo.');
      return;
    }
    if (!contrasena) {
      setError('Por favor ingresa tu contraseña.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const success = await login(usuario, contrasena, remember);
      if (!success) setError('Credenciales no válidas. Verifica el correo y la contraseña.');
    } catch (loginError) {
      console.error(loginError);
      setError('No fue posible conectar con el servicio de autenticación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-city-overlay bg-texture-dots flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Ambient glowing lighting in Validum colors */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-[#c4d600]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-[#0f2537]/90 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card matching user reference screenshot aesthetic with corporate brand identity */}
      <div className="w-full max-w-[480px] bg-[#f7f5ed] text-[#1c1b17] rounded-3xl p-8 sm:p-10 shadow-cream-card relative z-10 transition-all duration-300 border-2 border-[#c4d600]">
        
        {/* Official Brand Logo */}
        <div className="mb-6 flex justify-center pb-4 border-b border-[#dfdbc9]">
          <ValidumLogo variant="full" theme="light" size="lg" />
        </div>

        {/* Top Tag */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-mono tracking-[0.22em] text-[#0f2537] uppercase font-bold">
            BIENVENIDO DE VUELTA
          </span>
          <div className="flex items-center gap-1.5 bg-[#0f2537] text-slate-100 px-3 py-1 rounded-full text-xs font-semibold border border-[#c4d600]">
            <span className="w-2 h-2 rounded-full bg-[#c4d600] animate-pulse" />
            <span className="font-mono text-[11px]">Plataforma SaaS</span>
          </div>
        </div>

        {/* Main Title */}
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#0f2537] tracking-tight mb-2">
          Inicia sesión
        </h1>

        {/* Subtitle */}
        <p className="text-slate-600 text-xs sm:text-sm font-sans mb-6">
          Ingresa con tus credenciales corporativas para acceder a la gestión de seguridad social.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-100 border border-red-300 text-red-800 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-6 p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs rounded-xl font-medium">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* USUARIO Field */}
          <div>
            <label className="block text-[11px] font-mono font-bold tracking-[0.18em] text-[#0f2537] uppercase mb-1.5">
              USUARIO CORPORATIVO
            </label>
            <div className="relative">
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="usuario@validum.com"
                className="w-full bg-white border border-[#dcd8cb] rounded-2xl px-4 py-3.5 text-xs text-[#0f2537] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f2537] focus:border-[#c4d600] transition-all shadow-sm font-medium"
              />
            </div>
          </div>

          {/* CONTRASEÑA Field */}
          <div>
            <label className="block text-[11px] font-mono font-bold tracking-[0.18em] text-[#0f2537] uppercase mb-1.5">
              CONTRASEÑA
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white border border-[#dcd8cb] rounded-2xl px-4 py-3.5 text-xs text-[#0f2537] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f2537] focus:border-[#c4d600] transition-all shadow-sm pr-12 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#0f2537] transition-colors p-1"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember session checkbox */}
          <div className="flex items-center justify-between pt-1 pb-2">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#0f2537]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[#c5c0b0] text-[#0f2537] focus:ring-[#0f2537] cursor-pointer"
              />
              <span>Recordar sesión</span>
            </label>
            <button type="button" onClick={() => void handleRecovery()} disabled={isRecovering} className="text-xs text-[#0f2537] hover:underline font-bold disabled:opacity-60">
              {isRecovering ? 'Enviando…' : '¿Olvidaste tu clave?'}
            </button>
          </div>

          {/* Primary Action Button using Validum Navy & Lime accent */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#0f2537] hover:bg-[#16324a] disabled:opacity-60 disabled:cursor-wait text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 shadow-xl border border-[#c4d600]/40 group"
          >
            <span className="text-sm font-semibold tracking-wide">{isSubmitting ? 'Validando…' : 'Ingresar al sistema'}</span>
            <ArrowRight className="w-4 h-4 text-[#c4d600] group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        {/* Divider & External / Partner buttons matching screenshot */}
        <div className="mt-8 pt-6 border-t border-[#e2dec9] text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#0f2537] mb-4 hover:opacity-80 transition-opacity cursor-pointer">
            <Facebook className="w-4 h-4 fill-[#0f2537] stroke-none" />
            <span className="tracking-wider uppercase text-[11px] font-mono">SÍGUENOS EN FACEBOOK</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            <button 
              onClick={() => alert('Empresa aliada: TECHPLANET')} 
              className="bg-[#eae7dc] hover:bg-[#dfdbc9] text-[#0f2537] font-mono text-[10px] font-bold tracking-wider py-2.5 px-2 rounded-xl transition-colors border border-[#dcd7c4]"
            >
              TECHPLANET
            </button>
            <button 
              onClick={() => alert('Cooperativa aliada: PROTSECOOP')} 
              className="bg-[#eae7dc] hover:bg-[#dfdbc9] text-[#0f2537] font-mono text-[10px] font-bold tracking-wider py-2.5 px-2 rounded-xl transition-colors border border-[#dcd7c4]"
            >
              PROTSECOOP
            </button>
            <button 
              onClick={() => alert('Empresa aliada: Tech Nova Planet')} 
              className="bg-[#eae7dc] hover:bg-[#dfdbc9] text-[#0f2537] font-mono text-[9px] sm:text-[10px] font-bold tracking-wider py-2.5 px-1.5 rounded-xl transition-colors border border-[#dcd7c4] truncate"
              title="Tech Nova Planet"
            >
              TECH NOVA PLANET
            </button>
          </div>

          <p className="text-[11px] text-[#0f2537] font-mono font-bold">
            © 2026 VALIDUM GRUPO EMPRESARIAL · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
};
