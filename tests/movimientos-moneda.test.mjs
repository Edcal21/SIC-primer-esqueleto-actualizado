import assert from "node:assert/strict";
import test from "node:test";
import { construirDetallesMovimiento } from "../lib/movimientos.ts";

/** El catálogo lo resuelve el servidor; las pruebas simulan las cuentas activas de movimiento. */
const catalogo = new Map([
  ["10100001", "Banco USD"],
  ["40100001", "Ingresos"],
  ["51010100", "Servicios básicos"],
  ["60100001", "Gasto A"],
  ["60100002", "Gasto B"],
]);

const cuentaNio = { cuentaBancariaMoneda: "NIO", tasaUsd: null, catalogo };
const cuentaUsdConTasa = { cuentaBancariaMoneda: "USD", tasaUsd: { tasa: "36.500000" }, catalogo };
const cuentaUsdSinTasa = { cuentaBancariaMoneda: "USD", tasaUsd: null, catalogo };
const asientoDiario = { cuentaBancariaMoneda: null, tasaUsd: null, catalogo };

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

// --- Regresión H4: las líneas bancarias de una minuta van en una sola dirección ---

test("rechaza una minuta con líneas bancarias en direcciones opuestas", () => {
  // Antes se aceptaba y reportaba un importe bancario de 200 cuando el efecto neto es 0.
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "10100001", cuentaNombre: "Banco", montoOriginal: "100.00", afectaCuentaBancaria: true },
      { tipo: "credito", cuentaCodigo: "10100001", cuentaNombre: "Banco", montoOriginal: "100.00", afectaCuentaBancaria: true },
    ],
    cuentaUsdConTasa,
  );
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.match(resultado.error, /misma dirección/);
});

test("acepta varias líneas bancarias si todas van en la misma dirección", () => {
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "10100001", cuentaNombre: "Banco", montoOriginal: "60.00", afectaCuentaBancaria: true },
      { tipo: "debito", cuentaCodigo: "10100001", cuentaNombre: "Banco", montoOriginal: "40.00", afectaCuentaBancaria: true },
      { tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: "3650.00" },
    ],
    cuentaUsdConTasa,
  );
  assert.equal(resultado.ok, true, resultado.ok ? "" : resultado.error);
  if (!resultado.ok) return;
  const marcadas = resultado.detalles.filter(detalle => detalle.afectaCuentaBancaria);
  assert.equal(marcadas.length, 2);
  assert.equal(marcadas.reduce((total, d) => total + Number(d.montoOriginal), 0), 100);
});

test("rechaza una línea cuyo código no está en el catálogo de cuentas de movimiento", () => {
  const resultado = construirDetallesMovimiento(
    [lineaBanco({ montoOriginal: "100.00" }), lineaContraparte({ cuentaCodigo: "99999999", monto: "3650.00" })],
    cuentaUsdConTasa,
  );
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.match(resultado.error, /La cuenta 99999999 no existe en el catálogo/);
});

test("el nombre de cuenta sale del catálogo del servidor, no del payload del cliente", () => {
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "51010100", cuentaNombre: "NOMBRE FALSIFICADO", monto: "500.00" },
      { tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "OTRO FALSIFICADO", monto: "500.00" },
    ],
    asientoDiario,
  );
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  assert.equal(resultado.detalles[0].cuentaNombre, "Servicios básicos");
  assert.equal(resultado.detalles[1].cuentaNombre, "Ingresos");
});

test("un asiento de diario sin cuenta bancaria no exige línea bancaria", () => {
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "51010100", monto: "1200.00" },
      { tipo: "credito", cuentaCodigo: "40100001", monto: "1200.00" },
    ],
    asientoDiario,
  );
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  assert.equal(resultado.detalles.every(detalle => detalle.afectaCuentaBancaria === false), true);
  assert.equal(resultado.detalles.every(detalle => detalle.moneda === "NIO" && detalle.tasaCambio === "1.000000"), true);
});

test("un asiento de diario rechaza líneas marcadas como bancarias", () => {
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "51010100", monto: "1200.00", afectaCuentaBancaria: true },
      { tipo: "credito", cuentaCodigo: "40100001", monto: "1200.00" },
    ],
    asientoDiario,
  );
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.match(resultado.error, /Un asiento de diario no tiene cuenta bancaria/);
});

test("una minuta bancaria sigue exigiendo al menos una línea marcada", () => {
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "51010100", monto: "1200.00" },
      { tipo: "credito", cuentaCodigo: "40100001", monto: "1200.00" },
    ],
    cuentaNio,
  );
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.match(resultado.error, /Marque al menos una línea/);
});
