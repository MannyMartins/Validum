import { CorrespondenceCategory, CorrespondencePriority, CorrespondenceStatus } from '@prisma/client';
import { IngestCorrespondenceDto } from './correspondence.dto';
import { CorrespondenceService } from './correspondence.service';

const validPayload: IngestCorrespondenceDto = {
  from: 'cliente@example.com',
  to: 'juridica@validum.co',
  subject: 'Solicitud de concepto',
  textPlain: 'Contenido sensible del correo',
  messageId: 'gmail-message-1',
  threadId: 'gmail-thread-1',
  fecha: '2026-09-18T15:30:00.000Z',
  remitente_nombre: 'Cliente Ejemplo',
  identificacion: '900123456',
  empresa_relacionada: 'Ejemplo SAS',
  categoria: 'Términos jurídicos',
  prioridad: 'Urgente',
  resumen: 'Solicita revisión de un término contractual.',
  documentos_requeridos: ['Contrato firmado'],
  propuesta_respuesta: 'Hemos recibido su solicitud.',
  alerta_inmediata: true,
};

function createPrismaMock() {
  const stored = new Map<string, { id: string; data: Record<string, unknown> }>();
  const correoClasificado = {
    findUnique: jest.fn(async ({ where }: any) => stored.get(`${where.cuentaDestino_gmailMessageId.cuentaDestino}:${where.cuentaDestino_gmailMessageId.gmailMessageId}`) || null),
    upsert: jest.fn(async ({ where, create, update }: any) => {
      const key = `${where.cuentaDestino_gmailMessageId.cuentaDestino}:${where.cuentaDestino_gmailMessageId.gmailMessageId}`;
      const previous = stored.get(key);
      const saved = { id: previous?.id || `correo-${stored.size + 1}`, data: previous ? { ...previous.data, ...update } : create };
      stored.set(key, saved);
      return { id: saved.id };
    }),
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
  };
  const prisma = {
    correoClasificado,
    $transaction: jest.fn(async (promises: Promise<unknown>[]) => Promise.all(promises)),
  };
  return { prisma, stored, correoClasificado };
}

describe('CorrespondenceService', () => {
  it('crea una ingesta válida con el mapeo esperado', async () => {
    const { prisma, stored } = createPrismaMock();
    const service = new CorrespondenceService(prisma as never);

    const result = await service.ingest(validPayload);

    expect(result).toEqual({ body: { id: 'correo-1', creado: true, resultado: 'creado' }, created: true });
    expect(stored.values().next().value!.data).toMatchObject({
      cuentaDestino: 'juridica@validum.co',
      gmailMessageId: 'gmail-message-1',
      remitenteCorreo: 'cliente@example.com',
      categoria: CorrespondenceCategory.TERMINOS_JURIDICOS,
      prioridad: CorrespondencePriority.URGENTE,
      errorClasificacion: false,
    });
  });

  it('actualiza una ingesta duplicada sin crear otro registro', async () => {
    const { prisma, stored } = createPrismaMock();
    const service = new CorrespondenceService(prisma as never);
    await service.ingest(validPayload);

    const result = await service.ingest({ ...validPayload, resumen: 'Resumen corregido' });

    expect(result.body).toEqual({ id: 'correo-1', creado: false, resultado: 'actualizado' });
    expect(stored.size).toBe(1);
    expect(stored.values().next().value!.data).toMatchObject({ resumen: 'Resumen corregido' });
  });

  it('conserva el correo y aplica valores seguros si la clasificación es inválida', async () => {
    const { prisma, stored } = createPrismaMock();
    const service = new CorrespondenceService(prisma as never);

    await service.ingest({ ...validPayload, categoria: 'Categoría inventada', prioridad: 'Crítica' });

    expect(stored.values().next().value!.data).toMatchObject({
      categoria: CorrespondenceCategory.CONSULTA_GENERAL,
      prioridad: CorrespondencePriority.MODERADO,
      errorClasificacion: true,
    });
    expect(stored.values().next().value!.data.respuestaCrudaIa).toContain('Categoría inventada');
    expect(stored.values().next().value!.data.respuestaCrudaIa).toContain('Crítica');
  });

  it('aplica todos los filtros del listado y conserva el orden jurídico', async () => {
    const { prisma, correoClasificado } = createPrismaMock();
    const service = new CorrespondenceService(prisma as never);

    await service.list({
      categoria: 'Cobros Jurídicos',
      prioridad: 'Moderado',
      estado: 'en_revision',
      cuenta_destino: 'cobros@validum.co',
      alerta_inmediata: true,
      fecha_desde: '2026-09-01',
      fecha_hasta: '2026-09-18',
      busqueda: 'NIT 900',
      pagina: 2,
      limite: 10,
    });

    expect(correoClasificado.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        categoria: CorrespondenceCategory.COBROS_JURIDICOS,
        prioridad: CorrespondencePriority.MODERADO,
        estado: CorrespondenceStatus.EN_REVISION,
        cuentaDestino: 'cobros@validum.co',
        alertaInmediata: true,
        OR: expect.arrayContaining([expect.objectContaining({ asunto: expect.any(Object) })]),
      }),
      orderBy: [{ alertaInmediata: 'desc' }, { prioridad: 'asc' }, { fechaRecepcion: 'desc' }],
      skip: 10,
      take: 10,
    }));
  });
});
