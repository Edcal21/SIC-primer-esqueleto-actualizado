UPDATE "roles"
SET "descripcion" = 'Importa balanza de comprobación y descarga reportes.'
WHERE "id" = 'contador_general';
--> statement-breakpoint
UPDATE "roles"
SET "descripcion" = 'Registra minutas y consulta/carga reportes bancarios.'
WHERE "id" = 'operador_bancario';
--> statement-breakpoint
DELETE FROM "roles_permisos"
WHERE "rol_id" = 'contador_general'
	AND "permiso_id" IN ('movimientos:escribir', 'catalogo:administrar', 'banco:ver', 'banco:cargar', 'conciliacion:aprobar');
--> statement-breakpoint
INSERT INTO "roles_permisos" ("rol_id", "permiso_id") VALUES
	('contador_general', 'panel:ver'),
	('contador_general', 'importaciones:administrar'),
	('contador_general', 'reportes:ver'),
	('contador_general', 'reportes:descargar'),
	('operador_bancario', 'movimientos:escribir')
ON CONFLICT DO NOTHING;
