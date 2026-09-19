import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { SessionPayload } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { MailSyncService } from './mail-sync.service';
import { StartOAuthDto, UpdateMailboxDto } from './mailbox.dto';
import { MailboxService } from './mailbox.service';
import { GoogleOAuthService } from './google-oauth.service';

const MANAGER_ROLES = ['owner', 'admin'];

const bodyValidation = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

@Controller('correspondencia/cuentas')
export class MailboxController {
  constructor(
    private readonly mailboxes: MailboxService,
    private readonly oauth: GoogleOAuthService,
    private readonly sync: MailSyncService,
    private readonly config: ConfigService,
  ) {}

  private assertManager(user: SessionPayload) {
    if (!MANAGER_ROLES.includes(user.membershipRole)) {
      throw new ForbiddenException('Solo los administradores pueden gestionar las cuentas de correo.');
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: { user: SessionPayload }) {
    this.assertManager(req.user);
    return this.mailboxes.list();
  }

  /**
   * Devuelve la URL de consentimiento. No redirige desde aquí: el panel abre
   * la URL para que el administrador vea a qué cuenta de Google va a entrar.
   */
  @Post('oauth/iniciar')
  @UseGuards(JwtAuthGuard)
  start(@Req() req: { user: SessionPayload }, @Body(bodyValidation) body: StartOAuthDto) {
    this.assertManager(req.user);
    const state = this.oauth.createState(req.user.sub);
    return { url: this.oauth.buildAuthorizationUrl(state, body.cuenta) };
  }

  /**
   * Callback de Google. Llega desde el navegador sin cabecera de sesión, así
   * que la autorización se apoya en la firma y caducidad del `state`.
   */
  @Get('oauth/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() response: Response,
  ) {
    const redirectBase = String(this.config.get('CORRESPONDENCIA_OAUTH_REDIRECT_APP') || '').trim();
    const finish = (status: string, detail?: string) => {
      if (!redirectBase) {
        return response.status(status === 'ok' ? 200 : 400).json({ estado: status, detalle: detail || null });
      }
      const url = new URL(redirectBase);
      url.searchParams.set('cuenta_estado', status);
      if (detail) url.searchParams.set('cuenta_detalle', detail);
      return response.redirect(url.toString());
    };

    if (error) return finish('cancelado', 'La autorización fue cancelada en Google.');

    const verified = this.oauth.verifyState(state);
    if (!verified) return finish('error', 'La solicitud caducó o no es válida. Inténtalo de nuevo.');
    if (!code) return finish('error', 'Google no devolvió el código de autorización.');

    try {
      const account = await this.mailboxes.connectFromCode(code, verified.userId);
      return finish('ok', account.direccion);
    } catch (caught) {
      return finish('error', (caught as Error).message?.slice(0, 200) || 'No se pudo conectar la cuenta.');
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() req: { user: SessionPayload },
    @Param('id') id: string,
    @Body(bodyValidation) body: UpdateMailboxDto,
  ) {
    this.assertManager(req.user);
    if (body.etiqueta === undefined && body.activa === undefined) {
      throw new BadRequestException('No hay cambios que aplicar.');
    }
    return this.mailboxes.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  disconnect(@Req() req: { user: SessionPayload }, @Param('id') id: string) {
    this.assertManager(req.user);
    return this.mailboxes.disconnect(id);
  }

  /** Dispara un ciclo manual, útil para probar sin esperar al programador. */
  @Post('sincronizar')
  @UseGuards(JwtAuthGuard)
  async runNow(@Req() req: { user: SessionPayload }) {
    this.assertManager(req.user);
    return { resultados: await this.sync.runCycle() };
  }
}
