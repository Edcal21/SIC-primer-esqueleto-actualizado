INSERT INTO roles_permisos (rol_id, permiso_id)
VALUES ('administrador', 'catalogo:administrar')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
