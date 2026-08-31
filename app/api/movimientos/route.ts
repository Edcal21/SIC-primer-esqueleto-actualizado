import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { cuentasBancarias, detallesMovimientos, iglesias, movimientosCuentas } from "../../../db/schema";
import { registrarAuditoria } from "../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";

type DetallePayload = {
  tipo?: string;
  cuentaCodigo?: string;
  cuentaNombre?: string;
  monto?: string | number;
};

type MovimientoPayload = {
  fecha?: string;
  iglesiaCodigo?: string;
  cuentaBancariaNumero?: string;
  referencia?: string;
  concepto?: string;
  detalles?: DetallePayload[];
};

const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "movimientos:escribir")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  const movimientos = await db.select().from(movimientosCuentas).orderBy(desc(movimientosCuentas.creadoEn)).limit(100);
  const ids = movimientos.map(item => item.id);
  const detalles = ids.length
    ? await db.select().from(detallesMovimientos).where(inArray(detallesMovimientos.movimientoId, ids)).orderBy(asc(detallesMovimientos.orden))
    : [];

  return Response.json({ movimientos, detalles }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "movimientos:escribir")) return jsonError("No tiene permiso para registrar movimientos", 403);

  let body: MovimientoPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const fecha = body.fecha?.trim();
  const iglesiaCodigo = body.iglesiaCodigo?.trim();
  const cuentaBancariaNumero = body.cuentaBancariaNumero?.trim();
  const referencia = body.referencia?.trim() || null;
  const concepto = body.concepto?.trim();
  const detalles = body.detalles ?? [];

  if (!fecha || !fechaRegex.test(fecha)) return jsonError("Fecha inválida", 400);
  if (!iglesiaCodigo) return jsonError("La iglesia es obligatoria", 400);
  if (!cuentaBancariaNumero) return jsonError("La cuenta bancaria es obligatoria", 400);
  if (!concepto) return jsonError("Concepto es obligatorio", 400);
  if (detalles.length < 2) return jsonError("Debe agregar al menos dos detalles para cumplir partida doble", 400);

  const detallesNormalizados = detalles.map((detalle, index) => ({
    tipo: detalle.tipo?.trim().toLowerCase(),
    cuentaCodigo: detalle.cuentaCodigo?.trim(),
    cuentaNombre: detalle.cuentaNombre?.trim(),
    monto: String(detalle.monto ?? "").trim(),
    orden: index + 1,
  }));

  for (const detalle of detallesNormalizados) {
    if (detalle.tipo !== "credito" && detalle.tipo !== "debito") return jsonError("Tipo inválido; utilice crédito o débito", 400);
    if (!detalle.cuentaCodigo || !detalle.cuentaNombre) return jsonError("La cuenta del detalle es obligatoria", 400);
    const monto = Number(detalle.monto);
    if (!Number.isFinite(monto) || monto <= 0) return jsonError("El monto debe ser mayor que cero", 400);
  }
  const totalDebitos = detallesNormalizados.filter(detalle => detalle.tipo === "debito").reduce((total, detalle) => total + Number(detalle.monto), 0);
  const totalCreditos = detallesNormalizados.filter(detalle => detalle.tipo === "credito").reduce((total, detalle) => total + Number(detalle.monto), 0);
  if (Math.abs(totalDebitos - totalCreditos) >= 0.01) return jsonError("La minuta no está cuadrada: el total de débitos debe ser igual al total de créditos", 400);

  const db = getDb();
  try {
    const [iglesia] = await db.select({ codigo: iglesias.codigo }).from(iglesias)
      .where(and(eq(iglesias.codigo, iglesiaCodigo), eq(iglesias.estado, "activa"))).limit(1);
    if (!iglesia) return jsonError("La iglesia seleccionada no existe o está inactiva", 400);
    const [cuentaBancaria] = await db.select({ numeroCuenta: cuentasBancarias.numeroCuenta }).from(cuentasBancarias)
      .where(and(eq(cuentasBancarias.numeroCuenta, cuentaBancariaNumero), eq(cuentasBancarias.estado, "activa"))).limit(1);
    if (!cuentaBancaria) return jsonError("La cuenta bancaria seleccionada no existe o está inactiva", 400);

    const result = await db.transaction(async tx => {
      const [movimiento] = await tx.insert(movimientosCuentas).values({
        fecha,
        iglesiaCodigo,
        cuentaBancariaNumero,
        referencia,
        concepto,
        creadoPor: user.id,
      }).returning();

      const detallesCreados = await tx.insert(detallesMovimientos).values(
        detallesNormalizados.map(detalle => ({
          movimientoId: movimiento.id,
          tipo: detalle.tipo as "credito" | "debito",
          cuentaCodigo: detalle.cuentaCodigo!,
          cuentaNombre: detalle.cuentaNombre!,
          monto: Number(detalle.monto).toFixed(2),
          orden: detalle.orden,
        })),
      ).returning();
      await registrarAuditoria(tx, {
        user,
        modulo: "Minutas",
        accion: "Registró movimiento contable",
        entidad: "movimientos_cuentas",
        entidadId: movimiento.id,
        detalle: `${fecha} · Iglesia ${iglesiaCodigo} · Cuenta bancaria ${cuentaBancariaNumero} · ${concepto}`,
      });

      return { movimiento, detalles: detallesCreados };
    });

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Movement creation failed", error);
    return jsonError("No se pudo guardar el movimiento", 500);
  }
}
