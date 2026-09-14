# Arquitectura de autorización y firma electrónica para Validum

**Estado:** propuesta técnica para implementación y revisión jurídica  
**Ámbito:** Colombia — afiliaciones al SGSSS  
**Base técnica:** React, Supabase Auth, PostgreSQL, Row Level Security, Storage y Edge Functions

> Este documento es una guía de arquitectura y redacción operativa. No reemplaza la revisión de un abogado colombiano ni garantiza por sí solo el no repudio. La evidencia técnica debe probar identidad, voluntad, integridad del documento y trazabilidad del proceso.

## Decisión principal

La firma trazada con mouse, lápiz óptico o tableta debe tratarse en el producto como una **firma electrónica**, no como una firma digital certificada. En Colombia, el Decreto 2364 de 2012 admite métodos electrónicos que permitan identificar al firmante y que sean confiables y apropiados para el propósito. Una firma digital, en sentido estricto, es una especie particular regulada por la Ley 527 de 1999 y normalmente usa criptografía y certificados.

Por eso Validum no debe guardar únicamente una imagen PNG: debe conservar un paquete de evidencia formado por la versión exacta del documento, su hash, la autorización expresa, la identidad verificada, eventos con hora del servidor, canal de entrega, IP, navegador, resultado del OTP y el PDF final sellado.

Fuentes: [Ley 527 de 1999](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276), [Decreto 2364 de 2012](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=50583) y [Ley 1581 de 2012](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981).

---

## FASE 1 — Comunicación y textos legales

### Reglas de experiencia y consentimiento

1. El correo o WhatsApp es una invitación; la autorización se obtiene dentro de la página de firma.
2. Las casillas deben aparecer vacías. El silencio, la inacción y las casillas premarcadas no acreditan consentimiento.
3. Deben separarse, al menos, estas decisiones:
   - aceptación de términos del trámite;
   - autorización para tratamiento de datos personales;
   - autorización explícita de datos sensibles, cuando corresponda;
   - aceptación del mecanismo de firma electrónica;
   - comunicaciones comerciales, siempre opcionales y separadas.
4. Antes de firmar se debe mostrar el texto completo, su versión y la opción de descargarlo.
5. La persona debe poder rechazar, pedir corrección de datos o comunicarse con el Responsable.
6. El enlace no debe contener cédula, nombre, correo, teléfono ni otro dato personal.

La SIC ha precisado que aceptar una política no sustituye la autorización previa, expresa e informada y que debe conservarse prueba de quién autorizó y mediante qué mecanismo. Véase el [criterio de la SIC sobre consentimiento](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/boletin/el-silencio-las-casillas-premarcadas-por-defecto-y-la-inaccion-no-constituyen-el-consentimiento-conforme-con).

### Plantilla de correo electrónico

**Asunto:** Acción requerida: revise y firme su afiliación — {{EMPRESA}}

Hola, **{{NOMBRE_CLIENTE}}**:

{{EMPRESA}} ha preparado los documentos relacionados con su proceso de afiliación. Revise cuidadosamente la información y, si está de acuerdo, otorgue las autorizaciones solicitadas y firme electrónicamente desde el siguiente botón:

**[REVISAR Y FIRMAR]({{ENLACE_UNICO}})**

El enlace es personal, no debe compartirse y estará disponible hasta **{{FECHA_HORA_EXPIRACION}} (hora de Colombia)**. Si encuentra un dato incorrecto, no firme todavía y comuníquese con nosotros por **{{CANAL_ATENCION}}**.

**Aviso de privacidad:** {{RAZON_SOCIAL_RESPONSABLE}}, identificado con NIT {{NIT}}, con domicilio en {{DIRECCION}} y contacto {{CORREO_PRIVACIDAD}} / {{TELEFONO}}, es Responsable del tratamiento de sus datos personales. La información será recolectada, almacenada, usada, circulada y, cuando corresponda, suprimida para: validar su identidad; gestionar y documentar el trámite de afiliación al SGSSS; comunicarse con usted sobre el trámite; generar y custodiar los documentos y evidencias de autorización y firma; atender consultas y reclamos; y cumplir obligaciones legales y contractuales. Usted puede conocer, actualizar, rectificar y solicitar la supresión de sus datos, revocar la autorización cuando legalmente proceda y presentar consultas o reclamos mediante {{CANAL_HABEAS_DATA}}. Consulte la Política de Tratamiento de Información en {{URL_POLITICA}}.

El proceso puede involucrar datos sensibles, incluidos datos de salud y, si se utiliza como mecanismo de identificación, datos biométricos. Usted no está obligado a autorizar datos sensibles, salvo los casos permitidos por la ley; en la pantalla de firma se explicará su finalidad y se solicitará autorización explícita y separada.

Si usted no solicitó este trámite, ignore el enlace y repórtelo a **{{CANAL_SEGURIDAD}}**.

Atentamente,  
**{{EMPRESA}}**  
{{DATOS_CONTACTO}}

### Plantilla corta para WhatsApp

Hola, **{{NOMBRE}}**. {{EMPRESA}} le envía el acceso personal para revisar y firmar electrónicamente su trámite de afiliación:

{{ENLACE_UNICO}}

Vence: **{{FECHA_HORA_EXPIRACION}} (Colombia)**. No lo reenvíe. Si un dato está errado o usted no solicitó el trámite, escriba a {{CANAL_ATENCION}}.

**Privacidad:** {{RAZON_SOCIAL_RESPONSABLE}}, NIT {{NIT}}, tratará sus datos para identificarlo, gestionar la afiliación, custodiar documentos/evidencias y cumplir obligaciones legales. Puede conocer, actualizar, rectificar, solicitar supresión o revocar cuando proceda en {{CANAL_HABEAS_DATA}}. Política: {{URL_POLITICA}}. En la página se solicitará autorización expresa y separada para datos sensibles cuando aplique.

### Texto que debe aparecer en la página de firma

Casillas inicialmente desmarcadas:

- `He leído y acepto los Términos y Condiciones, versión {{VERSION_TERMINOS}}.`
- `Autorizo de manera previa, expresa e informada el tratamiento de mis datos para las finalidades descritas en la Autorización, versión {{VERSION_AUTORIZACION}}.`
- `Autorizo explícitamente el tratamiento de los datos sensibles identificados y para las finalidades informadas. Entiendo que no estoy obligado a autorizar su tratamiento.`
- `Acepto utilizar este mecanismo de firma electrónica y reconozco que la firma, el código de verificación y la evidencia técnica quedarán vinculados al documento mostrado.`

Debe existir un botón separado **No acepto / solicitar corrección**. Marketing y publicidad no pueden agregarse a estas casillas obligatorias.

---

## FASE 2 — Ecosistema NPM y herramientas

### Selección recomendada para Validum

| Necesidad | Opción principal | Alternativa | Decisión propuesta |
|---|---|---|---|
| Correo transaccional | `resend` | `@sendgrid/mail` | Resend para una primera versión por simplicidad; dominio propio con SPF, DKIM y DMARC. |
| WhatsApp | Meta WhatsApp Cloud API mediante `fetch` | `twilio` | Meta directa para menor dependencia; Twilio si se prioriza soporte multicanal. No usar automatizaciones no oficiales de WhatsApp Web. |
| Firma trazada | `signature_pad` | `react-signature-canvas` | Mantener `signature_pad`, que ya está instalado en Validum. Guardar PNG/SVG y datos vectoriales de los trazos. |
| Validación | `zod` | — | Validar cada entrada tanto en React como en Edge Functions. |
| Cliente Supabase | `@supabase/supabase-js` | — | Ya instalado. En navegador solo URL y publishable key. |
| Logs técnicos | `pino` en servicios propios / logs estructurados en Edge | Sentry | Nunca registrar documentos, firmas, tokens o datos sensibles en texto libre. |
| Hash y tokens | Web Crypto / `node:crypto` | — | SHA-256 y tokens aleatorios de 256 bits; no hace falta una librería adicional. |

`signature_pad` soporta trazos suaves, exportación a imagen y conservación de grupos de puntos; también documenta el escalado de canvas para pantallas de alta densidad. Véase [Signature Pad](https://github.com/szimek/signature_pad). Resend recomienda verificar dominio con SPF y DKIM y añadir DMARC; véase [dominios de Resend](https://resend.com/docs/dashboard/domains/introduction). WhatsApp exige opt-in explícito y respeto de las bajas; véase [WhatsApp con Twilio](https://www.twilio.com/docs/whatsapp/api).

### Cliente Supabase seguro en React/Vite

```ts
// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('Falta la configuración pública de Supabase')
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

Reglas:

- `VITE_SUPABASE_PUBLISHABLE_KEY` puede estar en el navegador; la seguridad real depende de grants y RLS.
- `SUPABASE_SECRET_KEY`, claves de Resend, Meta o Twilio solo viven en secretos de Edge Functions.
- No enviar correos o WhatsApp directamente desde React.
- Fijar versiones exactas en producción y mantener auditoría de dependencias, lockfile y actualizaciones controladas.
- Verificar las firmas de los webhooks de Resend/Twilio/Meta antes de cambiar el estado de una entrega.

### Evidencia mínima a capturar

- ID interno de solicitud y organización.
- versión y SHA-256 de cada documento mostrado;
- fecha y hora del servidor en UTC y zona mostrada al usuario;
- dirección IP obtenida en servidor desde el proxy confiable, nunca aceptada desde el formulario;
- `User-Agent`, idioma y un identificador de sesión aleatorio;
- canal, proveedor, ID del mensaje y estados enviado/entregado/fallido;
- apertura del enlace, vista de documentos, decisiones de consentimiento, inicio y final de firma;
- método de autenticación y resultado del OTP, sin almacenar el OTP;
- nombre declarado y vínculo con el registro del afiliado;
- PNG/SVG, datos vectoriales de trazos si son necesarios, y sus hashes;
- SHA-256 del PDF final y cadena de auditoría inmutable.

IP, navegador y telemetría también son datos personales: deben aparecer en la finalidad, tener retención definida y acceso restringido.

---

## FASE 3 — Arquitectura de autenticación y seguridad en Supabase

### 3.1 Actores y fronteras de confianza

- **Administradores/asesores:** usuarios reales de Supabase Auth. Cada usuario pertenece a una o más organizaciones por `organization_members`.
- **Firmante externo:** no recibe acceso directo a tablas ni Storage. Usa un token opaco de un solo uso y, para mayor fuerza probatoria, un OTP enviado a un canal previamente registrado.
- **React:** usa publishable key y JWT del administrador. Nunca conoce secretos de proveedores.
- **Edge Functions:** crean enlaces, validan tokens/OTP, entregan el mínimo documento necesario, sellan la evidencia y procesan webhooks.
- **PostgreSQL:** ejecuta RLS para los administradores autenticados. Las funciones públicas de firma no consultan directamente la Data API.
- **Storage:** todos los buckets de documentos, firmas y PDFs finales son privados.

Supabase distingue la publishable key del navegador y la secret key del backend; esta última omite RLS y nunca debe salir del entorno controlado. Véase [API keys de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

### 3.2 Flujo de autenticación

1. El administrador inicia sesión con email/contraseña o magic link.
2. En producción se exige MFA (`aal2`) a propietarios y administradores.
3. La sesión identifica al usuario; RLS comprueba su membresía y rol para cada fila.
4. Al crear una solicitud, una Edge Function genera 32 bytes aleatorios. El enlace contiene el token en Base64URL, pero PostgreSQL conserva solo su SHA-256.
5. El firmante abre el enlace. La Edge Function compara el hash en tiempo constante, verifica expiración, revocación, uso previo y límites de intentos.
6. Se envía y valida OTP antes de permitir la firma. El token queda consumido al finalizar.
7. No se devuelve ningún dato de otra solicitud ni se permite listar solicitudes.

Supabase recomienda MFA y permite exigir `aal2` también desde políticas RLS; véase [MFA de Supabase Auth](https://supabase.com/docs/guides/auth/auth-mfa).

### 3.3 Extensión propuesta del esquema existente

El esquema actual de Validum ya tiene `organizations`, `organization_members`, `employees`, `generated_forms` y funciones privadas de pertenencia. La firma debe añadirse como una migración incremental, sin reemplazar esas tablas.

```sql
create table public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null check (document_type in (
    'terms', 'privacy_policy', 'data_authorization', 'affiliation_document'
  )),
  version text not null,
  title text not null,
  storage_path text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, document_type, version),
  unique (organization_id, id)
);

create table public.signing_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id text not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in (
    'pending', 'opened', 'verified', 'signed', 'rejected', 'expired', 'revoked'
  )),
  authentication_method text not null default 'email_otp'
    check (authentication_method in ('email_otp', 'sms_otp', 'whatsapp_otp')),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  signed_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  foreign key (organization_id, employee_id)
    references public.employees(organization_id, employee_id)
    on update cascade on delete restrict,
  unique (organization_id, id)
);

create table public.signing_request_documents (
  organization_id uuid not null,
  request_id uuid not null,
  document_version_id uuid not null,
  display_order smallint not null default 0,
  required boolean not null default true,
  primary key (request_id, document_version_id),
  foreign key (organization_id, request_id)
    references public.signing_requests(organization_id, id) on delete cascade,
  foreign key (organization_id, document_version_id)
    references public.legal_document_versions(organization_id, id) on delete restrict
);

create table public.signing_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms')),
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  attempted_at timestamptz not null default now(),
  provider_event_at timestamptz,
  safe_metadata jsonb not null default '{}'::jsonb,
  foreign key (organization_id, request_id)
    references public.signing_requests(organization_id, id) on delete cascade
);

create table public.electronic_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  document_version_id uuid not null,
  decision text not null check (decision in ('accepted', 'rejected')),
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  decided_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  foreign key (organization_id, request_id)
    references public.signing_requests(organization_id, id) on delete cascade,
  foreign key (organization_id, document_version_id)
    references public.legal_document_versions(organization_id, id) on delete restrict,
  unique (request_id, document_version_id)
);

create table public.electronic_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  method text not null check (method in ('drawn_canvas', 'uploaded_image', 'certificate')),
  signer_name text not null,
  signature_storage_path text not null,
  stroke_storage_path text,
  signature_sha256 text not null check (signature_sha256 ~ '^[0-9a-f]{64}$'),
  signed_payload_sha256 text not null check (signed_payload_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  foreign key (organization_id, request_id)
    references public.signing_requests(organization_id, id) on delete restrict,
  unique (request_id)
);

create table public.signed_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  storage_path text not null,
  pdf_sha256 text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  sealed_at timestamptz not null default now(),
  foreign key (organization_id, request_id)
    references public.signing_requests(organization_id, id) on delete restrict,
  unique (request_id),
  unique (organization_id, storage_path)
);

create table public.signing_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  request_id uuid not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  safe_metadata jsonb not null default '{}'::jsonb,
  previous_hash text,
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  foreign key (organization_id, request_id)
    references public.signing_requests(organization_id, id) on delete restrict
);

create index signing_requests_org_status_idx
  on public.signing_requests (organization_id, status, created_at desc);
create index signing_request_documents_org_idx
  on public.signing_request_documents (organization_id, request_id);
create index signing_deliveries_org_request_idx
  on public.signing_deliveries (organization_id, request_id, attempted_at desc);
create index electronic_consents_org_request_idx
  on public.electronic_consents (organization_id, request_id);
create index electronic_signatures_org_request_idx
  on public.electronic_signatures (organization_id, request_id);
create index signed_artifacts_org_request_idx
  on public.signed_artifacts (organization_id, request_id);
create index signing_events_org_request_idx
  on public.signing_events (organization_id, request_id, id);
```

### 3.4 RLS y privilegios

La regla es doble: **grants mínimos primero, RLS después**. Todas las tablas quedan sin acceso para `anon`. Los firmantes externos solo interactúan con Edge Functions. Los usuarios internos autenticados pueden consultar únicamente filas de sus organizaciones. Las escrituras probatorias se hacen desde funciones controladas y no se ofrece `UPDATE` ni `DELETE` sobre consentimientos, firmas, artefactos o eventos.

```sql
alter table public.legal_document_versions enable row level security;
alter table public.signing_requests enable row level security;
alter table public.signing_request_documents enable row level security;
alter table public.signing_deliveries enable row level security;
alter table public.electronic_consents enable row level security;
alter table public.electronic_signatures enable row level security;
alter table public.signed_artifacts enable row level security;
alter table public.signing_events enable row level security;

revoke all on public.legal_document_versions,
  public.signing_requests,
  public.signing_request_documents,
  public.signing_deliveries,
  public.electronic_consents,
  public.electronic_signatures,
  public.signed_artifacts,
  public.signing_events
from anon, authenticated;

grant select on public.legal_document_versions,
  public.signing_requests,
  public.signing_request_documents,
  public.signing_deliveries,
  public.electronic_consents,
  public.electronic_signatures,
  public.signed_artifacts,
  public.signing_events
to authenticated;

-- El backend controlado puede insertar y actualizar el flujo; la evidencia
-- no recibe DELETE. La secret key nunca se distribuye al cliente.
grant select, insert, update on public.legal_document_versions,
  public.signing_requests,
  public.signing_request_documents,
  public.signing_deliveries,
  public.electronic_consents,
  public.electronic_signatures,
  public.signed_artifacts,
  public.signing_events
to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'legal_document_versions', 'signing_requests', 'signing_request_documents',
    'signing_deliveries', 'electronic_consents', 'electronic_signatures',
    'signed_artifacts', 'signing_events'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_organization_member(organization_id)))',
      table_name || '_tenant_read', table_name
    );
  end loop;
end $$;

-- Activar cuando el flujo de MFA de la aplicación ya esté implementado.
-- Debe repetirse como política restrictiva en cada tabla probatoria.
create policy signing_requests_require_mfa
on public.signing_requests
as restrictive
for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2');
```

Las funciones `SECURITY DEFINER` deben permanecer en el esquema `private`, usar `search_path = ''`, verificar `auth.uid()` o el token explícitamente y tener permisos `EXECUTE` revocados salvo para los roles indispensables. Las columnas usadas en RLS y claves foráneas deben estar indexadas. Véase [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) y [seguridad de la Data API](https://supabase.com/docs/guides/api/securing-your-api).

### 3.5 Storage

Buckets privados propuestos:

- `legal-documents`: versiones publicadas de términos, autorización y documentos a firmar;
- `electronic-signatures`: imágenes y trazos, ruta `organization_id/request_id/...`;
- `signed-artifacts`: PDF final y manifiesto de evidencia.

No se crean enlaces públicos permanentes. Los archivos se descargan con JWT sujeto a RLS o con URL firmada de vida muy corta creada por una Edge Function. Las URL firmadas de Storage permanecen válidas hasta su expiración, así que deben ser breves y nunca sustituir el token de firma revocable. Véase [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals) y [control de acceso de Storage](https://supabase.com/docs/guides/storage/security/access-control).

### 3.6 Controles adicionales indispensables

- MFA obligatorio para `owner` y `admin` antes de producción.
- OTP y límite de intentos para firmantes; bloqueo temporal y detección de abuso.
- Enlace de 256 bits, un solo uso, vencimiento corto y revocación inmediata.
- HTTPS, HSTS y dominio propio; SPF, DKIM y DMARC para correo.
- Webhooks autenticados, idempotentes y con protección contra repetición.
- No registrar PII en URLs, analítica, trazas o mensajes de error.
- Cifrado en tránsito y reposo; evaluar cifrado de aplicación para los datos más sensibles.
- Retención documentada por tipo de evidencia; no borrar por rutina sin validar obligaciones legales.
- Backups, restauración probada, monitoreo de accesos y alertas.
- Pruebas automáticas de aislamiento: usuario A no puede leer, insertar, actualizar ni borrar filas de B.
- Revisar ubicación de datos, subencargados, DPA y reglas colombianas de transmisión o transferencia internacional antes de producción.
- Auditoría independiente periódica si se quiere elevar la fuerza probatoria del mecanismo.

Supabase permite centralizar autenticación, límites y lógica de proveedores en Edge Functions; véase [Edge Functions](https://supabase.com/docs/guides/functions). A septiembre de 2026, Supabase también está migrando de claves `anon/service_role` heredadas a claves publishable/secret y cambia la exposición automática de tablas nuevas; las migraciones deben declarar grants explícitos. Véase el [changelog de cambios incompatibles](https://supabase.com/changelog?types=breaking-change).

---

## FASE 4 — Diagrama de flujo

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador / asesor
    participant React as Validum React
    participant Auth as Supabase Auth
    participant Send as Edge Function: crear-y-enviar
    participant DB as PostgreSQL + RLS
    participant Msg as Resend / Meta / Twilio
    actor Cliente as Cliente firmante
    participant Sign as Edge Function: portal-firma
    participant Store as Storage privado

    Admin->>React: Inicia sesión
    React->>Auth: Email/contraseña + MFA
    Auth-->>React: JWT con user_id y aal2
    Admin->>React: Selecciona afiliado y documentos
    React->>Send: Solicita envío con JWT
    Send->>DB: Valida organización, rol y afiliado
    Send->>DB: Crea solicitud + hash del token + versiones
    Send->>Msg: Envía enlace opaco por correo/WhatsApp
    Msg-->>DB: Webhook firmado de entrega
    Cliente->>Sign: Abre enlace único
    Sign->>DB: Valida hash, expiración, estado y límites
    Sign-->>Cliente: Muestra documentos mínimos y aviso
    Cliente->>Sign: Solicita/verifica OTP
    Sign->>DB: Registra evento de verificación
    Cliente->>Sign: Acepta autorizaciones separadas
    Cliente->>Sign: Traza firma con mouse/tableta
    Sign->>Store: Guarda firma y trazos en bucket privado
    Sign->>DB: Guarda consentimientos, hashes, IP y navegador
    Sign->>Store: Genera y guarda PDF final sellado
    Sign->>DB: Guarda hash PDF y encadena auditoría
    Sign->>DB: Consume token y marca solicitud como firmada
    Sign-->>Cliente: Confirmación y copia descargable temporal
    Sign-->>React: Estado firmado disponible para el tenant
    React->>DB: Consulta con JWT; RLS limita a su organización
```

## Criterios de aceptación antes de producción

1. Un usuario de la organización A obtiene cero filas de B en pruebas positivas y negativas.
2. `anon` no puede consultar directamente ninguna tabla o bucket probatorio.
3. Cambiar cualquier byte del documento o PDF final produce un hash distinto.
4. Un enlace vencido, revocado o consumido siempre falla y nunca revela si existe otro cliente.
5. La página no permite firmar sin revisar y marcar cada autorización requerida.
6. La autorización sensible está separada, explicada y no premarcada.
7. El PDF final incorpora versión documental, fecha/hora, identificador de evidencia y hash verificable.
8. Los webhooks inválidos, repetidos o fuera de tiempo no alteran el estado.
9. Existe una prueba real de restauración y un procedimiento de atención de consultas/reclamos.
10. Abogado y responsable de protección de datos aprueban textos, finalidades, retención y transferencias internacionales.

