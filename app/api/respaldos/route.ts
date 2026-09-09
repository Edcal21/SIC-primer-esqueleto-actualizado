import { getDb } from "../../../db";
import { registrarAuditoria } from "../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";
import { obtenerEstadoRespaldos, solicitarRespaldo } from "../../../lib/respaldo";
import { verificarRateLimit } from "../../../lib/security";

/**
 * Solo lectura para generar el respaldo: esta ruta puede DEJAR PEDIDO un respaldo manual,
 * pero nunca ejecuta pg_dump por sí misma — esa restricción es del runtime en el que corre
 * la aplicación (Cloudflare Workers / workerd), no de dónde esté alojado el servidor. Un
 * cron corto en el servidor (scripts/respaldo-postgresql.sh --atender-solicitudes) es
 * quien realmente genera el archivo y resuelve la solicitud.
 */
export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "configuracion:administrar")) return jsonError("No tiene permiso para ver el estado de los respaldos", 403);

  try {
    const estado = await obtenerEstadoRespaldos(getDb());
    return Response.json(estado, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Backup status query failed", error);
    return jsonError("No se pudo consultar el estado de los respaldos", 500);
  }
}

export async function POST(request: Request) {
  const limited = verificarRateLimit(request, { keyPrefix: "respaldos:solicitar", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "configuracion:administrar")) return jsonError("No tiene permiso para solicitar respaldos", 403);

  const db = getDb();
  try {
    const resultado = await solicitarRespaldo(db, user);
    if (resultado.creada) {
      await registrarAuditoria(db, {
        user,
        modulo: "Respaldos",
        accion: "Solicitó respaldo manual de la base de datos",
        entidad: "respaldos_solicitudes",
        entidadId: resultado.solicitud.id,
        detalle: `Solicitud creada; el servidor la atenderá en su próxima corrida programada.`,
      });
    }
    return Response.json(resultado, { status: resultado.creada ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Backup request failed", error);
    return jsonError("No se pudo solicitar el respaldo", 500);
  }
}
