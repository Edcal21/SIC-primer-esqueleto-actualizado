import assert from "node:assert/strict";
import test from "node:test";
import { reporteCambioPatrimonioDesdeBalanza } from "../lib/reportes.ts";

/**
 * Datos sintéticos con la misma estructura que la balanza de comprobación real de la institución:
 * cinco cuentas de patrimonio por código real (31010000, 31020000, 33010100, 33010200, 33010300),
 * más cuentas de ingreso (4xxxxxxx) y gasto (5xxxxxxx) para derivar la utilidad del ejercicio. Las
 * cifras no son reales.
 */
const balanza = (periodo, cuentas) => ({
  periodo,
  filas: cuentas.map(([codigo, concepto, saldo]) => ({ codigo, concepto, debe: 0, haber: 0, saldo })),
});

const linea = (reporte, concepto) => reporte.filas.find(fila => fila.concepto === concepto)?.actual;

test("el traslado esperado coincide con la variación real cuando no hay ajustes adicionales", () => {
  // Año anterior: utilidad del ejercicio de -5,000 (una pérdida).
  const anterior = balanza("2024-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 10000],
    ["33010100", "Incremento o Decremento del Patrimonio", -500],
    ["33010200", "Utilidades Acumuladas", -20000],
    ["33010300", "Incremento o Decremento por Revaluacion de Activos", 8000],
    ["40010000", "Ingresos", 50000],
    ["50010000", "Gastos Operativos", 55000],
  ]);
  // Año actual: Utilidades Acumuladas bajó exactamente en 5,000 — el traslado de la pérdida
  // anterior, sin ningún ajuste adicional.
  const actual = balanza("2025-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 10000],
    ["33010100", "Incremento o Decremento del Patrimonio", -500],
    ["33010200", "Utilidades Acumuladas", -25000],
    ["33010300", "Incremento o Decremento por Revaluacion de Activos", 8000],
    ["40010000", "Ingresos", 60000],
    ["50010000", "Gastos Operativos", 58000],
  ]);

  const reporte = reporteCambioPatrimonioDesdeBalanza(actual, anterior, "2025", "2024");

  assert.equal(linea(reporte, "Utilidad (pérdida) del Ejercicio 2024"), -5000);
  assert.equal(linea(reporte, "Utilidad (pérdida) del Ejercicio 2025"), 2000);
  assert.equal(linea(reporte, "Utilidades Acumuladas"), -20000, "debe tomar el saldo inicial de la primera aparición (año anterior)");
  assert.equal(linea(reporte, "Variación en Utilidades Acumuladas"), -5000);
  assert.equal(linea(reporte, "Traslado esperado (resultado del ejercicio 2024)"), -5000);
  assert.equal(linea(reporte, "Diferencia sin explicar en Utilidades Acumuladas"), 0, "el traslado explica toda la variación, sin ajustes pendientes");
  assert.equal(reporte.advertencias?.some(aviso => aviso.includes("no se explica completamente")), false);
});

test("una diferencia sin explicar en Utilidades Acumuladas se advierte, no se oculta", () => {
  const anterior = balanza("2024-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 10000],
    ["33010100", "Incremento o Decremento del Patrimonio", -500],
    ["33010200", "Utilidades Acumuladas", -20000],
    ["33010300", "Incremento o Decremento por Revaluacion de Activos", 8000],
    ["40010000", "Ingresos", 50000],
    ["50010000", "Gastos Operativos", 55000], // resultado 2024 = -5000
  ]);
  // Utilidades Acumuladas bajó 8,000 en vez de los 5,000 esperados: hay un ajuste de -3,000 sin explicar.
  const actual = balanza("2025-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 10000],
    ["33010100", "Incremento o Decremento del Patrimonio", -500],
    ["33010200", "Utilidades Acumuladas", -28000],
    ["33010300", "Incremento o Decremento por Revaluacion de Activos", 8000],
    ["40010000", "Ingresos", 60000],
    ["50010000", "Gastos Operativos", 58000],
  ]);

  const reporte = reporteCambioPatrimonioDesdeBalanza(actual, anterior, "2025", "2024");

  assert.equal(linea(reporte, "Variación en Utilidades Acumuladas"), -8000);
  assert.equal(linea(reporte, "Traslado esperado (resultado del ejercicio 2024)"), -5000);
  assert.equal(linea(reporte, "Diferencia sin explicar en Utilidades Acumuladas"), -3000);
  assert.ok(reporte.advertencias?.some(aviso => aviso.includes("diferencia de -3000.00")), "debe advertir la diferencia exacta, no redondearla en silencio");
});

test("el total de movimientos del ejercicio reconstruye exacto la diferencia entre saldo inicial y final", () => {
  const anterior = balanza("2024-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 10000],
    ["33010100", "Incremento o Decremento del Patrimonio", -500],
    ["33010200", "Utilidades Acumuladas", -20000],
    ["33010300", "Incremento o Decremento por Revaluacion de Activos", 8000],
    ["40010000", "Ingresos", 50000],
    ["50010000", "Gastos Operativos", 55000],
  ]);
  // Este año además hubo una donación nueva que subió Patrimonio Donado y la Revaluación cambió.
  const actual = balanza("2025-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 15000],
    ["33010100", "Incremento o Decremento del Patrimonio", -500],
    ["33010200", "Utilidades Acumuladas", -25000],
    ["33010300", "Incremento o Decremento por Revaluacion de Activos", 9200],
    ["40010000", "Ingresos", 60000],
    ["50010000", "Gastos Operativos", 58000],
  ]);

  const reporte = reporteCambioPatrimonioDesdeBalanza(actual, anterior, "2025", "2024");
  const totalInicial = linea(reporte, "Total Patrimonio (saldo inicial)");
  const totalFinal = linea(reporte, "Total Patrimonio (saldo final)");
  const totalMovimientos = linea(reporte, "Total movimientos del ejercicio");

  assert.equal(Math.round((totalInicial + totalMovimientos) * 100) / 100, totalFinal, "saldo inicial + movimientos debe reconstruir el saldo final, siempre, por construcción");
});

test("una cuenta de patrimonio ausente en la balanza se advierte y se toma como cero", () => {
  const anterior = balanza("2024-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 10000],
    ["33010200", "Utilidades Acumuladas", -20000],
    // Falta 33010100 y 33010300 a propósito.
    ["40010000", "Ingresos", 50000],
    ["50010000", "Gastos Operativos", 55000],
  ]);
  const actual = balanza("2025-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 10000],
    ["33010200", "Utilidades Acumuladas", -25000],
    ["40010000", "Ingresos", 60000],
    ["50010000", "Gastos Operativos", 58000],
  ]);

  const reporte = reporteCambioPatrimonioDesdeBalanza(actual, anterior, "2025", "2024");
  assert.equal(linea(reporte, "Incremento o Decremento del Patrimonio"), 0);
  assert.ok(reporte.advertencias?.some(aviso => aviso.includes("No se encontraron en la balanza importada")));
  assert.ok(reporte.advertencias?.some(aviso => aviso.includes("33010100")));
  assert.ok(reporte.advertencias?.some(aviso => aviso.includes("33010300")));
});

test("una pérdida del ejercicio anterior se traslada como negativo, y una utilidad como positivo", () => {
  const anterior = balanza("2024-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 10000],
    ["33010100", "Incremento o Decremento del Patrimonio", 0],
    ["33010200", "Utilidades Acumuladas", -10000],
    ["33010300", "Incremento o Decremento por Revaluacion de Activos", 0],
    ["40010000", "Ingresos", 70000],
    ["50010000", "Gastos Operativos", 60000], // ganancia de 10000
  ]);
  const actual = balanza("2025-12", [
    ["31010000", "Patrimonio", 100000],
    ["31020000", "Patrimonio Donado", 10000],
    ["33010100", "Incremento o Decremento del Patrimonio", 0],
    ["33010200", "Utilidades Acumuladas", 0], // subió 10000, coincide exacto con la ganancia trasladada
    ["33010300", "Incremento o Decremento por Revaluacion de Activos", 0],
    ["40010000", "Ingresos", 65000],
    ["50010000", "Gastos Operativos", 65000],
  ]);

  const reporte = reporteCambioPatrimonioDesdeBalanza(actual, anterior, "2025", "2024");
  assert.equal(linea(reporte, "Utilidad (pérdida) del Ejercicio 2024"), 10000);
  assert.equal(linea(reporte, "Traslado esperado (resultado del ejercicio 2024)"), 10000);
  assert.equal(linea(reporte, "Diferencia sin explicar en Utilidades Acumuladas"), 0);
});
