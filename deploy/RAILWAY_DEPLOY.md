# Guía de Despliegue en Railway y Administración con PostgreSQL

Esta guía explica paso a paso cómo desplegar la plataforma completa en **[Railway](https://railway.app)** utilizando **PostgreSQL** como la base de datos central y cómo administrarla directamente mediante consultas **SQL**.

---

## 🏛️ Arquitectura de la Base de Datos (PostgreSQL en Railway)

Toda la información del sistema (usuarios, empresas, afiliados, beneficiarios, novedades, planillas PILA, documentos soporte, sellos de radicación, plantillas de formularios y casos) está unificada en **PostgreSQL**.

### Características clave:
1. **Acceso Directo con SQL**: Puedes consultar, insertar, modificar o exportar cualquier dato usando la pestaña **Data** o **Query** de Railway, o mediante clientes SQL de escritorio (DBeaver, TablePlus, pgAdmin, DataGrip, VSCode SQLTools).
2. **Migraciones Automáticas**: La API (`apps/api`) ejecuta automáticamente `prisma migrate deploy` en Railway al iniciar, garantizando que el esquema de PostgreSQL siempre esté al día.
3. **Script SQL Maestro**: Incluido en [`deploy/railway_database_init.sql`](file:///f:/Proyecto%20Formularios%20EPS/deploy/railway_database_init.sql) para inicializar toda la base de datos de manera idempotente con un solo clic.

---

## 🗄️ Paso 1: Crear la Base de Datos PostgreSQL en Railway

1. Entra a tu proyecto en [Railway](https://railway.app).
2. Haz clic en el botón **"+ New"** (o presiona `Cmd+K` / `Ctrl+K`).
3. Selecciona **Database** > **Add PostgreSQL**.
4. Railway creará instantáneamente un contenedor gestionado de PostgreSQL.
5. Haz clic sobre la tarjeta de **Postgres**:
   - En la pestaña **Variables**, verás:
     - `DATABASE_URL` (conexión interna privada)
     - `DATABASE_PUBLIC_URL` (conexión pública para conectarte desde tu computador)
     - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.

---

## 💻 Paso 2: Inicializar la Base de Datos con SQL (Opcional si usas el API)

Si deseas precargar todas las tablas e insertar los datos iniciales (administrador por defecto y empresa base) de inmediato:

1. En Railway, haz clic sobre el servicio **Postgres**.
2. Ve a la pestaña **Data** o **Query**.
3. Abre el archivo [`deploy/railway_database_init.sql`](file:///f:/Proyecto%20Formularios%20EPS/deploy/railway_database_init.sql) de este repositorio.
4. Copia todo su contenido y pégalo en el editor de consultas **Query** de Railway.
5. Haz clic en **Run Query**.
6. ¡Listo! Todas las tablas, índices, enums y datos iniciales quedan creados en segundos.

---

## 🔌 Paso 3: Administrar la Base de Datos con SQL de Escritorio

Puedes conectarte desde cualquier cliente SQL (como **DBeaver**, **TablePlus** o **pgAdmin**):

1. En el servicio **Postgres** de Railway, ve a **Settings** > **Networking** y activa **Public Networking**.
2. Copia la URL que aparece en `DATABASE_PUBLIC_URL`.
3. Abre tu cliente SQL (por ejemplo, TablePlus o DBeaver) y selecciona **"New Connection from URL"**.
4. Pega la URL y conéctate.

### Consultas SQL más comunes para administración:

```sql
-- 1. Ver todas las empresas registradas
SELECT "id", "legalName", "documentType", "documentNumber", "email", "phone"
FROM "Company"
ORDER BY "createdAt" DESC;

-- 2. Ver todos los empleados / cotizantes con su empresa
SELECT e."firstName", e."firstSurname", e."documentNumber", e."epsName", c."legalName" as "empresa"
FROM "Employee" e
LEFT JOIN "Company" c ON e."companyId" = c."id";

-- 3. Ver beneficiarios por empleado
SELECT b."firstName", b."firstSurname", b."relationship", b."documentNumber", e."firstName" as "cotizante"
FROM "Beneficiary" b
JOIN "Employee" e ON b."employeeId" = e."id";

-- 4. Ver documentos soporte subidos
SELECT "id", "nombre", "categoria", "tipo_archivo", "tamano_bytes", "created_at"
FROM "soporte_documentos"
ORDER BY "created_at" DESC;

-- 5. Ver usuarios del sistema
SELECT "id", "email", "role", "createdAt"
FROM "User";

-- 6. Ver plantillas activas de formularios EPS/ARL
SELECT "name", "entityName", "entityType", "applicationType", "version", "active"
FROM "FormTemplate";
```

---

## 🚀 Paso 4: Despliegue de la API Backend (`apps/api`)

La API NestJS conecta la aplicación con PostgreSQL y procesa formularios y documentos.

1. En el mismo proyecto de Railway, haz clic en **"+ New"** > **GitHub Repo** y selecciona este repositorio.
2. En la tarjeta del nuevo servicio:
   - **Settings** > **Service Name**: cámbialo a `api`.
   - **Settings** > **Build**:
     - Agrega variable de entorno: `RAILWAY_DOCKERFILE_PATH=/deploy/api.Dockerfile`
     - **Root Directory**: `/`
3. En la pestaña **Variables**:
   - `DATABASE_URL`: Vincula la variable de PostgreSQL: selecciona **Add Reference** y elige `${{Postgres.DATABASE_URL}}`.
   - `REDIS_URL`: Si agregaste Redis en Railway, vincula `${{Redis.REDIS_URL}}`. Si no, la API usará el fallback automático.
   - `JWT_SECRET`: Ingresa una clave secreta segura (ej: `validum-production-super-secure-jwt-key-2026-eps-forms`).
   - `NODE_ENV`: `production`
4. En **Settings** > **Networking**: Haz clic en **"Generate Domain"** para obtener la URL pública de la API (ej: `https://api-production-xxxx.up.railway.app`).

Al iniciar, el contenedor ejecutará automáticamente `prisma migrate deploy` asegurando que PostgreSQL tenga todas las tablas sincronizadas.

---

## 🌐 Paso 5: Despliegue de Validum (`apps/validum`)

1. En Railway, haz clic en **"+ New"** > **GitHub Repo** y selecciona este repositorio.
2. En la tarjeta del servicio:
   - **Settings** > **Service Name**: nómbralo `validum`.
   - **Settings** > **Build**:
     - Agrega variable: `RAILWAY_DOCKERFILE_PATH=/deploy/validum.Dockerfile`
     - **Root Directory**: `/`
3. En la pestaña **Variables**:
   - `VITE_API_URL`: La URL pública de tu API (ej: `https://api-production-xxxx.up.railway.app/api`).
4. En **Settings** > **Networking**: Haz clic en **"Generate Domain"**.
5. ¡Validum estará disponible de inmediato en su dominio público HTTPS!

---

## 📊 Paso 6: Despliegue del Dashboard Operativo (`apps/dashboard`) (Opcional)

1. En Railway: **"+ New"** > **GitHub Repo**.
2. **Settings**:
   - **Service Name**: `dashboard`
   - Agrega `RAILWAY_DOCKERFILE_PATH=/deploy/dashboard.Dockerfile`
   - **Root Directory**: `/`
3. **Variables**:
   - `NEXT_PUBLIC_API_URL`: `https://api-production-xxxx.up.railway.app/api`
4. **Networking**: Haz clic en **"Generate Domain"**.

---

## ✅ Resumen de URLs y Verificación

| Componente | Tipo | URL de Verificación |
|---|---|---|
| **PostgreSQL** | Base de Datos | Administrable vía pestaña **Data/Query** en Railway o clientes SQL |
| **API Backend** | Servicio Web | `https://tu-api.up.railway.app/api/health` |
| **Validum** | Web App | `https://tu-validum.up.railway.app/health.json` |
| **Dashboard** | Panel Operativo | `https://tu-dashboard.up.railway.app` |
