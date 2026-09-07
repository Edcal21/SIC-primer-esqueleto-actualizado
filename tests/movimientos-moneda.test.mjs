import assert from "node:assert/strict";
import test from "node:test";
import { construirDetallesMovimiento } from "../lib/movimientos.ts";

const cuentaNio = { cuentaBancariaMoneda: "NIO", tasaUsd: null };
const cuentaUsdConTasa = { cuentaBancariaMoneda: "USD", tasaUsd: { tasa: "36.500000" } };
const cuentaUsdSinTasa = { cuentaBancariaMoneda: "USD", tasaUsd: null };

const lineaBanco = (extra = {}) => ({ tipo: "debito", cuentaCodigo: "10100001", cuentaNombre: "Banco USD", afectaCuentaBancaria: true, ...extra });
const lineaContraparte = (extra = {}) => ({ tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: "100.00", ...extra });

test("USD 100 a tasa 36.50 produce línea bancaria de NIO 3650.00 y minuta cuadrada", () => {
  const resultado = construirDetallesMovimiento(
    [lineaBanco({ montoOriginal: "100.00" }), lineaContraparte({ monto: "3650.00" })],
    cuentaUsdConTasa,
  );
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  const banco = resultado.detalles.find(detalle => detalle.afectaCuentaBancaria);
  assert.equal(banco.moneda, "USD");
  assert.equal(banco.montoOriginal, "100.00");
  assert.equal(banco.tasaCambio, "36.500000");
  assert.equal(banco.monto, "3650.00");
});

test("bloquea el registro cuando falta la tasa de la fecha para una cuenta USD", () => {
  const resultado = construirDetallesMovimiento(
    [lineaBanco({ montoOriginal: "100.00" }), lineaContraparte({ monto: "3650.00" })],
    cuentaUsdSinTasa,
  );
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.match(resultado.error, /Falta registrar la tasa de cambio/);
});

test("rechaza minutas sin ninguna línea marcada como afecta la cuenta bancaria", () => {
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "10100001", cuentaNombre: "Banco", monto: "100.00" },
      { tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: "100.00" },
    ],
    cuentaNio,
  );
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.match(resultado.error, /Marque al menos una línea/);
});

test("rechaza importe USD inválido (cero o vacío) en la línea marcada", () => {
  const resultado = construirDetallesMovimiento(
    [lineaBanco({ montoOriginal: "0" }), lineaContraparte({ monto: "0" })],
    cuentaUsdConTasa,
  );
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.match(resultado.error, /importe original en USD mayor que cero/);
});

test("una minuta desbalanceada se rechaza incluso con montos válidos individualmente", () => {
  const resultado = construirDetallesMovimiento(
    [lineaBanco({ montoOriginal: "100.00" }), lineaContraparte({ monto: "3600.00" })],
    cuentaUsdConTasa,
  );
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.match(resultado.error, /no está cuadrada/);
});

test("cuenta NIO no requiere tasa: el importe original es igual al monto contable", () => {
  const resultado = construirDetallesMovimiento(
    [lineaBanco({ monto: "500.00" }), lineaContraparte({ monto: "500.00" })],
    cuentaNio,
  );
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  const banco = resultado.detalles.find(detalle => detalle.afectaCuentaBancaria);
  assert.equal(banco.moneda, "NIO");
  assert.equal(banco.tasaCambio, "1.000000");
  assert.equal(banco.montoOriginal, "500.00");
  assert.equal(banco.monto, "500.00");
});

test("minuta con más de dos líneas: solo la línea marcada lleva el importe bancario, no la suma de débitos", () => {
  // Debe: Gasto A 100 NIO, Gasto B 50 NIO (dos líneas de débito); Haber: Banco NIO 150 (una línea, marcada).
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "60100001", cuentaNombre: "Gasto A", monto: "100.00" },
      { tipo: "debito", cuentaCodigo: "60100002", cuentaNombre: "Gasto B", monto: "50.00" },
      { tipo: "credito", cuentaCodigo: "10100001", cuentaNombre: "Banco NIO", monto: "150.00", afectaCuentaBancaria: true },
    ],
    cuentaNio,
  );
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  const banco = resultado.detalles.find(detalle => detalle.afectaCuentaBancaria);
  assert.equal(banco.montoOriginal, "150.00");
  assert.notEqual(banco.montoOriginal, "300.00"); // nunca la suma total de los débitos (100+50+150)
});
