import { CuentaCorreo } from '@prisma/client';
import { GmailHistoryGoneError } from './gmail-client.service';
import { GoogleTokenRevokedError } from './google-oauth.service';
import { MailSyncService } from './mail-sync.service';

const encode = (text: string) => Buffer.from(text, 'utf8').toString('base64url');

function buildAccount(overrides: Partial<CuentaCorreo> = {}): CuentaCorreo {
  return {
    id: 'cuenta-1',
    direccion: 'juridica@example.test',
    etiqueta: null,
    refreshTokenCifrado: 'cifrado',
    refreshTokenIv: 'iv',
    refreshTokenTag: 'tag',
    estado: 'CONECTADA',
    ultimoHistoryId: null,
    ultimaSincronizacion: null,
    ultimoError: null,
    erroresConsecutivos: 0,
    correosProcesados: 0,
    conectadaPorId: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  } as CuentaCorreo;
}

function buildMessage(id: string) {
  return {
    id,
    threadId: `hilo-${id}`,
    internalDate: '1758211800000',
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: 'remitente@example.test' },
        { name: 'To', value: 'juridica@example.test' },
        { name: 'Subject', value: `Asunto ${id}` },
      ],
      body: { data: encode(`Cuerpo del mensaje ${id}`) },
    },
  };
}

function setup(options: {
  accounts?: CuentaCorreo[];
  existingIds?: string[];
  maxPerCycle?: string;
  enabled?: boolean;
} = {}) {
  const accounts = options.accounts ?? [buildAccount()];
  const existing = new Set(options.existingIds ?? []);

  const prisma = {
    correoClasificado: {
      findUnique: jest.fn(async ({ where }: any) =>
        existing.has(where.cuentaDestino_gmailMessageId.gmailMessageId) ? { id: 'ya-existe' } : null,
      ),
    },
  };
  const config = {
    get: jest.fn((key: string) => key === 'CORRESPONDENCIA_POLL_ENABLED'
      ? (options.enabled === false ? 'false' : 'true')
      : (key === 'CORRESPONDENCIA_MAX_POR_CICLO' ? options.maxPerCycle : undefined)),
  };
  const mailboxes = {
    activeAccounts: jest.fn(async () => accounts),
    accessTokenFor: jest.fn(async () => 'token-de-acceso'),
    markSuccess: jest.fn(async () => undefined),
    markFailure: jest.fn(async () => undefined),
  };
  const gmail = {
    listHistory: jest.fn(async () => ({ messageIds: [], historyId: '900' })),
    listRecentMessages: jest.fn(async () => ({ messageIds: [] as string[], complete: true })),
    getProfile: jest.fn(async () => ({ emailAddress: 'juridica@example.test', historyId: '999' })),
    getMessage: jest.fn(async (_token: string, id: string) => buildMessage(id)),
  };
  const classifier = {
    classify: jest.fn(async () => ({
      remitente_nombre: 'Remitente',
      identificacion: null,
      empresa_relacionada: null,
      categoria: 'Consulta General',
      prioridad: 'Moderado',
      resumen: 'Resumen',
      documentos_requeridos: [],
      propuesta_respuesta: '',
      alerta_inmediata: false,
      error_parseo: false,
    })),
  };
  const correspondence = { ingest: jest.fn(async () => ({ body: {}, created: true })), detail: jest.fn() };

  const service = new MailSyncService(
    prisma as never,
    config as never,
    mailboxes as never,
    gmail as never,
    classifier as never,
    correspondence as never,
  );
  return { service, prisma, mailboxes, gmail, classifier, correspondence };
}

describe('ciclo de sincronización de correo', () => {
  it('no sobrescribe una clasificación existente cuando la IA real está desactivada', async () => {
    const { service, prisma, correspondence } = setup();
    await expect(service.reclassify('correo-1')).rejects.toThrow('desactivada');
    expect(prisma.correoClasificado.findUnique).not.toHaveBeenCalled();
    expect(correspondence.ingest).not.toHaveBeenCalled();
  });
  it('el modo de prueba impide incluso una revisión manual de Gmail', async () => {
    const { service, mailboxes, gmail } = setup({ enabled: false });
    await expect(service.runCycle()).rejects.toThrow('desactivada');
    await expect(service.syncAccount(buildAccount())).rejects.toThrow('desactivada');
    expect(mailboxes.activeAccounts).not.toHaveBeenCalled();
    expect(gmail.getMessage).not.toHaveBeenCalled();
  });

  it('un lote parcial no confirma el cursor ni mueve la ventana de recuperación', async () => {
    const { service, gmail, mailboxes } = setup({ maxPerCycle: '1' });
    gmail.listRecentMessages.mockResolvedValue({ messageIds: ['m1'], complete: false });
    await service.syncAccount(buildAccount());
    expect(mailboxes.markSuccess).toHaveBeenCalledWith('cuenta-1', null, 1, false);
    expect(gmail.getProfile.mock.invocationCallOrder[0]).toBeLessThan(gmail.listRecentMessages.mock.invocationCallOrder[0]);
  });
  it('en la primera carga pide solo la ventana reciente y guarda el historyId', async () => {
    const { service, gmail, mailboxes, correspondence } = setup();
    gmail.listRecentMessages.mockResolvedValue({ messageIds: ['m1', 'm2'], complete: true });

    const result = await service.syncAccount(buildAccount());

    expect(gmail.listRecentMessages).toHaveBeenCalled();
    expect(gmail.listHistory).not.toHaveBeenCalled();
    expect(result.nuevos).toBe(2);
    expect(correspondence.ingest).toHaveBeenCalledTimes(2);
    expect(mailboxes.markSuccess).toHaveBeenCalledWith('cuenta-1', '999', 2, true);
  });

  it('usa la sincronización incremental cuando ya hay historyId', async () => {
    const { service, gmail } = setup();
    gmail.listHistory.mockResolvedValue({ messageIds: ['m9'], historyId: '1000' } as never);

    const result = await service.syncAccount(buildAccount({ ultimoHistoryId: '500' }));

    expect(gmail.listHistory).toHaveBeenCalledWith('token-de-acceso', '500', 50, expect.any(Function));
    expect(gmail.listRecentMessages).not.toHaveBeenCalled();
    expect(result.nuevos).toBe(1);
  });

  it('recarga la ventana reciente si el historyId caducó, sin perder correos', async () => {
    const { service, gmail, mailboxes } = setup();
    gmail.listHistory.mockRejectedValue(new GmailHistoryGoneError());
    gmail.listRecentMessages.mockResolvedValue({ messageIds: ['m1'], complete: true });

    const result = await service.syncAccount(buildAccount({ ultimoHistoryId: 'caducado' }));

    expect(gmail.listRecentMessages).toHaveBeenCalled();
    expect(result.nuevos).toBe(1);
    expect(mailboxes.markSuccess).toHaveBeenCalledWith('cuenta-1', '999', 1, true);
  });

  it('no vuelve a llamar al modelo por un correo ya guardado', async () => {
    const { service, gmail, classifier, correspondence } = setup({ existingIds: ['m1'] });
    gmail.listRecentMessages.mockResolvedValue({ messageIds: ['m1', 'm2'], complete: true });

    const result = await service.syncAccount(buildAccount());

    expect(result).toMatchObject({ nuevos: 1, omitidos: 1 });
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    expect(correspondence.ingest).toHaveBeenCalledTimes(1);
    expect(gmail.getMessage).toHaveBeenCalledTimes(1);
  });

  it('respeta el tope por ciclo para no disparar el costo', async () => {
    const { service, gmail, classifier } = setup({ maxPerCycle: '2' });
    gmail.listRecentMessages.mockResolvedValue({ messageIds: ['m1', 'm2'], complete: false });

    const result = await service.syncAccount(buildAccount());

    expect(gmail.listRecentMessages).toHaveBeenCalledWith('token-de-acceso', expect.any(String), 2, expect.any(Function));
    expect(result.nuevos).toBe(2);
    expect(classifier.classify).toHaveBeenCalledTimes(2);
  });

  it('ignora un tope fuera de rango y usa el valor por defecto', async () => {
    const { service, gmail } = setup({ maxPerCycle: '9999' });
    gmail.listRecentMessages.mockResolvedValue({ messageIds: [], complete: true });
    await service.syncAccount(buildAccount());
    expect(gmail.listRecentMessages).toHaveBeenCalledWith('token-de-acceso', expect.any(String), 50, expect.any(Function));
  });

  it('envía a la ingesta la cuenta de origen y los datos del correo', async () => {
    const { service, gmail, correspondence } = setup();
    gmail.listRecentMessages.mockResolvedValue({ messageIds: ['m1'], complete: true });

    await service.syncAccount(buildAccount());

    expect(correspondence.ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        cuenta_origen: 'juridica@example.test',
        messageId: 'm1',
        subject: 'Asunto m1',
        categoria: 'Consulta General',
      }),
    );
  });

  it('el fallo de una cuenta no detiene a las demás', async () => {
    const cuentaA = buildAccount({ id: 'cuenta-a', direccion: 'a@example.test' });
    const cuentaB = buildAccount({ id: 'cuenta-b', direccion: 'b@example.test' });
    const { service, mailboxes, gmail } = setup({ accounts: [cuentaA, cuentaB] });
    mailboxes.accessTokenFor
      .mockRejectedValueOnce(new Error('Gmail respondió 500.'))
      .mockResolvedValue('token-de-acceso' as never);
    gmail.listRecentMessages.mockResolvedValue({ messageIds: ['m1'], complete: true });

    const results = await service.runCycle();

    expect(results).toHaveLength(2);
    expect(results[0].error).toContain('No se pudo sincronizar');
    expect(results[1].nuevos).toBe(1);
    expect(mailboxes.markFailure).toHaveBeenCalledWith('cuenta-a', expect.stringContaining('No se pudo sincronizar'));
  });

  it('no cuenta como fallo reintentable una autorización revocada', async () => {
    const { service, mailboxes } = setup();
    mailboxes.accessTokenFor.mockRejectedValue(new GoogleTokenRevokedError());

    const results = await service.runCycle();

    expect(results[0].error).toContain('revocó');
    expect(mailboxes.markFailure).not.toHaveBeenCalled();
  });

  it('no hace nada si no hay cuentas conectadas', async () => {
    const { service, mailboxes } = setup({ accounts: [] });
    await expect(service.runCycle()).resolves.toEqual([]);
    expect(mailboxes.accessTokenFor).not.toHaveBeenCalled();
  });

  it('omite mensajes sin identificador utilizable', async () => {
    const { service, gmail, classifier } = setup();
    gmail.listRecentMessages.mockResolvedValue({ messageIds: ['m1'], complete: true });
    gmail.getMessage.mockResolvedValue({ threadId: 'x', payload: { headers: [] } } as never);

    const result = await service.syncAccount(buildAccount());

    expect(result).toMatchObject({ nuevos: 0, omitidos: 1 });
    expect(classifier.classify).not.toHaveBeenCalled();
  });
});
