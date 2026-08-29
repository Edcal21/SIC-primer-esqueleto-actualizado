CREATE TABLE "detalles_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movimiento_id" uuid NOT NULL,
	"tipo" varchar(7) NOT NULL,
	"cuenta_codigo" varchar(40) NOT NULL,
	"cuenta_nombre" text NOT NULL,
	"monto" numeric(18, 2) NOT NULL,
	"orden" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_detalles_movimientos_tipo" CHECK ("detalles_movimientos"."tipo" in ('credito', 'debito')),
	CONSTRAINT "ck_detalles_movimientos_monto" CHECK ("detalles_movimientos"."monto" > 0),
	CONSTRAINT "ck_detalles_movimientos_orden" CHECK ("detalles_movimientos"."orden" > 0)
);
--> statement-breakpoint
CREATE TABLE "movimientos_cuentas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date NOT NULL,
	"referencia" varchar(120),
	"concepto" text NOT NULL,
	"estado" varchar(12) DEFAULT 'registrado' NOT NULL,
	"creado_por" varchar(40) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_movimientos_cuentas_estado" CHECK ("movimientos_cuentas"."estado" in ('registrado', 'anulado'))
);
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD CONSTRAINT "detalles_movimientos_movimiento_id_movimientos_cuentas_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos_cuentas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_cuentas" ADD CONSTRAINT "movimientos_cuentas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_detalles_movimientos_movimiento" ON "detalles_movimientos" USING btree ("movimiento_id");--> statement-breakpoint
CREATE INDEX "idx_detalles_movimientos_cuenta" ON "detalles_movimientos" USING btree ("cuenta_codigo");--> statement-breakpoint
CREATE INDEX "idx_detalles_movimientos_tipo" ON "detalles_movimientos" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "idx_movimientos_cuentas_fecha" ON "movimientos_cuentas" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "idx_movimientos_cuentas_referencia" ON "movimientos_cuentas" USING btree ("referencia");--> statement-breakpoint
CREATE INDEX "idx_movimientos_cuentas_estado" ON "movimientos_cuentas" USING btree ("estado");
