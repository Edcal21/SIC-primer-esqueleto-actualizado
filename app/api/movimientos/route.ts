import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { cuentasBancarias, detallesMovimientos, iglesias, lineasReporteBancario, movimientosCuentas } from "../../../db/schema";
import { registrarAuditoria } from "../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";
import { construirDetallesMovimiento, type DetalleEntrada } from "../../../lib/movimientos";
import { obtenerTasaVigente } from "../../../lib/tasas";
import { verificarPeriodosAbiertos } from "../../../lib/periodos";

type DetallePayload = DetalleEntrada;

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
  const [detalles, enlazados] = ids.length
    ? await Promise.all([
      db.select().from(detallesMovimientos).where(inArray(detallesMovimientos.movimientoId, ids)).orderBy(asc(detallesMovimientos.orden)),
      db.select({ movimientoId: lineasReporteBancario.movimientoId }).from(lineasReporteBancario).where(inArray(lineasReporteBancario.movimientoId, ids)),
    ])
    : [[], []];

  const conciliados = new Set(enlazados.map(item => item.movimientoId));
  return Response.json({
    movimientos: movimientos.map(movimiento => ({ ...movimiento, enlazadoAConciliacion: conciliados.has(movimiento.id) })),
    detalles,
  }, { headers: { "Cache-Control": "no-store" } });
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

  const db = getDb();
  try {
    const bloqueo = await verificarPeriodosAbiertos(db, [fecha]);
    if (bloqueo) return jsonError(bloqueo.mensaje, 409);

    const [iglesia] = await db.select({ codigo: iglesias.codigo }).from(iglesias)
      .where(and(eq(iglesias.codigo, iglesiaCodigo), eq(iglesias.estado, "activa"))).limit(1);
    if (!iglesia) return jsonError("La iglesia seleccionada no existe o está inactiva", 400);
    const [cuentaBancaria] = await db.select({ numeroCuenta: cuentasBancarias.numeroCuenta, moneda: cuentasBancarias.moneda }).from(cuentasBancarias)
      .where(and(eq(cuentasBancarias.numeroCuenta, cuentaBancariaNumero), eq(cuentasBancarias.estado, "activa"))).limit(1);
    if (!cuentaBancaria) return jsonError("La cuenta bancaria seleccionada no existe o está inactiva", 400);

    const tasaUsd = cuentaBancaria.moneda === "USD" ? await obtenerTasaVigente(db, fecha) : null;
    const resultadoDetalles = construirDetallesMovimiento(detalles, { cuentaBancariaMoneda: cuentaBancaria.moneda, tasaUsd });
    if (!resultadoDetalles.ok) return jsonError(resultadoDetalles.error, 400);
    const detallesNormalizados = resultadoDetalles.detalles;

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
          tipo: detalle.tipo,
          cuentaCodigo: detalle.cuentaCodigo,
          cuentaNombre: detalle.cuentaNombre,
          monto: detalle.monto,
          orden: detalle.orden,
          afectaCuentaBancaria: detalle.afectaCuentaBancaria,
          moneda: detalle.moneda,
          montoOriginal: detalle.montoOriginal,
          tasaCambio: detalle.tasaCambio,
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
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return jsonError("Ya existe una minuta registrada con la misma fecha, iglesia, cuenta bancaria y referencia", 409);
    }
    if (error && typeof error === "object" && "code" in error && error.code === "23514") {
      return jsonError("La minuta no cumple las reglas contables de partida doble", 400);
    }
    return jsonError("No se pudo guardar el movimiento", 500);
  }
}
