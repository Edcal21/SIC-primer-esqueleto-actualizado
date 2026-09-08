import * as XLSX from "xlsx";

type RawRow = Record<string, unknown> & { __numeroLinea?: number };
type SheetRow = unknown[];

export type CatalogoRow = {
  numeroLinea: number;
  codigo: string;
  descripcion: string;
  nivel: number;
  cuentaPadre: string | null;
  esCuentaMovimiento: boolean;
  naturaleza: "deudora" | "acreedora";
  estado: "activa" | "inactiva";
  clasificacionFlujo: "operación" | "inversión" | "financiamiento" | "no aplica";
};

export type CatalogoProcesado = {
  filas: CatalogoRow[];
  cuentasMovimiento: number;
  cuentasActivas: number;
};

const headerAliases = {
  codigo: ["codigo", "código", "cuenta", "cuenta codigo", "cuenta código", "codigo cuenta", "código cuenta"],
  descripcion: ["descripcion", "descripción", "nombre", "nombre cuenta", "cuenta nombre"],
  nivel: ["nivel"],
  cuentaPadre: ["cuenta padre", "padre", "codigo padre", "código padre"],
  movimiento: ["movimiento", "cuenta movimiento", "es cuenta movimiento", "detalle", "afectable"],
  naturaleza: ["naturaleza", "tipo saldo", "saldo normal"],
  estado: ["estado", "estatus"],
  flujo: ["flujo", "clasificacion flujo", "clasificación flujo", "estado flujo", "tipo flujo"],
};

function normalizarHeader(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function valorTexto(value: unknown) {
  return String(value ?? "").trim();
}

function buscarValor(row: RawRow, aliases: string[]) {
  const entries = Object.entries(row).map(([key, value]) => [normalizarHeader(key), value] as const);
  const normalizedAliases = aliases.map(normalizarHeader);
  return entries.find(([key]) => normalizedAliases.includes(key))?.[1];
}

function filasConEncabezado(rows: SheetRow[]): RawRow[] {
  const normalizedAliases = {
    codigo: headerAliases.codigo.map(normalizarHeader),
    descripcion: headerAliases.descripcion.map(normalizarHeader),
  };
  const headerIndex = rows.findIndex(row => {
    const headers = row.map(cell => normalizarHeader(valorTexto(cell))).filter(Boolean);
    return normalizedAliases.codigo.some(alias => headers.includes(alias))
      && normalizedAliases.descripcion.some(alias => headers.includes(alias));
  });
  if (headerIndex === -1) throw new Error("No se encontraron encabezados de catálogo: Código/Cuenta y Descripción/Nombre");

  const headers = rows[headerIndex].map(cell => valorTexto(cell));
  return rows.slice(headerIndex + 1).map((row, index) => ({
    ...Object.fromEntries(headers.map((header, columnIndex) => [header || `columna_${columnIndex + 1}`, row[columnIndex] ?? ""])),
    __numeroLinea: headerIndex + index + 2,
  }));
}

function inferirNivel(codigo: string, value: unknown) {
  const parsed = Number(valorTexto(value));
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) return parsed;
  const trimmed = codigo.replace(/0+$/, "");
  return Math.min(5, Math.max(1, Math.ceil(trimmed.length / 2)));
}

function inferirPadre(codigo: string, nivel: number, value: unknown) {
  const explicit = valorTexto(value);
  if (explicit) return explicit;
  if (nivel <= 1) return null;
  const keep = Math.max(1, (nivel - 1) * 2);
  const inferred = codigo.slice(0, keep).padEnd(8, "0");
  return inferred === codigo ? null : inferred;
}

function normalizarBoolean(value: unknown, fallback: boolean) {
  const text = normalizarHeader(valorTexto(value));
  if (!text) return fallback;
  if (["si", "s", "true", "1", "x", "detalle", "movimiento", "afectable"].includes(text)) return true;
  if (["no", "n", "false", "0", "mayor", "titulo", "grupo"].includes(text)) return false;
  return fallback;
}

function normalizarNaturaleza(codigo: string, value: unknown): CatalogoRow["naturaleza"] {
  const text = normalizarHeader(valorTexto(value));
  if (["deudora", "deudor", "debito", "debe"].includes(text)) return "deudora";
  if (["acreedora", "acreedor", "credito", "haber"].includes(text)) return "acreedora";
  return codigo.startsWith("2") || codigo.startsWith("3") || codigo.startsWith("4") ? "acreedora" : "deudora";
}

function normalizarEstado(value: unknown): CatalogoRow["estado"] {
  const text = normalizarHeader(valorTexto(value));
  if (["inactiva", "inactivo", "baja", "0"].includes(text)) return "inactiva";
  return "activa";
}

function normalizarFlujo(codigo: string, value: unknown): CatalogoRow["clasificacionFlujo"] {
  const text = normalizarHeader(valorTexto(value));
  if (text === "operacion") return "operación";
  if (text === "inversion") return "inversión";
  if (text === "financiamiento") return "financiamiento";
  if (["no aplica", "n/a", "na"].includes(text)) return "no aplica";
  return codigo.startsWith("1") || codigo.startsWith("4") || codigo.startsWith("5") ? "operación" : "no aplica";
}

export function extraerFilasCatalogo(rows: SheetRow[]): CatalogoProcesado {
  const parsed = filasConEncabezado(rows).map((row, index) => {
    const codigo = valorTexto(buscarValor(row, headerAliases.codigo));
    const descripcion = valorTexto(buscarValor(row, headerAliases.descripcion));
    const nivel = inferirNivel(codigo, buscarValor(row, headerAliases.nivel));
    const estado = normalizarEstado(buscarValor(row, headerAliases.estado));
    return {
      numeroLinea: row.__numeroLinea ?? index + 2,
      codigo,
      descripcion,
      nivel,
      cuentaPadre: inferirPadre(codigo, nivel, buscarValor(row, headerAliases.cuentaPadre)),
      esCuentaMovimiento: normalizarBoolean(buscarValor(row, headerAliases.movimiento), nivel === 5),
      naturaleza: normalizarNaturaleza(codigo, buscarValor(row, headerAliases.naturaleza)),
      estado,
      clasificacionFlujo: normalizarFlujo(codigo, buscarValor(row, headerAliases.flujo)),
    };
  });

  const filas = parsed.filter(row => row.codigo || row.descripcion);
  const invalid = filas.find(row => !/^\d{8}$/.test(row.codigo) || !row.descripcion);
  if (invalid) throw new Error(`Fila ${invalid.numeroLinea}: la cuenta debe tener 8 dígitos y la descripción es obligatoria`);
  if (!filas.length) throw new Error("El archivo no contiene cuentas contables");

  return {
    filas,
    cuentasMovimiento: filas.filter(row => row.esCuentaMovimiento).length,
    cuentasActivas: filas.filter(row => row.estado === "activa").length,
  };
}

export function leerCatalogoContable(buffer: ArrayBuffer): CatalogoProcesado {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas para procesar");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { header: 1, defval: "" });
  return extraerFilasCatalogo(rows);
}
