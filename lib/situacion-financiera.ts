import * as XLSX from "xlsx";

type SheetRow = unknown[];

export type SituacionFinancieraRow = {
  numeroLinea: number;
  concepto: string;
  saldoFinal: string;
  esTotal: boolean;
};

export type SituacionFinancieraProcesada = { filas: SituacionFinancieraRow[] };

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

/**
 * El reporte de referencia ubica el título "Saldo Final" en K, pero combina J:K para los datos.
 * Por eso se detecta la columna numérica efectiva alrededor del encabezado, en vez de fijar J o K.
 */
export function extraerFilasSituacionFinanciera(rows: SheetRow[]): SituacionFinancieraProcesada {
  let encabezadoFila = -1, descripcionColumna = -1, saldoEncabezadoColumna = -1;
  for (let fila = 0; fila < rows.length; fila += 1) {
    const descripcion = rows[fila].findIndex(celda => ["descripcion", "concepto"].includes(normalizar(celda)));
    const saldo = rows[fila].findIndex(celda => normalizar(celda) === "saldo final");
    if (descripcion >= 0 && saldo >= 0) {
      encabezadoFila = fila; descripcionColumna = descripcion; saldoEncabezadoColumna = saldo; break;
    }
  }
  if (encabezadoFila < 0) throw new Error("No se encontraron los encabezados Descripción y Saldo Final del Estado de Situación Financiera");

  const candidatas = Array.from(new Set([saldoEncabezadoColumna - 2, saldoEncabezadoColumna - 1, saldoEncabezadoColumna, saldoEncabezadoColumna + 1, saldoEncabezadoColumna + 2]))
    .filter(columna => columna >= 0);
  const saldoColumna = candidatas
    .map(columna => ({ columna, cantidad: rows.slice(encabezadoFila + 1).filter(fila => Number.isFinite(monto(fila[columna]))).length }))
    .sort((a, b) => b.cantidad - a.cantidad || Math.abs(a.columna - saldoEncabezadoColumna) - Math.abs(b.columna - saldoEncabezadoColumna))[0];
  if (!saldoColumna || saldoColumna.cantidad === 0) throw new Error("No se encontraron valores numéricos en la columna Saldo Final");

  const filas = rows.slice(encabezadoFila + 1).flatMap((fila, index) => {
    const concepto = String(fila[descripcionColumna] ?? "").trim();
    const esExcedente = /^excedente ingresos s\/egresos (acumulados|del ejercicio)$/i.test(normalizar(concepto));
    let saldoFinal = monto(fila[saldoColumna.columna]);
    // El formato fuente coloca estos dos importes auxiliares fuera de la columna combinada J:K.
    // Se conservan porque el flujo anual los necesita expresamente para el traspaso de resultados.
    if (!Number.isFinite(saldoFinal) && esExcedente) {
      const valorAuxiliar = fila.slice(descripcionColumna + 1).map(monto).find(Number.isFinite);
      saldoFinal = valorAuxiliar ?? Number.NaN;
    }
    if (!concepto || !Number.isFinite(saldoFinal)) return [];
    return [{
      numeroLinea: encabezadoFila + index + 2,
      concepto,
      saldoFinal: saldoFinal.toFixed(2),
      esTotal: /^total\b/i.test(concepto),
    }];
  });
  if (!filas.length) throw new Error("El archivo no contiene líneas con Saldo Final");
  return { filas };
}

export type RevisionSituacion = {
  estado: "procesado" | "con_diferencias";
  observaciones: string[];
};

const claveConcepto = (concepto: string) => normalizar(concepto);
const buscar = (filas: SituacionFinancieraRow[], ...conceptos: string[]) => {
  const claves = conceptos.map(claveConcepto);
  const fila = filas.find(item => claves.includes(claveConcepto(item.concepto)));
  return fila ? Number(fila.saldoFinal) : null;
};

/**
 * Revisa un Estado de Situación Financiera ya leído antes de guardarlo. No corrige nada: decide si
 * el archivo entra como "procesado" o como "con_diferencias" y deja por escrito qué encontró.
 *
 * Dos controles:
 *  - Cuadre contable: Total ACTIVOS contra el total de pasivos más patrimonio. Si alguna de las dos
 *    líneas no está, no se puede verificar y eso también se anota; el silencio no es aprobación.
 *  - Conceptos repetidos: el formato de origen repite alguna línea de total. Mientras el importe sea
 *    el mismo es inofensivo y solo se anota, pero si difieren el reporte tendría que elegir uno y
 *    el archivo se marca con diferencias.
 */
export function revisarSituacionFinanciera(filas: SituacionFinancieraRow[]): RevisionSituacion {
  const observaciones: string[] = [];
  let estado: RevisionSituacion["estado"] = "procesado";

  const activos = buscar(filas, "Total ACTIVOS");
  const pasivosYPatrimonio = buscar(filas, "TOTAL PASIVOS Y PATRIMONIO + PATRIMONIO", "Total PASIVOS Y PATRIMONIO MAS PATRIMONIO");
  const pasivos = buscar(filas, "Total PASIVOS CORRIENTES");
  const patrimonio = buscar(filas, "Total PATRIMONIO");
  const contraparte = pasivosYPatrimonio ?? (pasivos !== null && patrimonio !== null ? pasivos + patrimonio : null);

  if (activos === null || contraparte === null) {
    observaciones.push(
      `No se pudo verificar el cuadre contable: falta ${activos === null ? "la línea Total ACTIVOS" : "el total de pasivos más patrimonio"} en el archivo.`,
    );
  } else {
    const diferencia = Math.round((activos - contraparte) * 100) / 100;
    if (Math.abs(diferencia) >= 0.01) {
      estado = "con_diferencias";
      observaciones.push(
        `El estado no cuadra: Total ACTIVOS ${activos.toFixed(2)} contra pasivos más patrimonio ${contraparte.toFixed(2)}, diferencia ${diferencia.toFixed(2)}.`,
      );
    }
  }

  const porConcepto = new Map<string, { nombre: string; saldos: number[] }>();
  for (const fila of filas) {
    const clave = claveConcepto(fila.concepto);
    const grupo = porConcepto.get(clave) ?? { nombre: fila.concepto, saldos: [] };
    grupo.saldos.push(Number(fila.saldoFinal));
    porConcepto.set(clave, grupo);
  }
  for (const { nombre, saldos } of porConcepto.values()) {
    if (saldos.length < 2) continue;
    const distintos = new Set(saldos.map(saldo => saldo.toFixed(2)));
    if (distintos.size > 1) {
      estado = "con_diferencias";
      observaciones.push(
        `El concepto "${nombre}" aparece ${saldos.length} veces con importes distintos (${[...distintos].join(", ")}). Los reportes no pueden decidir cuál usar.`,
      );
    } else {
      observaciones.push(`El concepto "${nombre}" aparece ${saldos.length} veces con el mismo importe; se toma una sola vez.`);
    }
  }

  return { estado, observaciones };
}

export function leerSituacionFinanciera(buffer: ArrayBuffer): SituacionFinancieraProcesada {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas para procesar");
  const rows = XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
  return extraerFilasSituacionFinanciera(rows);
}
