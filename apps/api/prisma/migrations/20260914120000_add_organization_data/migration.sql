-- This migration intentionally remains separate from the initial migration.
-- Railway runs `prisma migrate deploy`, so already-applied migrations must never
-- be edited after deployment.

CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_members" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organizationId","userId")
);

CREATE TABLE "user_preferences" (
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "activeCompanyId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "soporte_documentos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "employeeId" TEXT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Otro',
    "tipo_archivo" TEXT NOT NULL,
    "tamano_bytes" BIGINT NOT NULL DEFAULT 0,
    "storage_path" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "soporte_documentos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stamp_presets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stamp_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stamp_presets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "generated_forms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generated_form_id" TEXT NOT NULL,
    "template_id" TEXT,
    "employee_id" TEXT,
    "template_name" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "pdf_storage_path" TEXT NOT NULL,
    "manual_fields" JSONB DEFAULT '{}',
    "procedure_fields" JSONB DEFAULT '{}',
    "source_pdf_file_name" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "novelties" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "novelty_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "novelty_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "data" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "novelties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pila_forms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "form_number" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "data" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pila_forms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_members_userId_active_idx" ON "organization_members"("userId", "active");
CREATE INDEX "organizations_createdBy_idx" ON "organizations"("createdBy");
CREATE INDEX "user_preferences_organizationId_idx" ON "user_preferences"("organizationId");
CREATE INDEX "user_preferences_activeCompanyId_idx" ON "user_preferences"("activeCompanyId");
CREATE INDEX "soporte_documentos_organizationId_created_at_idx" ON "soporte_documentos"("organizationId", "created_at");
CREATE INDEX "soporte_documentos_ownerId_idx" ON "soporte_documentos"("ownerId");
CREATE INDEX "soporte_documentos_employeeId_idx" ON "soporte_documentos"("employeeId");
CREATE INDEX "stamp_presets_organizationId_stamp_id_idx" ON "stamp_presets"("organizationId", "stamp_id");
CREATE INDEX "generated_forms_organizationId_generated_at_idx" ON "generated_forms"("organizationId", "generated_at");
CREATE INDEX "novelties_organizationId_employee_id_idx" ON "novelties"("organizationId", "employee_id");
CREATE INDEX "pila_forms_organizationId_form_id_idx" ON "pila_forms"("organizationId", "form_id");
CREATE UNIQUE INDEX "stamp_presets_organizationId_stamp_id_key" ON "stamp_presets"("organizationId", "stamp_id");
CREATE UNIQUE INDEX "generated_forms_organizationId_generated_form_id_key" ON "generated_forms"("organizationId", "generated_form_id");
CREATE UNIQUE INDEX "novelties_organizationId_novelty_id_key" ON "novelties"("organizationId", "novelty_id");
CREATE UNIQUE INDEX "pila_forms_organizationId_form_id_key" ON "pila_forms"("organizationId", "form_id");

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_activeCompanyId_fkey" FOREIGN KEY ("activeCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "soporte_documentos" ADD CONSTRAINT "soporte_documentos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "soporte_documentos" ADD CONSTRAINT "soporte_documentos_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "soporte_documentos" ADD CONSTRAINT "soporte_documentos_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stamp_presets" ADD CONSTRAINT "stamp_presets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_forms" ADD CONSTRAINT "generated_forms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "novelties" ADD CONSTRAINT "novelties_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pila_forms" ADD CONSTRAINT "pila_forms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
