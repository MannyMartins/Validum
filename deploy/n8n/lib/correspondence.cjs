'use strict';

const CATEGORIES = ['Términos jurídicos', 'Cobros Jurídicos', 'Consulta General', 'Soporte Operativo'];
const PRIORITIES = ['Urgente', 'Moderado', 'Respuesta Ligera'];

function truncate(value, max) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, max);
}

function addressText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(addressText).filter(Boolean).join(', ');
  if (!value || typeof value !== 'object') return '';
  if (typeof value.text === 'string' && value.text.trim()) return value.text;
  if (Array.isArray(value.value)) {
    return value.value.map(entry => {
      if (!entry || typeof entry !== 'object') return addressText(entry);
      const address = truncate(entry.address || entry.email || '', 1000).trim();
      const name = truncate(entry.name || '', 500).trim();
      return name && address ? `${name} <${address}>` : address || name;
    }).filter(Boolean).join(', ');
  }
  return truncate(value.address || value.email || value.name || '', 1000);
}

function stripHtml(value) {
  return truncate(value, 100000)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(value, now = new Date()) {
  let parsed;
  if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) {
    const numeric = Number(value);
    parsed = new Date(Math.abs(numeric) < 1000000000000 ? numeric * 1000 : numeric);
  } else {
    parsed = new Date(typeof value === 'string' ? value : '');
  }
  return Number.isNaN(parsed.getTime()) ? now.toISOString() : parsed.toISOString();
}

function normalizeEmail(input, previousNodeName, accounts, now = new Date()) {
  const from = truncate(addressText(input.from || input.sender), 1000).trim();
  const to = truncate(addressText(input.to || input.deliveredTo || input.recipients), 1000).trim();
  const htmlText = input.html ? stripHtml(input.html) : '';
  const textPlain = truncate(input.textPlain || input.text || htmlText || input.snippet || '', 15000);
  const configuredAccount = truncate(accounts && accounts[previousNodeName], 320).trim().toLowerCase();
  return {
    from,
    to,
    subject: truncate(input.subject || '', 1000),
    textPlain,
    messageId: truncate(input.messageId || input.id || input.message_id || '', 1000).trim(),
    threadId: truncate(input.threadId || input.thread_id || '', 1000).trim(),
    fecha: normalizeDate(input.date || input.internalDate, now),
    cuenta_origen: configuredAccount || truncate(to, 320).trim().toLowerCase(),
  };
}

function extractFirstJsonObject(value) {
  const source = truncate(value, 20000).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) return source.slice(start, index + 1);
    }
  }
  return '';
}

function nullable(value, max) {
  const normalized = truncate(value, max).trim();
  return !normalized || normalized.toLowerCase() === 'null' ? null : normalized;
}

function senderFallback(from) {
  const value = truncate(from, 500).trim();
  const beforeAddress = value.split('<')[0].trim().replace(/^['"]|['"]$/g, '');
  return beforeAddress || value || 'Remitente no identificado';
}

function prepareValidumPayload(original, modelOutput) {
  const raw = truncate(modelOutput && (modelOutput.text ?? modelOutput.output ?? modelOutput.response), 20000);
  let parsed = {};
  let parseError = false;
  try {
    const objectText = extractFirstJsonObject(raw);
    if (!objectText) throw new Error('No JSON object');
    parsed = JSON.parse(objectText);
  } catch (_error) {
    parseError = true;
  }
  const categoryValid = CATEGORIES.includes(parsed.categoria);
  const priorityValid = PRIORITIES.includes(parsed.prioridad);
  parseError = parseError || !categoryValid || !priorityValid;
  const documents = Array.isArray(parsed.documentos_requeridos)
    ? parsed.documentos_requeridos.slice(0, 100).map(item => truncate(item, 1000).trim()).filter(Boolean)
    : [];

  return {
    from: truncate(original.from, 1000),
    to: truncate(original.to, 1000),
    subject: truncate(original.subject, 1000),
    textPlain: truncate(original.textPlain, 15000),
    messageId: truncate(original.messageId, 1000),
    threadId: truncate(original.threadId, 1000),
    fecha: normalizeDate(original.fecha),
    cuenta_origen: truncate(original.cuenta_origen, 320).trim().toLowerCase(),
    remitente_nombre: truncate(parsed.remitente_nombre, 500).trim() || senderFallback(original.from),
    identificacion: nullable(parsed.identificacion, 200),
    empresa_relacionada: nullable(parsed.empresa_relacionada, 500),
    categoria: categoryValid ? parsed.categoria : 'Consulta General',
    prioridad: priorityValid ? parsed.prioridad : 'Moderado',
    resumen: truncate(parsed.resumen, 20000).trim() || 'Correo recibido; la clasificación automática no estuvo disponible.',
    documentos_requeridos: documents,
    propuesta_respuesta: truncate(parsed.propuesta_respuesta, 100000),
    alerta_inmediata: parsed.alerta_inmediata === true,
    error_parseo: parseError,
    ...(parseError ? { respuesta_cruda: raw } : {}),
  };
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  addressText,
  extractFirstJsonObject,
  nullable,
  normalizeDate,
  normalizeEmail,
  prepareValidumPayload,
  senderFallback,
  stripHtml,
  truncate,
};
