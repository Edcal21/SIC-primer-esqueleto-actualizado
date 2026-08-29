import { desc } from "drizzle-orm";
import * as XLSX from "xlsx";
import { getDb } from "../../../../db";
import { importacionesBalanza, lineasBalanza } from "../../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

type RawRow = Record<string, unknown>;
type SheetRow = unknown[];
type BalanzaRow = {
  numeroLinea: number;
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: string;
  haber: string;
  saldo: string;
};

const periodoRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const headerAliases = {
  codigo: ["codigo", "código", "cuenta", "cuenta codigo", "cuenta código", "codigo cuenta", "código cuenta"],
  nombre: ["descripcion", "descripción", "nombre", "cuenta nombre", "nombre cuenta"],
  debe: ["debe", "debito", "débito", "debitos", "débitos", "cargo", "deudor"],
  haber: ["haber", "credito", "crédito", "creditos", "créditos", "abono", "acreedor"],
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
  return rows.slice(headerIndex + 1).map(row => Object.fromEntries(headers.map((header, index) => [header || `columna_${index + 1}`, row[index] ?? ""])));
}

function extraerFilas(rows: RawRow[]): BalanzaRow[] {
  const parsed = rows.map((row, index) => {
    const cuentaCodigo = valorTexto(buscarValor(row, headerAliases.codigo));
    const cuentaNombre = valorTexto(buscarValor(row, headerAliases.nombre));
    const debe = valorMonto(buscarValor(row, headerAliases.debe));
    const haber = valorMonto(buscarValor(row, headerAliases.haber));
    const saldoCell = buscarValor(row, headerAliases.saldo);
    const saldo = saldoCell === undefined || saldoCell === "" ? debe - haber : valorMonto(saldoCell);

    return { numeroLinea: index + 2, cuentaCodigo, cuentaNombre, debe, haber, saldo };
  }).filter(row => row.cuentaCodigo || row.cuentaNombre || row.debe || row.haber || row.saldo);

  const invalid = parsed.find(row => !row.cuentaCodigo || !row.cuentaNombre || !Number.isFinite(row.debe) || !Number.isFinite(row.haber) || !Number.isFinite(row.saldo));
  if (invalid) throw new Error(`Fila ${invalid.numeroLinea}: cuenta, descripción, debe y haber son obligatorios y deben tener montos válidos`);
  if (!parsed.length) throw new Error("El archivo no contiene líneas de balanza");

  return parsed.map(row => ({
    numeroLinea: row.numeroLinea,
    cuentaCodigo: row.cuentaCodigo,
    cuentaNombre: row.cuentaNombre,
    debe: row.debe.toFixed(2),
    haber: row.haber.toFixed(2),
    saldo: row.saldo.toFixed(2),
  }));
}

async function leerArchivo(archivo: File) {
  const buffer = await archivo.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas para procesar");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { header: 1, defval: "" });
  return filasConEncabezado(rows);
}

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "importaciones:administrar")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  const importaciones = await db
    .select()
    .from(importacionesBalanza)
    .orderBy(desc(importacionesBalanza.creadoEn))
    .limit(50);

  return Response.json({ importaciones }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "importaciones:administrar")) return jsonError("No tiene permiso para importar balanza de comprobación", 403);

  const form = await request.formData();
  const archivo = form.get("archivo");
  const periodo = valorTexto(form.get("periodo"));

  if (!(archivo instanceof File) || !archivo.name) return jsonError("Seleccione un archivo de balanza", 400);
  if (!periodoRegex.test(periodo)) return jsonError("Período inválido; use formato YYYY-MM", 400);
  if (archivo.size > 10 * 1024 * 1024) return jsonError("El archivo supera el límite de 10 MB", 413);
  if (!/\.(csv|xlsx|xls)$/i.test(archivo.name)) return jsonError("Formato no permitido; use CSV o Excel", 415);

  let filas: BalanzaRow[];
  try {
    filas = extraerFilas(await leerArchivo(archivo));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo leer la balanza", 400);
  }

  const totalDebe = filas.reduce((total, fila) => total + Number(fila.debe), 0);
  const totalHaber = filas.reduce((total, fila) => total + Number(fila.haber), 0);
  const db = getDb();

  try {
    const result = await db.transaction(async tx => {
      const [importacion] = await tx.insert(importacionesBalanza).values({
        archivoNombre: archivo.name,
        archivoTamano: archivo.size,
        periodo,
        totalLineas: filas.length,
        totalDebe: totalDebe.toFixed(2),
        totalHaber: totalHaber.toFixed(2),
        importadoPor: user.id,
      }).returning();

      const lineas = await tx.insert(lineasBalanza).values(
        filas.map(fila => ({ ...fila, importacionId: importacion.id })),
      ).returning();

      return { importacion, lineas };
    });

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trial balance import failed", error);
    return jsonError("No se pudo guardar la balanza de comprobación", 500);
  }
}
