import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import { archivosImportados, conciliacionesBancarias, cuentasBancarias, lineasReporteBancario, reportesBancarios } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { construirLineasConMoneda, leerEstadoBancario, resumenEstadoBancario, type LineaEstadoBancario } from "../../../../lib/banco";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { verificarRateLimit } from "../../../../lib/security";
import { verificarPeriodosAbiertos } from "../../../../lib/periodos";
import { prepararEvidenciaArchivo, registrarArchivoImportado } from "../../../../lib/importaciones";

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
  archivoImportadoId: row.archivoImportadoId,
});

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "banco:ver")) return jsonError("Permiso insuficiente", 403);
  const db = getDb();
  try {
    const rows = await db.select().from(reportesBancarios).orderBy(desc(reportesBancarios.creadoEn)).limit(50);
    const conciliaciones = await db.select({ id: conciliacionesBancarias.id, reporteId: conciliacionesBancarias.reporteId, estado: conciliacionesBancarias.estado }).from(conciliacionesBancarias);
    const idsArchivos = rows.map(row => row.archivoImportadoId).filter((id): id is string => Boolean(id));
    const evidencias = idsArchivos.length ? await db.select({ id: archivosImportados.id, version: archivosImportados.version, hashSha256: archivosImportados.archivoHashSha256 })
      .from(archivosImportados).where(inArray(archivosImportados.id, idsArchivos)) : [];
    const porReporte = new Map(conciliaciones.map(item => [item.reporteId, item]));
    const porArchivo = new Map(evidencias.map(item => [item.id, item]));
    return Response.json({
      reportes: rows.map(row => ({
        ...serializar(row),
        version: row.archivoImportadoId ? porArchivo.get(row.archivoImportadoId)?.version ?? null : null,
        hashSha256: row.archivoImportadoId ? porArchivo.get(row.archivoImportadoId)?.hashSha256 ?? null : null,
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
  const limited = verificarRateLimit(request, { keyPrefix: "banco:reportes", limit: 12, windowMs: 60_000 });
  if (limited) return limited;

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
  const [cuenta] = await db.select({ numeroCuenta: cuentasBancarias.numeroCuenta, nombre: cuentasBancarias.nombre, moneda: cuentasBancarias.moneda })
    .from(cuentasBancarias)
    .where(and(eq(cuentasBancarias.numeroCuenta, cuentaBancariaNumero), eq(cuentasBancarias.estado, "activa")))
    .limit(1);
  if (!cuenta) return jsonError("La cuenta bancaria seleccionada no existe o está inactiva", 400);

  const evidencia = await prepararEvidenciaArchivo(archivo);
  let lineas: LineaEstadoBancario[];
  try {
    lineas = await leerEstadoBancario(archivo);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo leer el estado bancario";
    try {
      await db.transaction(async tx => {
        const archivoImportado = await registrarArchivoImportado(tx, {
          evidencia, tipo: "estado_bancario", user, cuentaBancariaNumero: cuenta.numeroCuenta,
          cantidadRegistros: 0, estado: "error", mensajeError: mensaje,
        });
        const [reporte] = await tx.insert(reportesBancarios).values({
          nombre: archivo.name,
          fecha: new Date().toISOString().slice(0, 10),
          estado: "error",
          archivoTamano: archivo.size,
          cargadoPor: user.id,
          cargadoPorNombre: user.nombre,
          cuentaBancariaNumero: cuenta.numeroCuenta,
          mensajeError: mensaje,
          archivoImportadoId: archivoImportado.id,
        }).returning();
        await registrarAuditoria(tx, {
          user,
          modulo: "Bancos",
          accion: "Rechazó reporte bancario ilegible",
          entidad: "reportes_bancarios",
          entidadId: reporte.id,
          resultado: "error",
          detalle: `${archivo.name} · versión ${archivoImportado.version} · SHA-256 ${archivoImportado.archivoHashSha256.slice(0, 12)}… · ${mensaje}`,
        });
      });
    } catch (registroFallido) {
      console.error("Bank report error logging failed", registroFallido);
    }
    return jsonError(mensaje, 400);
  }

  const resumen = resumenEstadoBancario(lineas);
  // Un estado de cuenta puede cruzar el cierre de mes: se rechaza si toca algún período cerrado.
  const bloqueo = await verificarPeriodosAbiertos(db, lineas.map(linea => linea.fecha));
  if (bloqueo) return jsonError(bloqueo.mensaje, 409);
  // Cada línea resuelve su propia tasa por fecha en el catálogo; nunca se convierte todo el
  // estado de cuenta con una tasa única. Las líneas USD sin tasa registrada para su fecha quedan
  // guardadas como pendientes de completar (nunca se infiere el valor).
  const lineasConMoneda = await construirLineasConMoneda(db, lineas, cuenta.moneda);
  const pendientesDeTasa = lineasConMoneda.filter(linea => linea.moneda === "USD" && linea.tasaCambio === null).length;

  try {
    const reporte = await db.transaction(async tx => {
      const periodo = resumen.periodoInicio?.slice(0, 7) === resumen.periodoFin?.slice(0, 7)
        ? resumen.periodoInicio?.slice(0, 7) ?? null
        : `${resumen.periodoInicio}/${resumen.periodoFin}`;
      const archivoImportado = await registrarArchivoImportado(tx, {
        evidencia, tipo: "estado_bancario", user, cuentaBancariaNumero: cuenta.numeroCuenta, periodo,
        cantidadRegistros: resumen.totalLineas,
        totalesControl: {
          totalDebitos: resumen.totalDebitos,
          totalCreditos: resumen.totalCreditos,
          neto: (Number(resumen.totalCreditos) - Number(resumen.totalDebitos)).toFixed(2),
          pendientesDeTasa,
        },
      });
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
        archivoImportadoId: archivoImportado.id,
      }).returning();

      await tx.insert(lineasReporteBancario).values(lineasConMoneda.map(linea => ({ ...linea, reporteId: creado.id })));
      await registrarAuditoria(tx, {
        user,
        modulo: "Bancos",
        accion: "Procesó reporte bancario",
        entidad: "reportes_bancarios",
        entidadId: creado.id,
        detalle: `${archivo.name} · versión ${archivoImportado.version} · SHA-256 ${archivoImportado.archivoHashSha256.slice(0, 12)}… · ${cuenta.nombre} · ${resumen.totalLineas} líneas · débitos ${resumen.totalDebitos} · créditos ${resumen.totalCreditos}`
          + (pendientesDeTasa ? ` · ${pendientesDeTasa} líneas pendientes de tasa USD` : ""),
      });

      return { creado, archivoImportado };
    });

    return Response.json({
      reporte: { ...serializar(reporte.creado), version: reporte.archivoImportado.version, hashSha256: reporte.archivoImportado.archivoHashSha256, conciliacionId: null, conciliacionEstado: null },
      pendientesDeTasa,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bank report upload failed", error);
    return jsonError("No se pudo guardar el reporte bancario", 500);
  }
}
