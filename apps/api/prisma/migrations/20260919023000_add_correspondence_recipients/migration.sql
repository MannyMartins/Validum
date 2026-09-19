-- Esta migración es deliberadamente aditiva: no transforma ni elimina datos existentes.
ALTER TABLE "correos_clasificados" ADD COLUMN "destinatarios" TEXT;
