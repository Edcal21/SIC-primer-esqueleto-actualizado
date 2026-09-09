-- Cola del botón "Generar respaldo ahora". La aplicación solo inserta la solicitud; un
-- cron corto en el servidor (scripts/respaldo-postgresql.sh --atender-solicitudes) es
-- quien realmente ejecuta pg_dump y marca la solicitud resuelta.
CREATE TABLE IF NOT EXISTS "respaldos_solicitudes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "solicitado_por" varchar(40) NOT NULL,
  "solicitado_por_nombre" text NOT NULL,
  "solicitado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "estado" varchar(12) DEFAULT 'pendiente' NOT NULL,
  "atendido_en" timestamp with time zone,
  "respaldo_id" uuid,
  CONSTRAINT "ck_respaldos_solicitudes_estado" CHECK ("estado" in ('pendiente', 'completado', 'error')),
  CONSTRAINT "respaldos_solicitudes_solicitado_por_usuarios_id_fk" FOREIGN KEY ("solicitado_por") REFERENCES "usuarios"("id"),
  CONSTRAINT "respaldos_solicitudes_respaldo_id_respaldos_sistema_id_fk" FOREIGN KEY ("respaldo_id") REFERENCES "respaldos_sistema"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_respaldos_solicitudes_estado" ON "respaldos_solicitudes" USING btree ("estado");
