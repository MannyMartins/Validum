# Conectar buzones de Gmail a Validum

Validum lee por su cuenta los buzones de Gmail que se le conecten, clasifica cada
correo con Gemini y lo guarda en el módulo de Correspondencia. No hace falta n8n
ni ningún servicio adicional en Railway: el trabajo lo hace la propia API, que ya
está corriendo.

Esta guía cubre lo que hay que hacer una sola vez en Google Cloud y en Railway.

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
5. **Publica la aplicación** ("Publicar aplicación" → estado *En producción*).

> **Este paso es el más importante de toda la guía.** Si la aplicación se queda
> en estado *Prueba*, Google caduca las autorizaciones a los 7 días y las cuentas
> se desconectan solas cada semana. Al publicarla, esa caducidad desaparece
> aunque Google todavía no haya verificado la aplicación.

Como la aplicación no está verificada, al autorizar cada cuenta aparecerá una
pantalla de advertencia. Hay que entrar en **Configuración avanzada → Ir a
(nombre de la app)**. Es normal y solo ocurre una vez por cuenta. El límite de
100 usuarios de las aplicaciones sin verificar no afecta a un puñado de buzones.

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
| `GEMINI_MODEL` | `gemini-flash-lite-latest` (opcional) |
| `CORRESPONDENCIA_POLL_CRON` | `*/5 * * * *` (opcional) |
| `CORRESPONDENCIA_MAX_POR_CICLO` | `50` (opcional) |

`CORRESPONDENCIA_TOKEN_KEY` cifra los tokens de Google guardados en la base de
datos. Si se cambia, los tokens dejan de poder descifrarse y hay que reconectar
todas las cuentas. Guárdala en un lugar seguro y no la rotes sin motivo.

### Sobre la clave de Gemini

La facturación de la API de Gemini es **independiente** de cualquier suscripción
de Gemini o Google AI Pro: esas suscripciones solo aplican dentro de la interfaz
web de AI Studio. Para que la API funcione desde Validum hace falta una clave con
facturación de Cloud habilitada, que se crea en <https://aistudio.google.com/apikey>.

Esto no es solo un tema de costo. Los términos del nivel gratuito dicen que
Google puede usar el contenido enviado para mejorar sus productos y que revisores
humanos pueden leerlo, y piden expresamente no enviar información sensible ni
personal. La correspondencia jurídica lleva cédulas, NIT y datos de clientes, así
que **el nivel gratuito no debe usarse con correos reales**. En el nivel de pago
Google no usa los datos para entrenar.

## 5. Conectar las seis cuentas

1. Entra a Validum como **Propietario** o **Administrador** y abre **Correspondencia**.
2. Baja hasta **Cuentas de correo** y pulsa **Conectar cuenta**.
3. Se abre Google en otra pestaña. **Elige "Usar otra cuenta"** para conectar un
   buzón distinto del que ya tengas abierto en el navegador.
4. Acepta la advertencia de aplicación no verificada por **Configuración avanzada**.
5. Concede el permiso de lectura. Volverás al panel y la cuenta aparecerá como
   *Conectada*.
6. Repite para cada buzón. La dirección la determina Google, no lo que escribas.

Si conectar varias cuentas se complica porque el navegador entra siempre con la
misma, usa una ventana de incógnito o un perfil distinto de Chrome para cada una.

## 6. Comprobar que funciona

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
  `POST /api/correspondencia/:id/reclasificar`. Ningún correo se pierde.
- **Cuentas con fallos.** Tras 10 fallos seguidos la cuenta se pausa sola para
  dejar de gastar llamadas. Se reanuda desde el panel.
- **Autorización revocada.** Si alguien retira el permiso desde su cuenta de
  Google, la cuenta pasa a *Desconectada* y el panel pide reconectarla.
- **Varias réplicas.** El ciclo se programa como trabajo repetible en Redis, así
  que aunque la API escale a varias instancias solo una ejecuta cada ciclo.

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
| Las cuentas se desconectan cada semana | La pantalla de consentimiento quedó en estado *Prueba*. Publícala en producción. |
| "Google no entregó un token de actualización" | La cuenta ya había autorizado antes. Retira el acceso en <https://myaccount.google.com/permissions> y vuelve a conectarla. |
| El botón *Conectar cuenta* está deshabilitado | Faltan variables de Google o `CORRESPONDENCIA_TOKEN_KEY` tiene menos de 32 caracteres. |
| Los correos entran con *Error IA* | Falta `GEMINI_API_KEY`, o la clave no tiene facturación habilitada. |
| No entra ningún correo | Revisa que la cuenta esté *Conectada* y usa **Revisar ahora** para ver el error concreto. |

## Alternativa: ingesta externa

El endpoint `POST /api/correspondencia/ingest`, protegido con
`CORRESPONDENCIA_INGEST_API_KEY`, sigue disponible por si alguna vez se quiere
alimentar la correspondencia desde fuera (por ejemplo desde n8n). Los flujos de
n8n quedan documentados en `deploy/n8n/` como respaldo, pero el camino principal
es el que describe esta guía.
