# Despliegue seguro de Validum en Railway

## Arquitectura

- **Validum Web**: interfaz React servida por Nginx.
- **API**: NestJS. Es la única capa autorizada para acceder a datos privados.
- **PostgreSQL**: datos estructurados; nunca se expone directamente al navegador.
- **Redis**: colas de procesamiento de documentos y WhatsApp.
- **Object Storage compatible con S3**: PDFs, firmas e imágenes. PostgreSQL conserva únicamente sus metadatos y claves privadas.

> Importante: Railway PostgreSQL sustituye la base de datos de Supabase, pero no sustituye automáticamente Supabase Auth, Storage ni su API REST. Antes de retirar Supabase del entorno de producción, la interfaz debe consumir los endpoints equivalentes del API de Validum.

## 1. PostgreSQL

1. En el proyecto de Railway selecciona **New > Database > Add PostgreSQL**.
2. No habilites acceso público salvo durante una tarea administrativa puntual.
3. El servicio API debe recibir `DATABASE_URL` mediante una referencia a `${{Postgres.DATABASE_URL}}`.
4. No ejecutes scripts SQL manuales para crear el esquema. El contenedor del API ejecuta `prisma migrate deploy` al iniciar y aplica solamente las migraciones pendientes.

Para crear el primer administrador, configura temporalmente `ADMIN_EMAIL` y `ADMIN_PASSWORD` y ejecuta el seed de Prisma desde un entorno administrativo. No existen usuarios ni contraseñas predeterminados en el repositorio.

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

No guardes PDFs ni firmas como Base64 dentro de PostgreSQL. El API genera enlaces de lectura de corta duración (15 minutos).

## 4. API

Crea un servicio desde este repositorio con:

```text
RAILWAY_DOCKERFILE_PATH=/deploy/api.Dockerfile
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<secreto aleatorio de al menos 32 caracteres>
JWT_EXPIRES_IN_SECONDS=28800
DASHBOARD_ORIGIN=https://<dominio-validum>
```

Añade también las variables S3 anteriores y las credenciales reales de WhatsApp descritas en `apps/api/.env.example`. Genera un dominio público y verifica:

```text
https://<dominio-api>/api/health
```

Nunca uses el ejemplo de esta guía como `JWT_SECRET`. Genera un valor único con un gestor de contraseñas o un generador criptográfico.

## 5. Validum Web

Crea otro servicio desde el mismo repositorio:

```text
RAILWAY_DOCKERFILE_PATH=/deploy/validum.Dockerfile
VITE_API_URL=https://<dominio-api>/api
```

Después de generar el dominio de Validum, coloca ese origen HTTPS exacto en `DASHBOARD_ORIGIN` del API y vuelve a desplegarlo.

## 6. Estado de la migración desde Supabase

El esquema PostgreSQL y el API base están preparados, pero el frontend actual todavía contiene llamadas de Supabase para autenticación, equipos, plantillas y archivos. Por seguridad no se debe eliminar Supabase de producción hasta sustituir esas llamadas por endpoints NestJS y completar estas pruebas:

- inicio y cierre de sesión;
- recuperación e invitación de usuarios;
- aislamiento por organización;
- alta, edición y consulta de empresas, cotizantes y beneficiarios;
- carga, edición y persistencia de plantillas;
- carga y descarga privada de PDFs, firmas y soportes;
- generación de formularios y auditoría.

Configurar solamente `VITE_API_URL` no migra esos datos. Esta comprobación evita publicar una interfaz que parezca funcionar mientras conserva información únicamente en IndexedDB del navegador.
