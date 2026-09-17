import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { importacionesSituacionFinanciera, lineasSituacionFinanciera } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { mensajePeriodoCerrado, primerPeriodoCerrado } from "../../../../lib/periodos";
import { verificarRateLimit } from "../../../../lib/security";
import { leerSituacionFinanciera } from "../../../../lib/situacion-financiera";
import { prepararEvidenciaArchivo, registrarArchivoImportado } from "../../../../lib/importaciones";

const periodoRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "importaciones:administrar")) return jsonError("Permiso insuficiente", 403);
  const importaciones = await getDb().select().from(importacionesSituacionFinanciera)
    .orderBy(desc(importacionesSituacionFinanciera.creadoEn)).limit(50);
  return Response.json({ importaciones }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const limited = verificarRateLimit(request, { keyPrefix: "importaciones:situacion-financiera", limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "importaciones:administrar")) return jsonError("No tiene permiso para importar estados financieros", 403);

  const form = await request.formData();
  const archivo = form.get("archivo");
  const periodo = String(form.get("periodo") ?? "").trim();
  if (!(archivo instanceof File) || !archivo.name) return jsonError("Seleccione el Estado de Situación Financiera", 400);
  if (!periodoRegex.test(periodo)) return jsonError("Período inválido; use formato YYYY-MM", 400);
  if (archivo.size > 10 * 1024 * 1024) return jsonError("El archivo supera el límite de 10 MB", 413);
  if (!/\.(csv|xlsx|xls)$/i.test(archivo.name)) return jsonError("Formato no permitido; use CSV o Excel", 415);

  const db = getDb();
  const cerrado = await primerPeriodoCerrado(db, [periodo]);
  if (cerrado) return jsonError(mensajePeriodoCerrado(cerrado), 409);

  const evidencia = await prepararEvidenciaArchivo(archivo);
  let procesado;
  try {
    procesado = leerSituacionFinanciera(evidencia.arrayBuffer);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo leer el Estado de Situación Financiera";
    await db.transaction(tx => registrarArchivoImportado(tx, { evidencia, tipo: "situacion_financiera", user, periodo, cantidadRegistros: 0, estado: "error", mensajeError: mensaje }));
    return jsonError(mensaje, 400);
  }

  try {
    const result = await db.transaction(async tx => {
      const totalSaldoFinal = procesado.filas.reduce((total: number, fila: { saldoFinal: string }) => total + Number(fila.saldoFinal), 0);
      const archivoImportado = await registrarArchivoImportado(tx, {
        evidencia, tipo: "situacion_financiera", user, periodo, cantidadRegistros: procesado.filas.length,
        totalesControl: { sumaSaldosFinales: totalSaldoFinal.toFixed(2) },
      });
      const [importacion] = await tx.insert(importacionesSituacionFinanciera).values({
        archivoNombre: archivo.name,
        archivoTamano: archivo.size,
        periodo,
        estado: "procesado",
        totalLineas: procesado.filas.length,
        importadoPor: user.id,
        archivoImportadoId: archivoImportado.id,
      }).returning();
      const lineas = await tx.insert(lineasSituacionFinanciera).values(
        procesado.filas.map(fila => ({ ...fila, importacionId: importacion.id })),
      ).returning();
      await registrarAuditoria(tx, {
        user,
        modulo: "Importaciones",
        accion: "Importó estado de situación financiera",
        entidad: "importaciones_situacion_financiera",
        entidadId: importacion.id,
        detalle: `${archivo.name} · versión ${archivoImportado.version} · SHA-256 ${archivoImportado.archivoHashSha256.slice(0, 12)}… · ${periodo} · ${lineas.length} líneas con Saldo Final`,
      });
      return { importacion, lineas, archivoImportado: { id: archivoImportado.id, version: archivoImportado.version, hashSha256: archivoImportado.archivoHashSha256 } };
    });
    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Financial position import failed", error);
    return jsonError("No se pudo guardar el Estado de Situación Financiera", 500);
  }
}
