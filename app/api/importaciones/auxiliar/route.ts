import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cuentasBancarias, cuentasContables, detallesMovimientos, iglesias, movimientosCuentas } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { leerAuxiliarContable } from "../../../../lib/auxiliar";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { construirDetallesMovimiento } from "../../../../lib/movimientos";
import { verificarPeriodosAbiertos } from "../../../../lib/periodos";
import { verificarRateLimit } from "../../../../lib/security";
import { obtenerTasaVigente } from "../../../../lib/tasas";
import { prepararEvidenciaArchivo, registrarArchivoImportado } from "../../../../lib/importaciones";

export async function POST(request: Request) {
  const limited = verificarRateLimit(request, { keyPrefix: "importaciones:auxiliar", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "importaciones:administrar")) return jsonError("No tiene permiso para importar auxiliar contable", 403);

  const form = await request.formData();
  const archivo = form.get("archivo");

  if (!(archivo instanceof File) || !archivo.name) return jsonError("Seleccione un archivo de auxiliar contable", 400);
  if (archivo.size > 10 * 1024 * 1024) return jsonError("El archivo supera el límite de 10 MB", 413);
  if (!/\.(csv|xlsx|xls)$/i.test(archivo.name)) return jsonError("Formato no permitido; use CSV o Excel", 415);

  const db = getDb();
  const evidencia = await prepararEvidenciaArchivo(archivo);
  let auxiliar;
  try {
    auxiliar = leerAuxiliarContable(evidencia.arrayBuffer);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo leer el auxiliar contable";
    await db.transaction(tx => registrarArchivoImportado(tx, { evidencia, tipo: "auxiliar_contable", user, cantidadRegistros: 0, estado: "error", mensajeError: mensaje }));
    return jsonError(mensaje, 400);
  }

  try {
    const result = await db.transaction(async tx => {
      const movimientosCreados = [];
      const fechas = auxiliar.movimientos.map((movimiento: { fecha: string }) => movimiento.fecha).sort();
      const primerPeriodo = fechas[0]?.slice(0, 7) ?? null;
      const ultimoPeriodo = fechas.at(-1)?.slice(0, 7) ?? null;
      const periodo = primerPeriodo === ultimoPeriodo ? primerPeriodo : `${fechas[0]}/${fechas.at(-1)}`;
      const archivoImportado = await registrarArchivoImportado(tx, {
        evidencia, tipo: "auxiliar_contable", user, periodo, cantidadRegistros: auxiliar.movimientos.length,
        totalesControl: { totalLineas: auxiliar.totalLineas, totalDebitos: auxiliar.totalDebitos.toFixed(2), totalCreditos: auxiliar.totalCreditos.toFixed(2) },
      });

      for (const movimiento of auxiliar.movimientos) {
        const bloqueo = await verificarPeriodosAbiertos(tx, [movimiento.fecha]);
        if (bloqueo) throw new Error(bloqueo.mensaje);

        const [iglesia] = await tx.select({ codigo: iglesias.codigo }).from(iglesias)
          .where(and(eq(iglesias.codigo, movimiento.iglesiaCodigo), eq(iglesias.estado, "activa"))).limit(1);
        if (!iglesia) throw new Error(`La iglesia ${movimiento.iglesiaCodigo} no existe o está inactiva`);

        const [cuentaBancaria] = await tx.select({ numeroCuenta: cuentasBancarias.numeroCuenta, moneda: cuentasBancarias.moneda }).from(cuentasBancarias)
          .where(and(eq(cuentasBancarias.numeroCuenta, movimiento.cuentaBancariaNumero), eq(cuentasBancarias.estado, "activa"))).limit(1);
        if (!cuentaBancaria) throw new Error(`La cuenta bancaria ${movimiento.cuentaBancariaNumero} no existe o está inactiva`);

        for (const detalle of movimiento.detalles) {
          const [cuenta] = await tx.select({ codigo: cuentasContables.codigo, descripcion: cuentasContables.descripcion }).from(cuentasContables)
            .where(and(eq(cuentasContables.codigo, detalle.cuentaCodigo), eq(cuentasContables.estado, "activa"), eq(cuentasContables.esCuentaMovimiento, true))).limit(1);
          if (!cuenta) throw new Error(`Fila ${detalle.numeroLinea}: la cuenta ${detalle.cuentaCodigo} no existe, está inactiva o no es de movimiento`);
        }

        const tasaUsd = cuentaBancaria.moneda === "USD" ? await obtenerTasaVigente(tx, movimiento.fecha) : null;
        const resultadoDetalles = construirDetallesMovimiento(movimiento.detalles, { cuentaBancariaMoneda: cuentaBancaria.moneda, tasaUsd });
        if (!resultadoDetalles.ok) throw new Error(`Movimiento ${movimiento.referencia ?? movimiento.concepto}: ${resultadoDetalles.error}`);

        const [creado] = await tx.insert(movimientosCuentas).values({
          fecha: movimiento.fecha,
          iglesiaCodigo: movimiento.iglesiaCodigo,
          cuentaBancariaNumero: movimiento.cuentaBancariaNumero,
          referencia: movimiento.referencia,
          concepto: movimiento.concepto,
          creadoPor: user.id,
          archivoImportadoId: archivoImportado.id,
        }).returning();

        const detalles = await tx.insert(detallesMovimientos).values(
          resultadoDetalles.detalles.map(detalle => ({
            movimientoId: creado.id,
            tipo: detalle.tipo,
            cuentaCodigo: detalle.cuentaCodigo,
            cuentaNombre: detalle.cuentaNombre,
            monto: detalle.monto,
            orden: detalle.orden,
            afectaCuentaBancaria: detalle.afectaCuentaBancaria,
            moneda: detalle.moneda,
            montoOriginal: detalle.montoOriginal,
            tasaCambio: detalle.tasaCambio,
          })),
        ).returning();

        movimientosCreados.push({ movimiento: creado, detalles });
      }

      await registrarAuditoria(tx, {
        user,
        modulo: "Importaciones",
        accion: "Importó auxiliar contable",
        entidad: "movimientos_cuentas",
        entidadId: archivoImportado.id,
        detalle: `${archivo.name} · versión ${archivoImportado.version} · SHA-256 ${archivoImportado.archivoHashSha256.slice(0, 12)}… · ${auxiliar.movimientos.length} movimientos · ${auxiliar.totalLineas} líneas · débitos ${auxiliar.totalDebitos.toFixed(2)} · créditos ${auxiliar.totalCreditos.toFixed(2)}`,
      });

      return {
        archivoNombre: archivo.name,
        archivoTamano: archivo.size,
        totalMovimientos: movimientosCreados.length,
        totalLineas: auxiliar.totalLineas,
        totalDebitos: auxiliar.totalDebitos.toFixed(2),
        totalCreditos: auxiliar.totalCreditos.toFixed(2),
        archivoImportado: { id: archivoImportado.id, version: archivoImportado.version, hashSha256: archivoImportado.archivoHashSha256 },
      };
    });

    return Response.json({ importacion: result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Auxiliary ledger import failed", error);
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return jsonError("El auxiliar contiene un movimiento duplicado por fecha, iglesia, cuenta bancaria y referencia", 409);
    }
    if (error && typeof error === "object" && "code" in error && error.code === "23514") {
      return jsonError("El auxiliar contiene movimientos que no cumplen partida doble", 400);
    }
    return jsonError(error instanceof Error ? error.message : "No se pudo guardar el auxiliar contable", 500);
  }
}
