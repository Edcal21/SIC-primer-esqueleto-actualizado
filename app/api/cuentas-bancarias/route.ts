import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { cuentasBancarias } from "../../../db/schema";
import { registrarAuditoria } from "../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";

type CuentaBancariaPayload = {
  numeroCuenta?: string;
  nombre?: string;
  moneda?: "USD" | "NIO";
};

const monedas = new Set(["USD", "NIO"]);

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "movimientos:escribir") && !puede(user, "banco:ver") && !puede(user, "catalogo:administrar")) {
    return jsonError("Permiso insuficiente", 403);
  }

  const url = new URL(request.url);
  const soloActivas = url.searchParams.get("estado") !== "todas" || !puede(user, "catalogo:administrar");
  const db = getDb();
  const rows = await db.select({
    numeroCuenta: cuentasBancarias.numeroCuenta,
    nombre: cuentasBancarias.nombre,
    moneda: cuentasBancarias.moneda,
    estado: cuentasBancarias.estado,
  }).from(cuentasBancarias)
    .where(soloActivas ? eq(cuentasBancarias.estado, "activa") : undefined)
    .orderBy(asc(cuentasBancarias.nombre), asc(cuentasBancarias.numeroCuenta));

  return Response.json({ cuentasBancarias: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "catalogo:administrar")) return jsonError("No tiene permiso para administrar cuentas bancarias", 403);

  let body: CuentaBancariaPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const numeroCuenta = body.numeroCuenta?.trim();
  const nombre = body.nombre?.trim();
  const moneda = body.moneda;

  if (!numeroCuenta) return jsonError("El número de cuenta es obligatorio", 400);
  if (numeroCuenta.length > 32) return jsonError("El número de cuenta admite hasta 32 caracteres", 400);
  if (!nombre) return jsonError("El nombre de la cuenta bancaria es obligatorio", 400);
  if (!moneda || !monedas.has(moneda)) return jsonError("Moneda inválida; use NIO o USD", 400);

  const db = getDb();
  const [existente] = await db.select({ numeroCuenta: cuentasBancarias.numeroCuenta }).from(cuentasBancarias).where(eq(cuentasBancarias.numeroCuenta, numeroCuenta)).limit(1);
  if (existente) return jsonError("Ya existe una cuenta bancaria con ese número", 409);

  try {
    const [cuenta] = await db.insert(cuentasBancarias).values({ numeroCuenta, nombre, moneda }).returning();
    await registrarAuditoria(db, {
      user,
      modulo: "Bancos",
      accion: "Creó cuenta bancaria",
      entidad: "cuentas_bancarias",
      entidadId: cuenta.numeroCuenta,
      detalle: `${cuenta.nombre} · ${cuenta.moneda}`,
    });
    return Response.json({ cuentaBancaria: cuenta }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bank account creation failed", error);
    return jsonError("No se pudo crear la cuenta bancaria", 500);
  }
}
