import { asc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { permisos, roles, rolesPermisos } from "../../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "usuarios:administrar")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  const roleRows = await db.select().from(roles).orderBy(asc(roles.nombre));
  const permissionRows = await db.select().from(permisos).orderBy(asc(permisos.id));
  const rolePermissionRows = await db.select().from(rolesPermisos);

  return Response.json({
    roles: roleRows.map((rol) => ({
      ...rol,
      permisos: rolePermissionRows.filter((item) => item.rolId === rol.id).map((item) => item.permisoId),
    })),
    permisos: permissionRows,
  }, { headers: { "Cache-Control": "no-store" } });
}
