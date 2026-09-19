-- CreateEnum
CREATE TYPE "CorrespondenceCategory" AS ENUM ('Términos jurídicos', 'Cobros Jurídicos', 'Consulta General', 'Soporte Operativo');

-- CreateEnum
CREATE TYPE "CorrespondencePriority" AS ENUM ('Urgente', 'Moderado', 'Respuesta Ligera');

-- CreateEnum
CREATE TYPE "CorrespondenceStatus" AS ENUM ('pendiente', 'en_revision', 'respondido', 'archivado');

-- CreateTable
CREATE TABLE "correos_clasificados" (
    "id" TEXT NOT NULL,
    "gmail_message_id" TEXT NOT NULL,
    "gmail_thread_id" TEXT NOT NULL,
    "cuenta_destino" TEXT NOT NULL,
    "remitente_correo" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "fecha_recepcion" TIMESTAMPTZ(6) NOT NULL,
    "remitente_nombre" TEXT NOT NULL,
    "identificacion" TEXT,
    "empresa_relacionada" TEXT,
    "categoria" "CorrespondenceCategory" NOT NULL,
    "prioridad" "CorrespondencePriority" NOT NULL,
    "resumen" TEXT NOT NULL,
    "documentos_requeridos" JSONB NOT NULL DEFAULT '[]',
    "propuesta_respuesta" TEXT NOT NULL,
    "alerta_inmediata" BOOLEAN NOT NULL DEFAULT false,
    "estado" "CorrespondenceStatus" NOT NULL DEFAULT 'pendiente',
    "asignado_a" TEXT,
    "notas_internas" TEXT,
    "error_clasificacion" BOOLEAN NOT NULL DEFAULT false,
    "respuesta_cruda_ia" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correos_clasificados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "correos_clasificados_cuenta_destino_gmail_message_id_key" ON "correos_clasificados"("cuenta_destino", "gmail_message_id");
CREATE INDEX "correos_clasificados_categoria_idx" ON "correos_clasificados"("categoria");
CREATE INDEX "correos_clasificados_prioridad_idx" ON "correos_clasificados"("prioridad");
CREATE INDEX "correos_clasificados_estado_idx" ON "correos_clasificados"("estado");
CREATE INDEX "correos_clasificados_fecha_recepcion_idx" ON "correos_clasificados"("fecha_recepcion");
CREATE INDEX "correos_clasificados_alerta_inmediata_idx" ON "correos_clasificados"("alerta_inmediata");
CREATE INDEX "correos_clasificados_asignado_a_idx" ON "correos_clasificados"("asignado_a");

-- AddForeignKey
ALTER TABLE "correos_clasificados" ADD CONSTRAINT "correos_clasificados_asignado_a_fkey" FOREIGN KEY ("asignado_a") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
