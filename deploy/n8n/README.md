# Correspondencia: Gmail → IA → Validum (camino alternativo)

> **Este ya no es el camino principal.** Validum lee los buzones de Gmail por su
> cuenta, sin n8n ni servicios adicionales: la propia API consulta cada buzón,
> clasifica con Gemini y guarda el resultado. La guía vigente es
> [`deploy/GMAIL_SETUP.md`](../GMAIL_SETUP.md).
>
> Lo que sigue se conserva por si alguna vez conviene alimentar la
> correspondencia desde fuera. El endpoint de ingesta con API key sigue activo,
> así que estos flujos funcionan sin cambios.

Estos archivos dejan preparado el flujo, pero **no contienen credenciales ni secretos**:

- `correspondencia-workflow.json`: flujo principal importable en n8n.
- `correspondencia-errores.json`: flujo opcional para gestionar errores.
- `lib/correspondence.cjs`: lógica fuente de normalización y preparación del payload.
- `generate-workflows.cjs`: genera ambos JSON desde esa lógica para evitar divergencias.

Después de cambiar la lógica, regenere y pruebe los exports desde la raíz del repositorio:

```bash
node deploy/n8n/generate-workflows.cjs
node --test deploy/n8n/lib/correspondence.test.cjs
```

Codex no tiene acceso a n8n Cloud, Railway ni las cuentas de Gmail. Por eso los pasos que dependen de esas plataformas deben ser ejecutados y comprobados por el usuario.

## 1. Despliegue seguro y reversión

Siga este orden; no active n8n antes de terminarlo:

1. En Railway, genere y descargue una copia de seguridad o snapshot de PostgreSQL. Compruebe que la copia corresponde al entorno `production` del proyecto `validum-form`.
2. Revise y haga merge del PR de Correspondencia.
3. Espere a que los servicios `Validum API`, `Validum` y el panel terminen en estado **Success**.
4. En los logs de `Validum API`, confirme que `prisma migrate deploy` terminó correctamente y aplicó la migración aditiva que agrega `destinatarios`.
5. Pruebe el panel y la API. Solo entonces cree la variable secreta y configure n8n como se explica abajo.

Plan de reversión: desactive primero el workflow de n8n y revierta el PR con un nuevo commit/revert. La migración únicamente agrega una columna nullable, por lo que puede permanecer sin uso; no ejecute un `DROP COLUMN` ni restaure la base salvo que exista un incidente que realmente lo justifique. Si la migración falla, mantenga n8n desactivado, conserve los logs y restaure desde la copia únicamente después de identificar el alcance.

## 2. Clave de ingesta

Genere una clave aleatoria de 64 caracteres hexadecimales en una terminal local:

```bash
openssl rand -hex 32
```

Guárdela como `CORRESPONDENCIA_INGEST_API_KEY` **únicamente** en el servicio `Validum API` de Railway. No la cree como `VITE_*`, no la coloque en el servicio web, el repositorio, capturas, tickets ni mensajes. La API exige al menos 32 caracteres y permanece cerrada si la variable falta o es demasiado corta.

En n8n cree una credencial **Header Auth** llamada `Validum Ingest`:

- Name: `X-API-Key`
- Value: la misma clave de Railway

El export no incluye esa credencial ni su identificador. Asígnela manualmente al nodo `Guardar en Validum`.

## 3. Probar conexión e ingesta

Ponga la clave en una variable de entorno de la sesión para no escribirla en el comando ni dejarla en el historial.

PowerShell:

```powershell
$env:CORRESPONDENCIA_INGEST_API_KEY = Read-Host -MaskInput "Clave de ingesta"
curl.exe -fsS -H "X-API-Key: $env:CORRESPONDENCIA_INGEST_API_KEY" "https://validum-api-production-e8f6.up.railway.app/api/correspondencia/ingest/health"
```

Bash:

```bash
read -s CORRESPONDENCIA_INGEST_API_KEY && export CORRESPONDENCIA_INGEST_API_KEY
curl --fail --silent --show-error \
  -H "X-API-Key: ${CORRESPONDENCIA_INGEST_API_KEY}" \
  https://validum-api-production-e8f6.up.railway.app/api/correspondencia/ingest/health
```

La respuesta esperada es `{"ok":true}`. Para una prueba de escritura use solamente datos ficticios:

```powershell
$payload = @{
  messageId = "validum-test-20260919-001"
  threadId = "validum-test-thread-001"
  from = "remitente@example.test"
  to = "buzon@example.test"
  cuenta_origen = "buzon@example.test"
  subject = "Prueba controlada de correspondencia"
  textPlain = "Mensaje ficticio sin datos personales."
  fecha = "2026-09-19T02:00:00.000Z"
  categoria = "Consulta General"
  prioridad = "Respuesta Ligera"
  resumen = "Prueba técnica."
  documentos_requeridos = @()
  propuesta_respuesta = "Acuse de recibo de prueba."
  alerta_inmediata = $false
  error_parseo = $false
} | ConvertTo-Json
curl.exe -fsS -X POST -H "X-API-Key: $env:CORRESPONDENCIA_INGEST_API_KEY" -H "Content-Type: application/json" --data-binary $payload "https://validum-api-production-e8f6.up.railway.app/api/correspondencia/ingest"
```

Compruebe el registro en el panel de Correspondencia y elimínelo desde la interfaz si existe esa acción administrativa. Como alternativa, un administrador de base de datos puede ejecutar, después de verificar los valores:

```sql
DELETE FROM "correos_clasificados"
WHERE "cuenta_destino" = 'buzon@example.test'
  AND "gmail_message_id" = 'validum-test-20260919-001';
```

No amplíe el `DELETE` ni lo ejecute sin la copia de seguridad.

## 4. Importar y configurar el workflow

1. En n8n seleccione **Import from File** e importe `deploy/n8n/correspondencia-workflow.json`.
2. Confirme que su nombre sea `Correspondencia - Gmail a Validum` y déjelo inactivo mientras configura y prueba.
3. Abra `Normalizar correo`. Al inicio del código, complete el objeto `CUENTAS`: asigne a cada clave `Gmail 1` … `Gmail 6` la dirección exacta que recibe ese nodo. No publique esas direcciones en el repositorio. Si deja una entrada vacía, el flujo usa el destinatario del mensaje como fallback, que puede ser menos estable si hay alias o varios destinatarios.
4. Abra `Guardar en Validum` y seleccione la credencial `Validum Ingest`.
5. Importe también `deploy/n8n/correspondencia-errores.json` si desea el flujo de errores. En la configuración del flujo principal, seleccione `Validum - Errores de correspondencia` como **Error workflow**. El nodo final es intencionalmente NoOp hasta definir un canal aprobado.

## 5. Conectar las seis cuentas de Gmail

Cada nodo `Gmail 1` a `Gmail 6` necesita **su propia credencial OAuth**:

1. Abra el nodo `Gmail 1`, despliegue Credential y elija **Create new credential**. No reutilice la credencial de otro buzón.
2. En Google elija **Usar otra cuenta**. Si Google insiste en la sesión anterior, use un perfil de navegador distinto o una ventana privada/incógnita.
3. Repita el proceso para cada nodo y verifique visualmente qué cuenta quedó asociada.

Si usa su propio proyecto de Google Cloud:

- Habilite **Gmail API**.
- Si la pantalla de consentimiento OAuth está en modo **Testing**, agregue las seis direcciones como **Test users**.
- Registre en el cliente OAuth la URL de redirección que n8n muestra en la pantalla de la credencial; debe coincidir exactamente en protocolo, host y ruta.
- Para cuentas de Google Workspace, el administrador puede necesitar permitir la aplicación de terceros y sus scopes.

Mantenga `simple = false`; el clasificador necesita el cuerpo completo. El flujo entregado sondea cada minuto.

## 6. Configurar el modelo de IA

En n8n cree una credencial de Anthropic con la API key suministrada directamente por ese proveedor y asígnela a `Anthropic Chat Model`. No coloque la clave dentro del prompt, el código o el JSON exportado. El nodo usa temperatura `0.1` y máximo `2000` tokens.

Para cambiar de proveedor, agregue el nodo Chat Model compatible con n8n, conecte su salida `ai_languageModel` a `Clasificar correo (IA)`, pruebe que su salida llegue como `text` u `output` y retire el subnodo Anthropic solo después de una prueba satisfactoria. El contrato JSON del prompt y `Preparar payload Validum` no deben cambiar.

## 7. Prueba de extremo a extremo y publicación

1. Envíe un correo ficticio distinto a cada una de las seis cuentas. No use datos personales, clínicos o jurídicos reales en la prueba.
2. En cada nodo Gmail use **Fetch Test Event** y ejecute manualmente la ruta completa.
3. Compruebe en la ejecución que `Normalizar correo` tiene `messageId` y la `cuenta_origen` correcta, que la IA devuelve JSON y que `Guardar en Validum` responde correctamente.
4. En el panel de Correspondencia verifique categoría, prioridad, cuenta y el indicador de error de clasificación. Repita para las seis cuentas.
5. Compruebe que reenviar el mismo `messageId` para la misma cuenta actualiza el registro y no crea un duplicado.
6. Solo después de seis pruebas satisfactorias, active/publice el flujo con **Publish**.

## 8. Operación diaria y fallos

Revise periódicamente el consumo de ejecuciones de su plan de n8n Cloud: seis disparadores cada minuto pueden consumir recursos. Si se acerca al límite, cambie cada sondeo de un minuto a cinco minutos y vuelva a validar la recepción.

Revise **Executions** para detectar fallos. El modelo reintenta tres veces con esperas de 5 segundos; Validum intenta hasta cuatro veces con esperas de 10 segundos. Si los fallos son inmediatos, la ventana de reintentos ronda 40 segundos; con timeouts de red puede durar más. Después del fallo final, Gmail Trigger no garantiza reenviar automáticamente ese mismo evento. Abra la ejecución fallida y use **Retry/Retry from failed**, o vuelva a inyectar manualmente el correo desde una ejecución controlada. La API es idempotente por `(cuenta_origen, messageId)`, así que reintentar no debe duplicarlo.

Si Validum está caído, no dé por recuperados los correos solo porque el servicio volvió. Reconcilie las ejecuciones fallidas de ese intervalo y reprocéselas una por una.

## 9. Seguridad, privacidad y rotación

El cuerpo, asunto, remitente, identificación, empresa y documentos mencionados se envían al proveedor de IA configurado. Confirme previamente que el contrato, región, retención y política de tratamiento de datos del proveedor son adecuados. Aplique minimización, acceso por necesidad, registro de responsables y tiempos de conservación. No use datos reales para pruebas.

No comparta exports que contengan credenciales. El JSON de este repositorio está deliberadamente desacoplado de ellas. Los logs y mensajes de error tampoco deben contener cuerpos de correo ni claves.

Para rotar `CORRESPONDENCIA_INGEST_API_KEY` sin perder mensajes:

1. Desactive temporalmente el flujo principal y anote la hora exacta del último éxito.
2. Genere una clave nueva; cambie la variable solo en `Validum API` y espere el despliegue **Success**.
3. Actualice inmediatamente el valor de la credencial `Validum Ingest` en n8n, pruebe `/ingest/health` y ejecute una prueba manual.
4. Reactive el flujo y reconcilie en Gmail y **Executions** todos los mensajes recibidos desde la hora anotada; reprocese cualquiera que no aparezca en Validum.
5. Elimine la clave antigua de cualquier gestor autorizado donde ya no sea necesaria.

La API acepta una sola clave activa, por lo que la pausa y la reconciliación explícita son las medidas que evitan pérdidas durante la rotación.

## 10. Fase 2 opcional: n8n en Railway — no ejecutar todavía

Cuando exista aprobación operativa, se puede desplegar n8n con la plantilla oficial como un servicio separado, usando su propio PostgreSQL persistente. Defina una `N8N_ENCRYPTION_KEY` aleatoria y estable, configure `WEBHOOK_URL` con el dominio HTTPS definitivo y limite el acceso administrativo. Después reimporte los JSON y recree las credenciales manualmente: las credenciales cifradas de n8n Cloud no deben copiarse en el repositorio. Finalmente actualice en Google Cloud todas las URLs de callback OAuth al nuevo dominio y vuelva a autorizar cada cuenta.

Esta fase cambia infraestructura, URLs OAuth, copias de seguridad y responsabilidades de operación; por eso no forma parte del despliegue actual.

## Acciones que SOLO puede hacer el usuario

- Crear y verificar la copia de seguridad de PostgreSQL.
- Revisar y hacer merge del PR.
- Comprobar el despliegue y la migración en Railway.
- Crear o rotar `CORRESPONDENCIA_INGEST_API_KEY` en `Validum API`.
- Crear y asignar las credenciales de n8n.
- Iniciar sesión y autorizar cada una de las seis cuentas de Google.
- Configurar Google Cloud/Workspace cuando corresponda.
- Crear y asignar la API key del proveedor de IA.
- Completar `CUENTAS`, ejecutar las pruebas con cada buzón y publicar el workflow.
- Definir e implementar los canales reales de alerta y error de la fase 2.
