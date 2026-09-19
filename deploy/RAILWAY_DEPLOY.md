# Despliegue seguro de Validum en Railway

## Arquitectura

- **Validum Web**: interfaz React servida por Nginx.
- **API**: NestJS. Es la única capa autorizada para acceder a datos privados.
- **PostgreSQL**: datos estructurados; nunca se expone directamente al navegador.
- **Redis**: colas de procesamiento de documentos y WhatsApp.
- **Object Storage compatible con S3**: PDFs, firmas e imágenes. PostgreSQL conserva únicamente sus metadatos y claves privadas.

El navegador nunca se conecta directamente a PostgreSQL. Toda autenticación, autorización, lectura y escritura pasa por el API de Validum.

## 1. PostgreSQL

1. En el proyecto de Railway selecciona **New > Database > Add PostgreSQL**.
2. No habilites acceso público salvo durante una tarea administrativa puntual.
3. El servicio API debe recibir `DATABASE_URL` mediante una referencia a `${{Postgres.DATABASE_URL}}`.
4. No ejecutes scripts SQL manuales para crear el esquema. El contenedor del API ejecuta `prisma migrate deploy` al iniciar y aplica solamente las migraciones pendientes.

Para crear el primer administrador, configura temporalmente `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 12 caracteres) en el servicio API. Al arrancar, el contenedor crea la cuenta de forma idempotente. Comprueba que puedes iniciar sesión y elimina después esas tres variables de Railway. No existen usuarios ni contraseñas predeterminados en el repositorio.

## 2. Redis

1. Añade un servicio Redis en Railway.
2. Asigna al API `REDIS_URL=${{Redis.REDIS_URL}}`.

El API no usa una dirección local como reemplazo en producción: sin Redis las colas no son confiables y el arranque se detiene con un mensaje explícito.

## 3. Almacenamiento privado

Configura un bucket privado compatible con S3 (Railway Buckets, Cloudflare R2, AWS S3 o equivalente) y añade al API:

```text
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
S3_CREATE_BUCKET=false
```

No guardes PDFs ni firmas como Base64 dentro de PostgreSQL. El API conserva claves privadas y entrega el contenido únicamente a usuarios autenticados de la misma organización.

## 4. API

Crea un servicio desde este repositorio con:

```text
RAILWAY_DOCKERFILE_PATH=/deploy/api.Dockerfile
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<secreto aleatorio de al menos 32 caracteres>
JWT_EXPIRES_IN_SECONDS=28800
CORRESPONDENCIA_INGEST_API_KEY=<secreto aleatorio largo compartido solo con n8n>
DASHBOARD_ORIGIN=https://<dominio-validum>
APP_URL=https://<dominio-validum>
ADMIN_NAME=<nombre del primer administrador; temporal>
ADMIN_EMAIL=<correo del primer administrador; temporal>
ADMIN_PASSWORD=<clave de al menos 12 caracteres; temporal>
```

Genera un dominio público y verifica:

```text
https://<dominio-api>/api/health
```

Nunca uses el ejemplo de esta guía como `JWT_SECRET`. Genera un valor único con un gestor de contraseñas o un generador criptográfico.

`CORRESPONDENCIA_INGEST_API_KEY` pertenece únicamente al servicio API. Copia su valor en la credencial de n8n que envía `X-API-Key`; no lo expongas como variable `VITE_*`. Si falta, la API seguirá iniciando, pero rechazará toda ingesta de correspondencia.

## 5. Validum Web

Crea otro servicio desde el mismo repositorio:

```text
RAILWAY_DOCKERFILE_PATH=/deploy/validum.Dockerfile
VITE_API_URL=https://<dominio-api>/api
```

Después de generar el dominio de Validum, coloca ese origen HTTPS exacto en `DASHBOARD_ORIGIN` del API y vuelve a desplegarlo.

## 6. Pruebas obligatorias antes de producción

- inicio y cierre de sesión;
- recuperación e invitación de usuarios;
- aislamiento por organización;
- alta, edición y consulta de empresas, cotizantes y beneficiarios;
- carga, edición y persistencia de plantillas;
- carga y descarga privada de PDFs, firmas y soportes;
- generación de formularios y auditoría.

## 7. Integraciones opcionales

El API principal puede arrancar sin correo ni WhatsApp. Para habilitarlos añade después:

```text
RESEND_API_KEY=<clave privada de Resend>
EMAIL_FROM=Validum <no-reply@su-dominio.com>
WHATSAPP_VERIFY_TOKEN=<token de verificacion elegido por la empresa>
WHATSAPP_ACCESS_TOKEN=<token de sistema de Meta>
WHATSAPP_PHONE_NUMBER_ID=<id del numero en Meta>
WHATSAPP_APP_SECRET=<secreto de la aplicacion de Meta>
```

Sin Resend, las invitaciones y recuperaciones responden con un error claro y no aparentan haber enviado correo. Sin las credenciales de Meta, el webhook de WhatsApp permanece bloqueado. Las invitaciones y recuperaciones usan enlaces de un solo uso emitidos por el API; configura y verifica el dominio remitente en Resend antes de probar esos flujos.
