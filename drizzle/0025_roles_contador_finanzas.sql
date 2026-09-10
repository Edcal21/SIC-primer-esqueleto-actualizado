INSERT INTO "permisos" ("id", "descripcion") VALUES
  ('conciliacion:ver', 'Consultar conciliaciones bancarias.'),
  ('conciliacion:gestionar', 'Generar conciliaciones y enlazar, descartar o reabrir líneas bancarias.')
ON CONFLICT ("id") DO UPDATE SET
  "descripcion" = EXCLUDED."descripcion";
--> statement-breakpoint
UPDATE "roles"
SET
  "nombre" = 'Contador',
  "descripcion" = 'Administra el sistema, gestiona conciliaciones, importaciones y descarga todos los reportes; no registra minutas.'
WHERE "id" = 'contador_general';
--> statement-breakpoint
UPDATE "roles"
SET
  "nombre" = 'Finanzas',
  "descripcion" = 'Registra minutas y carga reportes bancarios; no accede al centro de reportes financieros.'
WHERE "id" = 'operador_bancario';
--> statement-breakpoint
UPDATE "usuarios"
SET
  "usuario" = 'finanzas',
  "nombre" = 'Finanzas'
WHERE "id" = 'usr-banco';
--> statement-breakpoint
UPDATE "usuarios"
SET
  "nombre" = 'Contador'
WHERE "id" = 'usr-contador';
--> statement-breakpoint
UPDATE "usuarios"
SET
  "estado" = 'inactivo'
WHERE "id" = 'usr-admin';
--> statement-breakpoint
DELETE FROM "roles_permisos"
WHERE "rol_id" IN ('contador_general', 'operador_bancario');
--> statement-breakpoint
INSERT INTO "roles_permisos" ("rol_id", "permiso_id") VALUES
  ('contador_general', 'panel:ver'),
  ('contador_general', 'usuarios:administrar'),
  ('contador_general', 'roles:administrar'),
  ('contador_general', 'catalogo:administrar'),
  ('contador_general', 'iglesias:administrar'),
  ('contador_general', 'banco:ver'),
  ('contador_general', 'conciliacion:ver'),
  ('contador_general', 'conciliacion:gestionar'),
  ('contador_general', 'conciliacion:aprobar'),
  ('contador_general', 'importaciones:administrar'),
  ('contador_general', 'reportes:ver'),
  ('contador_general', 'reportes:descargar'),
  ('contador_general', 'auditoria:ver'),
  ('contador_general', 'configuracion:administrar'),
  ('operador_bancario', 'panel:ver'),
  ('operador_bancario', 'movimientos:escribir'),
  ('operador_bancario', 'banco:ver'),
  ('operador_bancario', 'banco:cargar')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "roles_permisos" ("rol_id", "permiso_id")
VALUES ('auditor_general', 'conciliacion:ver')
ON CONFLICT DO NOTHING;
