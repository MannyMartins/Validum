ALTER TABLE "User"
  ADD COLUMN "fullName" TEXT,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "organization_members"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "invited_email" TEXT,
  ADD COLUMN "invited_at" TIMESTAMP(3),
  ADD COLUMN "accepted_at" TIMESTAMP(3),
  ADD COLUMN "revoked_at" TIMESTAMP(3);

CREATE TABLE "workspace_state" (
  "organizationId" TEXT NOT NULL,
  "companies" JSONB NOT NULL DEFAULT '[]',
  "employees" JSONB NOT NULL DEFAULT '[]',
  "templates" JSONB NOT NULL DEFAULT '[]',
  "generatedForms" JSONB NOT NULL DEFAULT '[]',
  "stampPresets" JSONB NOT NULL DEFAULT '[]',
  "activeCompanyId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_state_pkey" PRIMARY KEY ("organizationId")
);

CREATE TABLE "auth_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");
CREATE INDEX "auth_tokens_userId_kind_expiresAt_idx" ON "auth_tokens"("userId", "kind", "expiresAt");

ALTER TABLE "workspace_state" ADD CONSTRAINT "workspace_state_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
