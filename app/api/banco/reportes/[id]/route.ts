import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { conciliacionesBancarias, lineasReporteBancario, reportesBancarios } from "../../../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../../lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "banco:ver")) return jsonError("Permiso insuficiente", 403);

  const { id } = await params;
  const db = getDb();
  const [reporte] = await db.select().from(reportesBancarios).where(eq(reportesBancarios.id, id)).limit(1);
  if (!reporte) return jsonError("Reporte bancario no encontrado", 404);

  const [lineas, [conciliacion]] = await Promise.all([
    db.select().from(lineasReporteBancario).where(eq(lineasReporteBancario.reporteId, id)).orderBy(asc(lineasReporteBancario.numeroLinea)),
    db.select({ id: conciliacionesBancarias.id, estado: conciliacionesBancarias.estado }).from(conciliacionesBancarias).where(eq(conciliacionesBancarias.reporteId, id)).limit(1),
  ]);

  return Response.json({
    reporte: {
      id: reporte.id,
      nombre: reporte.nombre,
      fecha: reporte.fecha,
      estado: reporte.estado,
      archivoTamano: reporte.archivoTamano,
      cargadoPor: reporte.cargadoPorNombre,
      creadoEn: reporte.creadoEn,
      cuentaBancariaNumero: reporte.cuentaBancariaNumero,
      periodoInicio: reporte.periodoInicio,
      periodoFin: reporte.periodoFin,
      totalLineas: reporte.totalLineas,
      totalDebitos: reporte.totalDebitos,
      totalCreditos: reporte.totalCreditos,
      mensajeError: reporte.mensajeError,
      conciliacionId: conciliacion?.id ?? null,
      conciliacionEstado: conciliacion?.estado ?? null,
    },
    lineas,
  }, { headers: { "Cache-Control": "no-store" } });
}
