import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { reportesBancarios } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "banco:ver")) return jsonError("Permiso insuficiente", 403);
  const db = getDb();
  try {
    const rows = await db.select().from(reportesBancarios).orderBy(desc(reportesBancarios.creadoEn)).limit(50);
    return Response.json({
      reportes: rows.map(row => ({
        id: row.id,
        nombre: row.nombre,
        fecha: row.fecha,
        estado: row.estado,
        archivoTamano: row.archivoTamano,
        cargadoPor: row.cargadoPorNombre,
        creadoEn: row.creadoEn,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bank report listing failed", error);
    return jsonError("No se pudo cargar el historial bancario", 500);
  }
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "banco:cargar")) return jsonError("No tiene permiso para cargar reportes bancarios", 403);
  const form = await request.formData(); const archivo = form.get("archivo");
  if (!(archivo instanceof File) || !archivo.name) return jsonError("Seleccione un archivo", 400);
  if (archivo.size > 10 * 1024 * 1024) return jsonError("El archivo supera el límite de 10 MB", 413);
  if (!/\.(csv|xlsx|xls)$/i.test(archivo.name)) return jsonError("Formato no permitido; use CSV o Excel", 415);
  const db = getDb();
  try {
    const [reporte] = await db.insert(reportesBancarios).values({
      nombre: archivo.name,
      fecha: new Date().toISOString().slice(0, 10),
      archivoTamano: archivo.size,
      cargadoPor: user.id,
      cargadoPorNombre: user.nombre,
    }).returning();
    await registrarAuditoria(db, { user, modulo: "Bancos", accion: "Cargó reporte bancario", entidad: "reportes_bancarios", entidadId: reporte.id, detalle: archivo.name });
    return Response.json({
      reporte: {
        id: reporte.id,
        nombre: reporte.nombre,
        fecha: reporte.fecha,
        estado: reporte.estado,
        archivoTamano: reporte.archivoTamano,
        cargadoPor: reporte.cargadoPorNombre,
        creadoEn: reporte.creadoEn,
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bank report upload failed", error);
    return jsonError("No se pudo guardar el reporte bancario", 500);
  }
}
