# Despliegue de revisión interna

La versión de revisión levanta Validum en el puerto `8080` y la API en el puerto `3001`, junto con PostgreSQL, Redis y MinIO. No incluye todavía un dominio público ni las credenciales de Meta.

## Antes de iniciar

1. Copia `.env.example` a `.env` y cambia `JWT_SECRET` y las contraseñas locales.
2. Para la primera inicialización de la base, levanta los servicios y ejecuta `pnpm db:migrate -- --name initial` desde el equipo anfitrión.
3. No publiques `.env`, `data/` ni documentos reales en un repositorio.

## Levantar la revisión

Desde la raíz del proyecto:

```powershell
docker compose -f deploy/docker-compose.review.yml up --build
```

Abre `http://localhost:8080` para Validum. La API se atiende en `http://localhost:3001/api`.

## Activar WhatsApp posteriormente

Se requiere un dominio HTTPS que apunte a la API. El callback de Meta será `https://TU-DOMINIO/api/webhooks/whatsapp`. Completa las variables `WHATSAPP_*` en `.env` y nunca las incluyas en código fuente.
