import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cuentasContables } from "../../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "movimientos:escribir") && !puede(user, "catalogo:administrar") && !puede(user, "reportes:ver")) {
    return jsonError("Permiso insuficiente", 403);
  }

  const url = new URL(request.url);
  const soloMovimiento = url.searchParams.get("movimiento") !== "false";
  const where = soloMovimiento
    ? and(eq(cuentasContables.estado, "activa"), eq(cuentasContables.esCuentaMovimiento, true))
    : eq(cuentasContables.estado, "activa");

  const cuentas = await getDb().select({
    codigo: cuentasContables.codigo,
    descripcion: cuentasContables.descripcion,
    naturaleza: cuentasContables.naturaleza,
    clasificacionFlujo: cuentasContables.clasificacionFlujo,
  }).from(cuentasContables).where(where).orderBy(asc(cuentasContables.codigo));

  return Response.json({ cuentas }, { headers: { "Cache-Control": "no-store" } });
}
