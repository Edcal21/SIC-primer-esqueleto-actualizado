import { conBloqueoConciliacion, esConflictoContable } from "../../../../lib/conciliacion-lock";
import { verificarPeriodosAbiertos } from "../../../../lib/periodos";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { conciliacionesBancarias, detallesMovimientos, lineasReporteBancario, movimientosCuentas } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

type MovimientoUpdatePayload = {
  estado?: "anulado";
  motivo?: string;
};

const MOTIVO_MINIMO = 10;

/**
 * Anula una minuta sin borrar su detalle contable: el asiento y sus líneas se conservan
 * y solo cambia el estado, de modo que la trazabilidad histórica queda intacta.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "movimientos:escribir")) return jsonError("No tiene permiso para anular movimientos contables", 403);

  const { id } = await params;
  let body: MovimientoUpdatePayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  if (body.estado !== "anulado") return jsonError("Solo se admite la anulación de movimientos registrados", 400);
  const motivo = body.motivo?.trim();
  if (!motivo || motivo.length < MOTIVO_MINIMO) return jsonError(`Indique el motivo de la anulación con al menos ${MOTIVO_MINIMO} caracteres`, 400);

  const db = getDb();
  try {
    return await conBloqueoConciliacion(db, async db => {
      const [movimiento] = await db.select().from(movimientosCuentas).where(eq(movimientosCuentas.id, id)).limit(1);
      if (!movimiento) return jsonError("Movimiento no encontrado", 404);
      if (movimiento.estado === "anulado") return jsonError("El movimiento ya está anulado", 409);

      // La minuta pertenece al período de su fecha: si ese período está cerrado, anularla lo alteraría.
      const bloqueo = await verificarPeriodosAbiertos(db, [movimiento.fecha]);
      if (bloqueo) return jsonError(bloqueo.mensaje, 409);

      const [enlace] = await db.select({
        lineaId: lineasReporteBancario.id,
        numeroLinea: lineasReporteBancario.numeroLinea,
        conciliacionEstado: conciliacionesBancarias.estado,
        periodo: conciliacionesBancarias.periodo,
      })
        .from(lineasReporteBancario)
        .leftJoin(conciliacionesBancarias, eq(conciliacionesBancarias.reporteId, lineasReporteBancario.reporteId))
        .where(eq(lineasReporteBancario.movimientoId, id))
        .limit(1);

      if (enlace) {
        const detalleConciliacion = enlace.periodo ? ` del período ${enlace.periodo}` : "";
        return jsonError(
          `El movimiento está enlazado a la línea ${enlace.numeroLinea} de una conciliación bancaria${detalleConciliacion}. Deshaga el enlace en la pantalla de conciliación antes de anularlo.`,
          409,
        );
      }

      const detalles = await db.select({ tipo: detallesMovimientos.tipo, monto: detallesMovimientos.monto })
        .from(detallesMovimientos).where(eq(detallesMovimientos.movimientoId, id));
      const total = detalles.filter(detalle => detalle.tipo === "debito").reduce((suma, detalle) => suma + Number(detalle.monto), 0);

      const [anulado] = await db.update(movimientosCuentas)
        .set({ estado: "anulado" })
        .where(eq(movimientosCuentas.id, id))
        .returning();

      await registrarAuditoria(db, {
        user,
        modulo: "Minutas",
        accion: "Anuló movimiento contable",
        entidad: "movimientos_cuentas",
        entidadId: id,
        detalle: `${movimiento.fecha} · ${movimiento.concepto} · ${total.toFixed(2)} NIO · motivo: ${motivo}`,
      });

      return Response.json({ movimiento: anulado }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) {
    if (esConflictoContable(error)) return jsonError("Conflicto contable: actualice la pantalla y vuelva a intentar", 409);
    console.error("Movement annulment failed", error);
    return jsonError("No se pudo anular el movimiento", 500);
  }
}
