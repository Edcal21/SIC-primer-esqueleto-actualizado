import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";
import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditoriaEventos } from "../../../db/schema";

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "auditoria:ver")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  const rows = await db.select().from(auditoriaEventos).orderBy(desc(auditoriaEventos.creadoEn)).limit(100);
  return Response.json({
    eventos: rows.map(row => ({
      fecha: row.creadoEn,
      usuario: row.usuarioNombre,
      accion: `${row.modulo}: ${row.accion}`,
      resultado: row.resultado,
      detalle: row.detalle,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
