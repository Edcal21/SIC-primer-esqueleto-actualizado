import { and, eq, inArray } from "drizzle-orm";
import type { getDb } from "../db";
import { cuentasContables } from "../db/schema";

type Db = ReturnType<typeof getDb>;

/**
 * Devuelve, indexadas por código, las cuentas del catálogo que están activas y admiten movimientos
 * directos, limitado a los códigos solicitados. Es la fuente de verdad del servidor para validar las
 * líneas de una minuta: el cliente elige el código y el nombre se toma de aquí, nunca del payload.
 */
export async function cargarCatalogoMovimiento(db: Db, codigos: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(codigos.map(codigo => codigo?.trim()).filter((codigo): codigo is string => Boolean(codigo)))];
  if (!unicos.length) return new Map();
  const filas = await db.select({ codigo: cuentasContables.codigo, descripcion: cuentasContables.descripcion })
    .from(cuentasContables)
    .where(and(
      inArray(cuentasContables.codigo, unicos),
      eq(cuentasContables.estado, "activa"),
      eq(cuentasContables.esCuentaMovimiento, true),
    ));
  return new Map(filas.map(fila => [fila.codigo, fila.descripcion]));
}
