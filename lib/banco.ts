import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import * as XLSX from "xlsx";
import type { getDb } from "../db";
import { conciliacionesBancarias, detallesMovimientos, lineasReporteBancario, movimientosCuentas } from "../db/schema";
import { calcularEquivalenteNio, sumarMontos } from "./moneda";
import { obtenerTasaVigente } from "./tasas";

type Db = ReturnType<typeof getDb>;
type SheetRow = unknown[];
type RawRow = Record<string, unknown>;
/** Filas de datos junto al número de fila real del archivo, para que los errores sean ubicables. */
type HojaBancaria = { filas: RawRow[]; primeraFilaDatos: number };

const MAXIMO_MOVIMIENTOS = 20000;

export type LineaEstadoBancario = {
  numeroLinea: number;
  fecha: string | null;
  referencia: string | null;
  descripcion: string;
  debito: string;
  credito: string;
  saldo: string | null;
};

/** Línea del estado de cuenta lista para insertar, con la moneda de la cuenta bancaria y, cuando
 *  hay tasa registrada en el catálogo para su fecha, el equivalente en NIO. Nunca convierte todo
 *  un estado de cuenta con una tasa única: cada línea resuelve su propia tasa por fecha. */
export type LineaEstadoBancarioConMoneda = LineaEstadoBancario & {
  moneda: "USD" | "NIO";
  tasaCambio: string | null;
  debitoNio: string | null;
  creditoNio: string | null;
};

export type MovimientoConciliable = {
  id: string;
  fecha: string;
  referencia: string | null;
  concepto: string;
  /** Equivalente en NIO (para reportes históricos). */
  monto: number;
  /** Importe en la moneda original de la cuenta bancaria: es lo que debe compararse contra el
   *  estado de cuenta, nunca la suma de todos los débitos de la minuta. */
  montoOriginal: number;
  moneda: "USD" | "NIO";
  /** false = minuta histórica sin ninguna línea marcada como "afecta la cuenta bancaria"; se
   *  conserva el cálculo legado (suma de débitos en NIO) sin inventar una moneda ni una tasa. */
  completo: boolean;
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

function filasConEncabezado(rows: SheetRow[]): HojaBancaria {
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
    const detectadas = rows.slice(0, 10).flatMap(row => row.map(cell => valorTexto(cell))).filter(Boolean).slice(0, 12);
    const encontradas = detectadas.length
      ? ` Columnas leídas en el archivo: ${detectadas.join(", ")}.`
      : " El archivo no contiene texto en las primeras filas.";
    throw new Error(
      "No se reconoció el encabezado del estado bancario. Se necesita una columna de descripción o concepto y otra de débito, crédito o monto."
      + encontradas,
    );
  }

  const headers = rows[headerIndex].map(cell => valorTexto(cell));
  return {
    filas: rows.slice(headerIndex + 1).map(row => Object.fromEntries(headers.map((header, index) => [header || `columna_${index + 1}`, row[index] ?? ""]))),
    primeraFilaDatos: headerIndex + 2,
  };
}

function extraerLineas(hoja: HojaBancaria): LineaEstadoBancario[] {
  const parsed = hoja.filas.map((row, index) => {
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

    return { numeroLinea: hoja.primeraFilaDatos + index, fecha, referencia, descripcion, debito, credito, saldo };
  }).filter(row => row.descripcion || row.referencia || row.debito || row.credito);

  if (!parsed.length) throw new Error("El archivo tiene encabezados válidos pero ninguna fila de movimientos");
  if (parsed.length > MAXIMO_MOVIMIENTOS) {
    throw new Error(`El archivo contiene ${parsed.length} movimientos y el máximo admitido por carga es ${MAXIMO_MOVIMIENTOS}; divida el estado de cuenta por período`);
  }

  for (const fila of parsed) {
    if (!fila.descripcion) throw new Error(`Fila ${fila.numeroLinea}: falta la descripción o concepto del movimiento`);
    if (!Number.isFinite(fila.debito)) throw new Error(`Fila ${fila.numeroLinea}: el débito no es un monto numérico válido`);
    if (!Number.isFinite(fila.credito)) throw new Error(`Fila ${fila.numeroLinea}: el crédito no es un monto numérico válido`);
    if (fila.saldo !== null && !Number.isFinite(fila.saldo)) throw new Error(`Fila ${fila.numeroLinea}: el saldo no es un monto numérico válido`);
    if (fila.debito === 0 && fila.credito === 0) throw new Error(`Fila ${fila.numeroLinea}: el movimiento no tiene débito ni crédito`);
    if (fila.debito > 0 && fila.credito > 0) throw new Error(`Fila ${fila.numeroLinea}: el movimiento trae débito y crédito a la vez; cada línea del estado de cuenta debe tener solo uno`);
  }

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
  if (!rows.length) throw new Error(`La hoja "${sheetName}" del archivo está vacía`);
  return extraerLineas(filasConEncabezado(rows));
}

/**
 * Adjunta a cada línea del estado de cuenta la moneda de la cuenta bancaria y, cuando existe tasa
 * registrada en el catálogo para su fecha, el equivalente en NIO. Cada línea resuelve su propia
 * tasa por fecha: nunca se convierte todo el estado de cuenta con una tasa única. Si la cuenta es
 * USD y la fecha no tiene tasa catalogada (o la línea no trae fecha), la línea queda "pendiente de
 * completar": se guarda igual, pero no podrá enlazarse ni aprobarse hasta completar la tasa.
 */
export async function construirLineasConMoneda(db: Db, lineas: LineaEstadoBancario[], moneda: "USD" | "NIO"): Promise<LineaEstadoBancarioConMoneda[]> {
  if (moneda === "NIO") {
    return lineas.map(linea => ({ ...linea, moneda, tasaCambio: "1.000000", debitoNio: linea.debito, creditoNio: linea.credito }));
  }

  const fechas = [...new Set(lineas.map(linea => linea.fecha).filter((fecha): fecha is string => Boolean(fecha)))];
  const tasasPorFecha = new Map<string, string>();
  await Promise.all(fechas.map(async fecha => {
    const tasa = await obtenerTasaVigente(db, fecha);
    if (tasa) tasasPorFecha.set(fecha, tasa.tasa);
  }));

  return lineas.map(linea => {
    const tasa = linea.fecha ? tasasPorFecha.get(linea.fecha) : undefined;
    if (!tasa) return { ...linea, moneda, tasaCambio: null, debitoNio: null, creditoNio: null };
    return { ...linea, moneda, tasaCambio: tasa, debitoNio: calcularEquivalenteNio(linea.debito, tasa), creditoNio: calcularEquivalenteNio(linea.credito, tasa) };
  });
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
  const [detalles, enlazadas] = await Promise.all([
    db.select({
      movimientoId: detallesMovimientos.movimientoId,
      tipo: detallesMovimientos.tipo,
      monto: detallesMovimientos.monto,
      montoOriginal: detallesMovimientos.montoOriginal,
      moneda: detallesMovimientos.moneda,
      afectaCuentaBancaria: detallesMovimientos.afectaCuentaBancaria,
    }).from(detallesMovimientos).where(inArray(detallesMovimientos.movimientoId, ids)),
    db.select({ id: lineasReporteBancario.id, movimientoId: lineasReporteBancario.movimientoId })
      .from(lineasReporteBancario).where(inArray(lineasReporteBancario.movimientoId, ids)),
  ]);

  const detallesPorMovimiento = new Map<string, typeof detalles>();
  for (const fila of detalles) {
    const lista = detallesPorMovimiento.get(fila.movimientoId) ?? [];
    lista.push(fila);
    detallesPorMovimiento.set(fila.movimientoId, lista);
  }
  const lineaPorMovimiento = new Map(enlazadas.filter(fila => fila.movimientoId).map(fila => [fila.movimientoId as string, fila.id]));

  return movimientos.map(movimiento => {
    const lineasDetalle = detallesPorMovimiento.get(movimiento.id) ?? [];
    const marcadas = lineasDetalle.filter(fila => fila.afectaCuentaBancaria);
    const lineaId = lineaPorMovimiento.get(movimiento.id) ?? null;

    if (marcadas.length) {
      return {
        ...movimiento,
        monto: Number(sumarMontos(marcadas.map(fila => fila.monto))),
        montoOriginal: Number(sumarMontos(marcadas.map(fila => fila.montoOriginal))),
        moneda: marcadas[0].moneda,
        completo: true,
        lineaId,
      };
    }

    // Minuta histórica sin línea marcada: se conserva el cálculo legado (suma de débitos en NIO)
    // sin inventar una moneda ni una tasa para un registro que nunca las capturó.
    const legado = Number(sumarMontos(lineasDetalle.filter(fila => fila.tipo === "debito").map(fila => fila.monto)));
    return { ...movimiento, monto: legado, montoOriginal: legado, moneda: "NIO" as const, completo: false, lineaId };
  });
}

const mismoMonto = (linea: { debito: string; credito: string }, movimiento: MovimientoConciliable) =>
  Math.abs(Math.abs(Number(linea.credito) - Number(linea.debito)) - movimiento.montoOriginal) < 0.01;

/** Una línea USD sin tasa registrada para su fecha está pendiente de completar: no se infiere el
 *  valor y se bloquea su enlace (automático o manual) hasta que se complete. */
export const estaPendienteDeTasa = (linea: { moneda: string; tasaCambio: string | null }) =>
  linea.moneda === "USD" && linea.tasaCambio === null;

/**
 * Intenta completar, con el catálogo vigente, las líneas de un reporte que quedaron pendientes de
 * tasa (cuenta USD sin tasa registrada para su fecha al momento de la carga). Nunca inventa una
 * tasa: solo aplica una que ya exista en el catálogo para la fecha exacta de la línea. Se puede
 * llamar cuantas veces sea necesario; es un no-op para las líneas que ya están completas.
 */
export async function completarLineasPendientesDeTasa(db: Db, reporteId: string): Promise<number> {
  const pendientes = await db.select().from(lineasReporteBancario)
    .where(and(eq(lineasReporteBancario.reporteId, reporteId), eq(lineasReporteBancario.moneda, "USD"), isNull(lineasReporteBancario.tasaCambio)));
  const conFecha = pendientes.filter((linea): linea is typeof linea & { fecha: string } => Boolean(linea.fecha));
  if (!conFecha.length) return 0;

  let completadas = 0;
  for (const linea of conFecha) {
    const tasa = await obtenerTasaVigente(db, linea.fecha);
    if (!tasa) continue;
    await db.update(lineasReporteBancario).set({
      tasaCambio: tasa.tasa,
      debitoNio: calcularEquivalenteNio(linea.debito, tasa.tasa),
      creditoNio: calcularEquivalenteNio(linea.credito, tasa.tasa),
    }).where(eq(lineasReporteBancario.id, linea.id));
    completadas += 1;
  }
  return completadas;
}

/**
 * Enlaza automáticamente las líneas del estado bancario con movimientos contables cuando existe
 * una sola coincidencia por monto original (en la moneda de la cuenta) y fecha, cuando el estado
 * la trae. Nunca decide entre empates ni enlaza líneas USD pendientes de completar su tasa.
 */
export async function autoConciliar(db: Db, reporteId: string, cuentaBancariaNumero: string, usuarioId: string) {
  await completarLineasPendientesDeTasa(db, reporteId);

  const todasLasPendientes = await db.select().from(lineasReporteBancario)
    .where(and(eq(lineasReporteBancario.reporteId, reporteId), eq(lineasReporteBancario.estadoConciliacion, "pendiente")))
    .orderBy(asc(lineasReporteBancario.numeroLinea));
  const lineas = todasLasPendientes.filter(linea => !estaPendienteDeTasa(linea));
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

/** Recalcula los totales de la conciliación a partir de las líneas y de los movimientos del período.
 *  Los totales quedan expresados en la moneda original de la cuenta bancaria (nunca se mezclan
 *  monedas ni se convierte todo el estado con una tasa única). */
export async function recalcularConciliacion(db: Db, conciliacionId: string) {
  const [conciliacion] = await db.select().from(conciliacionesBancarias).where(eq(conciliacionesBancarias.id, conciliacionId)).limit(1);
  if (!conciliacion) return null;

  await completarLineasPendientesDeTasa(db, conciliacion.reporteId);

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
