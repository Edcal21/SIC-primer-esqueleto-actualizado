ALTER TABLE "archivos_importados" DROP CONSTRAINT "ck_archivos_importados_tipo";
--> statement-breakpoint
ALTER TABLE "archivos_importados" ADD CONSTRAINT "ck_archivos_importados_tipo" CHECK ("archivos_importados"."tipo" in ('estado_bancario', 'balanza', 'situacion_financiera', 'estado_resultado', 'catalogo_contable', 'auxiliar_contable'));
--> statement-breakpoint
CREATE TABLE "importaciones_estado_resultado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archivo_nombre" text NOT NULL,
	"archivo_tamano" integer NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"estado" varchar(10) DEFAULT 'procesado' NOT NULL,
	"total_lineas" integer DEFAULT 0 NOT NULL,
	"total_ingresos" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_gastos" numeric(18, 2) DEFAULT '0' NOT NULL,
	"resultado_ejercicio" numeric(18, 2) DEFAULT '0' NOT NULL,
	"importado_por" varchar(40) NOT NULL,
	"archivo_importado_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_importaciones_resultado_periodo" CHECK ("importaciones_estado_resultado"."periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "ck_importaciones_resultado_estado" CHECK ("importaciones_estado_resultado"."estado" in ('procesado', 'error')),
	CONSTRAINT "ck_importaciones_resultado_lineas" CHECK ("importaciones_estado_resultado"."total_lineas" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lineas_estado_resultado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importacion_id" uuid NOT NULL,
	"numero_linea" integer NOT NULL,
	"concepto" text NOT NULL,
	"saldo_inicial" numeric(18, 2) DEFAULT '0' NOT NULL,
	"movimiento_periodo" numeric(18, 2) DEFAULT '0' NOT NULL,
	"saldo_final" numeric(18, 2) DEFAULT '0' NOT NULL,
	"es_total" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ck_lineas_resultado_numero" CHECK ("lineas_estado_resultado"."numero_linea" > 0),
	CONSTRAINT "ck_lineas_resultado_concepto" CHECK (length(trim("lineas_estado_resultado"."concepto")) > 0)
);
--> statement-breakpoint
ALTER TABLE "importaciones_estado_resultado" ADD CONSTRAINT "importaciones_estado_resultado_importado_por_usuarios_id_fk" FOREIGN KEY ("importado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "importaciones_estado_resultado" ADD CONSTRAINT "importaciones_estado_resultado_archivo_importado_id_archivos_importados_id_fk" FOREIGN KEY ("archivo_importado_id") REFERENCES "public"."archivos_importados"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lineas_estado_resultado" ADD CONSTRAINT "lineas_estado_resultado_importacion_id_importaciones_estado_resultado_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."importaciones_estado_resultado"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_importaciones_resultado_periodo" ON "importaciones_estado_resultado" USING btree ("periodo");
--> statement-breakpoint
CREATE INDEX "idx_importaciones_resultado_usuario" ON "importaciones_estado_resultado" USING btree ("importado_por");
--> statement-breakpoint
CREATE UNIQUE INDEX "ux_importaciones_resultado_archivo" ON "importaciones_estado_resultado" USING btree ("archivo_importado_id");
--> statement-breakpoint
CREATE INDEX "idx_lineas_resultado_importacion" ON "lineas_estado_resultado" USING btree ("importacion_id");
--> statement-breakpoint
CREATE INDEX "idx_lineas_resultado_concepto" ON "lineas_estado_resultado" USING btree ("concepto");
