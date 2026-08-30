import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { iglesias } from "../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "movimientos:escribir")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  const rows = await db.select({ codigo: iglesias.codigo, nombre: iglesias.nombre })
    .from(iglesias)
    .where(eq(iglesias.estado, "activa"))
    .orderBy(asc(iglesias.codigo));

  return Response.json({ iglesias: rows }, { headers: { "Cache-Control": "no-store" } });
}
