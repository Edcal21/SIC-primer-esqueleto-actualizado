ALTER TABLE "reportes_bancarios" ADD COLUMN IF NOT EXISTS "cuenta_bancaria_numero" varchar(32);
--> statement-breakpoint
ALTER TABLE "reportes_bancarios" ADD COLUMN IF NOT EXISTS "periodo_inicio" date;
--> statement-breakpoint
ALTER TABLE "reportes_bancarios" ADD COLUMN IF NOT EXISTS "periodo_fin" date;
--> statement-breakpoint
ALTER TABLE "reportes_bancarios" ADD COLUMN IF NOT EXISTS "total_lineas" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "reportes_bancarios" ADD COLUMN IF NOT EXISTS "total_debitos" numeric(18, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "reportes_bancarios" ADD COLUMN IF NOT EXISTS "total_creditos" numeric(18, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "reportes_bancarios" ADD COLUMN IF NOT EXISTS "mensaje_error" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "reportes_bancarios" ADD CONSTRAINT "reportes_bancarios_cuenta_bancaria_numero_cuentas_bancarias_numero_cuenta_fk" FOREIGN KEY ("cuenta_bancaria_numero") REFERENCES "public"."cuentas_bancarias"("numero_cuenta") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "reportes_bancarios" ADD CONSTRAINT "ck_reportes_bancarios_totales" CHECK ("total_lineas" >= 0 and "total_debitos" >= 0 and "total_creditos" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reportes_bancarios_cuenta" ON "reportes_bancarios" ("cuenta_bancaria_numero");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lineas_reporte_bancario" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reporte_id" uuid NOT NULL,
  "numero_linea" integer NOT NULL,
  "fecha" date,
  "referencia" varchar(120),
  "descripcion" text NOT NULL,
  "debito" numeric(18, 2) DEFAULT '0' NOT NULL,
  "credito" numeric(18, 2) DEFAULT '0' NOT NULL,
  "saldo" numeric(18, 2),
  "estado_conciliacion" varchar(12) DEFAULT 'pendiente' NOT NULL,
  "movimiento_id" uuid,
  "conciliado_por" varchar(40),
  "conciliado_en" timestamp with time zone,
  CONSTRAINT "ck_lineas_reporte_bancario_numero" CHECK ("numero_linea" > 0),
  CONSTRAINT "ck_lineas_reporte_bancario_montos" CHECK ("debito" >= 0 and "credito" >= 0),
  CONSTRAINT "ck_lineas_reporte_bancario_estado" CHECK ("estado_conciliacion" in ('pendiente', 'conciliada', 'descartada')),
  CONSTRAINT "ck_lineas_reporte_bancario_conciliada" CHECK ("estado_conciliacion" <> 'conciliada' or "movimiento_id" is not null)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lineas_reporte_bancario" ADD CONSTRAINT "lineas_reporte_bancario_reporte_id_reportes_bancarios_id_fk" FOREIGN KEY ("reporte_id") REFERENCES "public"."reportes_bancarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lineas_reporte_bancario" ADD CONSTRAINT "lineas_reporte_bancario_movimiento_id_movimientos_cuentas_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos_cuentas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lineas_reporte_bancario" ADD CONSTRAINT "lineas_reporte_bancario_conciliado_por_usuarios_id_fk" FOREIGN KEY ("conciliado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lineas_reporte_bancario_reporte" ON "lineas_reporte_bancario" ("reporte_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lineas_reporte_bancario_estado" ON "lineas_reporte_bancario" ("estado_conciliacion");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_lineas_reporte_bancario_movimiento" ON "lineas_reporte_bancario" ("movimiento_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conciliaciones_bancarias" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reporte_id" uuid NOT NULL,
  "cuenta_bancaria_numero" varchar(32) NOT NULL,
  "periodo" varchar(7) NOT NULL,
  "estado" varchar(10) DEFAULT 'borrador' NOT NULL,
  "total_banco" numeric(18, 2) DEFAULT '0' NOT NULL,
  "total_conciliado" numeric(18, 2) DEFAULT '0' NOT NULL,
  "total_pendiente" numeric(18, 2) DEFAULT '0' NOT NULL,
  "lineas_conciliadas" integer DEFAULT 0 NOT NULL,
  "lineas_pendientes" integer DEFAULT 0 NOT NULL,
  "movimientos_sin_conciliar" integer DEFAULT 0 NOT NULL,
  "observaciones" text,
  "creado_por" varchar(40) NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "revisado_por" varchar(40),
  "revisado_por_nombre" text,
  "revisado_en" timestamp with time zone,
  CONSTRAINT "ck_conciliaciones_bancarias_estado" CHECK ("estado" in ('borrador', 'aprobada', 'rechazada')),
  CONSTRAINT "ck_conciliaciones_bancarias_periodo" CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conciliaciones_bancarias" ADD CONSTRAINT "conciliaciones_bancarias_reporte_id_reportes_bancarios_id_fk" FOREIGN KEY ("reporte_id") REFERENCES "public"."reportes_bancarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conciliaciones_bancarias" ADD CONSTRAINT "conciliaciones_bancarias_cuenta_bancaria_numero_cuentas_bancarias_numero_cuenta_fk" FOREIGN KEY ("cuenta_bancaria_numero") REFERENCES "public"."cuentas_bancarias"("numero_cuenta") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conciliaciones_bancarias" ADD CONSTRAINT "conciliaciones_bancarias_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conciliaciones_bancarias" ADD CONSTRAINT "conciliaciones_bancarias_revisado_por_usuarios_id_fk" FOREIGN KEY ("revisado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_conciliaciones_bancarias_reporte" ON "conciliaciones_bancarias" ("reporte_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conciliaciones_bancarias_cuenta" ON "conciliaciones_bancarias" ("cuenta_bancaria_numero");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conciliaciones_bancarias_estado" ON "conciliaciones_bancarias" ("estado");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conciliaciones_bancarias_periodo" ON "conciliaciones_bancarias" ("periodo");
--> statement-breakpoint
INSERT INTO "permisos" ("id", "descripcion") VALUES
  ('configuracion:administrar', 'Editar la configuración institucional del sistema.')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "roles_permisos" ("rol_id", "permiso_id")
SELECT 'administrador', "permiso"
FROM (VALUES ('configuracion:administrar'), ('banco:ver'), ('conciliacion:aprobar')) AS "permisos_admin"("permiso")
WHERE EXISTS (SELECT 1 FROM "roles" WHERE "id" = 'administrador')
ON CONFLICT DO NOTHING;
