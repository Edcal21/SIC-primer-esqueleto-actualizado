import { conBloqueoConciliacion, esConflictoContable } from "../../../../lib/conciliacion-lock";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { conciliacionesBancarias, cuentasBancarias, lineasReporteBancario, movimientosCuentas, reportesBancarios } from "../../../../db/schema";
import { registrarAdvertenciaSegregacionConciliacion, registrarAuditoria } from "../../../../lib/auditoria";
import { estaPendienteDeTasa, mismoMonto, movimientosConciliables, recalcularConciliacion } from "../../../../lib/banco";
import { jsonError, puede, usuarioDesdeRequest, type UsuarioSesion } from "../../../../lib/auth";
import { primerPeriodoCerrado, mensajePeriodoCerrado } from "../../../../lib/periodos";

type AccionConciliacion = "conciliar" | "descartar" | "reabrir" | "aprobar" | "rechazar" | "reabrir_conciliacion";
type ConciliacionUpdatePayload = {
  accion?: AccionConciliacion;
  lineaId?: string;
  movimientoId?: string;
  observaciones?: string;
};

const acciones = new Set<AccionConciliacion>(["conciliar", "descartar", "reabrir", "aprobar", "rechazar", "reabrir_conciliacion"]);

async function cargarConciliacion(db: ReturnType<typeof getDb>, id: string) {
  const [conciliacion] = await db.select().from(conciliacionesBancarias).where(eq(conciliacionesBancarias.id, id)).limit(1);
  return conciliacion ?? null;
}

async function detalle(db: ReturnType<typeof getDb>, id: string) {
  const conciliacion = await cargarConciliacion(db, id);
  if (!conciliacion) return null;

  const [[reporte], [cuenta], lineas] = await Promise.all([
    db.select().from(reportesBancarios).where(eq(reportesBancarios.id, conciliacion.reporteId)).limit(1),
    db.select().from(cuentasBancarias).where(eq(cuentasBancarias.numeroCuenta, conciliacion.cuentaBancariaNumero)).limit(1),
    db.select().from(lineasReporteBancario).where(eq(lineasReporteBancario.reporteId, conciliacion.reporteId)).orderBy(asc(lineasReporteBancario.numeroLinea)),
  ]);

  const fechas = lineas.map(linea => linea.fecha).filter((fecha): fecha is string => Boolean(fecha)).sort();
  const movimientos = await movimientosConciliables(db, conciliacion.cuentaBancariaNumero, fechas[0] ?? null, fechas[fechas.length - 1] ?? null);
  const movimientoPorId = new Map(movimientos.map(movimiento => [movimiento.id, movimiento]));

  return {
    conciliacion: {
      ...conciliacion,
      reporteNombre: reporte?.nombre ?? null,
      cuentaBancariaNombre: cuenta?.nombre ?? null,
      cuentaBancariaMoneda: cuenta?.moneda ?? null,
    },
    lineas: lineas.map(linea => ({
      ...linea,
      movimiento: linea.movimientoId ? movimientoPorId.get(linea.movimientoId) ?? null : null,
    })),
    movimientos,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "conciliacion:ver")) return jsonError("Permiso insuficiente", 403);

  const { id } = await params;
  const db = getDb();
  try {
    const data = await detalle(db, id);
    if (!data) return jsonError("Conciliación no encontrada", 404);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Reconciliation detail failed", error);
    return jsonError("No se pudo cargar la conciliación", 500);
  }
}

async function actualizarLinea(
  db: ReturnType<typeof getDb>,
  user: UsuarioSesion,
  conciliacion: typeof conciliacionesBancarias.$inferSelect,
  accion: Extract<AccionConciliacion, "conciliar" | "descartar" | "reabrir">,
  body: ConciliacionUpdatePayload,
) {
  if (!puede(user, "conciliacion:gestionar")) return jsonError("No tiene permiso para modificar líneas de conciliación", 403);
  if (conciliacion.estado !== "borrador") return jsonError("La conciliación ya fue revisada y no admite cambios", 409);

  const periodoCerradoLinea = await primerPeriodoCerrado(db, [conciliacion.periodo]);
  if (periodoCerradoLinea) return jsonError(mensajePeriodoCerrado(periodoCerradoLinea), 409);

  const lineaId = body.lineaId?.trim();
  if (!lineaId) return jsonError("Indique la línea del estado bancario", 400);
  const [linea] = await db.select().from(lineasReporteBancario)
    .where(and(eq(lineasReporteBancario.id, lineaId), eq(lineasReporteBancario.reporteId, conciliacion.reporteId))).limit(1);
  if (!linea) return jsonError("Línea bancaria no encontrada en este reporte", 404);

  if (accion === "conciliar") {
    if (estaPendienteDeTasa(linea)) {
      return jsonError(
        "Esta línea es de una cuenta USD y no tiene tasa de cambio registrada para su fecha; está pendiente de completar. Registre la tasa del día en Configuración → Tasas de cambio y vuelva a intentar.",
        409,
      );
    }
    const movimientoId = body.movimientoId?.trim();
    if (!movimientoId) return jsonError("Seleccione el movimiento contable a enlazar", 400);
    const [movimiento] = await db.select().from(movimientosCuentas).where(eq(movimientosCuentas.id, movimientoId)).limit(1);
    if (!movimiento) return jsonError("Movimiento contable no encontrado", 404);
    if (movimiento.estado !== "registrado") return jsonError("El movimiento está anulado y no puede conciliarse", 409);
    if (movimiento.cuentaBancariaNumero !== conciliacion.cuentaBancariaNumero) {
      return jsonError("El movimiento pertenece a otra cuenta bancaria", 400);
    }
    const [cuenta] = await db.select().from(cuentasBancarias).where(eq(cuentasBancarias.numeroCuenta, conciliacion.cuentaBancariaNumero)).limit(1);
    if (!cuenta || cuenta.moneda !== linea.moneda) return jsonError("La moneda de la línea no coincide con la cuenta bancaria", 409);
    const candidatos = await movimientosConciliables(db, conciliacion.cuentaBancariaNumero, movimiento.fecha, movimiento.fecha);
    const candidato = candidatos.find(item => item.id === movimientoId);
    if (!candidato || !mismoMonto(linea, candidato)) return jsonError("Moneda, importe o datos históricos incompatibles con la línea bancaria", 409);
    const [ocupada] = await db.select({ id: lineasReporteBancario.id }).from(lineasReporteBancario)
      .where(eq(lineasReporteBancario.movimientoId, movimientoId)).limit(1);
    if (ocupada && ocupada.id !== lineaId) return jsonError("El movimiento ya está enlazado con otra línea bancaria", 409);

    await db.update(lineasReporteBancario)
      .set({ estadoConciliacion: "conciliada", movimientoId, conciliadoPor: user.id, conciliadoEn: new Date() })
      .where(eq(lineasReporteBancario.id, lineaId));
  } else {
    await db.update(lineasReporteBancario)
      .set({
        estadoConciliacion: accion === "descartar" ? "descartada" : "pendiente",
        movimientoId: null,
        conciliadoPor: accion === "descartar" ? user.id : null,
        conciliadoEn: accion === "descartar" ? new Date() : null,
      })
      .where(eq(lineasReporteBancario.id, lineaId));
  }

  const actualizada = await recalcularConciliacion(db, conciliacion.id);
  const etiquetas = { conciliar: "Enlazó línea bancaria con movimiento", descartar: "Descartó línea bancaria", reabrir: "Reabrió línea bancaria" };
  await registrarAuditoria(db, {
    user,
    modulo: "Conciliación",
    accion: etiquetas[accion],
    entidad: "lineas_reporte_bancario",
    entidadId: lineaId,
    detalle: `Conciliación ${conciliacion.id} · línea ${linea.numeroLinea}${accion === "conciliar" ? ` · movimiento ${body.movimientoId}` : ""}`,
  });

  return Response.json({ conciliacion: actualizada }, { headers: { "Cache-Control": "no-store" } });
}

async function revisar(
  db: ReturnType<typeof getDb>,
  user: UsuarioSesion,
  conciliacion: typeof conciliacionesBancarias.$inferSelect,
  accion: Extract<AccionConciliacion, "aprobar" | "rechazar">,
  body: ConciliacionUpdatePayload,
) {
  if (!puede(user, "conciliacion:aprobar")) return jsonError("No tiene permiso para aprobar o rechazar conciliaciones", 403);
  const periodoCerradoRevision = await primerPeriodoCerrado(db, [conciliacion.periodo]);
  if (periodoCerradoRevision) return jsonError(mensajePeriodoCerrado(periodoCerradoRevision), 409);
  if (conciliacion.estado !== "borrador") return jsonError("La conciliación ya fue revisada", 409);

  const observaciones = body.observaciones?.trim() || null;
  if (accion === "rechazar" && !observaciones) return jsonError("Indique el motivo del rechazo", 400);

  if (accion === "aprobar") {
    const data = await detalle(db, conciliacion.id);
    if (!data || data.lineas.some(linea => linea.moneda !== data.conciliacion.cuentaBancariaMoneda || estaPendienteDeTasa(linea) || (linea.estadoConciliacion === "conciliada" && (!linea.movimiento || !mismoMonto(linea, linea.movimiento))))) {
      return jsonError("No se puede aprobar: existen líneas sin tasa o enlaces incompatibles/incompletos", 409);
    }
  }
  const actual = await recalcularConciliacion(db, conciliacion.id);
  if (accion === "aprobar" && actual && actual.lineasPendientes > 0) {
    return jsonError(`No se puede aprobar: quedan ${actual.lineasPendientes} líneas bancarias sin conciliar ni descartar`, 400);
  }

  const [lineaGestionadaPorRevisor] = accion === "aprobar"
    ? await db.select({ id: lineasReporteBancario.id }).from(lineasReporteBancario)
      .where(and(eq(lineasReporteBancario.reporteId, conciliacion.reporteId), eq(lineasReporteBancario.conciliadoPor, user.id))).limit(1)
    : [];
  const creoConciliacion = conciliacion.creadoPor === user.id;
  const modificoLineas = Boolean(lineaGestionadaPorRevisor);

  const [revisada] = await db.update(conciliacionesBancarias).set({
    estado: accion === "aprobar" ? "aprobada" : "rechazada",
    observaciones,
    revisadoPor: user.id,
    revisadoPorNombre: user.nombre,
    revisadoEn: new Date(),
  }).where(eq(conciliacionesBancarias.id, conciliacion.id)).returning();

  await registrarAuditoria(db, {
    user,
    modulo: "Conciliación",
    accion: accion === "aprobar" ? "Aprobó conciliación bancaria" : "Rechazó conciliación bancaria",
    entidad: "conciliaciones_bancarias",
    entidadId: conciliacion.id,
    detalle: `Período ${conciliacion.periodo} · cuenta ${conciliacion.cuentaBancariaNumero}${observaciones ? ` · ${observaciones}` : ""}`,
  });

  if (accion === "aprobar" && (creoConciliacion || modificoLineas)) {
    await registrarAdvertenciaSegregacionConciliacion(db, {
      user,
      conciliacionId: conciliacion.id,
      periodo: conciliacion.periodo,
      cuentaBancariaNumero: conciliacion.cuentaBancariaNumero,
      origen: creoConciliacion && modificoLineas ? "creacion_y_lineas" : creoConciliacion ? "creacion" : "lineas",
    });
  }

  return Response.json({ conciliacion: revisada }, { headers: { "Cache-Control": "no-store" } });
}

async function reabrirConciliacion(
  db: ReturnType<typeof getDb>,
  user: UsuarioSesion,
  conciliacion: typeof conciliacionesBancarias.$inferSelect,
  body: ConciliacionUpdatePayload,
) {
  if (!puede(user, "conciliacion:aprobar")) return jsonError("No tiene permiso para reabrir conciliaciones", 403);
  if (conciliacion.estado !== "rechazada") return jsonError("Solo se puede reabrir una conciliación rechazada", 409);

  const motivo = body.observaciones?.trim();
  if (!motivo || motivo.length < 10) return jsonError("Indique un motivo de reapertura de al menos 10 caracteres", 400);

  const periodoCerrado = await primerPeriodoCerrado(db, [conciliacion.periodo]);
  if (periodoCerrado) return jsonError(mensajePeriodoCerrado(periodoCerrado), 409);

  const detalleAnterior = [
    `Motivo reapertura: ${motivo}`,
    conciliacion.revisadoPorNombre ? `Rechazó: ${conciliacion.revisadoPorNombre}` : null,
    conciliacion.revisadoEn ? `Fecha rechazo: ${conciliacion.revisadoEn.toISOString()}` : null,
    conciliacion.observaciones ? `Motivo rechazo: ${conciliacion.observaciones}` : null,
  ].filter(Boolean).join(" · ");

  const [reabierta] = await db.update(conciliacionesBancarias).set({
    estado: "borrador",
    observaciones: null,
    revisadoPor: null,
    revisadoPorNombre: null,
    revisadoEn: null,
  }).where(eq(conciliacionesBancarias.id, conciliacion.id)).returning();

  await registrarAuditoria(db, {
    user,
    modulo: "Conciliación",
    accion: "Reabrió conciliación rechazada",
    entidad: "conciliaciones_bancarias",
    entidadId: conciliacion.id,
    detalle: detalleAnterior,
  });

  return Response.json({ conciliacion: reabierta }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "conciliacion:ver")) return jsonError("Permiso insuficiente", 403);

  const { id } = await params;
  let body: ConciliacionUpdatePayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const accion = body.accion;
  if (!accion || !acciones.has(accion)) return jsonError("Acción inválida", 400);

  const db = getDb();
  try {
    return await conBloqueoConciliacion(db, async db => {
      const conciliacion = await cargarConciliacion(db, id);
      if (!conciliacion) return jsonError("Conciliación no encontrada", 404);
      if (accion === "reabrir_conciliacion") return await reabrirConciliacion(db, user, conciliacion, body);
      if (accion === "aprobar" || accion === "rechazar") return await revisar(db, user, conciliacion, accion, body);
      return await actualizarLinea(db, user, conciliacion, accion, body);
    });
  } catch (error) {
    if (esConflictoContable(error)) return jsonError("Conflicto contable: actualice la pantalla y vuelva a intentar", 409);
    console.error("Reconciliation update failed", error);
    return jsonError("No se pudo actualizar la conciliación", 500);
  }
}
