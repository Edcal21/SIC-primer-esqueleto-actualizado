import assert from "node:assert/strict";
import test from "node:test";

test("al comparar por mes propone el mes calendario anterior del mismo año", async () => {
  const { periodoAnterior } = await import(`../app/shared.ts?periodos=${Date.now()}`);
  assert.equal(periodoAnterior("2026-05", "mes"), "2026-04");
  assert.equal(periodoAnterior("2026-01", "mes"), "2025-12");
  assert.equal(periodoAnterior("2026-T1", "trimestre"), "2025-T4");
});

test("el lector encuentra Saldo Final aunque el encabezado esté en la celda combinada siguiente", async () => {
  const { extraerFilasSituacionFinanciera } = await import(`../lib/situacion-financiera.ts?parser=${Date.now()}`);
  const vacias = () => Array(11).fill("");
  const encabezado = vacias(); encabezado[0] = "Descripción"; encabezado[10] = "Saldo Final";
  const detalle = vacias(); detalle[0] = "  EFECTIVO EN BANCOS"; detalle[9] = 500;
  const total = vacias(); total[0] = "Total EFECTIVO"; total[9] = 500;
  const fueraSaldoFinal = vacias(); fueraSaldoFinal[0] = "Cálculo auxiliar"; fueraSaldoFinal[6] = 999;

  const result = extraerFilasSituacionFinanciera([["Estado de Situación Financiera"], encabezado, detalle, total, fueraSaldoFinal]);
  assert.deepEqual(result.filas, [
    { numeroLinea: 3, concepto: "EFECTIVO EN BANCOS", saldoFinal: "500.00", esTotal: false },
    { numeroLinea: 4, concepto: "Total EFECTIVO", saldoFinal: "500.00", esTotal: true },
  ]);
});

test("el flujo compara el Saldo Final y calcula la variación neta de efectivo", async () => {
  const { reporteFlujoDesdeSituaciones } = await import(`../lib/reportes.ts?reporte=${Date.now()}`);
  const actual = { periodo: "2026-06", filas: [
    { concepto: "Caja General", saldoFinal: 150, esTotal: false },
    { concepto: "Total EFECTIVO", saldoFinal: 650, esTotal: true },
  ] };
  const anterior = { periodo: "2026-05", filas: [
    { concepto: "CAJA GENERAL", saldoFinal: 100, esTotal: false },
    { concepto: "Total efectivo", saldoFinal: 500, esTotal: true },
  ] };

  const reporte = reporteFlujoDesdeSituaciones(actual, anterior, "junio de 2026", "mayo de 2026");
  assert.equal(reporte.fuente, "Estado de Situación Financiera 2026-06");
  assert.deepEqual(reporte.filas[0], { concepto: "Caja General", actual: 150, anterior: 100, variacion: 50, esTotal: false });
  assert.deepEqual(reporte.filas.at(-1), { concepto: "Variación neta de efectivo", actual: 650, anterior: 500, variacion: 150, esTotal: true });
});
