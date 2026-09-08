import { and, desc, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { tasasCambio } from "../db/schema";
import { normalizarTasa } from "./moneda";

type Db = ReturnType<typeof getDb>;

/**
 * Tasa NIO por unidad de USD vigente para una fecha exacta. El catálogo se consulta por
 * fecha exacta (no "la más reciente anterior"): si no se registró la tasa de ese día,
 * se considera faltante y el llamador debe bloquear el registro con un error claro.
 */
export async function obtenerTasaVigente(db: Db, fecha: string): Promise<{ id: string; tasa: string; fuente: string } | null> {
  const [fila] = await db.select({ id: tasasCambio.id, tasa: tasasCambio.tasa, fuente: tasasCambio.fuente })
    .from(tasasCambio)
    .where(and(eq(tasasCambio.fecha, fecha), eq(tasasCambio.moneda, "USD")))
    .limit(1);
  return fila ?? null;
}

export async function listarTasas(db: Db) {
  return db.select().from(tasasCambio).orderBy(desc(tasasCambio.fecha)).limit(200);
}

export type NuevaTasa = { fecha: string; tasa: string; fuente: string; usuarioId: string };

export async function crearTasa(db: Db, input: NuevaTasa) {
  const tasaNormalizada = normalizarTasa(input.tasa);
  const [fila] = await db.insert(tasasCambio).values({
    fecha: input.fecha,
    moneda: "USD",
    tasa: tasaNormalizada,
    fuente: input.fuente,
    creadoPor: input.usuarioId,
  }).returning();
  return fila;
}

export type ActualizacionTasa = { tasa?: string; fuente?: string; usuarioId: string };

export async function actualizarTasa(db: Db, id: string, input: ActualizacionTasa) {
  const values: Partial<typeof tasasCambio.$inferInsert> = { actualizadoPor: input.usuarioId, actualizadoEn: new Date() };
  if (input.tasa !== undefined) values.tasa = normalizarTasa(input.tasa);
  if (input.fuente !== undefined) values.fuente = input.fuente;
  const [fila] = await db.update(tasasCambio).set(values).where(eq(tasasCambio.id, id)).returning();
  return fila ?? null;
}
