import { getDb } from "../../../../db";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { conBloqueoConciliacion, esConflictoContable } from "../../../../lib/conciliacion-lock";
import {
  cerrarPeriodo,
  esPeriodoValido,
  impedimentosParaCerrar,
  marcarEnRevision,
  MOTIVO_REAPERTURA_MINIMO,
  obtenerPeriodo,
  reabrirPeriodo,
} from "../../../../lib/periodos";

type AccionPeriodo = "revision" | "cerrar" | "reabrir";
type PeriodoUpdatePayload = { accion?: AccionPeriodo; motivo?: string };

const acciones = new Set<AccionPeriodo>(["revision", "cerrar", "reabrir"]);

/**
 * Transiciones del cierre contable. Todas se ejecutan bajo el mismo bloqueo que usan las escrituras
 * de conciliación: cerrar un período comprueba el estado de sus conciliaciones, así que no puede
 * correr en paralelo con una aprobación o un enlace que cambiaría justo esa comprobación.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ periodo: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "configuracion:administrar")) return jsonError("No tiene permiso para administrar períodos contables", 403);

  const { periodo: periodoParam } = await params;
  const periodo = decodeURIComponent(periodoParam);
  if (!esPeriodoValido(periodo)) return jsonError("Período inválido; use el formato AAAA-MM", 400);

  let body: PeriodoUpdatePayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const accion = body.accion;
  if (!accion || !acciones.has(accion)) return jsonError("Acción inválida; use revision, cerrar o reabrir", 400);

  const motivo = body.motivo?.trim();
  if (accion === "reabrir" && (!motivo || motivo.length < MOTIVO_REAPERTURA_MINIMO)) {
    return jsonError(`Indique el motivo de la reapertura con al menos ${MOTIVO_REAPERTURA_MINIMO} caracteres`, 400);
  }

  const db = getDb();
  try {
    return await conBloqueoConciliacion(db, async tx => {
      const actual = await obtenerPeriodo(tx, periodo);
      if (!actual) return jsonError("El período no está registrado; ábralo antes de administrarlo", 404);

      if (accion === "revision") {
        if (actual.estado === "cerrado") return jsonError("El período está cerrado; reabralo antes de marcarlo en revisión", 409);
        if (actual.estado === "revision") return jsonError("El período ya está en revisión", 409);
        const actualizado = await marcarEnRevision(tx, periodo);
        await registrarAuditoria(tx, {
          user,
          modulo: "Cierre contable",
          accion: "Marcó período en revisión",
          entidad: "periodos_contables",
          entidadId: periodo,
          detalle: `Período ${periodo} en revisión previa al cierre`,
        });
        return Response.json({ periodo: actualizado }, { headers: { "Cache-Control": "no-store" } });
      }

      if (accion === "cerrar") {
        if (actual.estado === "cerrado") return jsonError("El período ya está cerrado", 409);
        const impedimentos = await impedimentosParaCerrar(tx, periodo);
        if (impedimentos.length) {
          await registrarAuditoria(tx, {
            user,
            modulo: "Cierre contable",
            accion: "Intento de cierre rechazado",
            entidad: "periodos_contables",
            entidadId: periodo,
            resultado: "error",
            detalle: `Período ${periodo}: ${impedimentos.map(item => item.motivo).join("; ")}`,
          });
          return Response.json(
            { error: `No se puede cerrar el período ${periodo}: quedan asuntos sin resolver`, impedimentos },
            { status: 409, headers: { "Cache-Control": "no-store" } },
          );
        }
        const actualizado = await cerrarPeriodo(tx, periodo, user);
        await registrarAuditoria(tx, {
          user,
          modulo: "Cierre contable",
          accion: "Cerró período contable",
          entidad: "periodos_contables",
          entidadId: periodo,
          detalle: `Período ${periodo} cerrado; queda bloqueado para captura, anulación, importación y conciliación`,
        });
        return Response.json({ periodo: actualizado }, { headers: { "Cache-Control": "no-store" } });
      }

      if (actual.estado !== "cerrado") return jsonError("Solo se puede reabrir un período cerrado", 409);
      // La reapertura levanta el candado y nada más: no borra ni recalcula lo ya registrado.
      const actualizado = await reabrirPeriodo(tx, periodo, user, motivo!);
      await registrarAuditoria(tx, {
        user,
        modulo: "Cierre contable",
        accion: "Reabrió período contable",
        entidad: "periodos_contables",
        entidadId: periodo,
        detalle: `Período ${periodo} reabierto · cerrado previamente por ${actual.cerradoPorNombre ?? "usuario no registrado"} · motivo: ${motivo}`,
      });
      return Response.json({ periodo: actualizado }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) {
    if (esConflictoContable(error)) return jsonError("Conflicto contable: actualice la pantalla y vuelva a intentar", 409);
    console.error("Accounting period update failed", error);
    return jsonError("No se pudo actualizar el período contable", 500);
  }
}
