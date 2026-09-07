import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { iglesias } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

type IglesiaUpdatePayload = {
  nombre?: string;
  estado?: "activa" | "inactiva";
};

const estados = new Set(["activa", "inactiva"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "iglesias:administrar")) return jsonError("No tiene permiso para administrar iglesias", 403);

  const { codigo } = await params;
  let body: IglesiaUpdatePayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const values: Partial<typeof iglesias.$inferInsert> = {};
  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim();
    if (!nombre) return jsonError("El nombre de la iglesia es obligatorio", 400);
    values.nombre = nombre;
  }
  if (body.estado !== undefined) {
    if (!estados.has(body.estado)) return jsonError("Estado inválido", 400);
    values.estado = body.estado;
  }
  if (!Object.keys(values).length) return jsonError("No hay cambios para actualizar", 400);

  const db = getDb();
  const [iglesia] = await db.update(iglesias).set(values).where(eq(iglesias.codigo, codigo)).returning();
  if (!iglesia) return jsonError("Iglesia no encontrada", 404);
  await registrarAuditoria(db, { user, modulo: "Iglesias", accion: "Actualizó iglesia", entidad: "iglesias", entidadId: codigo, detalle: Object.keys(values).join(", ") });
  return Response.json({ iglesia }, { headers: { "Cache-Control": "no-store" } });
}
