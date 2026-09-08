-- Fuente mensual separada para el flujo de efectivo. La balanza y sus líneas no se alteran.
CREATE TABLE IF NOT EXISTS "importaciones_situacion_financiera" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "archivo_nombre" text NOT NULL,
  "archivo_tamano" integer NOT NULL,
  "periodo" varchar(7) NOT NULL,
  "estado" varchar(10) DEFAULT 'procesado' NOT NULL,
  "total_lineas" integer DEFAULT 0 NOT NULL,
  "importado_por" varchar(40) NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_importaciones_situacion_periodo" CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT "ck_importaciones_situacion_estado" CHECK ("estado" in ('procesado', 'error')),
  CONSTRAINT "ck_importaciones_situacion_lineas" CHECK ("total_lineas" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lineas_situacion_financiera" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "importacion_id" uuid NOT NULL,
  "numero_linea" integer NOT NULL,
  "concepto" text NOT NULL,
  "saldo_final" numeric(18, 2) NOT NULL,
  "es_total" boolean DEFAULT false NOT NULL,
  CONSTRAINT "ck_lineas_situacion_numero" CHECK ("numero_linea" > 0),
  CONSTRAINT "ck_lineas_situacion_concepto" CHECK (length(trim("concepto")) > 0)
);
--> statement-breakpoint
ALTER TABLE "importaciones_situacion_financiera" ADD CONSTRAINT "importaciones_situacion_financiera_importado_por_usuarios_id_fk"
  FOREIGN KEY ("importado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lineas_situacion_financiera" ADD CONSTRAINT "lineas_situacion_financiera_importacion_id_importaciones_situacion_financiera_id_fk"
  FOREIGN KEY ("importacion_id") REFERENCES "public"."importaciones_situacion_financiera"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_importaciones_situacion_periodo" ON "importaciones_situacion_financiera" ("periodo");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_importaciones_situacion_usuario" ON "importaciones_situacion_financiera" ("importado_por");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lineas_situacion_importacion" ON "lineas_situacion_financiera" ("importacion_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lineas_situacion_concepto" ON "lineas_situacion_financiera" ("concepto");
