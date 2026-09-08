import * as XLSX from "xlsx";

type RawRow = Record<string, unknown> & { __numeroLinea?: number };
type SheetRow = unknown[];

export type AuxiliarDetalle = {
  numeroLinea: number;
  tipo: "debito" | "credito";
  cuentaCodigo: string;
  cuentaNombre: string;
  monto: string;
  afectaCuentaBancaria: boolean;
  montoOriginal?: string;
};

export type AuxiliarMovimiento = {
  key: string;
  fecha: string;
  iglesiaCodigo: string;
  cuentaBancariaNumero: string;
  referencia: string | null;
  concepto: string;
  detalles: AuxiliarDetalle[];
  totalDebitos: number;
  totalCreditos: number;
};

export type AuxiliarProcesado = {
  movimientos: AuxiliarMovimiento[];
  totalLineas: number;
  totalDebitos: number;
  totalCreditos: number;
};

const headerAliases = {
  fecha: ["fecha", "fecha movimiento", "fecha contable", "fecha documento"],
  iglesia: ["iglesia", "codigo iglesia", "código iglesia", "sucursal", "centro", "centro costo"],
  cuentaBancaria: ["cuenta bancaria", "banco", "cuenta banco", "numero cuenta bancaria", "número cuenta bancaria"],
  referencia: ["referencia", "documento", "numero documento", "número documento", "comprobante", "minuta"],
  concepto: ["concepto", "descripcion", "descripción", "detalle", "glosa"],
  cuentaCodigo: ["cuenta", "codigo cuenta", "código cuenta", "cuenta codigo", "cuenta código"],
  cuentaNombre: ["nombre cuenta", "cuenta nombre", "descripcion cuenta", "descripción cuenta"],
  tipo: ["tipo", "naturaleza movimiento", "debito credito", "débito crédito"],
  debito: ["debito", "débito", "debe", "cargo", "egreso"],
  credito: ["credito", "crédito", "haber", "abono"],
  monto: ["monto", "importe", "valor"],
  afectaBanco: ["afecta banco", "afecta cuenta bancaria", "banco afectado", "linea banco", "línea banco"],
  montoOriginal: ["monto original", "importe original", "valor original", "monto usd", "importe usd"],
};

function normalizarHeader(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function valorTexto(value: unknown) {
  return String(value ?? "").trim();
}

function valorMonto(value: unknown) {
  const raw = valorTexto(value);
  const negative = /^\(.+\)$/.test(raw);
  const normalized = raw.replace(/[C$\s()]/gi, "").replace(/,/g, "");
  const parsed = Number(normalized || "0");
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : Number.NaN;
}

function buscarValor(row: RawRow, aliases: string[]) {
  const entries = Object.entries(row).map(([key, value]) => [normalizarHeader(key), value] as const);
  const normalizedAliases = aliases.map(normalizarHeader);
  return entries.find(([key]) => normalizedAliases.includes(key))?.[1];
}

function filasConEncabezado(rows: SheetRow[]): RawRow[] {
  const required = {
    fecha: headerAliases.fecha.map(normalizarHeader),
    cuentaCodigo: headerAliases.cuentaCodigo.map(normalizarHeader),
  };
  const headerIndex = rows.findIndex(row => {
    const headers = row.map(cell => normalizarHeader(valorTexto(cell))).filter(Boolean);
    return required.fecha.some(alias => headers.includes(alias))
      && required.cuentaCodigo.some(alias => headers.includes(alias));
  });
  if (headerIndex === -1) throw new Error("No se encontraron encabezados de auxiliar: Fecha y Cuenta");

  const headers = rows[headerIndex].map(cell => valorTexto(cell));
  return rows.slice(headerIndex + 1).map((row, index) => ({
    ...Object.fromEntries(headers.map((header, columnIndex) => [header || `columna_${columnIndex + 1}`, row[columnIndex] ?? ""])),
    __numeroLinea: headerIndex + index + 2,
  }));
}

function normalizarFecha(value: unknown) {
  const raw = valorTexto(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const excelDate = Number(raw);
  if (Number.isFinite(excelDate) && excelDate > 1) {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }
  return raw;
}

function tipoYMonto(row: RawRow) {
  const debito = valorMonto(buscarValor(row, headerAliases.debito));
  const credito = valorMonto(buscarValor(row, headerAliases.credito));
  const monto = valorMonto(buscarValor(row, headerAliases.monto));
  const tipoTexto = normalizarHeader(valorTexto(buscarValor(row, headerAliases.tipo)));

  if (Number.isFinite(debito) && debito > 0 && Number.isFinite(credito) && credito > 0) throw new Error("trae débito y crédito en la misma línea");
  if (Number.isFinite(debito) && debito > 0) return { tipo: "debito" as const, monto: debito };
  if (Number.isFinite(credito) && credito > 0) return { tipo: "credito" as const, monto: credito };
  if (Number.isFinite(monto) && monto !== 0) {
    if (["credito", "creditos", "haber", "abono"].includes(tipoTexto)) return { tipo: "credito" as const, monto: Math.abs(monto) };
    if (["debito", "debitos", "debe", "cargo", "egreso"].includes(tipoTexto)) return { tipo: "debito" as const, monto: Math.abs(monto) };
    return monto < 0 ? { tipo: "credito" as const, monto: Math.abs(monto) } : { tipo: "debito" as const, monto };
  }
  throw new Error("no trae monto válido");
}

function normalizarBoolean(value: unknown) {
  const text = normalizarHeader(valorTexto(value));
  if (["si", "s", "true", "1", "x", "banco"].includes(text)) return true;
  if (["no", "n", "false", "0"].includes(text)) return false;
  return null;
}

export function extraerMovimientosAuxiliar(rows: SheetRow[]): AuxiliarProcesado {
  const grupos = new Map<string, AuxiliarMovimiento>();
  let totalLineas = 0;
  let totalDebitos = 0;
  let totalCreditos = 0;

  for (const row of filasConEncabezado(rows)) {
    const numeroLinea = row.__numeroLinea ?? 0;
    const fecha = normalizarFecha(buscarValor(row, headerAliases.fecha));
    const iglesiaCodigo = valorTexto(buscarValor(row, headerAliases.iglesia));
    const cuentaBancariaNumero = valorTexto(buscarValor(row, headerAliases.cuentaBancaria));
    const referencia = valorTexto(buscarValor(row, headerAliases.referencia)) || null;
    const concepto = valorTexto(buscarValor(row, headerAliases.concepto));
    const cuentaCodigo = valorTexto(buscarValor(row, headerAliases.cuentaCodigo));
    const cuentaNombre = valorTexto(buscarValor(row, headerAliases.cuentaNombre)) || cuentaCodigo;
    const afectaBanco = normalizarBoolean(buscarValor(row, headerAliases.afectaBanco));
    const montoOriginal = buscarValor(row, headerAliases.montoOriginal);

    if (!fecha && !iglesiaCodigo && !cuentaBancariaNumero && !referencia && !concepto && !cuentaCodigo) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error(`Fila ${numeroLinea}: fecha inválida; use YYYY-MM-DD o DD/MM/AAAA`);
    if (!/^\d{8}$/.test(iglesiaCodigo)) throw new Error(`Fila ${numeroLinea}: el código de iglesia debe tener 8 dígitos`);
    if (!cuentaBancariaNumero) throw new Error(`Fila ${numeroLinea}: la cuenta bancaria es obligatoria`);
    if (!concepto) throw new Error(`Fila ${numeroLinea}: el concepto es obligatorio`);
    if (!/^\d{8}$/.test(cuentaCodigo)) throw new Error(`Fila ${numeroLinea}: la cuenta contable debe tener 8 dígitos`);

    let movimiento;
    try {
      movimiento = tipoYMonto(row);
    } catch (error) {
      throw new Error(`Fila ${numeroLinea}: ${error instanceof Error ? error.message : "monto inválido"}`);
    }

    const key = [fecha, iglesiaCodigo, cuentaBancariaNumero, referencia ?? "", concepto].join("|");
    const grupo = grupos.get(key) ?? {
      key,
      fecha,
      iglesiaCodigo,
      cuentaBancariaNumero,
      referencia,
      concepto,
      detalles: [],
      totalDebitos: 0,
      totalCreditos: 0,
    };
    grupo.detalles.push({
      numeroLinea,
      tipo: movimiento.tipo,
      cuentaCodigo,
      cuentaNombre,
      monto: movimiento.monto.toFixed(2),
      afectaCuentaBancaria: afectaBanco ?? cuentaCodigo === cuentaBancariaNumero,
      montoOriginal: montoOriginal === undefined || valorTexto(montoOriginal) === "" ? undefined : valorTexto(montoOriginal),
    });
    if (movimiento.tipo === "debito") {
      grupo.totalDebitos += movimiento.monto;
      totalDebitos += movimiento.monto;
    } else {
      grupo.totalCreditos += movimiento.monto;
      totalCreditos += movimiento.monto;
    }
    grupos.set(key, grupo);
    totalLineas += 1;
  }

  const movimientos = [...grupos.values()];
  if (!movimientos.length) throw new Error("El archivo no contiene movimientos para importar");
  const invalid = movimientos.find(movimiento => movimiento.detalles.length < 2 || Math.abs(movimiento.totalDebitos - movimiento.totalCreditos) >= 0.01);
  if (invalid) throw new Error(`Movimiento ${invalid.referencia ?? invalid.concepto}: débitos y créditos no cuadran`);

  return { movimientos, totalLineas, totalDebitos, totalCreditos };
}

export function leerAuxiliarContable(buffer: ArrayBuffer): AuxiliarProcesado {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas para procesar");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { header: 1, defval: "" });
  return extraerMovimientosAuxiliar(rows);
}
