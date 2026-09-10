import { desc, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cuentasContables, importacionesBalanza, lineasBalanza } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { primerPeriodoCerrado, mensajePeriodoCerrado } from "../../../../lib/periodos";
import { verificarRateLimit } from "../../../../lib/security";
import { leerBalanza, type BalanzaProcesada } from "../../../../lib/balanza";

const periodoRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

function valorTexto(value: unknown) {
  return String(value ?? "").trim();
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

  const db = getDb();
  // Importar una balanza reescribe los saldos del período: se rechaza si ya está cerrado.
  const periodoCerrado = await primerPeriodoCerrado(db, [periodo]);
  if (periodoCerrado) return jsonError(mensajePeriodoCerrado(periodoCerrado), 409);

  let balanza: BalanzaProcesada;
  try {
    balanza = leerBalanza(await archivo.arrayBuffer());
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo leer la balanza", 400);
  }

  const { filas, totalDebe, totalHaber } = balanza;
  const codigosCuentas = [...new Set(filas.map(fila => fila.cuentaCodigo.trim()).filter(Boolean))];
  if (codigosCuentas.length) {
    const cuentas = await db.select({
      codigo: cuentasContables.codigo,
      estado: cuentasContables.estado,
      esCuentaMovimiento: cuentasContables.esCuentaMovimiento,
    }).from(cuentasContables).where(inArray(cuentasContables.codigo, codigosCuentas));
    const mapaCuentas = new Map(cuentas.map(cuenta => [cuenta.codigo, cuenta]));
    const erroresCatalogo = filas.flatMap((fila, index) => {
      const cuenta = mapaCuentas.get(fila.cuentaCodigo.trim());
      if (!cuenta) return [`Línea ${index + 1}: la cuenta ${fila.cuentaCodigo} no existe en el catálogo contable`];
      if (cuenta.estado !== "activa") return [`Línea ${index + 1}: la cuenta ${fila.cuentaCodigo} está inactiva`];
      if (!cuenta.esCuentaMovimiento) return [`Línea ${index + 1}: la cuenta ${fila.cuentaCodigo} es de mayor/título; la balanza solo admite cuentas de movimiento`];
      return [];
    });
    if (erroresCatalogo.length) return jsonError(`Catálogo contable inválido para la balanza. ${erroresCatalogo.slice(0, 5).join(" · ")}`, 400);
  }

  const diferencia = totalDebe - totalHaber;
  const estado = Math.abs(diferencia) < 0.01 ? "procesado" : "con_diferencias";

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
