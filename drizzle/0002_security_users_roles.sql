CREATE TABLE "roles" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permisos" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"descripcion" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles_permisos" (
	"rol_id" varchar(40) NOT NULL,
	"permiso_id" varchar(80) NOT NULL,
	CONSTRAINT "pk_roles_permisos" PRIMARY KEY("rol_id","permiso_id")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"usuario" varchar(80) NOT NULL,
	"nombre" text NOT NULL,
	"rol_id" varchar(40) NOT NULL,
	"salt" varchar(32) NOT NULL,
	"password_hash" varchar(64) NOT NULL,
	"estado" varchar(8) DEFAULT 'activo' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_usuarios_estado" CHECK ("usuarios"."estado" in ('activo', 'inactivo'))
);
--> statement-breakpoint
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permiso_id_permisos_id_fk" FOREIGN KEY ("permiso_id") REFERENCES "public"."permisos"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_roles_permisos_permiso" ON "roles_permisos" USING btree ("permiso_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ux_usuarios_usuario" ON "usuarios" USING btree ("usuario");
--> statement-breakpoint
CREATE INDEX "idx_usuarios_rol_estado" ON "usuarios" USING btree ("rol_id","estado");
--> statement-breakpoint
INSERT INTO "roles" ("id", "nombre", "descripcion") VALUES
	('contador_general', 'Contador general', 'Acceso operativo contable completo.'),
	('operador_bancario', 'Operador bancario', 'Consulta y carga de reportes bancarios.'),
	('auditor_general', 'Auditor general', 'Consulta de reportes, bancos y auditoría.');
--> statement-breakpoint
INSERT INTO "permisos" ("id", "descripcion") VALUES
	('panel:ver', 'Ver panel general.'),
	('movimientos:escribir', 'Registrar movimientos contables.'),
	('catalogo:administrar', 'Administrar catálogo contable.'),
	('banco:ver', 'Ver reportes bancarios.'),
	('banco:cargar', 'Cargar reportes bancarios.'),
	('conciliacion:aprobar', 'Aprobar conciliaciones.'),
	('importaciones:administrar', 'Administrar importaciones contables.'),
	('reportes:ver', 'Ver reportes financieros.'),
	('reportes:descargar', 'Descargar reportes financieros.'),
	('auditoria:ver', 'Ver auditoría del sistema.');
--> statement-breakpoint
INSERT INTO "roles_permisos" ("rol_id", "permiso_id") VALUES
	('contador_general', 'panel:ver'),
	('contador_general', 'movimientos:escribir'),
	('contador_general', 'catalogo:administrar'),
	('contador_general', 'banco:ver'),
	('contador_general', 'banco:cargar'),
	('contador_general', 'conciliacion:aprobar'),
	('contador_general', 'importaciones:administrar'),
	('contador_general', 'reportes:ver'),
	('contador_general', 'reportes:descargar'),
	('operador_bancario', 'panel:ver'),
	('operador_bancario', 'banco:ver'),
	('operador_bancario', 'banco:cargar'),
	('operador_bancario', 'reportes:ver'),
	('auditor_general', 'panel:ver'),
	('auditor_general', 'banco:ver'),
	('auditor_general', 'reportes:ver'),
	('auditor_general', 'reportes:descargar'),
	('auditor_general', 'auditoria:ver');
--> statement-breakpoint
INSERT INTO "usuarios" ("id", "usuario", "nombre", "rol_id", "salt", "password_hash") VALUES
	('usr-contador', 'contador', 'Contador General', 'contador_general', 'b04259fa5a05cd95fda1a4af06b926d8', 'a84233f4147da5048daef1e3d0d875df1d9ad96a9b77b35c399001793f9b5253'),
	('usr-banco', 'banco', 'Operador Bancario', 'operador_bancario', 'cd15b6c7a108464a98ed72733da083aa', '07ec8bed948731f1ccb8d4f5e49ac38ed62eab2f213cbb120950d2f9233525cc'),
	('usr-auditor', 'auditor', 'Auditor General', 'auditor_general', '1ae524d779667e6470265d096ab2efec', '563dff2b46b224cec7a76817f514431c2167f0a7c05ca16db989ba01013670ba');
