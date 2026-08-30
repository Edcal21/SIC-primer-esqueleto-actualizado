import { getDb } from "../../../../db";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { esTipoReporte, generarReportePorPeriodoDesdeDb, reporteCsv, type Granularidad } from "../../../../lib/reportes";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

export async function GET(request:Request,{params}:{params:Promise<{tipo:string}>}){
  const user=await usuarioDesdeRequest(request);if(!user)return jsonError("No autenticado",401);if(!puede(user,"reportes:ver"))return jsonError("Permiso insuficiente",403);
  const {tipo}=await params;if(!esTipoReporte(tipo))return jsonError("Reporte no encontrado",404);
  const currentYear=String(new Date().getFullYear()),previousYear=String(new Date().getFullYear()-1);
  const url=new URL(request.url),granularidad=(url.searchParams.get("granularidad")??"anio") as Granularidad,periodo=url.searchParams.get("periodo")??url.searchParams.get("anio")??currentYear,comparar=url.searchParams.get("comparar")??previousYear,formato=url.searchParams.get("formato")??"json";
  if(!["dia","mes","trimestre","anio"].includes(granularidad))return jsonError("Granularidad inválida",400);
  try {const db=getDb();const reporte=await generarReportePorPeriodoDesdeDb(db,tipo,granularidad,periodo,comparar);if(formato==="csv"){if(!puede(user,"reportes:descargar"))return jsonError("No tiene permiso para descargar reportes",403);await registrarAuditoria(db,{user,modulo:"Reportes",accion:"Descargó reporte",entidad:"reporte",entidadId:tipo,detalle:`${periodo} vs ${comparar}`});return new Response(reporteCsv(reporte),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${tipo}-${periodo}.csv"`}});}return Response.json({reporte},{headers:{"Cache-Control":"no-store"}});} catch(error){return jsonError(error instanceof Error?error.message:"No se pudo generar el reporte",400);}
}
