import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cuentasContables } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

type CuentaPayload = {
  codigo?: string;
  descripcion?: string;
  naturaleza?: "deudora" | "acreedora";
  clasificacionFlujo?: "operación" | "inversión" | "financiamiento" | "no aplica";
  esCuentaMovimiento?: boolean;
};

const codigoRegex = /^\d{8}$/;
const naturalezas = new Set(["deudora", "acreedora"]);
const flujos = new Set(["operación", "inversión", "financiamiento", "no aplica"]);

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "movimientos:escribir") && !puede(user, "catalogo:administrar") && !puede(user, "reportes:ver")) {
    return jsonError("Permiso insuficiente", 403);
  }

  const url = new URL(request.url);
  const soloMovimiento = url.searchParams.get("movimiento") !== "false";
  const where = soloMovimiento ? and(eq(cuentasContables.estado, "activa"), eq(cuentasContables.esCuentaMovimiento, true)) : undefined;

  const cuentas = await getDb().select({
    codigo: cuentasContables.codigo,
    descripcion: cuentasContables.descripcion,
    esCuentaMovimiento: cuentasContables.esCuentaMovimiento,
    naturaleza: cuentasContables.naturaleza,
    estado: cuentasContables.estado,
    clasificacionFlujo: cuentasContables.clasificacionFlujo,
  }).from(cuentasContables).where(where).orderBy(asc(cuentasContables.codigo));

  return Response.json({ cuentas }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "catalogo:administrar")) return jsonError("Permiso insuficiente", 403);

  let body: CuentaPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const codigo = body.codigo?.trim();
  const descripcion = body.descripcion?.trim();
  const naturaleza = body.naturaleza ?? "deudora";
  const clasificacionFlujo = body.clasificacionFlujo ?? "no aplica";

  if (!codigo || !codigoRegex.test(codigo)) return jsonError("El código debe tener 8 dígitos", 400);
  if (!descripcion) return jsonError("La descripción es obligatoria", 400);
  if (!naturalezas.has(naturaleza)) return jsonError("Naturaleza inválida", 400);
  if (!flujos.has(clasificacionFlujo)) return jsonError("Clasificación de flujo inválida", 400);

  const db = getDb();
  try {
    const [cuenta] = await db.insert(cuentasContables).values({
      codigo,
      descripcion,
      nivel: 5,
      esCuentaMovimiento: body.esCuentaMovimiento ?? true,
      naturaleza,
      clasificacionFlujo,
    }).returning();
    await registrarAuditoria(db, { user, modulo: "Catálogo", accion: "Creó cuenta contable", entidad: "cuentas_contables", entidadId: cuenta.codigo, detalle: cuenta.descripcion });
    return Response.json({ cuenta }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Account creation failed", error);
    return jsonError("No se pudo crear la cuenta; verifique que el código no exista", 409);
  }
}
