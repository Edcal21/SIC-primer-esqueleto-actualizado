import { getDb } from "../../../db";
import { obtenerCatalogoReportes } from "../../../lib/reportes";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";
export async function GET(request:Request){const user=await usuarioDesdeRequest(request);if(!user)return jsonError("No autenticado",401);if(!puede(user,"reportes:ver"))return jsonError("Permiso insuficiente",403);const reportes=await obtenerCatalogoReportes(getDb());return Response.json({reportes},{headers:{"Cache-Control":"no-store"}});}
