import * as XLSX from "xlsx";

type RawRow = Record<string, unknown> & { __numeroLinea?: number };
type SheetRow = unknown[];

export type BalanzaRow = {
  numeroLinea: number;
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: string;
  haber: string;
  saldo: string;
};

export type BalanzaProcesada = {
  filas: BalanzaRow[];
  totalDebe: number;
  totalHaber: number;
};

const headerAliases = {
  codigo: ["codigo", "código", "cuenta", "cuenta codigo", "cuenta código", "codigo cuenta", "código cuenta"],
  nombre: ["descripcion", "descripción", "nombre", "cuenta nombre", "nombre cuenta"],
  debe: ["debe", "debito", "débito", "debitos", "débitos", "cargo", "deudor"],
  haber: ["haber", "credito", "crédito", "creditos", "créditos", "abono", "acreedor"],
  saldoInicial: ["saldo inicial", "saldo anterior"],
  saldo: ["saldo", "saldo final", "saldo actual"],
};

function normalizarHeader(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function valorTexto(value: unknown) {
  return String(value ?? "").trim();
}

function valorMonto(value: unknown) {
  const raw = String(value ?? "0").trim();
  const normalized = raw.replace(/[C$\s]/gi, "").replace(/,/g, "");
  const parsed = Number(normalized || "0");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buscarValor(row: RawRow, aliases: string[]) {
  const entries = Object.entries(row).map(([key, value]) => [normalizarHeader(key), value] as const);
  const normalizedAliases = aliases.map(normalizarHeader);
  return entries.find(([key]) => normalizedAliases.includes(key))?.[1];
}

function filasConEncabezado(rows: SheetRow[]): RawRow[] {
  const normalizedAliases = {
    codigo: headerAliases.codigo.map(normalizarHeader),
    nombre: headerAliases.nombre.map(normalizarHeader),
    debe: headerAliases.debe.map(normalizarHeader),
    haber: headerAliases.haber.map(normalizarHeader),
  };
  const headerIndex = rows.findIndex(row => {
    const headers = row.map(cell => normalizarHeader(valorTexto(cell))).filter(Boolean);
    return normalizedAliases.codigo.some(alias => headers.includes(alias))
      && normalizedAliases.nombre.some(alias => headers.includes(alias))
      && normalizedAliases.debe.some(alias => headers.includes(alias))
      && normalizedAliases.haber.some(alias => headers.includes(alias));
  });
  if (headerIndex === -1) throw new Error("No se encontraron encabezados de balanza: Cuenta, Descripción, Débitos y Créditos");

  const headers = rows[headerIndex].map(cell => valorTexto(cell));
  return rows.slice(headerIndex + 1).map((row, index) => ({
    ...Object.fromEntries(headers.map((header, columnIndex) => [header || `columna_${columnIndex + 1}`, row[columnIndex] ?? ""])),
    __numeroLinea: headerIndex + index + 2,
  }));
}

export function extraerFilasBalanza(rows: SheetRow[]): BalanzaProcesada {
  const parsed = filasConEncabezado(rows).map((row, index) => {
    const cuentaCodigo = valorTexto(buscarValor(row, headerAliases.codigo));
    const cuentaNombre = valorTexto(buscarValor(row, headerAliases.nombre));
    const debe = valorMonto(buscarValor(row, headerAliases.debe));
    const haber = valorMonto(buscarValor(row, headerAliases.haber));
    const saldoInicial = valorMonto(buscarValor(row, headerAliases.saldoInicial));
    const saldoCell = buscarValor(row, headerAliases.saldo);
    const saldo = saldoCell === undefined || saldoCell === "" ? saldoInicial + debe - haber : valorMonto(saldoCell);

    return { numeroLinea: row.__numeroLinea ?? index + 2, cuentaCodigo, cuentaNombre, debe, haber, saldo };
  });

  const totalIndex = parsed.findIndex(row => /^(sumas iguales|total|totales)\b/.test(normalizarHeader(row.cuentaCodigo)));
  const totalRow = totalIndex >= 0 ? parsed[totalIndex] : undefined;
  const dataRows = parsed.slice(0, totalIndex >= 0 ? totalIndex : parsed.length)
    .filter(row => row.cuentaCodigo || row.cuentaNombre || row.debe || row.haber || row.saldo);

  const invalid = dataRows.find(row => !/^\d{8}$/.test(row.cuentaCodigo) || !row.cuentaNombre || !Number.isFinite(row.debe) || !Number.isFinite(row.haber) || !Number.isFinite(row.saldo));
  if (invalid) throw new Error(`Fila ${invalid.numeroLinea}: la cuenta debe tener 8 dígitos, la descripción es obligatoria y los montos deben ser válidos`);
  if (!dataRows.length) throw new Error("El archivo no contiene líneas de balanza");

  const filas: BalanzaRow[] = dataRows.map(row => ({
    numeroLinea: row.numeroLinea,
    cuentaCodigo: row.cuentaCodigo,
    cuentaNombre: row.cuentaNombre,
    debe: row.debe.toFixed(2),
    haber: row.haber.toFixed(2),
    saldo: row.saldo.toFixed(2),
  }));
  const totalsAreValid = totalRow && Number.isFinite(totalRow.debe) && Number.isFinite(totalRow.haber);
  return {
    filas,
    totalDebe: totalsAreValid ? totalRow.debe : filas.reduce((total, fila) => total + Number(fila.debe), 0),
    totalHaber: totalsAreValid ? totalRow.haber : filas.reduce((total, fila) => total + Number(fila.haber), 0),
  };
}

export function leerBalanza(buffer: ArrayBuffer): BalanzaProcesada {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas para procesar");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { header: 1, defval: "" });
  return extraerFilasBalanza(rows);
}
