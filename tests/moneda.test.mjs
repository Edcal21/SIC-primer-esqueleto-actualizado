import assert from "node:assert/strict";
import test from "node:test";
import { calcularEquivalenteNio, esTasaValida, montosIguales, normalizarTasa, redondearMonto } from "../lib/moneda.ts";

test("USD 100 a tasa 36.50 equivale a NIO 3650.00", () => {
  assert.equal(calcularEquivalenteNio("100.00", "36.50"), "3650.00");
  assert.equal(calcularEquivalenteNio(100, 36.5), "3650.00");
});

test("dos movimientos de USD 100 a tasas distintas producen NIO distintos pero mismo importe original", () => {
  const a = calcularEquivalenteNio("100.00", "36.50");
  const b = calcularEquivalenteNio("100.00", "37.10");
  assert.equal(a, "3650.00");
  assert.equal(b, "3710.00");
  assert.notEqual(a, b);
});

test("redondea a 2 decimales con mitad hacia arriba de forma exacta", () => {
  // 33.335 * 1 -> ya son 2 decimales objetivo tras escalar montoOriginal; probamos el caso límite
  // en la multiplicación monto x tasa, donde el resultado intermedio cae exactamente en .xx5.
  assert.equal(calcularEquivalenteNio("1.00", "36.125000"), "36.13"); // 36.125 -> redondea hacia arriba
  assert.equal(calcularEquivalenteNio("0.01", "1.005"), "0.01"); // 0.01005 -> redondea a 0.01
  assert.equal(redondearMonto("10.005"), "10.01");
  assert.equal(redondearMonto("10.004"), "10.00");
});

test("rechaza tasas inválidas o no positivas", () => {
  assert.equal(esTasaValida("36.50"), true);
  assert.equal(esTasaValida("0"), false);
  assert.equal(esTasaValida("-5"), false);
  assert.equal(esTasaValida("abc"), false);
  assert.equal(esTasaValida(""), false);
  assert.throws(() => normalizarTasa("0"));
  assert.throws(() => calcularEquivalenteNio("100", "0"));
  assert.throws(() => calcularEquivalenteNio("100", "-1"));
});

test("NIO usa tasa 1: el equivalente es igual al importe original", () => {
  assert.equal(calcularEquivalenteNio("1250.75", "1"), "1250.75");
});

test("normalizarTasa conserva 6 decimales exactos", () => {
  assert.equal(normalizarTasa("36.5"), "36.500000");
  assert.equal(normalizarTasa(36.123456789), "36.123457");
});

test("montosIguales compara con precisión decimal exacta, sin errores de punto flotante", () => {
  assert.equal(montosIguales(0.1 + 0.2, "0.3"), true);
  assert.equal(montosIguales("100.00", 100), true);
  assert.equal(montosIguales("100.00", 100.01), false);
});
