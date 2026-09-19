import { BadRequestException } from '@nestjs/common';
import { INGEST_LIMITS, IngestPayloadPipe, normalizeIngestDate, normalizeIngestRow } from './correspondence.dto';

describe('normalización de ingesta de correspondencia', () => {
  const now = new Date('2026-09-19T02:00:00.000Z');

  it.each([
    ['ISO', '2026-09-18T15:30:00.000Z', '2026-09-18T15:30:00.000Z'],
    ['epoch ms', 1_789_745_400_000, '2026-09-18T15:30:00.000Z'],
    ['epoch s', '1789745400', '2026-09-18T15:30:00.000Z'],
    ['basura', 'fecha-imposible', now.toISOString()],
  ])('acepta fecha %s', (_label, input, expected) => {
    expect(normalizeIngestDate(input, now)).toBe(expected);
  });

  it('recorta campos largos en vez de perder el correo', () => {
    const row = normalizeIngestRow({
      messageId: 'm'.repeat(2_000),
      to: 't'.repeat(2_000),
      from: 'f'.repeat(2_000),
      subject: 's'.repeat(2_000),
      textPlain: 'cuerpo',
    }, now);
    expect(row.messageId).toHaveLength(INGEST_LIMITS.identifier);
    expect(row.to).toHaveLength(INGEST_LIMITS.address);
    expect(row.from).toHaveLength(INGEST_LIMITS.address);
    expect(row.subject).toHaveLength(INGEST_LIMITS.subject);
  });

  it('aplica una clasificación segura cuando faltan campos con error_parseo', () => {
    const row = normalizeIngestRow({ messageId: 'm-1', cuenta_origen: 'BUZON@EXAMPLE.TEST', error_parseo: true }, now);
    expect(row).toMatchObject({
      cuenta_origen: 'buzon@example.test',
      categoria: 'Consulta General',
      prioridad: 'Moderado',
      error_parseo: true,
      documentos_requeridos: [],
      alerta_inmediata: false,
    });
    expect(row.respuesta_cruda).toContain('categoria_original');
  });

  it('solo rechaza si faltan messageId o la cuenta', () => {
    expect(() => normalizeIngestRow({ to: 'buzon@example.test' }, now)).toThrow(BadRequestException);
    expect(() => normalizeIngestRow({ messageId: 'm-1' }, now)).toThrow(BadRequestException);
  });

  it('admite lotes de 250 y rechaza 251', () => {
    const pipe = new IngestPayloadPipe();
    const row = { messageId: 'm', to: 'buzon@example.test' };
    expect(pipe.transform(Array.from({ length: 250 }, (_, index) => ({ ...row, messageId: `m-${index}` })))).toHaveLength(250);
    expect(() => pipe.transform(Array.from({ length: 251 }, (_, index) => ({ ...row, messageId: `m-${index}` })))).toThrow(BadRequestException);
  });
});
