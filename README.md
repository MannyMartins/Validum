# MVP · Formularios EPS por WhatsApp

Base profesional para recibir documentos por WhatsApp Business, clasificarlos, extraer información y enviarlos a revisión para diligenciar formularios EPS. El proyecto vive en `F:\Proyecto Formularios EPS`; los datos de desarrollo se conservan en `data/` dentro de esa carpeta.

## Arquitectura

```text
WhatsApp Business Cloud API → webhook NestJS → caso/documento → MinIO/S3
                                              ↓
                                      Redis + BullMQ (cola)
                                              ↓
                                  OCR/IA intercambiable → revisión
                                              ↓
                                      PostgreSQL + panel Next.js
```

La API (`apps/api`) concentra autenticación JWT, auditoría, casos, documentos, cola y webhook. El panel (`apps/dashboard`) es el inicio del área operativa. Cada documento tiene trazabilidad y no se almacena directamente en PostgreSQL: allí quedan sus metadatos y resultados; el binario se guarda en S3/MinIO.

## Integraciones necesarias

| Integración | Uso | Qué debe aportar el usuario |
| --- | --- | --- |
| Meta WhatsApp Business Cloud API | Recibir mensajes y archivos, responder al usuario | Cuenta Meta Business verificada, aplicación Meta, número de prueba/producción, `PHONE_NUMBER_ID`, token de usuario del sistema, secreto de app y URL HTTPS pública para el webhook. |
| PostgreSQL | Casos, contactos, documentos, usuarios y auditoría | En producción: URL de una base PostgreSQL administrada y política de copias de seguridad. Localmente se incluye en Docker. |
| Redis | Procesamiento en segundo plano con BullMQ | URL Redis gestionada en producción. Localmente se incluye en Docker. |
| S3 compatible | PDFs, fotos y archivos originales | Bucket privado, endpoint, región, clave de acceso y clave secreta. Puede ser AWS S3, Cloudflare R2, Wasabi o MinIO. |
| OCR/IA | Extraer texto, identificar datos y clasificar documentos | Elegir proveedor: OpenAI, Google Vision, Azure Document Intelligence o uno propio; proporcionar su credencial. El MVP comienza con adaptador `mock`, sin enviar información a terceros. |
| Hosting HTTPS | Exponer API y webhook para Meta | Dominio y despliegue (por ejemplo, Render, Railway, AWS, Azure o servidor propio). |

No introduzcas credenciales en el código ni las subas al repositorio. Copia `.env.example` a `.env` y completa únicamente los valores correspondientes.

## Puesta en marcha local

1. Instala Node.js 22 LTS, pnpm 9 y Docker Desktop.
2. Desde `F:\Proyecto Formularios EPS`, crea el archivo de configuración:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Instala las dependencias y enciende los servicios locales:

   ```powershell
   pnpm install
   docker compose up -d
   ```

4. Crea la estructura de base de datos y el usuario administrador (antes cambia `ADMIN_PASSWORD`):

   ```powershell
   pnpm db:generate
   pnpm db:migrate -- --name initial
   pnpm --filter @mvp/api prisma:seed
   ```

5. Inicia API y panel:

   ```powershell
   pnpm dev
   ```

API: `http://localhost:3001/api` · panel: `http://localhost:3000` · consola de archivos MinIO: `http://localhost:9001`.

Los datos locales se escriben bajo `data/postgres`, `data/redis` y `data/minio`. No se versionan. Para producción deben sustituirse por servicios gestionados o discos persistentes con copias de seguridad.

## Configurar WhatsApp Cloud API

1. En Meta for Developers crea una app de tipo Business y agrega WhatsApp.
2. Configura como callback `https://TU-DOMINIO/api/webhooks/whatsapp` y usa el mismo valor privado en `WHATSAPP_VERIFY_TOKEN`.
3. Suscribe el campo `messages` y completa en `.env` `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_APP_SECRET`.
4. La API valida la firma `X-Hub-Signature-256`; en producción `WHATSAPP_APP_SECRET` es obligatorio. Aún falta implementar la descarga autenticada de medios de Meta antes de procesar adjuntos reales.

## Estado del MVP y siguiente etapa

Incluido: esquema inicial, inicio de sesión JWT, registro de auditoría, webhook verificable, modelo de casos y contactos, documentos con almacenamiento privado, cola BullMQ, contrato OCR/IA intercambiable y panel inicial.

La siguiente implementación debe incorporar los formularios concretos de cada EPS: catálogo de EPS, plantillas PDF/HTML, mapeo validado de campos, descarga segura de medios de Meta, proveedor OCR elegido y pantalla de revisión/aprobación. Para diseñarlo bien se necesitan formularios de muestra anonimizados y las reglas de negocio de cada EPS.
