/**
 * Aritmética decimal exacta para montos (2 decimales) y tasas de cambio (6 decimales),
 * implementada con BigInt en punto fijo para evitar los errores de redondeo binario de
 * `Number` (p. ej. 1.005 * 100 en IEEE-754). Toda la contabilidad se mantiene en NIO;
 * estas utilidades son las únicas responsables de convertir un importe original (USD)
 * a su equivalente en NIO y de aplicar el redondeo a 2 decimales de forma consistente.
 *
 * Se usa `BigInt(n)` en vez de literales `123n`: el `target` de TypeScript del proyecto
 * (ES2017) no admite la sintaxis de literal BigInt.
 */

export const MONEDAS = ["NIO", "USD"] as const;
export type Moneda = (typeof MONEDAS)[number];

export const DECIMALES_MONTO = 2;
export const DECIMALES_TASA = 6;

const CERO = BigInt(0);
const UNO = BigInt(1);
const DOS = BigInt(2);
const DIEZ = BigInt(10);

export function esMonedaValida(value: unknown): value is Moneda {
  return typeof value === "string" && (MONEDAS as readonly string[]).includes(value);
}

/** Convierte un número o texto decimal a un entero escalado por 10^decimales, redondeando la mitad hacia arriba. */
function escalarDecimal(valor: string | number, decimales: number): bigint {
  if (typeof valor === "number" && !Number.isFinite(valor)) throw new Error("Valor numérico inválido");
  const texto = (typeof valor === "number" ? valor.toString() : valor).trim();
  if (!texto || !/^-?\d+(\.\d+)?$/.test(texto)) throw new Error(`Valor numérico inválido: "${valor}"`);

  const negativo = texto.startsWith("-");
  const sinSigno = negativo ? texto.slice(1) : texto;
  const [enteroTexto, decimalTexto = ""] = sinSigno.split(".");
  const base = BigInt(enteroTexto) * DIEZ ** BigInt(decimales);

  if (decimalTexto.length <= decimales) {
    const relleno = decimalTexto.padEnd(decimales, "0");
    const magnitud = base + (relleno ? BigInt(relleno) : CERO);
    return negativo ? -magnitud : magnitud;
  }

  // Hay más decimales de los que caben en la escala destino: redondear mitad hacia arriba.
  const conservados = decimalTexto.slice(0, decimales);
  const siguienteDigito = Number(decimalTexto[decimales]);
  let magnitud = base + BigInt(conservados);
  if (siguienteDigito >= 5) magnitud += UNO;
  return negativo ? -magnitud : magnitud;
}

function formatearDesdeBigInt(magnitud: bigint, decimales: number): string {
  const negativo = magnitud < CERO;
  const absoluta = negativo ? -magnitud : magnitud;
  const divisor = DIEZ ** BigInt(decimales);
  const entero = absoluta / divisor;
  const resto = absoluta % divisor;
  const decimalTexto = resto.toString().padStart(decimales, "0");
  return `${negativo ? "-" : ""}${entero.toString()}${decimales > 0 ? `.${decimalTexto}` : ""}`;
}

/** Redondea un importe a 2 decimales exactos (mitad hacia arriba), como texto "0.00". */
export function redondearMonto(valor: string | number): string {
  return formatearDesdeBigInt(escalarDecimal(valor, DECIMALES_MONTO), DECIMALES_MONTO);
}

/** Normaliza una tasa a 6 decimales exactos; lanza si no es un número positivo válido. */
export function normalizarTasa(valor: string | number): string {
  const escalada = escalarDecimal(valor, DECIMALES_TASA);
  if (escalada <= CERO) throw new Error("La tasa de cambio debe ser mayor que cero");
  return formatearDesdeBigInt(escalada, DECIMALES_TASA);
}

export function esTasaValida(valor: unknown): boolean {
  if (typeof valor !== "string" && typeof valor !== "number") return false;
  try {
    normalizarTasa(valor as string | number);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calcula el equivalente en NIO de un importe original dado una tasa NIO-por-unidad,
 * con precisión exacta: importe (2 decimales) × tasa (6 decimales), redondeado a 2
 * decimales (mitad hacia arriba). Ejemplo: USD 100.00 × 36.50 = NIO 3650.00.
 */
export function calcularEquivalenteNio(montoOriginal: string | number, tasa: string | number): string {
  const montoEscalado = escalarDecimal(montoOriginal, DECIMALES_MONTO); // escala 10^2
  const tasaEscalada = escalarDecimal(tasa, DECIMALES_TASA); // escala 10^6
  if (montoEscalado < CERO) throw new Error("El importe original no puede ser negativo");
  if (tasaEscalada <= CERO) throw new Error("La tasa de cambio debe ser mayor que cero");

  const producto = montoEscalado * tasaEscalada; // escala 10^8
  const divisor = DIEZ ** BigInt(DECIMALES_TASA); // reduce de 10^8 a 10^2
  const mitad = divisor / DOS;
  const equivalente = (producto + mitad) / divisor; // redondeo mitad hacia arriba
  return formatearDesdeBigInt(equivalente, DECIMALES_MONTO);
}

/** Compara dos importes decimales (texto o número) con tolerancia cero usando aritmética exacta. */
export function montosIguales(a: string | number, b: string | number): boolean {
  return escalarDecimal(a, DECIMALES_MONTO) === escalarDecimal(b, DECIMALES_MONTO);
}

/** Suma una lista de importes decimales con aritmética exacta y devuelve el resultado a 2 decimales. */
export function sumarMontos(valores: (string | number)[]): string {
  const total = valores.reduce((acumulado, valor) => acumulado + escalarDecimal(valor, DECIMALES_MONTO), CERO);
  return formatearDesdeBigInt(total, DECIMALES_MONTO);
}

export function esMontoPositivo(valor: unknown): valor is string | number {
  if (typeof valor !== "string" && typeof valor !== "number") return false;
  try {
    return escalarDecimal(valor as string | number, DECIMALES_MONTO) > CERO;
  } catch {
    return false;
  }
}
