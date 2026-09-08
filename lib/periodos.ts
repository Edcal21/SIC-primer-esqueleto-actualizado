import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { conciliacionesBancarias, importacionesBalanza, periodosContables } from "../db/schema";

type Db = ReturnType<typeof getDb>;

export type EstadoPeriodo = "abierto" | "revision" | "cerrado";
export type PeriodoContable = typeof periodosContables.$inferSelect;

const periodoRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MOTIVO_REAPERTURA_MINIMO = 15;

export function esPeriodoValido(periodo: string): boolean {
  return periodoRegex.test(periodo);
}

/** Período contable (YYYY-MM) al que pertenece una fecha YYYY-MM-DD. */
export function periodoDeFecha(fecha: string): string {
  const periodo = fecha.slice(0, 7);
  if (!esPeriodoValido(periodo)) throw new Error(`Fecha inválida para determinar el período contable: "${fecha}"`);
  return periodo;
}

export function periodoAnterior(periodo: string): string {
  if (!esPeriodoValido(periodo)) throw new Error(`Período inválido para determinar el período anterior: "${periodo}"`);
  const [anioTexto, mesTexto] = periodo.split("-");
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}

/** Períodos distintos que toca un conjunto de fechas, ordenados y sin repetir. */
export function periodosDeFechas(fechas: (string | null | undefined)[]): string[] {
  const periodos = new Set<string>();
  for (const fecha of fechas) {
    if (fecha) periodos.add(periodoDeFecha(fecha));
  }
  return [...periodos].sort();
}

/**
 * Un período admite escritura salvo que esté explícitamente cerrado. La ausencia de fila cuenta
 * como abierto: los períodos anteriores a este módulo nunca se administraron y no deben quedar
 * bloqueados retroactivamente. "revision" tampoco bloquea: es una señal de que el período se está
 * revisando, no un candado.
 */
export function permiteEscritura(periodo: PeriodoContable | null | undefined): boolean {
  return periodo?.estado !== "cerrado";
}

export function mensajePeriodoCerrado(periodo: string): string {
  return `El período contable ${periodo} está cerrado y no admite cambios. Para modificarlo, un administrador debe reabrirlo desde Cierre contable indicando el motivo.`;
}

/** Estado de un período, o null si nunca se administró (equivale a abierto). */
export async function obtenerPeriodo(db: Db, periodo: string): Promise<PeriodoContable | null> {
  const [fila] = await db.select().from(periodosContables).where(eq(periodosContables.periodo, periodo)).limit(1);
  return fila ?? null;
}

export async function listarPeriodos(db: Db): Promise<PeriodoContable[]> {
  return db.select().from(periodosContables).orderBy(asc(periodosContables.periodo));
}

/**
 * Devuelve el primer período cerrado de la lista, o null si todos admiten escritura. Se consulta
 * en una sola query para no multiplicar viajes a la base cuando una operación toca varios meses
 * (por ejemplo un estado de cuenta que cruza el cierre de mes).
 */
export async function primerPeriodoCerrado(db: Db, periodos: string[]): Promise<string | null> {
  if (!periodos.length) return null;
  const cerrados = await db.select({ periodo: periodosContables.periodo })
    .from(periodosContables)
    .where(and(inArray(periodosContables.periodo, periodos), eq(periodosContables.estado, "cerrado")))
    .orderBy(asc(periodosContables.periodo));
  return cerrados[0]?.periodo ?? null;
}

export type BloqueoPeriodo = { periodo: string; mensaje: string };

/**
 * Comprobación única que usan todas las rutas de escritura contable y bancaria: devuelve el
 * bloqueo si alguna de las fechas cae en un período cerrado, o null si se puede continuar.
 */
export async function verificarPeriodosAbiertos(db: Db, fechas: (string | null | undefined)[]): Promise<BloqueoPeriodo | null> {
  const cerrado = await primerPeriodoCerrado(db, periodosDeFechas(fechas));
  return cerrado ? { periodo: cerrado, mensaje: mensajePeriodoCerrado(cerrado) } : null;
}

export type ImpedimentoCierre = { motivo: string; detalle: string };

export async function validarCierreSecuencial(db: Db, periodo: string): Promise<ImpedimentoCierre | null> {
  const anterior = periodoAnterior(periodo);
  const filaAnterior = await obtenerPeriodo(db, anterior);
  if (filaAnterior?.estado === "cerrado") return null;
  return {
    motivo: "Período anterior sin cerrar",
    detalle: `Antes de cerrar ${periodo}, debe cerrar el período contable anterior ${anterior}.`,
  };
}

/**
 * Razones por las que un período todavía no puede cerrarse. Se devuelven todas juntas para que el
 * usuario no descubra los problemas de a uno.
 */
export async function impedimentosParaCerrar(db: Db, periodo: string): Promise<ImpedimentoCierre[]> {
  const [conciliaciones, balanzas] = await Promise.all([
    db.select({ id: conciliacionesBancarias.id, estado: conciliacionesBancarias.estado, cuenta: conciliacionesBancarias.cuentaBancariaNumero })
      .from(conciliacionesBancarias)
      .where(and(eq(conciliacionesBancarias.periodo, periodo), ne(conciliacionesBancarias.estado, "aprobada"))),
    db.select({ id: importacionesBalanza.id, archivo: importacionesBalanza.archivoNombre })
      .from(importacionesBalanza)
      .where(and(eq(importacionesBalanza.periodo, periodo), eq(importacionesBalanza.estado, "con_diferencias"))),
  ]);

  const impedimentos: ImpedimentoCierre[] = [];
  const borradores = conciliaciones.filter(fila => fila.estado === "borrador");
  const rechazadas = conciliaciones.filter(fila => fila.estado === "rechazada");

  if (borradores.length) {
    impedimentos.push({
      motivo: "Conciliaciones bancarias sin aprobar",
      detalle: `${borradores.length} conciliación(es) en borrador: ${borradores.map(fila => fila.cuenta).join(", ")}. Apruébelas o recháce y resuelva antes de cerrar.`,
    });
  }
  if (rechazadas.length) {
    impedimentos.push({
      motivo: "Conciliaciones bancarias rechazadas",
      detalle: `${rechazadas.length} conciliación(es) rechazada(s): ${rechazadas.map(fila => fila.cuenta).join(", ")}. Corrija y vuelva a conciliar antes de cerrar.`,
    });
  }
  if (balanzas.length) {
    impedimentos.push({
      motivo: "Balanza importada con diferencias",
      detalle: `${balanzas.length} importación(es) con diferencias: ${balanzas.map(fila => fila.archivo).join(", ")}. Corrija el descuadre antes de cerrar.`,
    });
  }
  return impedimentos;
}

export async function abrirPeriodo(db: Db, periodo: string): Promise<PeriodoContable> {
  const [fila] = await db.insert(periodosContables).values({ periodo, estado: "abierto" }).returning();
  return fila;
}

export async function marcarEnRevision(db: Db, periodo: string): Promise<PeriodoContable | null> {
  const [fila] = await db.update(periodosContables)
    .set({ estado: "revision", actualizadoEn: new Date() })
    .where(eq(periodosContables.periodo, periodo))
    .returning();
  return fila ?? null;
}

export async function cerrarPeriodo(db: Db, periodo: string, usuario: { id: string; nombre: string }): Promise<PeriodoContable | null> {
  const [fila] = await db.update(periodosContables)
    .set({ estado: "cerrado", fechaCierre: new Date(), cerradoPor: usuario.id, cerradoPorNombre: usuario.nombre, actualizadoEn: new Date() })
    .where(eq(periodosContables.periodo, periodo))
    .returning();
  return fila ?? null;
}

/**
 * Reabre un período cerrado. Nunca borra ni recalcula nada de lo ya registrado: solo levanta el
 * candado y deja constancia de quién lo hizo y por qué. Los datos del cierre anterior se conservan
 * (fecha y usuario) hasta que se vuelva a cerrar.
 */
export async function reabrirPeriodo(db: Db, periodo: string, usuario: { id: string; nombre: string }, motivo: string): Promise<PeriodoContable | null> {
  const [fila] = await db.update(periodosContables)
    .set({
      estado: "abierto",
      fechaCierre: null,
      cerradoPor: null,
      cerradoPorNombre: null,
      reabiertoPor: usuario.id,
      reabiertoPorNombre: usuario.nombre,
      reabiertoEn: new Date(),
      motivoReapertura: motivo,
      actualizadoEn: new Date(),
    })
    .where(eq(periodosContables.periodo, periodo))
    .returning();
  return fila ?? null;
}

/** Períodos con actividad contable registrada, para sugerir cuáles administrar. */
export async function periodosConActividad(db: Db): Promise<string[]> {
  const filas = await db.execute(sql`
    select distinct to_char(fecha, 'YYYY-MM') as periodo from movimientos_cuentas
    union
    select distinct periodo from importaciones_balanza
    union
    select distinct periodo from importaciones_situacion_financiera
    union
    select distinct periodo from conciliaciones_bancarias
    order by 1 desc
  `);
  return (filas as unknown as { periodo: string }[]).map(fila => fila.periodo).filter(esPeriodoValido);
}
