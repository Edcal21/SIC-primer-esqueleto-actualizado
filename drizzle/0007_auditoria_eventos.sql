CREATE TABLE "auditoria_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" varchar(40),
	"usuario_nombre" text NOT NULL,
	"modulo" varchar(40) NOT NULL,
	"accion" varchar(80) NOT NULL,
	"entidad" varchar(80),
	"entidad_id" text,
	"resultado" varchar(12) NOT NULL,
	"detalle" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_auditoria_eventos_resultado" CHECK ("auditoria_eventos"."resultado" in ('correcto', 'error'))
);
--> statement-breakpoint
ALTER TABLE "auditoria_eventos" ADD CONSTRAINT "auditoria_eventos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_auditoria_eventos_fecha" ON "auditoria_eventos" USING btree ("creado_en");
--> statement-breakpoint
CREATE INDEX "idx_auditoria_eventos_usuario" ON "auditoria_eventos" USING btree ("usuario_id");
--> statement-breakpoint
CREATE INDEX "idx_auditoria_eventos_modulo" ON "auditoria_eventos" USING btree ("modulo");
