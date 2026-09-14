# Guía de Despliegue en Railway

Esta guía explica paso a paso cómo desplegar el proyecto en **[Railway](https://railway.app)**.

> **Arquitectura actual:** Validum usa Supabase como backend principal (Auth, PostgreSQL, Storage y Edge Functions). La API NestJS y el dashboard forman un subsistema independiente para WhatsApp, colas y OCR, con PostgreSQL/Redis/S3 propios en Railway. Sus datos no se sincronizan automáticamente con Supabase.

---

## 🚀 Despliegue de Validum (Frontend Principal con Supabase)

Validum es la aplicación web (React + Vite + Tailwind) conectada directamente a Supabase Cloud (Auth, Base de datos, Storage y Edge Functions).

### Paso 1: Crear el proyecto en Railway
1. Ingresa a [railway.app](https://railway.app) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **"New Project"** (Nuevo Proyecto).
3. Selecciona **"Deploy from GitHub repo"** y elige este repositorio (`Proyecto Formularios EPS` o el nombre con el que esté en GitHub).

### Paso 2: Configurar el servicio para usar el Dockerfile
1. Una vez añadido el repositorio, haz clic sobre la tarjeta del servicio creado y ve a la pestaña **Settings**.
2. En la sección **Build**:
   - **Builder**: Cambia a `Dockerfile` (si no está seleccionado).
   - Agrega esta variable de configuración del servicio:
     ```text
     RAILWAY_DOCKERFILE_PATH=/deploy/validum.Dockerfile
     ```
   - **Root Directory**: Déjalo en `/` (raíz del repositorio).

### Paso 3: Configurar Variables de Entorno (Pestaña "Variables")
Agrega las siguientes variables en la pestaña **Variables**:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://guygyibcouicbziphswc.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | La clave pública/publishable activa del proyecto Supabase |

Estas variables se incorporan al cliente durante la compilación. Si cambian, realiza un nuevo despliegue; reiniciar el contenedor no recompila la aplicación. Nunca uses aquí una clave `service_role`.

### Paso 4: Generar Dominio Público (Pestaña "Networking")
1. Ve a la pestaña **Settings** > sección **Networking**.
2. Haz clic en **"Generate Domain"**.
3. Railway te asignará una URL pública segura con HTTPS, por ejemplo:
   `https://validum-production-xxxx.up.railway.app`
4. No fijes manualmente el puerto: Nginx escucha el valor dinámico `PORT` suministrado por Railway.

### Paso 5: Actualizar Supabase con tu nuevo dominio
Para que el inicio de sesión, invitaciones y redirecciones funcionen:
1. Entra a tu panel de [Supabase](https://supabase.com/dashboard/project/guygyibcouicbziphswc).
2. Ve a **Authentication** > **URL Configuration**.
3. En **Site URL**, coloca tu dominio de Railway:
   ```text
   https://tu-servicio.up.railway.app
   ```
4. En **Redirect URLs**, agrega:
   ```text
   https://tu-servicio.up.railway.app/**
   ```
5. Guarda los cambios. ¡Validum ya está completamente desplegado y funcional!

---

## 🛠️ Despliegue de la API Backend (NestJS) en Railway *(Opcional)*

Si además deseas desplegar la API NestJS (`apps/api`) con colas y base de datos propia:

### Paso 1: Agregar PostgreSQL y Redis en Railway
Dentro del mismo proyecto en Railway:
1. Haz clic en **"+ New"** > **Database** > **PostgreSQL**.
2. Haz clic en **"+ New"** > **Database** > **Redis**.
Railway creará ambas bases de datos gestionadas de forma instantánea.

### Paso 2: Crear el servicio para la API
1. Haz clic en **"+ New"** > **GitHub Repo** y selecciona de nuevo este repositorio.
2. En la tarjeta del nuevo servicio, ve a **Settings**:
   - **Service Name**: Renómbralo a `api`.
   - Agrega `RAILWAY_DOCKERFILE_PATH=/deploy/api.Dockerfile` en las variables del servicio.
   - **Root Directory**: Déjalo en `/`.

### Paso 3: Configurar Variables de la API
En la pestaña **Variables** del servicio `api`:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` *(Seleccionar del desplegable de Railway)* |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` *(Seleccionar del desplegable de Railway)* |
| `JWT_SECRET` | Genera una cadena aleatoria segura de 32+ caracteres |
| `JWT_EXPIRES_IN_SECONDS` | `28800` |
| `DASHBOARD_ORIGIN` | Dominio HTTPS público del panel, sin ruta final |
| `S3_ENDPOINT` | Endpoint del proveedor S3; puede omitirse con AWS S3 estándar |
| `S3_REGION` | Región del bucket privado |
| `S3_BUCKET` | Nombre del bucket privado |
| `S3_ACCESS_KEY_ID` | Clave del bucket S3 |
| `S3_SECRET_ACCESS_KEY` | Secreto del bucket S3 |
| `S3_FORCE_PATH_STYLE` | `false`, o `true` si tu proveedor lo exige |
| `S3_CREATE_BUCKET` | `false`; crea previamente un bucket privado en el proveedor |
| `WHATSAPP_VERIFY_TOKEN` | Token privado elegido para validar el webhook |
| `WHATSAPP_ACCESS_TOKEN` | Token de usuario del sistema de Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | Identificador del número de WhatsApp |
| `WHATSAPP_APP_SECRET` | Secreto de la aplicación de Meta |
| `WHATSAPP_API_VERSION` | `v22.0` o la versión vigente que hayas validado |
| `NODE_ENV` | `production` |

Sella en Railway `JWT_SECRET`, las claves S3 y los secretos/tokens de WhatsApp. La API se negará a iniciar en producción si falta una configuración crítica, evitando un despliegue aparentemente sano pero inseguro.

### Paso 4: Migraciones automáticas de Base de Datos
El contenedor de la API (`deploy/api.Dockerfile`) ya está configurado para ejecutar automáticamente las migraciones de Prisma en cada inicio antes de arrancar NestJS. No necesitas ejecutar comandos manuales en la consola de Railway.

### Paso 5: Crear el primer usuario del panel
Configura temporalmente `ADMIN_EMAIL` y `ADMIN_PASSWORD` en la API y ejecuta una sola vez en la consola del servicio:

```text
node apps/api/dist/prisma/seed.js
```

Después elimina `ADMIN_PASSWORD` de las variables. Este usuario pertenece al panel NestJS y es independiente del usuario de Supabase utilizado por Validum.

---

## 🖥️ Despliegue del Dashboard Next.js *(Opcional)*

Si deseas desplegar el panel operativo Next.js (`apps/dashboard`):

1. En el mismo proyecto de Railway: haz clic en **"+ New"** > **GitHub Repo**.
2. En **Settings**:
   - **Service Name**: `dashboard`
   - Agrega `RAILWAY_DOCKERFILE_PATH=/deploy/dashboard.Dockerfile` en las variables del servicio.
   - **Root Directory**: `/`
3. En **Variables**:
   - `NEXT_PUBLIC_API_URL`: La URL pública de tu servicio `api` (ej: `https://api-production-xxxx.up.railway.app/api`).
4. En **Networking**: Genera el dominio público.

---

## 🔍 Verificación Post-Despliegue

| Servicio | URL de Verificación | Respuesta Esperada |
|---|---|---|
| **Validum** | `https://tu-validum.up.railway.app/health.json` | `{"application":"validum","status":"ok"}` |
| **API** | `https://tu-api.up.railway.app/api/health` | `{"status":"ok","service":"api",...}` |
| **API Raíz** | `https://tu-api.up.railway.app/api` | `{"application":"whatsapp-document-automation-api","status":"running"}` |

### Checklist de Validación:
1. **Validum**:
   - Iniciar sesión con tu cuenta de Supabase.
   - Abrir la biblioteca de plantillas y abrir el editor con Sura / SOS / Sanitas.
   - Generar y descargar un PDF diligenciado.
2. **API**:
   - Al abrir `/api/health` responde con código 200 y status `ok`.
   - Si creaste las bases de datos PostgreSQL y Redis, los registros de log en Railway muestran `Nest application successfully started`.
3. **Panel**:
   - Inicia sesión con el usuario creado mediante el seed.
   - Comprueba que la tabla carga casos sin respuestas `401` en la consola del navegador.
