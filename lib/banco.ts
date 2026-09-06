import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import type { getDb } from "../db";
import { conciliacionesBancarias, detallesMovimientos, lineasReporteBancario, movimientosCuentas } from "../db/schema";

type Db = ReturnType<typeof getDb>;
type SheetRow = unknown[];
type RawRow = Record<string, unknown>;

export type LineaEstadoBancario = {
  numeroLinea: number;
  fecha: string | null;
  referencia: string | null;
  descripcion: string;
  debito: string;
  credito: string;
  saldo: string | null;
};

export type MovimientoConciliable = {
  id: string;
  fecha: string;
  referencia: string | null;
  concepto: string;
  monto: number;
  lineaId: string | null;
};

const headerAliases = {
  fecha: ["fecha", "fecha operacion", "fecha de operacion", "fecha movimiento", "fecha contable", "fecha valor", "date"],
  descripcion: ["descripcion", "concepto", "detalle", "transaccion", "movimiento", "description", "narrativa"],
  referencia: ["referencia", "numero", "no", "num", "documento", "numero documento", "num documento", "comprobante", "reference"],
  debito: ["debito", "debitos", "debe", "cargo", "cargos", "retiro", "retiros", "salida", "salidas", "withdrawal"],
  credito: ["credito", "creditos", "haber", "abono", "abonos", "deposito", "depositos", "entrada", "entradas", "deposit"],
  monto: ["monto", "importe", "valor", "amount"],
  saldo: ["saldo", "balance", "saldo disponible", "saldo contable", "saldo final"],
};

function normalizarHeader(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function valorTexto(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
}

function valorMonto(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const raw = valorTexto(value);
  if (!raw) return 0;
  const negativo = /^\(.*\)$/.test(raw) || raw.startsWith("-");
  const normalized = raw.replace(/[()]/g, "").replace(/[C$USD\s]/gi, "").replace(/,/g, "").replace(/^-/, "");
  const parsed = Number(normalized || "0");
  if (!Number.isFinite(parsed)) return Number.NaN;
  return negativo ? -parsed : parsed;
}

export function valorFecha(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = valorTexto(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const separado = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (separado) {
    const [, dia, mes, anioRaw] = separado;
    const anio = anioRaw.length === 2 ? `20${anioRaw}` : anioRaw;
    const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
    if (Number.isNaN(fecha.getTime())) return null;
    return fecha.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function buscarValor(row: RawRow, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizarHeader);
  return Object.entries(row).find(([key]) => normalizedAliases.includes(normalizarHeader(key)))?.[1];
}

function filasConEncabezado(rows: SheetRow[]): RawRow[] {
  const alias = {
    descripcion: headerAliases.descripcion.map(normalizarHeader),
    debito: headerAliases.debito.map(normalizarHeader),
    credito: headerAliases.credito.map(normalizarHeader),
    monto: headerAliases.monto.map(normalizarHeader),
  };
  const headerIndex = rows.findIndex(row => {
    const headers = row.map(cell => normalizarHeader(valorTexto(cell))).filter(Boolean);
    const tieneDescripcion = alias.descripcion.some(item => headers.includes(item));
    const tieneMonto = alias.debito.some(item => headers.includes(item))
      || alias.credito.some(item => headers.includes(item))
      || alias.monto.some(item => headers.includes(item));
    return tieneDescripcion && tieneMonto;
  });
  if (headerIndex === -1) {
    throw new Error("No se encontraron encabezados del estado bancario: se requiere una columna de descripción o concepto y otra de débito, crédito o monto");
  }

  const headers = rows[headerIndex].map(cell => valorTexto(cell));
  return rows.slice(headerIndex + 1).map(row => Object.fromEntries(headers.map((header, index) => [header || `columna_${index + 1}`, row[index] ?? ""])));
}

function extraerLineas(rows: RawRow[]): LineaEstadoBancario[] {
  const parsed = rows.map((row, index) => {
    const descripcion = valorTexto(buscarValor(row, headerAliases.descripcion));
    const referencia = valorTexto(buscarValor(row, headerAliases.referencia));
    const fecha = valorFecha(buscarValor(row, headerAliases.fecha));
    const debitoCelda = buscarValor(row, headerAliases.debito);
    const creditoCelda = buscarValor(row, headerAliases.credito);
    const montoCelda = buscarValor(row, headerAliases.monto);
    const saldoCelda = buscarValor(row, headerAliases.saldo);

    let debito = debitoCelda === undefined ? 0 : Math.abs(valorMonto(debitoCelda));
    let credito = creditoCelda === undefined ? 0 : Math.abs(valorMonto(creditoCelda));
    if (debitoCelda === undefined && creditoCelda === undefined && montoCelda !== undefined) {
      const monto = valorMonto(montoCelda);
      debito = monto < 0 ? Math.abs(monto) : 0;
      credito = monto > 0 ? monto : 0;
    }
    const saldo = saldoCelda === undefined || valorTexto(saldoCelda) === "" ? null : valorMonto(saldoCelda);

    return { numeroLinea: index + 2, fecha, referencia, descripcion, debito, credito, saldo };
  }).filter(row => row.descripcion || row.referencia || row.debito || row.credito);

  if (!parsed.length) throw new Error("El archivo no contiene movimientos bancarios");
  const invalida = parsed.find(row => !row.descripcion || !Number.isFinite(row.debito) || !Number.isFinite(row.credito) || (row.saldo !== null && !Number.isFinite(row.saldo)));
  if (invalida) throw new Error(`Fila ${invalida.numeroLinea}: la descripción es obligatoria y los montos deben ser numéricos`);
  const sinMonto = parsed.find(row => row.debito === 0 && row.credito === 0);
  if (sinMonto) throw new Error(`Fila ${sinMonto.numeroLinea}: el movimiento no tiene débito ni crédito`);

  return parsed.map(row => ({
    numeroLinea: row.numeroLinea,
    fecha: row.fecha,
    referencia: row.referencia || null,
    descripcion: row.descripcion,
    debito: row.debito.toFixed(2),
    credito: row.credito.toFixed(2),
    saldo: row.saldo === null ? null : row.saldo.toFixed(2),
  }));
}

export async function leerEstadoBancario(archivo: File): Promise<LineaEstadoBancario[]> {
  const buffer = await archivo.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas para procesar");
  const rows = XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false, dateNF: "yyyy-mm-dd" });
  return extraerLineas(filasConEncabezado(rows));
}

export function resumenEstadoBancario(lineas: LineaEstadoBancario[]) {
  const fechas = lineas.map(linea => linea.fecha).filter((fecha): fecha is string => Boolean(fecha)).sort();
  const totalDebitos = lineas.reduce((total, linea) => total + Number(linea.debito), 0);
  const totalCreditos = lineas.reduce((total, linea) => total + Number(linea.credito), 0);
  return {
    totalLineas: lineas.length,
    totalDebitos: totalDebitos.toFixed(2),
    totalCreditos: totalCreditos.toFixed(2),
    periodoInicio: fechas[0] ?? null,
    periodoFin: fechas[fechas.length - 1] ?? null,
  };
}

export const periodoDesdeFecha = (fecha: string) => fecha.slice(0, 7);

/** Movimientos contables registrados sobre la cuenta bancaria dentro del período del estado. */
export async function movimientosConciliables(db: Db, cuentaBancariaNumero: string, desde: string | null, hasta: string | null): Promise<MovimientoConciliable[]> {
  const filtros = [eq(movimientosCuentas.cuentaBancariaNumero, cuentaBancariaNumero), eq(movimientosCuentas.estado, "registrado")];
  if (desde) filtros.push(gte(movimientosCuentas.fecha, desde));
  if (hasta) filtros.push(lte(movimientosCuentas.fecha, hasta));

  const movimientos = await db.select({
    id: movimientosCuentas.id,
    fecha: movimientosCuentas.fecha,
    referencia: movimientosCuentas.referencia,
    concepto: movimientosCuentas.concepto,
  }).from(movimientosCuentas).where(and(...filtros)).orderBy(asc(movimientosCuentas.fecha)).limit(500);

  if (!movimientos.length) return [];
  const ids = movimientos.map(movimiento => movimiento.id);
  const [totales, enlazadas] = await Promise.all([
    db.select({
      movimientoId: detallesMovimientos.movimientoId,
      total: sql<string>`coalesce(sum(${detallesMovimientos.monto}) filter (where ${detallesMovimientos.tipo} = 'debito'), 0)`,
    }).from(detallesMovimientos).where(inArray(detallesMovimientos.movimientoId, ids)).groupBy(detallesMovimientos.movimientoId),
    db.select({ id: lineasReporteBancario.id, movimientoId: lineasReporteBancario.movimientoId })
      .from(lineasReporteBancario).where(inArray(lineasReporteBancario.movimientoId, ids)),
  ]);

  const montoPorMovimiento = new Map(totales.map(fila => [fila.movimientoId, Number(fila.total)]));
  const lineaPorMovimiento = new Map(enlazadas.filter(fila => fila.movimientoId).map(fila => [fila.movimientoId as string, fila.id]));
  return movimientos.map(movimiento => ({
    ...movimiento,
    monto: montoPorMovimiento.get(movimiento.id) ?? 0,
    lineaId: lineaPorMovimiento.get(movimiento.id) ?? null,
  }));
}

const mismoMonto = (linea: { debito: string; credito: string }, movimiento: MovimientoConciliable) =>
  Math.abs(Math.abs(Number(linea.credito) - Number(linea.debito)) - movimiento.monto) < 0.01;

/**
 * Enlaza automáticamente las líneas del estado bancario con movimientos contables cuando existe
 * una sola coincidencia por monto (y fecha, cuando el estado la trae). Nunca decide entre empates.
 */
export async function autoConciliar(db: Db, reporteId: string, cuentaBancariaNumero: string, usuarioId: string) {
  const lineas = await db.select().from(lineasReporteBancario)
    .where(and(eq(lineasReporteBancario.reporteId, reporteId), eq(lineasReporteBancario.estadoConciliacion, "pendiente")))
    .orderBy(asc(lineasReporteBancario.numeroLinea));
  if (!lineas.length) return 0;

  const fechas = lineas.map(linea => linea.fecha).filter((fecha): fecha is string => Boolean(fecha)).sort();
  const movimientos = await movimientosConciliables(db, cuentaBancariaNumero, fechas[0] ?? null, fechas[fechas.length - 1] ?? null);
  const disponibles = movimientos.filter(movimiento => !movimiento.lineaId);
  const usados = new Set<string>();
  let conciliadas = 0;

  for (const linea of lineas) {
    const candidatos = disponibles.filter(movimiento => !usados.has(movimiento.id)
      && mismoMonto(linea, movimiento)
      && (!linea.fecha || movimiento.fecha === linea.fecha));
    if (candidatos.length !== 1) continue;
    const [movimiento] = candidatos;
    await db.update(lineasReporteBancario)
      .set({ estadoConciliacion: "conciliada", movimientoId: movimiento.id, conciliadoPor: usuarioId, conciliadoEn: new Date() })
      .where(eq(lineasReporteBancario.id, linea.id));
    usados.add(movimiento.id);
    conciliadas += 1;
  }

  return conciliadas;
}

/** Recalcula los totales de la conciliación a partir de las líneas y de los movimientos del período. */
export async function recalcularConciliacion(db: Db, conciliacionId: string) {
  const [conciliacion] = await db.select().from(conciliacionesBancarias).where(eq(conciliacionesBancarias.id, conciliacionId)).limit(1);
  if (!conciliacion) return null;

  const lineas = await db.select().from(lineasReporteBancario).where(eq(lineasReporteBancario.reporteId, conciliacion.reporteId));
  const neto = (linea: typeof lineas[number]) => Number(linea.credito) - Number(linea.debito);
  const totalBanco = lineas.reduce((total, linea) => total + neto(linea), 0);
  const conciliadas = lineas.filter(linea => linea.estadoConciliacion === "conciliada");
  const totalConciliado = conciliadas.reduce((total, linea) => total + neto(linea), 0);
  const pendientes = lineas.filter(linea => linea.estadoConciliacion === "pendiente");

  const fechas = lineas.map(linea => linea.fecha).filter((fecha): fecha is string => Boolean(fecha)).sort();
  const movimientos = await movimientosConciliables(db, conciliacion.cuentaBancariaNumero, fechas[0] ?? null, fechas[fechas.length - 1] ?? null);

  const [actualizada] = await db.update(conciliacionesBancarias).set({
    totalBanco: totalBanco.toFixed(2),
    totalConciliado: totalConciliado.toFixed(2),
    totalPendiente: (totalBanco - totalConciliado).toFixed(2),
    lineasConciliadas: conciliadas.length,
    lineasPendientes: pendientes.length,
    movimientosSinConciliar: movimientos.filter(movimiento => !movimiento.lineaId).length,
  }).where(eq(conciliacionesBancarias.id, conciliacionId)).returning();

  return actualizada;
}
