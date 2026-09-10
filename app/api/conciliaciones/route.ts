import { conBloqueoConciliacion, esConflictoContable } from "../../../lib/conciliacion-lock";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { conciliacionesBancarias, cuentasBancarias, reportesBancarios } from "../../../db/schema";
import { registrarAuditoria } from "../../../lib/auditoria";
import { autoConciliar, periodoDesdeFecha, recalcularConciliacion } from "../../../lib/banco";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";
import { primerPeriodoCerrado, mensajePeriodoCerrado } from "../../../lib/periodos";

type ConciliacionPayload = { reporteId?: string };

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "conciliacion:ver")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  try {
    const conciliaciones = await db.select({
      id: conciliacionesBancarias.id,
      reporteId: conciliacionesBancarias.reporteId,
      cuentaBancariaNumero: conciliacionesBancarias.cuentaBancariaNumero,
      cuentaBancariaNombre: cuentasBancarias.nombre,
      cuentaBancariaMoneda: cuentasBancarias.moneda,
      periodo: conciliacionesBancarias.periodo,
      estado: conciliacionesBancarias.estado,
      totalBanco: conciliacionesBancarias.totalBanco,
      totalConciliado: conciliacionesBancarias.totalConciliado,
      totalPendiente: conciliacionesBancarias.totalPendiente,
      lineasConciliadas: conciliacionesBancarias.lineasConciliadas,
      lineasPendientes: conciliacionesBancarias.lineasPendientes,
      movimientosSinConciliar: conciliacionesBancarias.movimientosSinConciliar,
      reporteNombre: reportesBancarios.nombre,
      creadoEn: conciliacionesBancarias.creadoEn,
      revisadoPorNombre: conciliacionesBancarias.revisadoPorNombre,
      revisadoEn: conciliacionesBancarias.revisadoEn,
      observaciones: conciliacionesBancarias.observaciones,
    })
      .from(conciliacionesBancarias)
      .innerJoin(reportesBancarios, eq(reportesBancarios.id, conciliacionesBancarias.reporteId))
      .innerJoin(cuentasBancarias, eq(cuentasBancarias.numeroCuenta, conciliacionesBancarias.cuentaBancariaNumero))
      .orderBy(desc(conciliacionesBancarias.creadoEn))
      .limit(50);

    const disponibles = await db.select({
      id: reportesBancarios.id,
      nombre: reportesBancarios.nombre,
      cuentaBancariaNumero: reportesBancarios.cuentaBancariaNumero,
      periodoInicio: reportesBancarios.periodoInicio,
      periodoFin: reportesBancarios.periodoFin,
      totalLineas: reportesBancarios.totalLineas,
    })
      .from(reportesBancarios)
      .where(eq(reportesBancarios.estado, "procesado"))
      .orderBy(desc(reportesBancarios.creadoEn))
      .limit(50);

    const conciliados = new Set(conciliaciones.map(item => item.reporteId));
    return Response.json({
      conciliaciones,
      reportesDisponibles: disponibles.filter(reporte => !conciliados.has(reporte.id) && reporte.cuentaBancariaNumero),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Reconciliation listing failed", error);
    return jsonError("No se pudo cargar el historial de conciliaciones", 500);
  }
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "conciliacion:gestionar")) return jsonError("No tiene permiso para generar conciliaciones", 403);

  let body: ConciliacionPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }
  const reporteId = body.reporteId?.trim();
  if (!reporteId) return jsonError("Seleccione el reporte bancario a conciliar", 400);

  const db = getDb();
  try {
    return await conBloqueoConciliacion(db, async db => {
      const [reporte] = await db.select().from(reportesBancarios).where(eq(reportesBancarios.id, reporteId)).limit(1);
      if (!reporte) return jsonError("Reporte bancario no encontrado", 404);
      if (reporte.estado !== "procesado") return jsonError("Solo se pueden conciliar reportes bancarios procesados", 400);
      if (!reporte.cuentaBancariaNumero) return jsonError("El reporte no tiene cuenta bancaria asociada; vuelva a cargarlo indicando la cuenta", 400);

      const [existente] = await db.select({ id: conciliacionesBancarias.id }).from(conciliacionesBancarias).where(eq(conciliacionesBancarias.reporteId, reporteId)).limit(1);
      if (existente) return jsonError("Este reporte bancario ya tiene una conciliación generada", 409);

      const periodo = periodoDesdeFecha(reporte.periodoFin ?? reporte.periodoInicio ?? reporte.fecha);
      const periodoCerrado = await primerPeriodoCerrado(db, [periodo]);
      if (periodoCerrado) return jsonError(mensajePeriodoCerrado(periodoCerrado), 409);

      const [conciliacion] = await db.insert(conciliacionesBancarias).values({
        reporteId: reporte.id,
        cuentaBancariaNumero: reporte.cuentaBancariaNumero,
        periodo,
        creadoPor: user.id,
      }).returning();

      const automaticas = await autoConciliar(db, reporte.id, reporte.cuentaBancariaNumero, user.id);
      const actualizada = await recalcularConciliacion(db, conciliacion.id);
      await registrarAuditoria(db, {
        user,
        modulo: "Conciliación",
        accion: "Generó conciliación bancaria",
        entidad: "conciliaciones_bancarias",
        entidadId: conciliacion.id,
        detalle: `${reporte.nombre} · período ${periodo} · ${automaticas} líneas enlazadas automáticamente`,
      });

      return Response.json({ conciliacion: actualizada ?? conciliacion, enlazadasAutomaticamente: automaticas }, { status: 201, headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) {
    if (esConflictoContable(error)) return jsonError("Conflicto contable: actualice la pantalla y vuelva a intentar", 409);
    console.error("Reconciliation creation failed", error);
    return jsonError("No se pudo generar la conciliación bancaria", 500);
  }
}
