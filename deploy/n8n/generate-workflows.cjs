'use strict';

const fs = require('node:fs');
const path = require('node:path');
const library = require('./lib/correspondence.cjs');

const outputDirectory = __dirname;

function codeFrom(functionNames, constants = '') {
  return [
    constants,
    ...functionNames.map(name => library[name].toString()),
  ].filter(Boolean).join('\n\n');
}

const accountMap = Object.fromEntries(
  Array.from({ length: 6 }, (_, index) => [`Gmail ${index + 1}`, '']),
);

const normalizerCode = `${codeFrom([
  'truncate',
  'addressText',
  'stripHtml',
  'normalizeDate',
  'normalizeEmail',
])}

const CUENTAS = ${JSON.stringify(accountMap, null, 2)};
return normalizeEmail($json, $prevNode.name, CUENTAS);`;

const prepareCode = `${codeFrom([
  'truncate',
  'normalizeDate',
  'extractFirstJsonObject',
  'nullable',
  'senderFallback',
  'prepareValidumPayload',
], `const CATEGORIES = ${JSON.stringify(library.CATEGORIES)};\nconst PRIORITIES = ${JSON.stringify(library.PRIORITIES)};`)}

const original = $('Normalizar correo').item.json;
return prepareValidumPayload(original, $json);`;

const classificationPrompt = `=Actúa como asistente jurídico-administrativo experto en clasificación de correspondencia.

Extrae el nombre del remitente, su identificación (cédula, NIT o null), la empresa relacionada y todos los documentos mencionados.

Clasifica el correo en exactamente una categoría:
- Términos jurídicos: demandas, tutelas, acciones judiciales, comunicaciones de juzgados o entidades de control, requerimientos con término legal, medidas cautelares y actuaciones que puedan generar consecuencias jurídicas.
- Cobros Jurídicos: cartera prejurídica o jurídica, cobros, acuerdos de pago, mandamientos de pago y procesos ejecutivos.
- Consulta General: solicitudes, PQRS, preguntas informativas o comunicaciones generales que no corresponden a un trámite operativo.
- Soporte Operativo: afiliaciones, planillas, radicación o corrección de documentos, inconvenientes de plataforma y apoyo sobre trámites.

Asigna exactamente una prioridad:
- Urgente: términos legales de 24 a 72 horas, comunicaciones de juzgados o entidades de control, medidas cautelares, órdenes judiciales o riesgo de sanción o perjuicio inmediato. alerta_inmediata debe ser true.
- Moderado: plazos de 5 a 15 días, cobros regulares o gestiones que requieren respuesta sin riesgo inmediato.
- Respuesta Ligera: confirmaciones, mensajes informativos, consultas rutinarias, acuses de recibo u orientación breve.

Devuelve únicamente un objeto JSON válido, sin markdown ni texto adicional, con estas claves exactas:
{"remitente_nombre":"string","identificacion":"string o null","empresa_relacionada":"string o null","categoria":"Términos jurídicos | Cobros Jurídicos | Consulta General | Soporte Operativo","prioridad":"Urgente | Moderado | Respuesta Ligera","resumen":"string","documentos_requeridos":["string"],"propuesta_respuesta":"string","alerta_inmediata":false}

El resumen debe tener máximo 3 líneas. Genera también una propuesta preliminar de respuesta formal. Si un dato no aparece, usa null o una lista vacía. No inventes identificaciones, empresas, fechas ni hechos. La propuesta es un borrador y no debe afirmar que ya se realizó una acción.

Correo:
De: {{ $json.from }}
Para: {{ $json.to }}
Asunto: {{ $json.subject }}
Cuerpo:
{{ $json.textPlain }}`;

const nodes = [];
for (let index = 1; index <= 6; index += 1) {
  nodes.push({
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      simple: false,
      filters: {},
      options: {},
    },
    id: `gmail-trigger-${index}`,
    name: `Gmail ${index}`,
    type: 'n8n-nodes-base.gmailTrigger',
    typeVersion: 1.2,
    position: [-1040, -420 + (index - 1) * 160],
  });
}

nodes.push(
  {
    parameters: { jsCode: normalizerCode, mode: 'runOnceForEachItem' },
    id: 'normalize-email',
    name: 'Normalizar correo',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-720, 0],
  },
  {
    parameters: {
      promptType: 'define',
      text: classificationPrompt,
      options: {},
    },
    id: 'classify-email',
    name: 'Clasificar correo (IA)',
    type: '@n8n/n8n-nodes-langchain.chainLlm',
    typeVersion: 1.7,
    position: [-440, 0],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
  },
  {
    parameters: {
      modelName: 'claude-3-5-haiku-latest',
      options: { temperature: 0.1, maxTokensToSample: 2000 },
    },
    id: 'anthropic-model',
    name: 'Anthropic Chat Model',
    type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
    typeVersion: 1.3,
    position: [-440, 240],
  },
  {
    parameters: { jsCode: prepareCode, mode: 'runOnceForEachItem' },
    id: 'prepare-payload',
    name: 'Preparar payload Validum',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-120, 0],
  },
  {
    parameters: {
      method: 'POST',
      url: 'https://validum-api-production-e8f6.up.railway.app/api/correspondencia/ingest',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json) }}',
      options: { timeout: 30000 },
    },
    id: 'save-validum',
    name: 'Guardar en Validum',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [220, -100],
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 10000,
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'immediate-alert',
            leftValue: '={{ $json.alerta_inmediata }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
          {
            id: 'urgent-priority',
            leftValue: '={{ $json.prioridad }}',
            rightValue: 'Urgente',
            operator: { type: 'string', operation: 'equals' },
          },
        ],
        combinator: 'or',
      },
      options: {},
    },
    id: 'immediate-alert-if',
    name: '¿Alerta inmediata?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [220, 100],
  },
  {
    parameters: {},
    id: 'immediate-alert-placeholder',
    name: 'ALERTA - Notificar',
    type: 'n8n-nodes-base.noOp',
    typeVersion: 1,
    position: [500, 40],
    notesInFlow: true,
    notes: 'FASE 2: sustituir por el canal de notificación aprobado. No envía mensajes en esta versión.',
  },
);

const connections = {
  'Normalizar correo': { main: [[{ node: 'Clasificar correo (IA)', type: 'main', index: 0 }]] },
  'Clasificar correo (IA)': { main: [[{ node: 'Preparar payload Validum', type: 'main', index: 0 }]] },
  'Anthropic Chat Model': { ai_languageModel: [[{ node: 'Clasificar correo (IA)', type: 'ai_languageModel', index: 0 }]] },
  'Preparar payload Validum': {
    main: [[
      { node: 'Guardar en Validum', type: 'main', index: 0 },
      { node: '¿Alerta inmediata?', type: 'main', index: 0 },
    ]],
  },
  '¿Alerta inmediata?': { main: [[{ node: 'ALERTA - Notificar', type: 'main', index: 0 }], []] },
};
for (let index = 1; index <= 6; index += 1) {
  connections[`Gmail ${index}`] = { main: [[{ node: 'Normalizar correo', type: 'main', index: 0 }]] };
}

const mainWorkflow = {
  name: 'Correspondencia - Gmail a Validum',
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: { executionOrder: 'v1', saveManualExecutions: true },
  versionId: '10000000-0000-4000-8000-000000000001',
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

const errorWorkflow = {
  name: 'Validum - Errores de correspondencia',
  nodes: [
    {
      parameters: {},
      id: 'error-trigger',
      name: 'Error Trigger',
      type: 'n8n-nodes-base.errorTrigger',
      typeVersion: 1,
      position: [-220, 0],
    },
    {
      parameters: {},
      id: 'error-placeholder',
      name: 'ERROR - Notificar',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [40, 0],
      notesInFlow: true,
      notes: 'FASE 2: sustituir por el canal de notificación aprobado. Revise $json para ver workflow, execution y error.',
    },
  ],
  pinData: {},
  connections: {
    'Error Trigger': { main: [[{ node: 'ERROR - Notificar', type: 'main', index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: 'v1' },
  versionId: '20000000-0000-4000-8000-000000000002',
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

function validateConnections(workflow) {
  const names = new Set(workflow.nodes.map(node => node.name));
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    if (!names.has(source)) throw new Error(`Conexión desde nodo inexistente: ${source}`);
    for (const branches of Object.values(outputs)) {
      for (const branch of branches) {
        for (const connection of branch) {
          if (!names.has(connection.node)) throw new Error(`Conexión hacia nodo inexistente: ${connection.node}`);
        }
      }
    }
  }
}

for (const [filename, workflow] of [
  ['correspondencia-workflow.json', mainWorkflow],
  ['correspondencia-errores.json', errorWorkflow],
]) {
  validateConnections(workflow);
  fs.writeFileSync(path.join(outputDirectory, filename), `${JSON.stringify(workflow, null, 2)}\n`);
}
