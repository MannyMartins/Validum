# Entrega de Validum para hosting

Este procedimiento publica la aplicación web. La base de datos, autenticación,
plantillas y documentos continúan protegidos en Supabase.

## Datos que debe entregar el proveedor del hosting

- Dominio o subdominio definitivo (recomendado: `app.validum.com.co`).
- Panel utilizado: cPanel, Plesk, VPS u otro.
- Servidor web: Apache o Nginx.
- Confirmación de certificado HTTPS y renovación automática.
- Acceso SFTP o usuario del panel para cargar archivos.
- Si compilará el proyecto: Node.js 22 y pnpm 9.

Validum debe publicarse en la raíz de un dominio o subdominio dedicado. No se
admite inicialmente una ruta como `empresa.com/validum`.

## Opción A — cPanel/Plesk sin Node.js

1. Copiar `apps/validum/.env.production.example` como
   `apps/validum/.env.production`.
2. Sustituir únicamente `VITE_SUPABASE_PUBLISHABLE_KEY` por la clave pública.
   Nunca colocar una `service_role` en un archivo de Vite.
3. Ejecutar desde la raíz en Windows:

   ```powershell
   powershell -ExecutionPolicy Bypass -File deploy/build-validum-hosting.ps1
   ```

4. Entregar `output/validum-hosting.zip`.
5. Extraer **el contenido** del ZIP en `public_html` (no la carpeta contenedora).
6. Confirmar que `https://DOMINIO/health.json` responde con `status: ok`.

El paquete contiene `.htaccess` para Apache. Si el panel oculta archivos cuyo
nombre comienza por punto, hay que activar "Mostrar archivos ocultos".

## Opción B — VPS con Docker

Construir la imagen pasando las dos variables públicas durante el build:

```bash
docker build \
  --file deploy/validum.Dockerfile \
  --build-arg VITE_SUPABASE_URL=https://guygyibcouicbziphswc.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLICA \
  --tag validum-web:1.0.0 .
```

El contenedor sirve HTTP en el puerto 80. El proxy del proveedor debe terminar
HTTPS y reenviar hacia ese puerto. La configuración Nginx incluida soporta SPA,
compresión, caché y cabeceras defensivas.

## Configuración posterior en Supabase

Cuando el dominio responda correctamente:

1. En Authentication > URL Configuration:
   - Site URL: `https://DOMINIO`
   - Redirect URL: `https://DOMINIO/**`
   - Conservar `http://localhost:3000/**` solo para desarrollo.
2. Configurar en las Edge Functions:

   ```bash
   supabase secrets set VALIDUM_APP_URL=https://DOMINIO
   ```

3. Configurar SMTP corporativo y comprobar invitación, recuperación de
   contraseña y acceso desde un segundo computador.

## Prueba de aceptación

- `https://DOMINIO/health.json` responde correctamente.
- El navegador muestra HTTPS sin advertencias.
- Un administrador puede iniciar sesión.
- Una invitación nueva dirige al dominio público y permite crear contraseña.
- Se abren las plantillas SOS y Sura con el PDF de fondo.
- Se genera, descarga y vuelve a abrir un PDF.
- Un operador no puede consultar datos de otra organización.
- Cerrar sesión impide regresar con el botón Atrás.

## Prohibido entregar o publicar

- `.env`, `.env.local` o `.env.production`.
- `SUPABASE_SERVICE_ROLE_KEY` o credenciales SMTP.
- Carpetas `node_modules`, `data`, `tmp`, `work` u `outputs`.
- Expedientes, documentos o PDF generados de clientes reales.

