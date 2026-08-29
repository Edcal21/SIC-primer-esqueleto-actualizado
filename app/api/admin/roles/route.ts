import { asc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { permisos, roles, rolesPermisos } from "../../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

type RolPayload = {
  id?: string;
  nombre?: string;
  descripcion?: string;
  permisos?: string[];
};

const rolIdRegex = /^[a-z0-9_:-]{3,40}$/;

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

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "roles:administrar")) return jsonError("Permiso insuficiente", 403);

  let body: RolPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const id = body.id?.trim().toLowerCase();
  const nombre = body.nombre?.trim();
  const descripcion = body.descripcion?.trim();
  const permissionIds = [...new Set(body.permisos ?? [])];

  if (!id || !rolIdRegex.test(id)) return jsonError("Identificador de rol inválido", 400);
  if (!nombre) return jsonError("Nombre es obligatorio", 400);
  if (!descripcion) return jsonError("Descripción es obligatoria", 400);

  const db = getDb();
  const validPermissions = await db.select({ id: permisos.id }).from(permisos);
  const validPermissionIds = new Set(validPermissions.map(item => item.id));
  if (permissionIds.some(item => !validPermissionIds.has(item))) return jsonError("La lista de permisos contiene valores inválidos", 400);

  try {
    const [created] = await db.insert(roles).values({ id, nombre, descripcion }).returning();
    if (permissionIds.length) {
      await db.insert(rolesPermisos).values(permissionIds.map(permisoId => ({ rolId: id, permisoId })));
    }
    return Response.json({ rol: { ...created, permisos: permissionIds } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Role creation failed", error);
    return jsonError("No se pudo crear el rol; verifique que el identificador no exista", 409);
  }
}
