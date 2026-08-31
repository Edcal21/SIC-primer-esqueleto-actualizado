CREATE TABLE IF NOT EXISTS "reportes_bancarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"estado" varchar(12) DEFAULT 'recibido' NOT NULL,
	"archivo_tamano" integer NOT NULL,
	"cargado_por" varchar(40) NOT NULL,
	"cargado_por_nombre" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reportes_bancarios_estado" CHECK ("reportes_bancarios"."estado" in ('recibido', 'procesado', 'error'))
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reportes_bancarios_cargado_por_usuarios_id_fk') THEN
		ALTER TABLE "reportes_bancarios" ADD CONSTRAINT "reportes_bancarios_cargado_por_usuarios_id_fk" FOREIGN KEY ("cargado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reportes_bancarios_fecha" ON "reportes_bancarios" USING btree ("fecha");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reportes_bancarios_usuario" ON "reportes_bancarios" USING btree ("cargado_por");
