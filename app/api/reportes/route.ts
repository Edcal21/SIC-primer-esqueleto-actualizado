import { catalogoReportes } from "../../../lib/reportes";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";
export async function GET(request:Request){const user=usuarioDesdeRequest(request);if(!user)return jsonError("No autenticado",401);if(!puede(user,"reportes:ver"))return jsonError("Permiso insuficiente",403);return Response.json({reportes:catalogoReportes});}
