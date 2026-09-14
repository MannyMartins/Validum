# Configuración de Supabase para Validum

La definición completa y ejecutable está en
`supabase/migrations/20260912_core_backend.sql`. El archivo crea el modelo
multiempresa, las relaciones, los índices, los buckets privados y todas las
políticas RLS.

## Puesta en marcha

1. En Supabase, abrir **SQL Editor**, crear una consulta y ejecutar completo
   `20260912_core_backend.sql`.
2. En **Authentication > Users**, crear o invitar el primer usuario.
3. Copiar `.env.example` como `.env.local` y pegar la **publishable key** del
   proyecto. La variable anterior `VITE_SUPABASE_ANON_KEY` sigue admitida por
   compatibilidad. No usar nunca la `service_role` en React.
4. Reiniciar Vite. Al iniciar sesión por primera vez, la función segura
   `create_organization_with_owner` crea la organización y asigna al usuario
   como propietario.

## Modelo

- `profiles`: perfil ligado a `auth.users`.
- `organizations`: tenant que aísla los datos de cada cliente de Validum.
- `organization_members`: usuarios, roles y pertenencia al tenant.
- `user_preferences`: organización y empresa aportante activa por usuario.
- `companies`: empresas/aportantes administrados dentro del tenant.
- `employees`: cotizantes, relacionados opcionalmente con una empresa.
- `beneficiaries`: beneficiarios relacionados con un cotizante.
- `affiliate_documents`: metadatos de anexos ligados al cotizante.
- `novelties` y `pila_forms`: novedades y planillas PILA.
- `form_templates`: plantilla, configuración completa y campos mapeados JSONB.
- `stamp_presets`: sellos reutilizables del diseñador.
- `generated_forms`: historial y metadatos de formularios generados.
- `soporte_documentos`: biblioteca documental existente, ahora aislada por tenant.

Las tablas de negocio usan columnas relacionales para búsqueda e integridad y
un campo JSONB (`data` o `definition`) para conservar todos los campos propios
de cada EPS sin perder información cuando el modelo del formulario evoluciona.

## Archivos privados

- `documentos-soporte`: anexos e identificaciones.
- `validum-templates`: PDF base y miniaturas.
- `validum-generated`: formularios diligenciados.

Todo objeto se guarda bajo `<organization_id>/...`. Las políticas de Storage
rechazan rutas que no pertenezcan a una organización del usuario. Ningún bucket
es público.

## Funcionamiento del frontend

Con variables válidas y una sesión autenticada, Supabase es el repositorio
principal. Si no se configuraron las variables, la aplicación continúa en modo
local con IndexedDB para facilitar desarrollo y trabajo sin conexión. Los
errores de una sesión Supabase activa no se convierten silenciosamente en
escrituras locales, evitando dos fuentes de verdad.

En el primer inicio autenticado, si las tablas del tenant todavía están vacías,
la aplicación importa una sola vez empresas, cotizantes, mapeos personalizados,
sellos e historial presentes en IndexedDB. Si ya existen registros remotos no
realiza una mezcla automática ni sobrescribe datos.

## Usuarios internos y permisos

La migración `20260913011039_internal_team_roles.sql` amplía
`organization_members`, que representa al equipo interno de cada tenant. No se
debe confundir con `employees`: esa tabla continúa representando a los
afiliados/cotizantes utilizados para rellenar formularios EPS.

Roles visibles:

- `owner`: propietario inicial del tenant.
- `admin`: administra equipo, empresas, afiliados, mapeos y formularios.
- `operator`: registra afiliados y trabaja con formularios PDF.
- `auditor`: consulta registros sin modificarlos.

Las invitaciones se envían desde la Edge Function
`invite-organization-user`. La función usa autenticación de usuario, verifica
que quien invita sea propietario o administrador y ejecuta
`auth.admin.inviteUserByEmail` exclusivamente con la secret key del entorno de
Supabase. Esa clave nunca se guarda en Vite ni en React.

Antes de desplegar la función, configurar el secreto con la URL pública de la
aplicación:

```bash
supabase secrets set VALIDUM_APP_URL=https://app.sudominio.com
supabase functions deploy invite-organization-user
```

La URL también debe estar incluida en **Authentication > URL Configuration >
Redirect URLs**. En desarrollo local se permiten únicamente orígenes
`localhost` y `127.0.0.1`.
