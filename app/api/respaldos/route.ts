import { getDb } from "../../../db";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";
import { obtenerEstadoRespaldos } from "../../../lib/respaldo";

/**
 * Solo lectura, deliberadamente. Generar un respaldo es tarea de scripts/respaldo-postgresql.sh
 * en el servidor, no de un botón en el navegador; esta ruta únicamente muestra lo que esa
 * bitácora ya registró, para que el administrador vea el estado sin entrar a una terminal.
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
