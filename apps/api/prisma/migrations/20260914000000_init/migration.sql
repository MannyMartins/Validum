-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'REVIEW_REQUIRED', 'READY', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('RECEIVED', 'STORED', 'PROCESSING', 'PROCESSED', 'REVIEW_REQUIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "AffiliateDocumentCategory" AS ENUM ('CONTRIBUTOR_IDENTITY', 'SPOUSE_IDENTITY', 'BENEFICIARY_IDENTITY', 'CIVIL_REGISTRY', 'OTHER');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'DASHBOARD', 'API');

-- CreateEnum
CREATE TYPE "TemplateEntityType" AS ENUM ('EPS', 'ARL', 'AFP', 'CCF', 'IPS', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('AFFILIATION', 'CHANGE', 'DISABILITY', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'DATA_PENDING', 'READY_FOR_REVIEW', 'APPROVED', 'GENERATED', 'SUBMITTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('NEW', 'AWAITING_APPLICATION_TYPE', 'AWAITING_DOCUMENT', 'AWAITING_FULL_NAME', 'AWAITING_EPS', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ANALYST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "beneficiaryId" TEXT,
    "category" "AffiliateDocumentCategory" NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
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

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
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
    "defaultValue" TEXT,

    CONSTRAINT "TemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "ApplicationType" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT,
    "templateId" TEXT,
    "caseId" TEXT,
    "formData" JSONB,
    "missingFields" JSONB,
    "generatedFileKey" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "whatsappId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "state" "ConversationState" NOT NULL DEFAULT 'NEW',
    "caseId" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "metaMessageId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'RECEIVED',
    "epsName" TEXT,
    "contactId" TEXT NOT NULL,
    "extractedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'RECEIVED',
    "extractedText" TEXT,
    "extraction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'API',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_documentType_documentNumber_key" ON "Company"("documentType", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_documentNumber_key" ON "Employee"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateDocument_storageKey_key" ON "AffiliateDocument"("storageKey");

-- CreateIndex
CREATE INDEX "AffiliateDocument_employeeId_category_idx" ON "AffiliateDocument"("employeeId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Beneficiary_employeeId_documentType_documentNumber_key" ON "Beneficiary"("employeeId", "documentType", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplate_entityName_applicationType_version_key" ON "FormTemplate"("entityName", "applicationType", "version");

-- CreateIndex
CREATE INDEX "TemplateField_templateId_page_idx" ON "TemplateField"("templateId", "page");

-- CreateIndex
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Application_caseId_key" ON "Application"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_whatsappId_key" ON "Contact"("whatsappId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationSession_contactId_key" ON "ConversationSession"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_metaMessageId_key" ON "WhatsAppMessage"("metaMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_contactId_createdAt_idx" ON "WhatsAppMessage"("contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Case_reference_key" ON "Case"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Document_sourceMessageId_key" ON "Document"("sourceMessageId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateDocument" ADD CONSTRAINT "AffiliateDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateField" ADD CONSTRAINT "TemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

