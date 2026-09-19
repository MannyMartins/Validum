import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { MailboxController } from './mailbox.controller';
import { CorrespondenceController } from '../correspondence.controller';
import { CorrespondenceModule } from '../correspondence.module';

function buildUser(membershipRole: string) {
  return {
    user: {
      sub: 'usuario-1',
      email: 'admin@example.test',
      role: 'ADMIN',
      organizationId: 'org-1',
      membershipRole,
      tokenVersion: 0,
    },
  };
}

function setup(options: { redirectApp?: string } = {}) {
  const mailboxes = {
    list: jest.fn(async () => ({ items: [], configuracion: {} })),
    connectFromCode: jest.fn(async () => ({ id: 'cuenta-1', direccion: 'juridica@example.test' })),
    update: jest.fn(async () => ({ id: 'cuenta-1' })),
    disconnect: jest.fn(async () => ({ ok: true })),
  };
  const oauth = {
    createState: jest.fn(() => 'state-firmado'),
    buildAuthorizationUrl: jest.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?state=state-firmado'),
    verifyState: jest.fn(() => ({ userId: 'usuario-1', issuedAt: Date.now(), nonce: 'n' })),
  };
  const sync = { runCycle: jest.fn(async () => []) };
  const config = {
    get: jest.fn((name: string) =>
      name === 'CORRESPONDENCIA_OAUTH_REDIRECT_APP' ? options.redirectApp : undefined,
    ),
  };
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };
  const controller = new MailboxController(mailboxes as never, oauth as never, sync as never, config as never);
  return { controller, mailboxes, oauth, sync, response };
}

describe('control de acceso a las cuentas de correo', () => {
  it('solo los administradores pueden listar y gestionar', async () => {
    const { controller, mailboxes, sync } = setup();
    for (const rol of ['viewer', 'operator', 'auditor']) {
      const user = buildUser(rol) as never;
      expect(() => controller.list(user)).toThrow(ForbiddenException);
      expect(() => controller.start(user, {})).toThrow(ForbiddenException);
      expect(() => controller.update(user, 'cuenta-1', { activa: true })).toThrow(ForbiddenException);
      expect(() => controller.disconnect(user, 'cuenta-1')).toThrow(ForbiddenException);
      await expect(controller.runNow(user)).rejects.toThrow(ForbiddenException);
    }
    // Ninguna operación llegó al servicio.
    expect(mailboxes.list).not.toHaveBeenCalled();
    expect(mailboxes.update).not.toHaveBeenCalled();
    expect(mailboxes.disconnect).not.toHaveBeenCalled();
    expect(sync.runCycle).not.toHaveBeenCalled();
  });

  it('permite a owner y admin', async () => {
    const { controller, mailboxes } = setup();
    await expect(controller.list(buildUser('owner') as never)).resolves.toBeDefined();
    await expect(controller.list(buildUser('admin') as never)).resolves.toBeDefined();
    expect(mailboxes.list).toHaveBeenCalledTimes(2);
  });

  it('los endpoints de gestión exigen sesión', () => {
    const { controller } = setup();
    for (const handler of [controller.list, controller.start, controller.update, controller.disconnect, controller.runNow]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(JwtAuthGuard);
    }
  });

  it('el callback no exige sesión, porque llega desde el navegador', () => {
    const { controller } = setup();
    expect(Reflect.getMetadata(GUARDS_METADATA, controller.callback)).toBeUndefined();
  });

  it('firma el state con el usuario que inicia el flujo', () => {
    const { controller, oauth } = setup();
    controller.start(buildUser('admin') as never, {});
    expect(oauth.createState).toHaveBeenCalledWith('usuario-1');
  });
});

describe('callback de Google', () => {
  it('conecta la cuenta cuando el state es válido', async () => {
    const { controller, mailboxes, response } = setup();
    await controller.callback('codigo', 'state-firmado', '', response as never);
    expect(mailboxes.connectFromCode).toHaveBeenCalledWith('codigo', 'usuario-1');
    expect(response.json).toHaveBeenCalledWith({ estado: 'ok', detalle: 'juridica@example.test' });
  });

  it('rechaza un state inválido o caducado sin tocar el código', async () => {
    const { controller, oauth, mailboxes, response } = setup();
    oauth.verifyState.mockReturnValue(null as never);
    await controller.callback('codigo', 'falsificado', '', response as never);
    expect(mailboxes.connectFromCode).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('no intenta nada si Google informa que se canceló', async () => {
    const { controller, mailboxes, response } = setup();
    await controller.callback('', '', 'access_denied', response as never);
    expect(mailboxes.connectFromCode).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ estado: 'cancelado' }));
  });

  it('exige el código aunque el state sea válido', async () => {
    const { controller, mailboxes, response } = setup();
    await controller.callback('', 'state-firmado', '', response as never);
    expect(mailboxes.connectFromCode).not.toHaveBeenCalled();
  });

  it('redirige al panel cuando hay URL configurada', async () => {
    const { controller, response } = setup({ redirectApp: 'https://validum.example.test/correspondencia' });
    await controller.callback('codigo', 'state-firmado', '', response as never);
    const destino = new URL(response.redirect.mock.calls[0][0]);
    expect(destino.searchParams.get('cuenta_estado')).toBe('ok');
    expect(destino.searchParams.get('cuenta_detalle')).toBe('juridica@example.test');
  });

  it('informa del fallo sin romper la navegación', async () => {
    const { controller, mailboxes, response } = setup();
    mailboxes.connectFromCode.mockRejectedValue(new Error('Google rechazó la autorización de la cuenta.'));
    await controller.callback('codigo', 'state-firmado', '', response as never);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ estado: 'error' }));
  });

  it('se registra antes de CorrespondenceController para que :id no capture /cuentas', () => {
    const controllers = Reflect.getMetadata('controllers', CorrespondenceModule) as unknown[];
    const mailboxIndex = controllers.indexOf(MailboxController);
    const correspondenceIndex = controllers.indexOf(CorrespondenceController);
    expect(mailboxIndex).toBeGreaterThanOrEqual(0);
    expect(correspondenceIndex).toBeGreaterThan(mailboxIndex);
  });
});

