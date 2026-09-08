import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { actualizarTasa } from "../../../../lib/tasas";

type TasaUpdatePayload = { tasa?: string | number; fuente?: string };

/**
 * Corrige una tasa ya catalogada (por ejemplo, un error de digitación). Los movimientos que ya
 * aplicaron la tasa anterior conservan su valor: esta corrección nunca recalcula históricos.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "configuracion:administrar")) return jsonError("No tiene permiso para administrar tasas de cambio", 403);

  const { id } = await params;
  let body: TasaUpdatePayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  if (body.fuente !== undefined && !body.fuente.trim()) return jsonError("La fuente no puede quedar vacía", 400);
  if (body.tasa === undefined && body.fuente === undefined) return jsonError("No hay cambios para actualizar", 400);

  const db = getDb();
  try {
    const tasa = await actualizarTasa(db, id, {
      tasa: body.tasa === undefined ? undefined : (body.tasa as string),
      fuente: body.fuente?.trim(),
      usuarioId: user.id,
    });
    if (!tasa) return jsonError("Tasa de cambio no encontrada", 404);
    await registrarAuditoria(db, {
      user,
      modulo: "Configuración",
      accion: "Corrigió tasa de cambio USD → NIO",
      entidad: "tasas_cambio",
      entidadId: tasa.id,
      detalle: `${tasa.fecha} · ${tasa.tasa} · fuente: ${tasa.fuente}`,
    });
    return Response.json({ tasa }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Exchange rate update failed", error);
    if (error instanceof Error && /tasa de cambio/.test(error.message)) return jsonError(error.message, 400);
    return jsonError("No se pudo actualizar la tasa de cambio", 500);
  }
}
