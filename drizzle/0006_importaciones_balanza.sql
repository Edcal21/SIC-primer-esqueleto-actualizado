CREATE TABLE "importaciones_balanza" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archivo_nombre" text NOT NULL,
	"archivo_tamano" integer NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"estado" varchar(12) DEFAULT 'procesado' NOT NULL,
	"total_lineas" integer DEFAULT 0 NOT NULL,
	"total_debe" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_haber" numeric(18, 2) DEFAULT '0' NOT NULL,
	"importado_por" varchar(40) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_importaciones_balanza_periodo" CHECK ("importaciones_balanza"."periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "ck_importaciones_balanza_estado" CHECK ("importaciones_balanza"."estado" in ('procesado', 'error')),
	CONSTRAINT "ck_importaciones_balanza_totales" CHECK ("importaciones_balanza"."total_lineas" >= 0 and "importaciones_balanza"."total_debe" >= 0 and "importaciones_balanza"."total_haber" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lineas_balanza" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importacion_id" uuid NOT NULL,
	"numero_linea" integer NOT NULL,
	"cuenta_codigo" varchar(40) NOT NULL,
	"cuenta_nombre" text NOT NULL,
	"debe" numeric(18, 2) DEFAULT '0' NOT NULL,
	"haber" numeric(18, 2) DEFAULT '0' NOT NULL,
	"saldo" numeric(18, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "ck_lineas_balanza_numero" CHECK ("lineas_balanza"."numero_linea" > 0),
	CONSTRAINT "ck_lineas_balanza_montos" CHECK ("lineas_balanza"."debe" >= 0 and "lineas_balanza"."haber" >= 0)
);
--> statement-breakpoint
ALTER TABLE "importaciones_balanza" ADD CONSTRAINT "importaciones_balanza_importado_por_usuarios_id_fk" FOREIGN KEY ("importado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lineas_balanza" ADD CONSTRAINT "lineas_balanza_importacion_id_importaciones_balanza_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."importaciones_balanza"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_importaciones_balanza_periodo" ON "importaciones_balanza" USING btree ("periodo");
--> statement-breakpoint
CREATE INDEX "idx_importaciones_balanza_usuario" ON "importaciones_balanza" USING btree ("importado_por");
--> statement-breakpoint
CREATE INDEX "idx_lineas_balanza_importacion" ON "lineas_balanza" USING btree ("importacion_id");
--> statement-breakpoint
CREATE INDEX "idx_lineas_balanza_cuenta" ON "lineas_balanza" USING btree ("cuenta_codigo");
