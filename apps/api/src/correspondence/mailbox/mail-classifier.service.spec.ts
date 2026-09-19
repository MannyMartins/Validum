import { NormalizedMail } from './gmail-message';
import { buildPrompt, parseClassification } from './mail-classifier.service';

const mail: NormalizedMail = {
  messageId: 'msg-1',
  threadId: 'hilo-1',
  from: 'Juzgado 12 <juzgado12@example.test>',
  to: 'juridica@example.test',
  subject: 'Acción de tutela 2026-00123',
  textPlain: 'Se concede término de 48 horas para responder.',
  fecha: '2026-09-18T15:30:00.000Z',
};

const respuestaValida = JSON.stringify({
  remitente_nombre: 'Juzgado 12 Civil',
  identificacion: '900123456',
  empresa_relacionada: 'Rama Judicial',
  categoria: 'Términos jurídicos',
  prioridad: 'Urgente',
  resumen: 'Tutela con término de 48 horas.',
  documentos_requeridos: ['Contestación', 'Historia clínica'],
  propuesta_respuesta: 'Se dará respuesta dentro del término.',
  alerta_inmediata: true,
});

describe('interpretación de la respuesta del modelo', () => {
  it('lee una respuesta bien formada', () => {
    const result = parseClassification(respuestaValida, mail);
    expect(result).toMatchObject({
      remitente_nombre: 'Juzgado 12 Civil',
      identificacion: '900123456',
      categoria: 'Términos jurídicos',
      prioridad: 'Urgente',
      alerta_inmediata: true,
      error_parseo: false,
    });
    expect(result.documentos_requeridos).toEqual(['Contestación', 'Historia clínica']);
    expect(result.respuesta_cruda).toBeUndefined();
  });

  it('tolera que el modelo envuelva el JSON en markdown', () => {
    const result = parseClassification('```json\n' + respuestaValida + '\n```', mail);
    expect(result.error_parseo).toBe(false);
    expect(result.categoria).toBe('Términos jurídicos');
  });

  it('tolera texto sobrante alrededor del JSON', () => {
    const result = parseClassification(`Claro, aquí tienes:\n${respuestaValida}\nEspero que sirva.`, mail);
    expect(result.error_parseo).toBe(false);
  });

  it('no pierde el correo si la respuesta no es JSON', () => {
    const result = parseClassification('No puedo ayudarte con eso.', mail);
    expect(result.error_parseo).toBe(true);
    expect(result.categoria).toBe('Consulta General');
    expect(result.prioridad).toBe('Moderado');
    expect(result.respuesta_cruda).toBe('No puedo ayudarte con eso.');
    expect(result.remitente_nombre).toBe(mail.from);
  });

  it('no pierde el correo si la respuesta viene vacía', () => {
    const result = parseClassification('', mail);
    expect(result.error_parseo).toBe(true);
    expect(result.resumen).toContain('revisión manual');
  });

  it('marca error cuando la categoría está fuera de la lista', () => {
    const result = parseClassification(
      JSON.stringify({ ...JSON.parse(respuestaValida), categoria: 'Inventada' }),
      mail,
    );
    expect(result.error_parseo).toBe(true);
    expect(result.categoria).toBe('Consulta General');
    expect(result.respuesta_cruda).toContain('Inventada');
  });

  it('marca error cuando la prioridad está fuera de la lista', () => {
    const result = parseClassification(
      JSON.stringify({ ...JSON.parse(respuestaValida), prioridad: 'Altísima' }),
      mail,
    );
    expect(result.error_parseo).toBe(true);
    expect(result.prioridad).toBe('Moderado');
  });

  it('convierte la cadena "null" en ausencia de dato', () => {
    const result = parseClassification(
      JSON.stringify({ ...JSON.parse(respuestaValida), identificacion: 'null', empresa_relacionada: '' }),
      mail,
    );
    expect(result.identificacion).toBeNull();
    expect(result.empresa_relacionada).toBeNull();
  });

  it('acepta alerta_inmediata como texto', () => {
    expect(parseClassification(JSON.stringify({ ...JSON.parse(respuestaValida), alerta_inmediata: 'true' }), mail).alerta_inmediata).toBe(true);
    expect(parseClassification(JSON.stringify({ ...JSON.parse(respuestaValida), alerta_inmediata: 'no' }), mail).alerta_inmediata).toBe(false);
  });

  it('normaliza documentos_requeridos aunque venga mal', () => {
    expect(parseClassification(JSON.stringify({ ...JSON.parse(respuestaValida), documentos_requeridos: 'un texto' }), mail).documentos_requeridos).toEqual([]);
    const muchos = parseClassification(
      JSON.stringify({ ...JSON.parse(respuestaValida), documentos_requeridos: Array.from({ length: 150 }, (_, i) => `doc ${i}`) }),
      mail,
    );
    expect(muchos.documentos_requeridos).toHaveLength(100);
  });

  it('rechaza un JSON que no sea objeto', () => {
    expect(parseClassification('[1,2,3]', mail).error_parseo).toBe(true);
    expect(parseClassification('"texto"', mail).error_parseo).toBe(true);
  });
});

describe('construcción del prompt', () => {
  it('incluye el correo y las categorías permitidas', () => {
    const prompt = buildPrompt(mail);
    expect(prompt).toContain(mail.from);
    expect(prompt).toContain(mail.subject);
    expect(prompt).toContain(mail.textPlain);
    expect(prompt).toContain('Términos jurídicos');
    expect(prompt).toContain('Respuesta Ligera');
    expect(prompt).toContain('JSON válido');
  });
});
