INSERT INTO "roles" ("id", "nombre", "descripcion") VALUES
	('administrador', 'Administrador', 'Administra usuarios, roles y perfiles del sistema.');
--> statement-breakpoint
INSERT INTO "permisos" ("id", "descripcion") VALUES
	('usuarios:administrar', 'Administrar usuarios del sistema.'),
	('roles:administrar', 'Administrar roles y perfiles del sistema.');
--> statement-breakpoint
INSERT INTO "roles_permisos" ("rol_id", "permiso_id") VALUES
	('administrador', 'panel:ver'),
	('administrador', 'usuarios:administrar'),
	('administrador', 'roles:administrar'),
	('administrador', 'auditoria:ver');
--> statement-breakpoint
INSERT INTO "usuarios" ("id", "usuario", "nombre", "rol_id", "salt", "password_hash") VALUES
	('usr-admin', 'administrador', 'Administrador del Sistema', 'administrador', '4836377235e90964097682ebfda61e05', 'd913ff8d9bf0ca9a71ce0d5625886395f1f32922d52ae740513f870ae5227ddd');
