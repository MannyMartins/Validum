'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractFirstJsonObject,
  normalizeDate,
  normalizeEmail,
  prepareValidumPayload,
  stripHtml,
} = require('./correspondence.cjs');

const now = new Date('2026-09-19T02:00:00.000Z');

test('normaliza fechas ISO, epoch y valores inválidos', () => {
  assert.equal(normalizeDate('2026-09-18T15:30:00.000Z', now), '2026-09-18T15:30:00.000Z');
  assert.equal(normalizeDate(1789745400000, now), '2026-09-18T15:30:00.000Z');
  assert.equal(normalizeDate('1789745400', now), '2026-09-18T15:30:00.000Z');
  assert.equal(normalizeDate('invalida', now), now.toISOString());
});

test('extrae direcciones estructuradas, limpia HTML y aplica recortes', () => {
  const normalized = normalizeEmail({
    from: { text: 'Remitente <remitente@example.test>' },
    to: { value: [{ name: 'Buzón', address: 'buzon@example.test' }] },
    subject: 's'.repeat(1200),
    html: '<style>.oculto{display:none}</style><p>Mensaje <b>importante</b></p>',
    id: 'mensaje-1',
    internalDate: 1789745400000,
  }, 'Gmail 1', { 'Gmail 1': 'cuenta@example.test' }, now);
  assert.equal(normalized.subject.length, 1000);
  assert.equal(normalized.cuenta_origen, 'cuenta@example.test');
  assert.equal(normalized.textPlain, 'Mensaje importante');
  assert.equal(stripHtml('<style>secreto</style><p>Visible</p>'), 'Visible');
});

test('usa el destinatario como fallback de cuenta', () => {
  const normalized = normalizeEmail({ to: 'fallback@example.test', id: 'm-1' }, 'Gmail 2', {}, now);
  assert.equal(normalized.cuenta_origen, 'fallback@example.test');
});

test('extrae el primer objeto JSON aunque haya markdown o texto alrededor', () => {
  assert.equal(extractFirstJsonObject('```json\n{"ok":true}\n```'), '{"ok":true}');
  assert.equal(extractFirstJsonObject('antes {"texto":"llave } interna"} después'), '{"texto":"llave } interna"}');
});

test('prepara clasificación válida con documentos acotados', () => {
  const payload = prepareValidumPayload({
    from: 'Persona <persona@example.test>', to: 'buzon@example.test', subject: 'Consulta', textPlain: 'Texto',
    messageId: 'm-1', threadId: 't-1', fecha: '2026-09-18T15:30:00.000Z', cuenta_origen: 'buzon@example.test',
  }, { text: JSON.stringify({
    remitente_nombre: 'Persona', identificacion: 'null', empresa_relacionada: '', categoria: 'Consulta General',
    prioridad: 'Respuesta Ligera', resumen: 'Consulta rutinaria.', documentos_requeridos: ['Documento'],
    propuesta_respuesta: '', alerta_inmediata: false,
  }) });
  assert.equal(payload.error_parseo, false);
  assert.deepEqual(payload.documentos_requeridos, ['Documento']);
  assert.equal(payload.identificacion, null);
});

test('conserva la respuesta defectuosa y usa fallbacks seguros', () => {
  const payload = prepareValidumPayload({ from: 'persona@example.test', messageId: 'm-2', to: 'buzon@example.test' }, { output: 'respuesta no parseable' });
  assert.equal(payload.error_parseo, true);
  assert.equal(payload.categoria, 'Consulta General');
  assert.equal(payload.prioridad, 'Moderado');
  assert.equal(payload.respuesta_cruda, 'respuesta no parseable');
  assert.deepEqual(payload.documentos_requeridos, []);
});

test('marca categorías inválidas aunque el JSON sea válido', () => {
  const payload = prepareValidumPayload({ from: 'persona@example.test', messageId: 'm-3', to: 'buzon@example.test' }, {
    text: '{"categoria":"Otra","prioridad":"Crítica","documentos_requeridos":[]}',
  });
  assert.equal(payload.error_parseo, true);
  assert.equal(payload.categoria, 'Consulta General');
  assert.equal(payload.prioridad, 'Moderado');
});
