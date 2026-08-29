import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { roles, usuarios } from "../../../../../db/schema";
import { registrarAuditoria } from "../../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest, type UsuarioSesion } from "../../../../../lib/auth";

type UsuarioUpdatePayload = {
  nombre?: string;
  rolId?: string;
  estado?: "activo" | "inactivo";
};

type AdminAuth = { user: UsuarioSesion; error?: never } | { user?: never; error: Response };

async function requireAdmin(request: Request): Promise<AdminAuth> {
  const user = await usuarioDesdeRequest(request);
  if (!user) return { error: jsonError("No autenticado", 401) };
  if (!puede(user, "usuarios:administrar")) return { error: jsonError("Permiso insuficiente", 403) };
  return { user };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;

  let body: UsuarioUpdatePayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  if (id === auth.user.id && (body.estado === "inactivo" || body.rolId !== undefined)) {
    return jsonError("No puede cambiar su propio rol ni inactivar su usuario", 400);
  }

  const values: Partial<typeof usuarios.$inferInsert> = {};
  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim();
    if (!nombre) return jsonError("Nombre es obligatorio", 400);
    values.nombre = nombre;
  }
  if (body.estado !== undefined) {
    if (!["activo", "inactivo"].includes(body.estado)) return jsonError("Estado inválido", 400);
    values.estado = body.estado;
  }
  if (body.rolId !== undefined) {
    const db = getDb();
    const [rol] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, body.rolId)).limit(1);
    if (!rol) return jsonError("Rol no encontrado", 404);
    values.rolId = body.rolId;
  }
  if (!Object.keys(values).length) return jsonError("No hay cambios para aplicar", 400);

  const db = getDb();
  const [updated] = await db.update(usuarios).set(values).where(eq(usuarios.id, id)).returning({
    id: usuarios.id,
    usuario: usuarios.usuario,
    nombre: usuarios.nombre,
    rolId: usuarios.rolId,
    estado: usuarios.estado,
    creadoEn: usuarios.creadoEn,
  });

  if (!updated) return jsonError("Usuario no encontrado", 404);
  await registrarAuditoria(db, { user: auth.user, modulo: "Usuarios", accion: "Actualizó usuario", entidad: "usuarios", entidadId: updated.id, detalle: Object.keys(values).join(", ") });
  return Response.json({ usuario: updated }, { headers: { "Cache-Control": "no-store" } });
}
