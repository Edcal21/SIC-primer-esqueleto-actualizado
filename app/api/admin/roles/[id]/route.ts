import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { permisos, roles, rolesPermisos } from "../../../../../db/schema";
import { registrarAuditoria } from "../../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../../lib/auth";

type RolUpdatePayload = {
  nombre?: string;
  descripcion?: string;
  permisos?: string[];
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "roles:administrar")) return jsonError("Permiso insuficiente", 403);

  const { id } = await params;
  let body: RolUpdatePayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const values: Partial<typeof roles.$inferInsert> = {};
  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim();
    if (!nombre) return jsonError("Nombre es obligatorio", 400);
    values.nombre = nombre;
  }
  if (body.descripcion !== undefined) {
    const descripcion = body.descripcion.trim();
    if (!descripcion) return jsonError("Descripción es obligatoria", 400);
    values.descripcion = descripcion;
  }

  const db = getDb();
  let permissionIds: string[] | undefined;
  if (body.permisos !== undefined) {
    permissionIds = [...new Set(body.permisos)];
    if (id === "administrador" && (!permissionIds.includes("usuarios:administrar") || !permissionIds.includes("roles:administrar"))) {
      return jsonError("El rol administrador debe conservar permisos administrativos", 400);
    }
    const validPermissions = await db.select({ id: permisos.id }).from(permisos);
    const validPermissionIds = new Set(validPermissions.map(item => item.id));
    if (permissionIds.some(item => !validPermissionIds.has(item))) return jsonError("La lista de permisos contiene valores inválidos", 400);
  }

  const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!existing) return jsonError("Rol no encontrado", 404);

  let updated = existing;
  if (Object.keys(values).length) {
    [updated] = await db.update(roles).set(values).where(eq(roles.id, id)).returning();
  }
  if (permissionIds !== undefined) {
    await db.delete(rolesPermisos).where(eq(rolesPermisos.rolId, id));
    if (permissionIds.length) {
      await db.insert(rolesPermisos).values(permissionIds.map(permisoId => ({ rolId: id, permisoId })));
    }
  }

  const rolePermissions = await db.select({ permisoId: rolesPermisos.permisoId }).from(rolesPermisos).where(eq(rolesPermisos.rolId, id));
  await registrarAuditoria(db, { user, modulo: "Roles", accion: "Actualizó rol", entidad: "roles", entidadId: id, detalle: permissionIds ? `${permissionIds.length} permisos` : Object.keys(values).join(", ") });
  return Response.json({ rol: { ...updated, permisos: rolePermissions.map(item => item.permisoId) } }, { headers: { "Cache-Control": "no-store" } });
}
