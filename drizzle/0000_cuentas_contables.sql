CREATE TABLE `cuentas_contables` (
	`codigo` text(8) PRIMARY KEY NOT NULL,
	`descripcion` text NOT NULL,
	`nivel` integer NOT NULL,
	`cuenta_padre` text(8),
	`es_cuenta_movimiento` integer DEFAULT false NOT NULL,
	`naturaleza` text NOT NULL,
	`estado` text DEFAULT 'activa' NOT NULL,
	`clasificacion_flujo` text DEFAULT 'no aplica' NOT NULL,
	CONSTRAINT `ck_cuentas_contables_codigo_8` CHECK(length(`codigo`) = 8),
	CONSTRAINT `ck_cuentas_contables_nivel` CHECK(`nivel` between 1 and 5),
	CONSTRAINT `ck_cuentas_contables_naturaleza` CHECK(`naturaleza` in ('deudora','acreedora')),
	CONSTRAINT `ck_cuentas_contables_estado` CHECK(`estado` in ('activa','inactiva')),
	CONSTRAINT `ck_cuentas_contables_flujo` CHECK(`clasificacion_flujo` in ('operación','inversión','financiamiento','no aplica')),
	FOREIGN KEY (`cuenta_padre`) REFERENCES `cuentas_contables`(`codigo`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_cuentas_contables_codigo` ON `cuentas_contables` (`codigo`);
--> statement-breakpoint
CREATE INDEX `idx_cuentas_contables_padre` ON `cuentas_contables` (`cuenta_padre`);
--> statement-breakpoint
CREATE INDEX `idx_cuentas_contables_movimiento_estado` ON `cuentas_contables` (`es_cuenta_movimiento`,`estado`);
