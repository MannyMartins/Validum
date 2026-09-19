# Conectar buzones de Gmail a Validum

Validum lee por su cuenta los buzones de Gmail que se le conecten, clasifica cada
correo con Gemini y lo guarda en el módulo de Correspondencia. No hace falta n8n
ni ningún servicio adicional en Railway: el trabajo lo hace la propia API, que ya
está corriendo.

Esta guía cubre lo que hay que hacer una sola vez en Google Cloud y en Railway.

## Estado actual: prueba ficticia gratuita

Mantenga `CORRESPONDENCIA_POLL_ENABLED=false` y `CORRESPONDENCIA_GEMINI_REAL_ENABLED=false` (también es el comportamiento si faltan). Así no se lee Gmail, ni siquiera con «Revisar ahora», ni se envían correos guardados a Gemini. No conecte buzones reales durante esta fase.

Para probar solo el modelo, configure `GEMINI_API_KEY` de un proyecto sin facturación en **Validum API** y abra **Correspondencia → Cuentas de correo → Probar con correo ficticio**. El servidor construye un ejemplo fijo, ignora cualquier correo suministrado en la petición y no guarda registros. El endpoint es `POST /api/correspondencia/cuentas/prueba-ia`, exige la sesión de propietario o administrador y devuelve `ficticio`, `guardado: false` y `clasificacion`. Si `error_parseo` es verdadero, la prueba no acredita que Gemini funcione: revise clave, disponibilidad y cuota.

Antes del despliegue del PR, verifique un backup de PostgreSQL. Tras el merge, compruebe que Railway termina en Success y aplica `prisma migrate deploy`. La tabla `cuentas_correo` es aditiva; al revertir el código puede permanecer sin uso. No elimine tablas para revertir.

Usar la API existente evita contratar n8n, pero aumenta su consumo de CPU, memoria y red. No garantiza costo cero en Railway. La cuota gratuita de Gemini también tiene límites.

---

## 1. Crear el proyecto en Google Cloud

1. Entra a <https://console.cloud.google.com/> con cualquiera de tus cuentas.
2. Crea un proyecto nuevo (por ejemplo `validum-correspondencia`).
3. Ve a **APIs y servicios → Biblioteca**, busca **Gmail API** y pulsa **Habilitar**.

## 2. Configurar la pantalla de consentimiento

1. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Externo**. (La opción *Interno* solo existe si las cuentas
   pertenecen a un dominio de Google Workspace.)
3. Rellena nombre de la aplicación, correo de asistencia y correo del desarrollador.
4. En **Permisos**, añade `https://www.googleapis.com/auth/gmail.readonly`.
   Es el permiso mínimo: permite leer, nunca enviar ni borrar.
5. Para pruebas, mantenga el modo **Prueba** y agregue las cuentas de prueba como usuarios autorizados. Evalúe la publicación y verificación antes de operar con datos reales.

> Los proyectos externos en modo Prueba suelen emitir refresh tokens que caducan a los 7 días cuando usan permisos Gmail. Publicar no garantiza tokens permanentes: la revocación, las políticas de Workspace y otros eventos también los invalidan.

`gmail.readonly` es un permiso restringido. Revise los requisitos de verificación y tratamiento de datos antes de publicar. Si Google muestra una advertencia o bloquea el acceso, compruebe el proyecto, el cliente y las políticas del administrador; no omita la advertencia automáticamente. [OAuth de Google](https://developers.google.com/identity/protocols/oauth2#expiration).

## 3. Crear el cliente OAuth

1. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**.
3. En **URI de redirección autorizados**, añade exactamente:

   ```
   https://validum-api-production-e8f6.up.railway.app/api/correspondencia/cuentas/oauth/callback
   ```

   Si tu dominio de API es otro, usa el tuyo. Tiene que coincidir carácter por
   carácter con la variable `GOOGLE_OAUTH_REDIRECT_URI`, incluido `https://`.
4. Guarda el **ID de cliente** y el **secreto de cliente**.

## 4. Configurar las variables en Railway

En el servicio **Validum API** (nunca en el frontend, y nunca con prefijo `VITE_`):

| Variable | Valor |
| --- | --- |
| `CORRESPONDENCIA_TOKEN_KEY` | Generado con `openssl rand -hex 32` |
| `GOOGLE_OAUTH_CLIENT_ID` | El ID de cliente del paso 3 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | El secreto de cliente del paso 3 |
| `GOOGLE_OAUTH_REDIRECT_URI` | La URL de redirección del paso 3 |
| `CORRESPONDENCIA_OAUTH_REDIRECT_APP` | URL del panel, p. ej. `https://validum-production.up.railway.app/correspondencia` |
| `GEMINI_API_KEY` | Clave de la API de Gemini (ver más abajo) |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` (opcional) |
| `CORRESPONDENCIA_POLL_ENABLED` | `false` durante las pruebas ficticias |
| `CORRESPONDENCIA_GEMINI_REAL_ENABLED` | `false` durante las pruebas ficticias |
| `CORRESPONDENCIA_POLL_CRON` | `*/5 * * * *` (opcional) |
| `CORRESPONDENCIA_MAX_POR_CICLO` | `50` (opcional) |

`CORRESPONDENCIA_TOKEN_KEY` cifra los tokens de Google guardados en la base de
datos. Si se cambia, los tokens dejan de poder descifrarse y hay que reconectar
todas las cuentas. Guárdala en un lugar seguro y no la rotes sin motivo.

### Sobre la clave de Gemini

La facturación de la API de Gemini es **independiente** de las suscripciones de consumo. Para la prueba ficticia se puede usar una clave del nivel gratuito obtenida directamente en [Google AI Studio](https://aistudio.google.com/apikey), sujeta a cuota y disponibilidad del modelo. No habilite facturación para esta fase. [Precios y condiciones](https://ai.google.dev/gemini-api/docs/pricing).

Esto no es solo un tema de costo. Los términos del nivel gratuito dicen que
Google puede usar el contenido enviado para mejorar sus productos y que revisores
humanos pueden leerlo, y piden expresamente no enviar información sensible ni
personal. La correspondencia jurídica lleva cédulas, NIT y datos de clientes, así
que **el nivel gratuito no debe usarse con correos reales**. En el nivel de pago
Google no usa los datos para entrenar.

## 5. Conectar las seis cuentas

1. Entra a Validum como **Propietario** o **Administrador** y abre **Correspondencia**.
2. Baja hasta **Cuentas de correo** y pulsa **Conectar cuenta**.
3. Se abre Google en la misma pestaña. **Elige "Usar otra cuenta"** para conectar un
   buzón distinto del que ya tengas abierto en el navegador.
4. Compruebe que la pantalla corresponde al cliente OAuth autorizado; resuelva cualquier advertencia con el administrador.
5. Concede el permiso de lectura. Volverás al panel y la cuenta aparecerá como
   *Conectada*.
6. Repite para cada buzón. La dirección la determina Google, no lo que escribas.

Si conectar varias cuentas se complica porque el navegador entra siempre con la
misma, usa una ventana de incógnito o un perfil distinto de Chrome para cada una.

## 6. Comprobar que funciona

Este apartado requiere una autorización posterior para lectura real. Active explícitamente `CORRESPONDENCIA_POLL_ENABLED=true` solo entonces. Para enviar contenido real al modelo también se exige `CORRESPONDENCIA_GEMINI_REAL_ENABLED=true` y un servicio adecuado para información sensible; con ese segundo interruptor apagado, los correos se guardan para revisión manual.

1. Envía un correo de prueba a uno de los buzones.
2. En **Cuentas de correo**, pulsa **Revisar ahora** sin esperar los 5 minutos.
3. El correo debe aparecer en la lista con su categoría y prioridad.
4. Si algo falla, la cuenta muestra el último error en su propia fila.

---

## Operación diaria

- **Ritmo.** Cada 5 minutos por defecto. Se cambia con `CORRESPONDENCIA_POLL_CRON`.
- **Tope por ciclo.** Como máximo 50 correos por cuenta y ciclo, para que una
  bandeja acumulada no dispare la factura del modelo. Los restantes entran en los
  ciclos siguientes.
- **Sin duplicados.** Cada correo se identifica por cuenta y por su id de Gmail.
  Si un correo ya está guardado, no se vuelve a enviar al modelo.
- **Errores de clasificación.** Si el modelo devuelve algo inservible, el correo
  se guarda igual, marcado con la etiqueta *Error IA*, y puede reprocesarse con
  `POST /api/correspondencia/:id/reclasificar` cuando la IA real esté autorizada y configurada. Si está desactivada, se conserva la clasificación existente.
- **Cuentas con fallos.** Tras 10 fallos seguidos la cuenta se pausa sola para
  dejar de gastar llamadas. Se reanuda desde el panel.
- **Autorización revocada.** Si alguien retira el permiso desde su cuenta de
  Google, la cuenta pasa a *Desconectada* y el panel pide reconectarla.
- **Varias réplicas.** El trabajo repetible usa Redis. Antes de escalar o permitir revisiones manuales simultáneas, valide exclusión entre ciclos; no asuma que los controles manuales quedan serializados por el trabajo repetible.
- **Recuperación.** La primera carga empieza un día antes de la conexión del buzón. Ante historial caducado se recupera desde la última sincronización, con un día de margen. Los lotes parciales conservan el cursor y la ventana hasta agotar pendientes; mensajes borrados de Gmail o anteriores a esa ventana no son recuperables por este mecanismo.

## Privacidad

- Los cuerpos de los correos, los tokens y las claves **nunca** se escriben en los logs.
- Los tokens de Google se guardan cifrados con AES-256-GCM.
- El listado de cuentas no devuelve ningún token, ni siquiera cifrado.
- Solo Propietario y Administrador pueden gestionar cuentas.
- El contenido de cada correo se envía a Google (Gemini) para clasificarlo. Ese
  es el único destino externo de los datos.

## Si algo sale mal

| Síntoma | Causa probable |
| --- | --- |
| `redirect_uri_mismatch` | La URL de redirección en Google no coincide exactamente con `GOOGLE_OAUTH_REDIRECT_URI`. |
| Las cuentas se desconectan cada semana | Compruebe el estado Prueba del consentimiento y las políticas de Google; evalúe publicación/verificación antes de producción. |
| "Google no entregó un token de actualización" | La cuenta ya había autorizado antes. Retira el acceso en <https://myaccount.google.com/permissions> y vuelve a conectarla. |
| El botón *Conectar cuenta* está deshabilitado | Faltan variables de Google o `CORRESPONDENCIA_TOKEN_KEY` tiene menos de 32 caracteres. |
| Los correos entran con *Error IA* | IA real deshabilitada, clave ausente, cuota agotada, modelo no disponible o respuesta inválida. No habilite facturación solo para resolver una prueba ficticia. |
| No entra ningún correo | Revisa que la cuenta esté *Conectada* y usa **Revisar ahora** para ver el error concreto. |

## Alternativa: ingesta externa

El endpoint `POST /api/correspondencia/ingest`, protegido con
`CORRESPONDENCIA_INGEST_API_KEY`, sigue disponible por si alguna vez se quiere
alimentar la correspondencia desde fuera (por ejemplo desde n8n). Los flujos de
n8n quedan documentados en `deploy/n8n/` como respaldo, pero el camino principal
es el que describe esta guía.
