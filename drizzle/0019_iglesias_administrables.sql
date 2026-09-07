INSERT INTO permisos (id, descripcion)
VALUES ('iglesias:administrar', 'Administrar catálogo institucional de iglesias.')
ON CONFLICT (id) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO roles_permisos (rol_id, permiso_id)
VALUES ('administrador', 'iglesias:administrar')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
