import { getDb } from "../../../../db";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { exportarFlujoExcel } from "../../../../lib/flujo-excel";
import { esTipoReporte, generarReportePorPeriodoDesdeDb, reporteCsv, type Granularidad } from "../../../../lib/reportes";

export async function GET(request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "reportes:ver")) return jsonError("Permiso insuficiente", 403);
  const { tipo } = await params;
  if (!esTipoReporte(tipo)) return jsonError("Reporte no encontrado", 404);

  const currentYear = String(new Date().getFullYear()), previousYear = String(new Date().getFullYear() - 1);
  const url = new URL(request.url);
  const granularidad = (url.searchParams.get("granularidad") ?? "anio") as Granularidad;
  const periodo = url.searchParams.get("periodo") ?? url.searchParams.get("anio") ?? currentYear;
  const comparar = url.searchParams.get("comparar") ?? previousYear;
  const formato = url.searchParams.get("formato") ?? "json";
  if (!["dia", "mes", "trimestre", "anio"].includes(granularidad)) return jsonError("Granularidad inválida", 400);
  if (!["json", "csv", "xlsx"].includes(formato)) return jsonError("Formato no soportado", 400);

  try {
    const db = getDb();
    const reporte = await generarReportePorPeriodoDesdeDb(db, tipo, granularidad, periodo, comparar);
    if (formato === "json") return Response.json({ reporte }, { headers: { "Cache-Control": "no-store" } });
    if (!puede(user, "reportes:descargar")) return jsonError("No tiene permiso para descargar reportes", 403);

    await registrarAuditoria(db, { user, modulo: "Reportes", accion: `Descargó reporte ${formato.toUpperCase()}`, entidad: "reporte", entidadId: tipo, detalle: `${periodo} vs ${comparar}` });
    if (formato === "csv") {
      return new Response(reporteCsv(reporte), { headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tipo}-${periodo}.csv"`,
      } });
    }
    if (tipo !== "flujo-efectivo") return jsonError("La exportación Excel está disponible para el flujo de efectivo", 400);
    const plantillaResponse = await fetch(new URL("/plantillas/flujo-efectivo.xlsx", request.url));
    if (!plantillaResponse.ok) throw new Error("No se pudo cargar la plantilla de flujo de efectivo");
    const archivo = exportarFlujoExcel(reporte, await plantillaResponse.arrayBuffer());
    const cuerpo = new ArrayBuffer(archivo.byteLength);
    new Uint8Array(cuerpo).set(archivo);
    return new Response(cuerpo, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="flujo-efectivo-${reporte.periodoFuente ?? periodo}.xlsx"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo generar el reporte", 400);
  }
}
