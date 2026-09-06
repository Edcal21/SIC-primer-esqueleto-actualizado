import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { conciliacionesBancarias, cuentasBancarias, lineasReporteBancario, reportesBancarios } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { leerEstadoBancario, resumenEstadoBancario, type LineaEstadoBancario } from "../../../../lib/banco";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

const serializar = (row: typeof reportesBancarios.$inferSelect) => ({
  id: row.id,
  nombre: row.nombre,
  fecha: row.fecha,
  estado: row.estado,
  archivoTamano: row.archivoTamano,
  cargadoPor: row.cargadoPorNombre,
  creadoEn: row.creadoEn,
  cuentaBancariaNumero: row.cuentaBancariaNumero,
  periodoInicio: row.periodoInicio,
  periodoFin: row.periodoFin,
  totalLineas: row.totalLineas,
  totalDebitos: row.totalDebitos,
  totalCreditos: row.totalCreditos,
  mensajeError: row.mensajeError,
});

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "banco:ver")) return jsonError("Permiso insuficiente", 403);
  const db = getDb();
  try {
    const rows = await db.select().from(reportesBancarios).orderBy(desc(reportesBancarios.creadoEn)).limit(50);
    const conciliaciones = await db.select({ id: conciliacionesBancarias.id, reporteId: conciliacionesBancarias.reporteId, estado: conciliacionesBancarias.estado }).from(conciliacionesBancarias);
    const porReporte = new Map(conciliaciones.map(item => [item.reporteId, item]));
    return Response.json({
      reportes: rows.map(row => ({
        ...serializar(row),
        conciliacionId: porReporte.get(row.id)?.id ?? null,
        conciliacionEstado: porReporte.get(row.id)?.estado ?? null,
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

  const form = await request.formData();
  const archivo = form.get("archivo");
  const cuentaBancariaNumero = String(form.get("cuentaBancariaNumero") ?? "").trim();

  if (!(archivo instanceof File) || !archivo.name) return jsonError("Seleccione un archivo", 400);
  if (!cuentaBancariaNumero) return jsonError("Seleccione la cuenta bancaria del estado de cuenta", 400);
  if (archivo.size > 10 * 1024 * 1024) return jsonError("El archivo supera el límite de 10 MB", 413);
  if (!/\.(csv|xlsx|xls)$/i.test(archivo.name)) return jsonError("Formato no permitido; use CSV o Excel", 415);

  const db = getDb();
  const [cuenta] = await db.select({ numeroCuenta: cuentasBancarias.numeroCuenta, nombre: cuentasBancarias.nombre })
    .from(cuentasBancarias)
    .where(and(eq(cuentasBancarias.numeroCuenta, cuentaBancariaNumero), eq(cuentasBancarias.estado, "activa")))
    .limit(1);
  if (!cuenta) return jsonError("La cuenta bancaria seleccionada no existe o está inactiva", 400);

  let lineas: LineaEstadoBancario[];
  try {
    lineas = await leerEstadoBancario(archivo);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo leer el estado bancario";
    try {
      const [reporte] = await db.insert(reportesBancarios).values({
        nombre: archivo.name,
        fecha: new Date().toISOString().slice(0, 10),
        estado: "error",
        archivoTamano: archivo.size,
        cargadoPor: user.id,
        cargadoPorNombre: user.nombre,
        cuentaBancariaNumero: cuenta.numeroCuenta,
        mensajeError: mensaje,
      }).returning();
      await registrarAuditoria(db, {
        user,
        modulo: "Bancos",
        accion: "Rechazó reporte bancario ilegible",
        entidad: "reportes_bancarios",
        entidadId: reporte.id,
        resultado: "error",
        detalle: `${archivo.name} · ${mensaje}`,
      });
    } catch (registroFallido) {
      console.error("Bank report error logging failed", registroFallido);
    }
    return jsonError(mensaje, 400);
  }

  const resumen = resumenEstadoBancario(lineas);

  try {
    const reporte = await db.transaction(async tx => {
      const [creado] = await tx.insert(reportesBancarios).values({
        nombre: archivo.name,
        fecha: new Date().toISOString().slice(0, 10),
        estado: "procesado",
        archivoTamano: archivo.size,
        cargadoPor: user.id,
        cargadoPorNombre: user.nombre,
        cuentaBancariaNumero: cuenta.numeroCuenta,
        periodoInicio: resumen.periodoInicio,
        periodoFin: resumen.periodoFin,
        totalLineas: resumen.totalLineas,
        totalDebitos: resumen.totalDebitos,
        totalCreditos: resumen.totalCreditos,
      }).returning();

      await tx.insert(lineasReporteBancario).values(lineas.map(linea => ({ ...linea, reporteId: creado.id })));
      await registrarAuditoria(tx, {
        user,
        modulo: "Bancos",
        accion: "Procesó reporte bancario",
        entidad: "reportes_bancarios",
        entidadId: creado.id,
        detalle: `${archivo.name} · ${cuenta.nombre} · ${resumen.totalLineas} líneas · débitos ${resumen.totalDebitos} · créditos ${resumen.totalCreditos}`,
      });

      return creado;
    });

    return Response.json({ reporte: { ...serializar(reporte), conciliacionId: null, conciliacionEstado: null } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bank report upload failed", error);
    return jsonError("No se pudo guardar el reporte bancario", 500);
  }
}
