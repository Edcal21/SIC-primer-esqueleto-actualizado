import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cuentasContables, importacionesBalanza, lineasBalanza } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { verificarRateLimit } from "../../../../lib/security";
import { leerBalanza, type BalanzaProcesada } from "../../../../lib/balanza";

const periodoRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

function valorTexto(value: unknown) {
  return String(value ?? "").trim();
}

function inferirCuenta(codigo: string) {
  const naturaleza = codigo.startsWith("2") || codigo.startsWith("3") || codigo.startsWith("4") ? "acreedora" : "deudora";
  const clasificacionFlujo = codigo.startsWith("1") || codigo.startsWith("4") || codigo.startsWith("5") ? "operación" : "no aplica";
  return { naturaleza: naturaleza as "deudora" | "acreedora", clasificacionFlujo: clasificacionFlujo as "operación" | "no aplica" };
}

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "importaciones:administrar")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  const importaciones = await db
    .select()
    .from(importacionesBalanza)
    .orderBy(desc(importacionesBalanza.creadoEn))
    .limit(50);

  return Response.json({ importaciones }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const limited = verificarRateLimit(request, { keyPrefix: "importaciones:balanza", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "importaciones:administrar")) return jsonError("No tiene permiso para importar balanza de comprobación", 403);

  const form = await request.formData();
  const archivo = form.get("archivo");
  const periodo = valorTexto(form.get("periodo"));

  if (!(archivo instanceof File) || !archivo.name) return jsonError("Seleccione un archivo de balanza", 400);
  if (!periodoRegex.test(periodo)) return jsonError("Período inválido; use formato YYYY-MM", 400);
  if (archivo.size > 10 * 1024 * 1024) return jsonError("El archivo supera el límite de 10 MB", 413);
  if (!/\.(csv|xlsx|xls)$/i.test(archivo.name)) return jsonError("Formato no permitido; use CSV o Excel", 415);

  let balanza: BalanzaProcesada;
  try {
    balanza = leerBalanza(await archivo.arrayBuffer());
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo leer la balanza", 400);
  }

  const { filas, totalDebe, totalHaber } = balanza;
  const diferencia = totalDebe - totalHaber;
  const estado = Math.abs(diferencia) < 0.01 ? "procesado" : "con_diferencias";
  const db = getDb();

  try {
    const result = await db.transaction(async tx => {
      const [importacion] = await tx.insert(importacionesBalanza).values({
        archivoNombre: archivo.name,
        archivoTamano: archivo.size,
        periodo,
        estado,
        totalLineas: filas.length,
        totalDebe: totalDebe.toFixed(2),
        totalHaber: totalHaber.toFixed(2),
        importadoPor: user.id,
      }).returning();

      const lineas = await tx.insert(lineasBalanza).values(
        filas.map(fila => ({ ...fila, importacionId: importacion.id })),
      ).returning();
      for (const fila of filas) {
        if (!/^\d{8}$/.test(fila.cuentaCodigo)) continue;
        const cuenta = inferirCuenta(fila.cuentaCodigo);
        await tx.insert(cuentasContables).values({
          codigo: fila.cuentaCodigo,
          descripcion: fila.cuentaNombre,
          nivel: 5,
          esCuentaMovimiento: true,
          naturaleza: cuenta.naturaleza,
          clasificacionFlujo: cuenta.clasificacionFlujo,
        }).onConflictDoUpdate({
          target: cuentasContables.codigo,
          set: {
            descripcion: fila.cuentaNombre,
            esCuentaMovimiento: true,
            estado: "activa",
            naturaleza: cuenta.naturaleza,
            clasificacionFlujo: cuenta.clasificacionFlujo,
          },
        });
      }
      await registrarAuditoria(tx, {
        user,
        modulo: "Importaciones",
        accion: "Importó balanza de comprobación",
        entidad: "importaciones_balanza",
        entidadId: importacion.id,
        detalle: `${archivo.name} · ${periodo} · ${filas.length} líneas · diferencia ${diferencia.toFixed(2)}`,
      });

      return { importacion, lineas };
    });

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trial balance import failed", error);
    return jsonError("No se pudo guardar la balanza de comprobación", 500);
  }
}
