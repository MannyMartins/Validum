import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class MailService {
  constructor(private config: ConfigService) {}
  async sendPasswordLink(email: string, fullName: string, token: string, kind: 'invite' | 'recovery') {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');
    const appUrl = this.config.get<string>('APP_URL')?.replace(/\/$/, '');
    if (!apiKey || !from || !appUrl) throw new ServiceUnavailableException('El servicio de correo no está configurado.');
    const link = `${appUrl}/?setupToken=${encodeURIComponent(token)}&setupType=${kind}`;
    const response = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: kind === 'invite' ? 'Invitación a Validum' : 'Recupera tu acceso a Validum',
        html: `<p>Hola ${this.escapeHtml(fullName)},</p><p>${kind === 'invite' ? 'Has sido invitado a Validum.' : 'Recibimos una solicitud para restablecer tu contraseña.'}</p><p><a href="${link}">Crear o cambiar contraseña</a></p><p>Este enlace es personal, vence pronto y solo puede usarse una vez.</p>` }),
    });
    if (!response.ok) throw new ServiceUnavailableException('El proveedor de correo rechazó el envío.');
  }
  private escapeHtml(value: string) { return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c); }
}
