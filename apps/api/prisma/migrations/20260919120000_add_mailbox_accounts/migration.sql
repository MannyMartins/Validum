-- Esta migración es deliberadamente aditiva: crea objetos nuevos y no transforma
-- ni elimina datos existentes. Puede revertirse eliminando la tabla y el enum.

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('conectada', 'desconectada', 'pausada');

-- CreateTable
CREATE TABLE "cuentas_correo" (
    "id" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "etiqueta" TEXT,
    "refresh_token_cifrado" TEXT,
    "refresh_token_iv" TEXT,
    "refresh_token_tag" TEXT,
    "estado" "MailboxStatus" NOT NULL DEFAULT 'conectada',
    "ultimo_history_id" TEXT,
    "ultima_sincronizacion" TIMESTAMPTZ(6),
    "ultimo_error" TEXT,
    "errores_consecutivos" INTEGER NOT NULL DEFAULT 0,
    "correos_procesados" INTEGER NOT NULL DEFAULT 0,
    "conectada_por" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_correo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_correo_direccion_key" ON "cuentas_correo"("direccion");

-- CreateIndex
CREATE INDEX "cuentas_correo_estado_idx" ON "cuentas_correo"("estado");

-- AddForeignKey
ALTER TABLE "cuentas_correo" ADD CONSTRAINT "cuentas_correo_conectada_por_fkey" FOREIGN KEY ("conectada_por") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
