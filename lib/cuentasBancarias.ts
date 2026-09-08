import { eq } from "drizzle-orm";
import type { getDb } from "../db";
import { movimientosCuentas, reportesBancarios } from "../db/schema";

type Db = ReturnType<typeof getDb>;

/**
 * Una cuenta bancaria con minutas registradas o estados de cuenta cargados no puede cambiar de
 * moneda: reinterpretaría retroactivamente importes ya contabilizados o conciliados en la moneda
 * original. La cuenta queda inmutable en moneda desde su primer movimiento.
 */
export async function tieneMovimientosIncompatibles(db: Db, numeroCuenta: string): Promise<boolean> {
  const [movimiento] = await db.select({ id: movimientosCuentas.id }).from(movimientosCuentas)
    .where(eq(movimientosCuentas.cuentaBancariaNumero, numeroCuenta)).limit(1);
  if (movimiento) return true;

  const [reporte] = await db.select({ id: reportesBancarios.id }).from(reportesBancarios)
    .where(eq(reportesBancarios.cuentaBancariaNumero, numeroCuenta)).limit(1);
  return Boolean(reporte);
}
