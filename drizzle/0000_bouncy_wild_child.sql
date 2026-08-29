CREATE TABLE "cuentas_contables" (
	"codigo" varchar(8) PRIMARY KEY NOT NULL,
	"descripcion" text NOT NULL,
	"nivel" integer NOT NULL,
	"cuenta_padre" varchar(8),
	"es_cuenta_movimiento" boolean DEFAULT false NOT NULL,
	"naturaleza" varchar(9) NOT NULL,
	"estado" varchar(8) DEFAULT 'activa' NOT NULL,
	"clasificacion_flujo" varchar(14) DEFAULT 'no aplica' NOT NULL,
	CONSTRAINT "ck_cuentas_contables_codigo_8" CHECK (length("cuentas_contables"."codigo") = 8),
	CONSTRAINT "ck_cuentas_contables_nivel" CHECK ("cuentas_contables"."nivel" between 1 and 5),
	CONSTRAINT "ck_cuentas_contables_naturaleza" CHECK ("cuentas_contables"."naturaleza" in ('deudora', 'acreedora')),
	CONSTRAINT "ck_cuentas_contables_estado" CHECK ("cuentas_contables"."estado" in ('activa', 'inactiva')),
	CONSTRAINT "ck_cuentas_contables_flujo" CHECK ("cuentas_contables"."clasificacion_flujo" in ('operación', 'inversión', 'financiamiento', 'no aplica'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ux_cuentas_contables_codigo" ON "cuentas_contables" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "idx_cuentas_contables_padre" ON "cuentas_contables" USING btree ("cuenta_padre");--> statement-breakpoint
CREATE INDEX "idx_cuentas_contables_movimiento_estado" ON "cuentas_contables" USING btree ("es_cuenta_movimiento","estado");