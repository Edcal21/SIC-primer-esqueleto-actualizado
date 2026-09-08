import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { importacionesSituacionFinanciera, lineasSituacionFinanciera } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { mensajePeriodoCerrado, primerPeriodoCerrado } from "../../../../lib/periodos";
import { verificarRateLimit } from "../../../../lib/security";
import { leerSituacionFinanciera, revisarSituacionFinanciera } from "../../../../lib/situacion-financiera";

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

  let procesado;
  try {
    procesado = leerSituacionFinanciera(await archivo.arrayBuffer());
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo leer el Estado de Situación Financiera", 400);
  }

  // La revisión no bloquea la importación: el archivo entra siempre, pero marcado y con el motivo
  // por escrito. Un estado con diferencias impide después cerrar el período.
  const revision = revisarSituacionFinanciera(procesado.filas);

  try {
    const result = await db.transaction(async tx => {
      const [importacion] = await tx.insert(importacionesSituacionFinanciera).values({
        archivoNombre: archivo.name,
        archivoTamano: archivo.size,
        periodo,
        estado: revision.estado,
        observaciones: revision.observaciones.length ? revision.observaciones.join(" ") : null,
        totalLineas: procesado.filas.length,
        importadoPor: user.id,
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
        detalle: `${archivo.name} · ${periodo} · ${lineas.length} líneas con Saldo Final · ${revision.estado}${revision.observaciones.length ? ` · ${revision.observaciones.join(" ")}` : ""}`,
      });
      return { importacion, lineas };
    });
    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Financial position import failed", error);
    return jsonError("No se pudo guardar el Estado de Situación Financiera", 500);
  }
}
