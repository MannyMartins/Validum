import { MAILBOX_KEY_MIN_LENGTH, open, seal } from './mailbox-crypto';
import { GoogleTokenRevokedError } from './google-oauth.service';
import { MailboxService, MAX_CONSECUTIVE_ERRORS } from './mailbox.service';

const KEY = 'k'.repeat(MAILBOX_KEY_MIN_LENGTH);

function setup(options: { key?: string } = {}) {
  const store = new Map<string, any>();
  const prisma = {
    cuentaCorreo: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const previous = store.get(where.direccion);
        const saved = previous ? { ...previous, ...update } : { id: 'cuenta-1', ...create };
        store.set(where.direccion, saved);
        return { id: saved.id, direccion: saved.direccion };
      }),
      findUnique: jest.fn(async () => ({ id: 'cuenta-1', estado: 'CONECTADA', direccion: 'a@example.test' })),
      update: jest.fn(async ({ data }: any) => ({
        erroresConsecutivos: typeof data.erroresConsecutivos === 'object' ? MAX_CONSECUTIVE_ERRORS : 0,
        direccion: 'a@example.test',
        id: 'cuenta-1',
        estado: 'CONECTADA',
      })),
      findMany: jest.fn(async () => []),
    },
  };
  const config = {
    get: jest.fn((name: string) => (name === 'CORRESPONDENCIA_TOKEN_KEY' ? (options.key ?? KEY) : undefined)),
  };
  const oauth = {
    exchangeCode: jest.fn(async () => ({ accessToken: 'acceso', refreshToken: 'refresco-secreto', expiresInSeconds: 3600 })),
    refreshAccessToken: jest.fn(async () => ({ accessToken: 'acceso-nuevo', refreshToken: null, expiresInSeconds: 3600 })),
    isConfigured: jest.fn(() => true),
  };
  const gmail = {
    getProfile: jest.fn(async () => ({ emailAddress: 'juridica@example.test', historyId: '10' })),
  };
  const service = new MailboxService(prisma as never, config as never, oauth as never, gmail as never);
  return { service, prisma, oauth, gmail, store };
}

describe('gestión de cuentas de correo', () => {
  it('guarda el refresh token cifrado, nunca en claro', async () => {
    const { service, store } = setup();
    await service.connectFromCode('codigo', 'usuario-1');
    const saved = store.get('juridica@example.test');
    expect(saved.refreshTokenCifrado).toBeTruthy();
    expect(JSON.stringify(saved)).not.toContain('refresco-secreto');
    expect(
      open(
        { ciphertext: saved.refreshTokenCifrado, iv: saved.refreshTokenIv, tag: saved.refreshTokenTag },
        KEY,
      ),
    ).toBe('refresco-secreto');
  });

  it('usa la dirección que reporta Google, no la que diga el usuario', async () => {
    const { service, gmail, store } = setup();
    gmail.getProfile.mockResolvedValue({ emailAddress: 'real@example.test', historyId: '1' } as never);
    await service.connectFromCode('codigo', null);
    expect(store.has('real@example.test')).toBe(true);
  });

  it('reconecta una cuenta existente en lugar de duplicarla', async () => {
    const { service, prisma } = setup();
    await service.connectFromCode('codigo', 'usuario-1');
    await service.connectFromCode('codigo', 'usuario-1');
    expect(prisma.cuentaCorreo.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.cuentaCorreo.upsert.mock.calls[1][0].where).toEqual({ direccion: 'juridica@example.test' });
  });

  it('reinicia el contador de errores al reconectar', async () => {
    const { service, prisma } = setup();
    await service.connectFromCode('codigo', 'usuario-1');
    expect(prisma.cuentaCorreo.upsert.mock.calls[0][0].update).toMatchObject({
      erroresConsecutivos: 0,
      estado: 'CONECTADA',
      ultimoError: null,
    });
  });

  it('se niega a guardar si la clave de cifrado es demasiado corta', async () => {
    const { service } = setup({ key: 'corta' });
    await expect(service.connectFromCode('codigo', null)).rejects.toThrow(/32 caracteres/);
  });

  it('rechaza si Google no devuelve la dirección del buzón', async () => {
    const { service, gmail } = setup();
    gmail.getProfile.mockResolvedValue({ emailAddress: '', historyId: null } as never);
    await expect(service.connectFromCode('codigo', null)).rejects.toThrow(/dirección/);
  });

  it('obtiene un access token nuevo a partir del refresh guardado', async () => {
    const { service, oauth } = setup();
    const sealed = seal('refresco-secreto', KEY);
    const token = await service.accessTokenFor({
      id: 'cuenta-1',
      refreshTokenCifrado: sealed.ciphertext,
      refreshTokenIv: sealed.iv,
      refreshTokenTag: sealed.tag,
    } as never);
    expect(token).toBe('acceso-nuevo');
    expect(oauth.refreshAccessToken).toHaveBeenCalledWith('refresco-secreto');
  });

  it('desconecta la cuenta si la credencial guardada no se puede descifrar', async () => {
    const { service, prisma } = setup();
    await expect(
      service.accessTokenFor({ id: 'cuenta-1', refreshTokenCifrado: 'basura', refreshTokenIv: 'x', refreshTokenTag: 'y' } as never),
    ).rejects.toThrow(GoogleTokenRevokedError);
    expect(prisma.cuentaCorreo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'DESCONECTADA' }) }),
    );
  });

  it('desconecta la cuenta cuando Google revoca la autorización', async () => {
    const { service, oauth, prisma } = setup();
    oauth.refreshAccessToken.mockRejectedValue(new GoogleTokenRevokedError());
    const sealed = seal('refresco', KEY);
    await expect(
      service.accessTokenFor({ id: 'cuenta-1', refreshTokenCifrado: sealed.ciphertext, refreshTokenIv: sealed.iv, refreshTokenTag: sealed.tag } as never),
    ).rejects.toThrow(GoogleTokenRevokedError);
    expect(prisma.cuentaCorreo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'DESCONECTADA' }) }),
    );
  });

  it('pausa la cuenta tras demasiados fallos seguidos', async () => {
    const { service, prisma } = setup();
    await service.markFailure('cuenta-1', 'Gmail respondió 500.');
    expect(prisma.cuentaCorreo.update).toHaveBeenLastCalledWith({
      where: { id: 'cuenta-1' },
      data: { estado: 'PAUSADA' },
    });
  });

  it('al desvincular borra los tokens pero conserva los correos', async () => {
    const { service, prisma } = setup();
    await service.disconnect('cuenta-1');
    const data = prisma.cuentaCorreo.update.mock.calls.at(-1)?.[0].data;
    expect(data).toMatchObject({
      refreshTokenCifrado: null,
      refreshTokenIv: null,
      refreshTokenTag: null,
      estado: 'DESCONECTADA',
    });
  });

  it('el listado no expone ningún token', async () => {
    const { service, prisma } = setup();
    prisma.cuentaCorreo.findMany.mockResolvedValue([
      { id: 'c1', direccion: 'a@example.test', estado: 'CONECTADA', conectadaPor: null },
    ] as never);
    const result = await service.list();
    expect(JSON.stringify(result)).not.toContain('refreshToken');
    expect(result.items[0].estado).toBe('conectada');
    expect(result.configuracion.clave_cifrado_valida).toBe(true);
  });

  it('no reactiva una cuenta desconectada sin volver a autorizarla', async () => {
    const { service, prisma } = setup();
    prisma.cuentaCorreo.findUnique.mockResolvedValue({ id: 'cuenta-1', estado: 'DESCONECTADA' } as never);
    await service.update('cuenta-1', { activa: true });
    expect(prisma.cuentaCorreo.update.mock.calls[0][0].data.estado).toBeUndefined();
  });
});
