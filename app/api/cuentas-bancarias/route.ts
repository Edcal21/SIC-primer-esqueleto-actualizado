import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { cuentasBancarias } from "../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "movimientos:escribir") && !puede(user, "banco:ver")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  const rows = await db.select({
    numeroCuenta: cuentasBancarias.numeroCuenta,
    nombre: cuentasBancarias.nombre,
    moneda: cuentasBancarias.moneda,
  }).from(cuentasBancarias)
    .where(eq(cuentasBancarias.estado, "activa"))
    .orderBy(asc(cuentasBancarias.nombre), asc(cuentasBancarias.numeroCuenta));

  return Response.json({ cuentasBancarias: rows }, { headers: { "Cache-Control": "no-store" } });
}
