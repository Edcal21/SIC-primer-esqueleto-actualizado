-- Bitácora de respaldos de la base de datos. La escribe scripts/respaldo-postgresql.sh
-- desde el servidor (vía psql) al terminar cada pg_dump; la aplicación solo la lee.
-- El respaldo en sí (el archivo .dump) no vive en la base de datos ni en esta tabla.
CREATE TABLE IF NOT EXISTS "respaldos_sistema" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "iniciado_en" timestamp with time zone NOT NULL,
  "finalizado_en" timestamp with time zone,
  "estado" varchar(12) NOT NULL,
  "modo" varchar(12) DEFAULT 'programado' NOT NULL,
  "archivo" text NOT NULL,
  "tamano_bytes" numeric(18, 0),
  "duracion_segundos" integer,
  "copia_secundaria_ok" boolean,
  "servidor" text,
  "mensaje" text,
  CONSTRAINT "ck_respaldos_sistema_estado" CHECK ("estado" in ('correcto', 'error')),
  CONSTRAINT "ck_respaldos_sistema_modo" CHECK ("modo" in ('programado', 'manual'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_respaldos_sistema_iniciado" ON "respaldos_sistema" USING btree ("iniciado_en");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_respaldos_sistema_estado" ON "respaldos_sistema" USING btree ("estado");
