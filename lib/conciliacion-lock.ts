import { sql } from "drizzle-orm";
import type { getDb } from "../db";

type Db = ReturnType<typeof getDb>;
/** Un único orden de bloqueo para anulación, creación, enlace y revisión.
 * Se adquiere antes de leer estados y se libera al commit/rollback. Las transacciones
 * anidadas usan savepoints y conservan el bloqueo exterior. Serializa escrituras
 * contables de conciliación; no bloquea las consultas de la interfaz. */
export async function conBloqueoConciliacion<T>(db: Db, operacion: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(73421, 1)`);
    return operacion(tx);
  });
}

export function esConflictoContable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; cause?: unknown };
  return ["23505", "40001", "40P01"].includes(e.code ?? "") || (e.cause !== error && esConflictoContable(e.cause));
}
