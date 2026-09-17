CREATE TABLE "archivos_importados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" varchar(28) NOT NULL,
	"archivo_nombre" text NOT NULL,
	"archivo_mime" text NOT NULL,
	"archivo_tamano" integer NOT NULL,
	"archivo_hash_sha256" varchar(64) NOT NULL,
	"archivo_original" bytea NOT NULL,
	"cuenta_bancaria_numero" varchar(32),
	"periodo" varchar(32),
	"clave_version" text NOT NULL,
	"version" integer NOT NULL,
	"cantidad_registros" integer DEFAULT 0 NOT NULL,
	"totales_control" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"estado" varchar(10) DEFAULT 'procesado' NOT NULL,
	"mensaje_error" text,
	"importado_por" varchar(40) NOT NULL,
	"importado_por_nombre" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_archivos_importados_tipo" CHECK ("archivos_importados"."tipo" in ('estado_bancario', 'balanza', 'situacion_financiera', 'catalogo_contable', 'auxiliar_contable')),
	CONSTRAINT "ck_archivos_importados_hash" CHECK ("archivos_importados"."archivo_hash_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_archivos_importados_tamano" CHECK ("archivos_importados"."archivo_tamano" >= 0 and octet_length("archivos_importados"."archivo_original") = "archivos_importados"."archivo_tamano"),
	CONSTRAINT "ck_archivos_importados_version" CHECK ("archivos_importados"."version" > 0),
	CONSTRAINT "ck_archivos_importados_registros" CHECK ("archivos_importados"."cantidad_registros" >= 0),
	CONSTRAINT "ck_archivos_importados_estado" CHECK ("archivos_importados"."estado" in ('procesado', 'error'))
);
--> statement-breakpoint
ALTER TABLE "archivos_importados" ADD CONSTRAINT "archivos_importados_cuenta_bancaria_numero_cuentas_bancarias_numero_cuenta_fk" FOREIGN KEY ("cuenta_bancaria_numero") REFERENCES "public"."cuentas_bancarias"("numero_cuenta") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "archivos_importados" ADD CONSTRAINT "archivos_importados_importado_por_usuarios_id_fk" FOREIGN KEY ("importado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ux_archivos_importados_version" ON "archivos_importados" USING btree ("clave_version","version");
--> statement-breakpoint
CREATE INDEX "idx_archivos_importados_hash" ON "archivos_importados" USING btree ("archivo_hash_sha256");
--> statement-breakpoint
CREATE INDEX "idx_archivos_importados_tipo_periodo" ON "archivos_importados" USING btree ("tipo","periodo");
--> statement-breakpoint
CREATE INDEX "idx_archivos_importados_cuenta" ON "archivos_importados" USING btree ("cuenta_bancaria_numero");
--> statement-breakpoint
CREATE INDEX "idx_archivos_importados_usuario_fecha" ON "archivos_importados" USING btree ("importado_por","creado_en");
--> statement-breakpoint
ALTER TABLE "movimientos_cuentas" ADD COLUMN "archivo_importado_id" uuid;
--> statement-breakpoint
ALTER TABLE "importaciones_balanza" ADD COLUMN "archivo_importado_id" uuid;
--> statement-breakpoint
ALTER TABLE "importaciones_situacion_financiera" ADD COLUMN "archivo_importado_id" uuid;
--> statement-breakpoint
ALTER TABLE "reportes_bancarios" ADD COLUMN "archivo_importado_id" uuid;
--> statement-breakpoint
ALTER TABLE "movimientos_cuentas" ADD CONSTRAINT "movimientos_cuentas_archivo_importado_id_archivos_importados_id_fk" FOREIGN KEY ("archivo_importado_id") REFERENCES "public"."archivos_importados"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "importaciones_balanza" ADD CONSTRAINT "importaciones_balanza_archivo_importado_id_archivos_importados_id_fk" FOREIGN KEY ("archivo_importado_id") REFERENCES "public"."archivos_importados"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "importaciones_situacion_financiera" ADD CONSTRAINT "importaciones_situacion_financiera_archivo_importado_id_archivos_importados_id_fk" FOREIGN KEY ("archivo_importado_id") REFERENCES "public"."archivos_importados"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reportes_bancarios" ADD CONSTRAINT "reportes_bancarios_archivo_importado_id_archivos_importados_id_fk" FOREIGN KEY ("archivo_importado_id") REFERENCES "public"."archivos_importados"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_movimientos_cuentas_archivo" ON "movimientos_cuentas" USING btree ("archivo_importado_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ux_importaciones_balanza_archivo" ON "importaciones_balanza" USING btree ("archivo_importado_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ux_importaciones_situacion_archivo" ON "importaciones_situacion_financiera" USING btree ("archivo_importado_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ux_reportes_bancarios_archivo" ON "reportes_bancarios" USING btree ("archivo_importado_id");
--> statement-breakpoint
CREATE TABLE "conciliaciones_archivos_importados" (
	"conciliacion_id" uuid NOT NULL,
	"archivo_importado_id" uuid NOT NULL,
	"rol" varchar(18) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_conciliaciones_archivos" PRIMARY KEY("conciliacion_id","archivo_importado_id"),
	CONSTRAINT "ck_conciliaciones_archivos_rol" CHECK ("conciliaciones_archivos_importados"."rol" in ('estado_bancario', 'movimientos'))
);
--> statement-breakpoint
ALTER TABLE "conciliaciones_archivos_importados" ADD CONSTRAINT "conciliaciones_archivos_importados_conciliacion_id_conciliaciones_bancarias_id_fk" FOREIGN KEY ("conciliacion_id") REFERENCES "public"."conciliaciones_bancarias"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conciliaciones_archivos_importados" ADD CONSTRAINT "conciliaciones_archivos_importados_archivo_importado_id_archivos_importados_id_fk" FOREIGN KEY ("archivo_importado_id") REFERENCES "public"."archivos_importados"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_conciliaciones_archivos_archivo" ON "conciliaciones_archivos_importados" USING btree ("archivo_importado_id");
