import {
  decodeBase64Url,
  extractBody,
  GMAIL_BODY_LIMIT,
  headerValue,
  htmlToText,
  normalizeGmailMessage,
  resolveDate,
} from './gmail-message';

const encode = (text: string) => Buffer.from(text, 'utf8').toString('base64url');

describe('lectura de mensajes de Gmail', () => {
  it('decodifica base64url incluyendo acentos', () => {
    expect(decodeBase64Url(encode('Notificación de cobro jurídico'))).toBe('Notificación de cobro jurídico');
    expect(decodeBase64Url(undefined)).toBe('');
  });

  it('lee cabeceras sin importar mayúsculas', () => {
    const payload = { headers: [{ name: 'subject', value: ' Tutela 2026 ' }] };
    expect(headerValue(payload, 'Subject')).toBe('Tutela 2026');
    expect(headerValue(payload, 'From')).toBe('');
  });

  it('prefiere text/plain sobre text/html', () => {
    const body = extractBody({
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/html', body: { data: encode('<p>versión html</p>') } },
        { mimeType: 'text/plain', body: { data: encode('versión plana') } },
      ],
    });
    expect(body).toBe('versión plana');
  });

  it('convierte html a texto cuando no hay texto plano', () => {
    const body = extractBody({
      mimeType: 'text/html',
      body: { data: encode('<style>p{color:red}</style><p>Primera</p><p>Segunda</p>') },
    });
    expect(body).toContain('Primera');
    expect(body).toContain('Segunda');
    expect(body).not.toContain('color:red');
    expect(body).not.toContain('<p>');
  });

  it('recorre partes anidadas', () => {
    const body = extractBody({
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: encode('anidado') } }] },
      ],
    });
    expect(body).toBe('anidado');
  });

  it('ignora los adjuntos', () => {
    const body = extractBody({
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', filename: 'demanda.txt', body: { data: encode('CONTENIDO ADJUNTO') } },
        { mimeType: 'text/plain', body: { data: encode('cuerpo real') } },
      ],
    });
    expect(body).toBe('cuerpo real');
  });

  it('descodifica entidades html', () => {
    expect(htmlToText('<p>Cobro &amp; embargo &lt;urgente&gt;</p>')).toBe('Cobro & embargo <urgente>');
  });

  it('usa internalDate en milisegundos', () => {
    expect(resolveDate({ internalDate: '1758211800000' })).toBe(new Date(1758211800000).toISOString());
  });

  it('recurre a la cabecera Date si no hay internalDate', () => {
    const fecha = resolveDate({ payload: { headers: [{ name: 'Date', value: 'Thu, 18 Sep 2026 15:30:00 +0000' }] } });
    expect(fecha).toBe('2026-09-18T15:30:00.000Z');
  });

  it('cae en la hora actual si la fecha es inservible', () => {
    const now = new Date('2026-09-19T00:00:00.000Z');
    expect(resolveDate({ internalDate: 'no-es-fecha' }, now)).toBe(now.toISOString());
  });

  it('normaliza un mensaje completo', () => {
    const mail = normalizeGmailMessage({
      id: 'msg-1',
      threadId: 'hilo-1',
      internalDate: '1758211800000',
      payload: {
        headers: [
          { name: 'From', value: 'Juzgado 12 <juzgado12@example.test>' },
          { name: 'To', value: 'juridica@example.test' },
          { name: 'Cc', value: 'copia@example.test' },
          { name: 'Subject', value: 'Acción de tutela' },
        ],
        mimeType: 'text/plain',
        body: { data: encode('Se concede término de 48 horas.') },
      },
    });
    expect(mail).toMatchObject({
      messageId: 'msg-1',
      threadId: 'hilo-1',
      from: 'Juzgado 12 <juzgado12@example.test>',
      subject: 'Acción de tutela',
      textPlain: 'Se concede término de 48 horas.',
    });
    expect(mail.to).toBe('juridica@example.test, copia@example.test');
  });

  it('recorta cuerpos enormes para no disparar el costo del modelo', () => {
    const mail = normalizeGmailMessage({
      id: 'msg-2',
      payload: { mimeType: 'text/plain', body: { data: encode('x'.repeat(GMAIL_BODY_LIMIT + 5_000)) } },
    });
    expect(mail.textPlain).toHaveLength(GMAIL_BODY_LIMIT);
  });

  it('usa el snippet cuando el mensaje no trae cuerpo', () => {
    const mail = normalizeGmailMessage({ id: 'msg-3', snippet: 'Resumen corto', payload: { headers: [] } });
    expect(mail.textPlain).toBe('Resumen corto');
  });
});
