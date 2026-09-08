import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cuentasContables } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { leerCatalogoContable } from "../../../../lib/catalogo";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";
import { verificarRateLimit } from "../../../../lib/security";

function valorTexto(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  const limited = verificarRateLimit(request, { keyPrefix: "importaciones:catalogo", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "catalogo:administrar")) return jsonError("No tiene permiso para importar catálogo contable", 403);

  const form = await request.formData();
  const archivo = form.get("archivo");

  if (!(archivo instanceof File) || !archivo.name) return jsonError("Seleccione un archivo de catálogo", 400);
  if (archivo.size > 10 * 1024 * 1024) return jsonError("El archivo supera el límite de 10 MB", 413);
  if (!/\.(csv|xlsx|xls)$/i.test(archivo.name)) return jsonError("Formato no permitido; use CSV o Excel", 415);

  let catalogo;
  try {
    catalogo = leerCatalogoContable(await archivo.arrayBuffer());
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo leer el catálogo contable", 400);
  }

  const db = getDb();
  try {
    const result = await db.transaction(async tx => {
      let creadas = 0;
      let actualizadas = 0;

      for (const fila of [...catalogo.filas].sort((a, b) => a.nivel - b.nivel)) {
        const [existente] = await tx.select({ codigo: cuentasContables.codigo })
          .from(cuentasContables)
          .where(eq(cuentasContables.codigo, fila.codigo))
          .limit(1);

        await tx.insert(cuentasContables).values({
          codigo: fila.codigo,
          descripcion: fila.descripcion,
          nivel: fila.nivel,
          cuentaPadre: fila.cuentaPadre,
          esCuentaMovimiento: fila.esCuentaMovimiento,
          naturaleza: fila.naturaleza,
          estado: fila.estado,
          clasificacionFlujo: fila.clasificacionFlujo,
        }).onConflictDoUpdate({
          target: cuentasContables.codigo,
          set: {
            descripcion: fila.descripcion,
            nivel: fila.nivel,
            cuentaPadre: fila.cuentaPadre,
            esCuentaMovimiento: fila.esCuentaMovimiento,
            naturaleza: fila.naturaleza,
            estado: fila.estado,
            clasificacionFlujo: fila.clasificacionFlujo,
          },
        });

        if (valorTexto(existente?.codigo)) actualizadas += 1;
        else creadas += 1;
      }

      await registrarAuditoria(tx, {
        user,
        modulo: "Catálogo contable",
        accion: "Importó catálogo contable",
        entidad: "cuentas_contables",
        entidadId: archivo.name,
        detalle: `${archivo.name} · ${catalogo.filas.length} cuentas · ${catalogo.cuentasMovimiento} de movimiento · ${catalogo.cuentasActivas} activas`,
      });

      return {
        archivoNombre: archivo.name,
        archivoTamano: archivo.size,
        totalLineas: catalogo.filas.length,
        cuentasMovimiento: catalogo.cuentasMovimiento,
        cuentasActivas: catalogo.cuentasActivas,
        creadas,
        actualizadas,
      };
    });

    return Response.json({ importacion: result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Chart of accounts import failed", error);
    return jsonError("No se pudo guardar el catálogo contable", 500);
  }
}
