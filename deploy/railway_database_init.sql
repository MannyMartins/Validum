-- =============================================================================
-- VALIDUM - POSTGRESQL MASTER DATABASE INITIALIZATION SCRIPT
-- Para Railway / PostgreSQL Standalone / DBeaver / pgAdmin / TablePlus
-- Este script es 100% idempotente y crea todas las tablas, relaciones,
-- índices y datos iniciales para la gestión completa del sistema.
-- =============================================================================

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enumeraciones del sistema
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "CaseStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'REVIEW_REQUIRED', 'READY', 'DELIVERED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "DocumentStatus" AS ENUM ('RECEIVED', 'STORED', 'PROCESSING', 'PROCESSED', 'REVIEW_REQUIRED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "AffiliateDocumentCategory" AS ENUM ('CONTRIBUTOR_IDENTITY', 'SPOUSE_IDENTITY', 'BENEFICIARY_IDENTITY', 'CIVIL_REGISTRY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'DASHBOARD', 'API');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "TemplateEntityType" AS ENUM ('EPS', 'ARL', 'AFP', 'CCF', 'IPS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "ApplicationType" AS ENUM ('AFFILIATION', 'CHANGE', 'DISABILITY', 'TRANSFER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'DATA_PENDING', 'READY_FOR_REVIEW', 'APPROVED', 'GENERATED', 'SUBMITTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "ConversationState" AS ENUM ('NEW', 'AWAITING_APPLICATION_TYPE', 'AWAITING_DOCUMENT', 'AWAITING_FULL_NAME', 'AWAITING_EPS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Tabla: Organizaciones / Tenants
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla: Usuarios del sistema
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ANALYST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla: Membresías en Organizaciones
CREATE TABLE IF NOT EXISTS "organization_members" (
    "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("organizationId", "userId")
);
CREATE INDEX IF NOT EXISTS "organization_members_userId_active_idx" ON "organization_members"("userId", "active");

-- 6. Tabla: Preferencias de Usuario
CREATE TABLE IF NOT EXISTS "user_preferences" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT REFERENCES "organizations"("id") ON DELETE CASCADE,
    "activeCompanyId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabla: Empresas (Directorio empresarial)
CREATE TABLE IF NOT EXISTS "Company" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "legalName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'NIT',
    "documentNumber" TEXT NOT NULL,
    "verificationDigit" TEXT,
    "department" TEXT,
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "humanResourcesContact" TEXT,
    "tradeName" TEXT,
    "legalRepresentative" TEXT,
    "representativeDocument" TEXT,
    "economicActivity" TEXT,
    "payerType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_doc_unique" UNIQUE ("documentType", "documentNumber")
);

-- 8. Tabla: Empleados / Cotizantes
CREATE TABLE IF NOT EXISTS "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "companyId" TEXT REFERENCES "Company"("id") ON DELETE SET NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL UNIQUE,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "firstSurname" TEXT NOT NULL,
    "secondSurname" TEXT,
    "birthDate" TIMESTAMP(3),
    "sex" TEXT,
    "genderIdentity" TEXT,
    "maritalStatus" TEXT,
    "nationality" TEXT,
    "birthCountry" TEXT NOT NULL DEFAULT 'CO',
    "birthDepartment" TEXT,
    "birthCity" TEXT,
    "issueCountry" TEXT NOT NULL DEFAULT 'CO',
    "issueDepartment" TEXT,
    "issueCity" TEXT,
    "issueDate" TIMESTAMP(3),
    "residenceDepartment" TEXT,
    "residenceCity" TEXT,
    "residenceType" TEXT,
    "address" TEXT,
    "neighborhood" TEXT,
    "municipalityCode" TEXT,
    "departmentCode" TEXT,
    "mobilePhone" TEXT,
    "landlinePhone" TEXT,
    "localityCommune" TEXT,
    "email" TEXT,
    "epsName" TEXT,
    "epsCode" TEXT,
    "arlName" TEXT,
    "arlRiskLevel" INTEGER,
    "pensionFund" TEXT,
    "compensationFund" TEXT,
    "affiliationType" TEXT,
    "affiliationMode" TEXT,
    "healthRegime" TEXT,
    "affiliateType" TEXT,
    "epsRegistrationCode" TEXT,
    "noveltyType" TEXT,
    "mobilityRegime" TEXT,
    "transferRegime" TEXT,
    "noveltyDate" TIMESTAMP(3),
    "previousEps" TEXT,
    "transferReason" TEXT,
    "previousCompensationFund" TEXT,
    "contributorType" TEXT,
    "contributorTypeCode" TEXT,
    "contributorSubtype" TEXT,
    "satRequest" TEXT,
    "ethnicity" TEXT,
    "disability" TEXT,
    "sisbenScore" DECIMAL(8,2),
    "specialGroup" TEXT,
    "condition" TEXT,
    "salary" DECIMAL(14,2),
    "position" TEXT,
    "workDepartment" TEXT,
    "selectedIps" TEXT,
    "ipsCode" TEXT,
    "startDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabla: Beneficiarios
CREATE TABLE IF NOT EXISTS "Beneficiary" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
    "relationship" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "firstSurname" TEXT NOT NULL,
    "secondSurname" TEXT,
    "birthDate" TIMESTAMP(3),
    "sex" TEXT,
    "nationality" TEXT,
    "birthCountry" TEXT,
    "birthDepartment" TEXT,
    "birthCity" TEXT,
    "ethnicity" TEXT,
    "disability" TEXT,
    "condition" TEXT,
    "residenceCity" TEXT,
    "residenceZone" TEXT,
    "residenceDepartment" TEXT,
    "phone" TEXT,
    "upcValue" DECIMAL(14,2),
    "selectedIps" TEXT,
    "ipsCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Beneficiary_unique_per_employee" UNIQUE ("employeeId", "documentType", "documentNumber")
);

-- 10. Tabla: Documentos de Afiliados
CREATE TABLE IF NOT EXISTS "AffiliateDocument" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
    "beneficiaryId" TEXT,
    "category" "AffiliateDocumentCategory" NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AffiliateDocument_employeeId_category_idx" ON "AffiliateDocument"("employeeId", "category");

-- 11. Tabla: Biblioteca de Documentos Soporte (Soportes escaneados)
CREATE TABLE IF NOT EXISTS "soporte_documentos" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT REFERENCES "organizations"("id") ON DELETE CASCADE,
    "ownerId" TEXT,
    "employeeId" TEXT,
    "nombre" VARCHAR(255) NOT NULL,
    "categoria" VARCHAR(64) NOT NULL DEFAULT 'Otro',
    "tipo_archivo" VARCHAR(32) NOT NULL,
    "tamano_bytes" BIGINT NOT NULL DEFAULT 0,
    "storage_path" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "soporte_documentos_org_date_idx" ON "soporte_documentos"("organizationId", "created_at" DESC);

-- 12. Tabla: Plantillas de Formularios
CREATE TABLE IF NOT EXISTS "FormTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityType" "TemplateEntityType" NOT NULL,
    "applicationType" "ApplicationType" NOT NULL,
    "description" TEXT,
    "storageKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "pageCount" INTEGER NOT NULL,
    "pageSizes" JSONB,
    "layoutFingerprint" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mappingStatus" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormTemplate_version_unique" UNIQUE ("entityName", "applicationType", "version")
);

-- 13. Tabla: Campos de Plantillas (Coordenadas y Mapeo X, Y)
CREATE TABLE IF NOT EXISTS "TemplateField" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "templateId" TEXT NOT NULL REFERENCES "FormTemplate"("id") ON DELETE CASCADE,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "dataSource" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "fontSize" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "fontFamily" TEXT NOT NULL DEFAULT 'helvetica',
    "alignment" TEXT NOT NULL DEFAULT 'left',
    "verticalAlignment" TEXT NOT NULL DEFAULT 'middle',
    "bold" BOOLEAN NOT NULL DEFAULT false,
    "uppercase" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#000000',
    "checkboxCharacter" TEXT,
    "checkboxMatchValue" TEXT,
    "checkboxRule" JSONB,
    "dateFormat" TEXT,
    "numberFormat" TEXT,
    "stampText" TEXT,
    "stampSubtext" TEXT,
    "stampShape" TEXT,
    "stampBorderColor" TEXT,
    "stampFillColor" TEXT,
    "stampBorderWidth" DOUBLE PRECISION,
    "stampOpacity" DOUBLE PRECISION,
    "characterByCharacter" BOOLEAN NOT NULL DEFAULT false,
    "characterSpacing" DOUBLE PRECISION,
    "characterCount" INTEGER,
    "padding" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "overflowPolicy" TEXT NOT NULL DEFAULT 'error',
    "minFontSize" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "maxLength" INTEGER,
    "acroFieldName" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT
);
CREATE INDEX IF NOT EXISTS "TemplateField_templateId_page_idx" ON "TemplateField"("templateId", "page");

-- 14. Tabla: Preajustes de Sellos de Radicación
CREATE TABLE IF NOT EXISTS "stamp_presets" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT REFERENCES "organizations"("id") ON DELETE CASCADE,
    "stamp_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "stamp_presets_org_stamp_idx" ON "stamp_presets"("organizationId", "stamp_id");

-- 15. Tabla: Historial de Formularios Generados
CREATE TABLE IF NOT EXISTS "generated_forms" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT REFERENCES "organizations"("id") ON DELETE CASCADE,
    "generated_form_id" TEXT NOT NULL,
    "template_id" TEXT,
    "employee_id" TEXT,
    "template_name" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "pdf_storage_path" TEXT NOT NULL,
    "manual_fields" JSONB DEFAULT '{}'::jsonb,
    "procedure_fields" JSONB DEFAULT '{}'::jsonb,
    "source_pdf_file_name" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "generated_forms_org_date_idx" ON "generated_forms"("organizationId", "generated_at" DESC);

-- 16. Tabla: Novedades Laborales
CREATE TABLE IF NOT EXISTS "novelties" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT REFERENCES "organizations"("id") ON DELETE CASCADE,
    "novelty_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "novelty_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "data" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "novelties_org_employee_idx" ON "novelties"("organizationId", "employee_id");

-- 17. Tabla: Formularios y Planillas PILA
CREATE TABLE IF NOT EXISTS "pila_forms" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT REFERENCES "organizations"("id") ON DELETE CASCADE,
    "form_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "form_number" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "data" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "pila_forms_org_form_idx" ON "pila_forms"("organizationId", "form_id");

-- 18. Tabla: Contactos WhatsApp
CREATE TABLE IF NOT EXISTS "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "whatsappId" TEXT NOT NULL UNIQUE,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 19. Tabla: Sesiones de Conversación
CREATE TABLE IF NOT EXISTS "ConversationSession" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "contactId" TEXT NOT NULL UNIQUE REFERENCES "Contact"("id") ON DELETE CASCADE,
    "state" "ConversationState" NOT NULL DEFAULT 'NEW',
    "caseId" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20. Tabla: Mensajes de WhatsApp
CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "contactId" TEXT NOT NULL REFERENCES "Contact"("id") ON DELETE CASCADE,
    "metaMessageId" TEXT NOT NULL UNIQUE,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_contactId_createdAt_idx" ON "WhatsAppMessage"("contactId", "createdAt");

-- 21. Tabla: Casos de Afiliación
CREATE TABLE IF NOT EXISTS "Case" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "reference" TEXT NOT NULL UNIQUE,
    "status" "CaseStatus" NOT NULL DEFAULT 'RECEIVED',
    "epsName" TEXT,
    "contactId" TEXT NOT NULL REFERENCES "Contact"("id") ON DELETE RESTRICT,
    "extractedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 22. Tabla: Solicitudes de Trámite (Application)
CREATE TABLE IF NOT EXISTS "Application" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "reference" TEXT NOT NULL UNIQUE,
    "type" "ApplicationType" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
    "companyId" TEXT REFERENCES "Company"("id") ON DELETE SET NULL,
    "templateId" TEXT REFERENCES "FormTemplate"("id") ON DELETE SET NULL,
    "caseId" TEXT UNIQUE REFERENCES "Case"("id") ON DELETE SET NULL,
    "formData" JSONB,
    "missingFields" JSONB,
    "generatedFileKey" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. Tabla: Documentos de Caso
CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "caseId" TEXT NOT NULL REFERENCES "Case"("id") ON DELETE CASCADE,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL UNIQUE,
    "sourceMessageId" TEXT UNIQUE,
    "status" "DocumentStatus" NOT NULL DEFAULT 'RECEIVED',
    "extractedText" TEXT,
    "extraction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 24. Tabla: Registro de Auditoría
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "actorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'API',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- =============================================================================
-- DATOS INICIALES DE DEMOSTRACIÓN Y ADMINISTRADOR
-- =============================================================================

-- Organización base
INSERT INTO "organizations" ("id", "name")
VALUES ('org-default-001', 'Tech Nova Planet')
ON CONFLICT ("id") DO NOTHING;

-- Usuario administrador por defecto (admin@validum.com.co / AdminValidum2026!)
INSERT INTO "User" ("id", "email", "passwordHash", "role")
VALUES (
    'usr-admin-001',
    'admin@validum.com.co',
    -- Hash bcrypt para 'AdminValidum2026!'
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'ADMIN'
)
ON CONFLICT ("email") DO NOTHING;

-- Membresía de usuario administrador en la organización
INSERT INTO "organization_members" ("organizationId", "userId", "role", "active")
VALUES ('org-default-001', 'usr-admin-001', 'owner', true)
ON CONFLICT ("organizationId", "userId") DO NOTHING;

-- Empresa de demostración
INSERT INTO "Company" ("id", "legalName", "documentType", "documentNumber", "verificationDigit", "department", "city", "address", "phone", "email", "tradeName")
VALUES (
    'comp-001',
    'TECH NOVA PLANET S.A.S.',
    'NIT',
    '901456789',
    '1',
    'BOGOTÁ D.C.',
    'BOGOTÁ, D.C.',
    'CALLE 100 # 15-20 PISO 5',
    '3001234567',
    'contacto@technovaplanet.co',
    'TECH NOVA PLANET'
)
ON CONFLICT ("documentType", "documentNumber") DO NOTHING;

-- Asignar empresa activa al usuario
INSERT INTO "user_preferences" ("userId", "organizationId", "activeCompanyId")
VALUES ('usr-admin-001', 'org-default-001', 'comp-001')
ON CONFLICT ("userId") DO UPDATE SET "activeCompanyId" = EXCLUDED."activeCompanyId";
