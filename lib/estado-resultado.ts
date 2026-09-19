import * as XLSX from "xlsx";

type SheetRow = unknown[];

export type EstadoResultadoRow = {
  numeroLinea: number;
  concepto: string;
  saldoInicial: string;
  movimientoPeriodo: string;
  saldoFinal: string;
  esTotal: boolean;
};

export type EstadoResultadoProcesado = {
  filas: EstadoResultadoRow[];
  totalIngresos: string;
  totalGastos: string;
  resultadoEjercicio: string;
  periodoDetectado: string | null;
};

function normalizar(value: unknown) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function monto(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NaN;
  const negativo = /^\(.*\)$/.test(raw);
  const parsed = Number(raw.replace(/[C$\s()]/gi, "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? (negativo ? -parsed : parsed) : Number.NaN;
}

function sumarBloque(fila: SheetRow, desde: number, hasta: number) {
  const importes = fila.slice(desde, hasta + 1).map(monto).filter(Number.isFinite);
  return importes.length ? importes.reduce((total, valor) => total + valor, 0) : Number.NaN;
}

function valorControl(filas: EstadoResultadoRow[], patron: RegExp, etiqueta: string) {
  const fila = [...filas].reverse().find(item => patron.test(normalizar(item.concepto)));
  if (!fila) throw new Error(`No se encontró ${etiqueta} en el Estado de Resultado Integral`);
  return Number(fila.saldoFinal);
}

function detectarPeriodo(rows: SheetRow[], hastaFila: number) {
  const meses: Record<string, string> = {
    enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
    julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
  };
  for (const fila of rows.slice(0, hastaFila + 1)) {
    for (const celda of fila) {
      const coincidencia = normalizar(celda).match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?: de| del)? (\d{4})/);
      if (coincidencia) return `${coincidencia[2]}-${meses[coincidencia[1]]}`;
    }
  }
  return null;
}

/**
 * El formato oficial agrupa las columnas en Saldo Inicial, movimiento del mes y saldo final.
 * Cada grupo puede ocupar varias celdas y el importe puede aparecer en cualquiera de ellas;
 * por eso se suma el bloque completo en lugar de fijar una columna única.
 */
export function extraerFilasEstadoResultado(rows: SheetRow[]): EstadoResultadoProcesado {
  let encabezadoFila = -1;
  let descripcionColumna = -1;
  let saldoInicialColumna = -1;
  let notasColumna = -1;

  for (let fila = 0; fila < rows.length; fila += 1) {
    const descripcion = rows[fila].findIndex(celda => ["descripcion", "concepto"].includes(normalizar(celda)));
    const saldoInicial = rows[fila].findIndex(celda => normalizar(celda) === "saldo inicial");
    if (descripcion >= 0 && saldoInicial >= 0) {
      encabezadoFila = fila;
      descripcionColumna = descripcion;
      saldoInicialColumna = saldoInicial;
      notasColumna = rows[fila].findIndex(celda => normalizar(celda).startsWith("nota"));
      break;
    }
  }
  if (encabezadoFila < 0) throw new Error("No se encontraron los encabezados Descripción y Saldo Inicial del Estado de Resultado Integral");

  const ultimaColumna = notasColumna > saldoInicialColumna
    ? notasColumna - 1
    : Math.max(...rows.slice(encabezadoFila + 1).map(fila => fila.length - 1));
  const saldoFinalInicio = ultimaColumna - 1;
  const movimientoInicio = saldoInicialColumna + 2;
  const movimientoFin = saldoFinalInicio - 1;
  if (movimientoInicio > movimientoFin || saldoFinalInicio <= saldoInicialColumna) {
    throw new Error("No se pudieron identificar los bloques de movimiento y saldo final del Estado de Resultado Integral");
  }

  const filas = rows.slice(encabezadoFila + 1).flatMap((fila, index) => {
    const concepto = String(fila[descripcionColumna] ?? "").trim();
    if (!concepto) return [];
    const saldoInicial = sumarBloque(fila, saldoInicialColumna, movimientoInicio - 1);
    const movimientoPeriodo = sumarBloque(fila, movimientoInicio, movimientoFin);
    const saldoFinal = sumarBloque(fila, saldoFinalInicio, ultimaColumna);
    if (![saldoInicial, movimientoPeriodo, saldoFinal].some(Number.isFinite)) return [];
    return [{
      numeroLinea: encabezadoFila + index + 2,
      concepto,
      saldoInicial: (Number.isFinite(saldoInicial) ? saldoInicial : 0).toFixed(2),
      movimientoPeriodo: (Number.isFinite(movimientoPeriodo) ? movimientoPeriodo : 0).toFixed(2),
      saldoFinal: (Number.isFinite(saldoFinal) ? saldoFinal : 0).toFixed(2),
      esTotal: /^total\b/i.test(concepto) || /^utilidad o perdida del ejercicio$/i.test(normalizar(concepto)),
    }];
  });
  if (!filas.length) throw new Error("El archivo no contiene líneas numéricas del Estado de Resultado Integral");

  const totalIngresos = valorControl(filas, /^total ingresos$/, "Total Ingresos");
  const totalGastos = valorControl(filas, /^total gastos operativos$/, "Total Gastos Operativos");
  const resultadoEjercicio = valorControl(filas, /^utilidad o perdida del ejercicio$/, "Utilidad o pérdida del ejercicio");
  const diferencia = Math.round((totalIngresos - totalGastos - resultadoEjercicio) * 100) / 100;
  if (Math.abs(diferencia) >= 0.01) {
    throw new Error(`El Estado de Resultado Integral no cuadra: Total Ingresos menos Total Gastos difiere de la utilidad o pérdida por C$ ${Math.abs(diferencia).toFixed(2)}`);
  }

  return {
    filas,
    totalIngresos: totalIngresos.toFixed(2),
    totalGastos: totalGastos.toFixed(2),
    resultadoEjercicio: resultadoEjercicio.toFixed(2),
    periodoDetectado: detectarPeriodo(rows, encabezadoFila),
  };
}

export function leerEstadoResultado(buffer: ArrayBuffer): EstadoResultadoProcesado {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas para procesar");
  const rows = XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
  return extraerFilasEstadoResultado(rows);
}
