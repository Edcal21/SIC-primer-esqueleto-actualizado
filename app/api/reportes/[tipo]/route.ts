import { getDb } from "../../../../db";
import { esTipoReporte, generarReportePorPeriodo, generarReportePorPeriodoDesdeDb, reporteCsv, type Granularidad } from "../../../../lib/reportes";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

export async function GET(request:Request,{params}:{params:Promise<{tipo:string}>}){
  const user=await usuarioDesdeRequest(request);if(!user)return jsonError("No autenticado",401);if(!puede(user,"reportes:ver"))return jsonError("Permiso insuficiente",403);
  const {tipo}=await params;if(!esTipoReporte(tipo))return jsonError("Reporte no encontrado",404);
  const url=new URL(request.url),granularidad=(url.searchParams.get("granularidad")??"anio") as Granularidad,periodo=url.searchParams.get("periodo")??url.searchParams.get("anio")??"2026",comparar=url.searchParams.get("comparar")??"2025",formato=url.searchParams.get("formato")??"json";
  if(!["dia","mes","trimestre","anio"].includes(granularidad))return jsonError("Granularidad inválida",400);
  try {let reporte=generarReportePorPeriodo(tipo,granularidad,periodo,comparar);try{reporte=(await generarReportePorPeriodoDesdeDb(getDb(),tipo,granularidad,periodo,comparar))??reporte;}catch(error){console.warn("Falling back to demo reports",error);}if(formato==="csv"){if(!puede(user,"reportes:descargar"))return jsonError("No tiene permiso para descargar reportes",403);return new Response(reporteCsv(reporte),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${tipo}-${periodo}.csv"`}});}return Response.json({reporte},{headers:{"Cache-Control":"no-store"}});} catch(error){return jsonError(error instanceof Error?error.message:"No se pudo generar el reporte",400);}
}
