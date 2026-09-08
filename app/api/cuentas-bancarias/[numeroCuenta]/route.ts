import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cuentasBancarias } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { tieneMovimientosIncompatibles } from "../../../../lib/cuentasBancarias";

type CuentaBancariaUpdatePayload = {
  nombre?: string;
  moneda?: "USD" | "NIO";
  estado?: "activa" | "inactiva";
};

const monedas = new Set(["USD", "NIO"]);
const estados = new Set(["activa", "inactiva"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ numeroCuenta: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "catalogo:administrar")) return jsonError("No tiene permiso para administrar cuentas bancarias", 403);

  const { numeroCuenta } = await params;
  let body: CuentaBancariaUpdatePayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const db = getDb();
  const values: Partial<typeof cuentasBancarias.$inferInsert> = {};
  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim();
    if (!nombre) return jsonError("El nombre de la cuenta bancaria es obligatorio", 400);
    values.nombre = nombre;
  }
  if (body.moneda !== undefined) {
    if (!monedas.has(body.moneda)) return jsonError("Moneda inválida; use NIO o USD", 400);
    const [actual] = await db.select({ moneda: cuentasBancarias.moneda }).from(cuentasBancarias)
      .where(eq(cuentasBancarias.numeroCuenta, decodeURIComponent(numeroCuenta))).limit(1);
    if (!actual) return jsonError("Cuenta bancaria no encontrada", 404);
    if (actual.moneda !== body.moneda && await tieneMovimientosIncompatibles(db, decodeURIComponent(numeroCuenta))) {
      return jsonError("No se puede cambiar la moneda: esta cuenta ya tiene minutas o estados de cuenta registrados en su moneda actual", 409);
    }
    values.moneda = body.moneda;
  }
  if (body.estado !== undefined) {
    if (!estados.has(body.estado)) return jsonError("Estado inválido", 400);
    values.estado = body.estado;
  }
  if (!Object.keys(values).length) return jsonError("No hay cambios para actualizar", 400);

  try {
    const [cuenta] = await db.update(cuentasBancarias).set(values).where(eq(cuentasBancarias.numeroCuenta, decodeURIComponent(numeroCuenta))).returning();
    if (!cuenta) return jsonError("Cuenta bancaria no encontrada", 404);
    await registrarAuditoria(db, {
      user,
      modulo: "Bancos",
      accion: "Actualizó cuenta bancaria",
      entidad: "cuentas_bancarias",
      entidadId: cuenta.numeroCuenta,
      detalle: Object.keys(values).join(", "),
    });
    return Response.json({ cuentaBancaria: cuenta }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bank account update failed", error);
    return jsonError("No se pudo actualizar la cuenta bancaria", 500);
  }
}
