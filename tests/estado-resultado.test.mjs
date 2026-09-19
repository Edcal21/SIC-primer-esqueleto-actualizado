import assert from "node:assert/strict";
import test from "node:test";
import { extraerFilasEstadoResultado } from "../lib/estado-resultado.ts";

function fila(concepto, { inicial, movimiento, final, movimientoCredito, finalCredito } = {}) {
  const row = Array(14).fill("");
  row[0] = concepto;
  if (inicial !== undefined) row[6] = inicial;
  if (movimiento !== undefined) row[8] = movimiento;
  if (movimientoCredito !== undefined) row[10] = movimientoCredito;
  if (final !== undefined) row[11] = final;
  if (finalCredito !== undefined) row[12] = finalCredito;
  return row;
}

const encabezado = (() => {
  const row = Array(14).fill("");
  row[0] = "Descripción";
  row[6] = "Saldo Inicial";
  row[8] = "December";
  row[13] = "Notas";
  return row;
})();

test("lee los tres bloques del formato oficial y conserva signos", () => {
  const resultado = extraerFilasEstadoResultado([
    ["Estado de Resultado Integral Acumulado al 31 de Diciembre del 2024"],
    encabezado,
    fila("TOTAL INGRESOS", { inicial: 80, movimiento: 20, final: 100 }),
    fila("TOTAL GASTOS OPERATIVOS", { inicial: 60, movimiento: 10, final: 70 }),
    fila("Utilidad o pérdida del ejercicio", { inicial: 20, movimientoCredito: -5, finalCredito: 30 }),
  ]);

  assert.equal(resultado.totalIngresos, "100.00");
  assert.equal(resultado.totalGastos, "70.00");
  assert.equal(resultado.resultadoEjercicio, "30.00");
  assert.equal(resultado.periodoDetectado, "2024-12");
  assert.deepEqual(resultado.filas.at(-1), {
    numeroLinea: 5,
    concepto: "Utilidad o pérdida del ejercicio",
    saldoInicial: "20.00",
    movimientoPeriodo: "-5.00",
    saldoFinal: "30.00",
    esTotal: true,
  });
});

test("rechaza un estado de resultado cuyos totales no cuadran", () => {
  assert.throws(() => extraerFilasEstadoResultado([
    encabezado,
    fila("TOTAL INGRESOS", { final: 100 }),
    fila("TOTAL GASTOS OPERATIVOS", { final: 70 }),
    fila("Utilidad o pérdida del ejercicio", { final: 25 }),
  ]), /no cuadra.*5\.00/i);
});

test("ignora títulos sin importes y marca las filas de total", () => {
  const resultado = extraerFilasEstadoResultado([
    encabezado,
    fila("INGRESOS"),
    fila("TOTAL INGRESOS", { final: 50 }),
    fila("TOTAL GASTOS OPERATIVOS", { final: 50 }),
    fila("Utilidad o pérdida del ejercicio", { final: 0 }),
  ]);
  assert.equal(resultado.filas.length, 3);
  assert.ok(resultado.filas.every(item => item.esTotal));
});
