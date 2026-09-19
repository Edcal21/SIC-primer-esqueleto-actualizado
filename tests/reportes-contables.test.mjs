import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";

const cuenta = (codigo, concepto, debe, haber, saldo) => ({ codigo, concepto, debe, haber, saldo });

test("la balanza anual usa el saldo inicial de enero y suma los movimientos mensuales", async () => {
  const { reporteBalanzaAnualDesdeMeses } = await import(`../lib/reportes.ts?balanza-anual=${Date.now()}`);
  const reporte = reporteBalanzaAnualDesdeMeses([
    { periodo: "2025-01", filas: [
      cuenta("10000000", "ACTIVOS", 50, 20, 130),
      cuenta("20000000", "PASIVOS", 10, 40, 230),
      cuenta("40000000", "INGRESOS", 0, 30, 30),
      cuenta("50000000", "GASTOS", 25, 5, 20),
    ] },
    { periodo: "2025-02", filas: [
      cuenta("10000000", "ACTIVOS", 10, 5, 135),
      cuenta("20000000", "PASIVOS", 7, 20, 243),
      cuenta("40000000", "INGRESOS", 0, 40, 70),
      cuenta("50000000", "GASTOS", 15, 3, 32),
    ] },
  ], 2025);

  assert.deepEqual(reporte.columnas, ["Cuenta", "Debe 2024", "Haber 2024", "Debe 2025", "Haber 2025", "Debe acumulado 2025", "Haber acumulado 2025"]);
  assert.deepEqual(reporte.filas.find(fila => fila.codigo === "10000000")?.valores, [100, 0, 60, 25, 135, 0]);
  assert.deepEqual(reporte.filas.find(fila => fila.codigo === "20000000")?.valores, [0, 200, 17, 60, 0, 243]);
  assert.deepEqual(reporte.filas.find(fila => fila.codigo === "40000000")?.valores, [0, 0, 0, 70, 0, 70]);
  assert.deepEqual(reporte.filas.find(fila => fila.codigo === "50000000")?.valores, [0, 0, 40, 8, 32, 0]);
  assert.deepEqual(reporte.filas.at(-1)?.valores, [100, 200, 117, 163, 167, 313]);
});

test("la balanza anual exige enero para obtener un saldo inicial verificable", async () => {
  const { reporteBalanzaAnualDesdeMeses } = await import(`../lib/reportes.ts?balanza-sin-enero=${Date.now()}`);
  assert.throws(() => reporteBalanzaAnualDesdeMeses([{ periodo: "2025-02", filas: [] }], 2025), /balanza de enero 2025/i);
});

test("la balanza anual no omite silenciosamente meses intermedios", async () => {
  const { reporteBalanzaAnualDesdeMeses } = await import(`../lib/reportes.ts?balanza-mes-faltante=${Date.now()}`);
  assert.throws(() => reporteBalanzaAnualDesdeMeses([
    { periodo: "2025-01", filas: [] },
    { periodo: "2025-03", filas: [] },
  ], 2025), /2025-02/);
});

test("el resultado comparativo usa el saldo final de los Estados de Resultado Integral", async () => {
  const { reporteResultadoComparativoDesdeEstados } = await import(`../lib/reportes.ts?resultado-comparativo=${Date.now()}`);
  const reporte = reporteResultadoComparativoDesdeEstados(
    { periodo: "2025-12", filas: [
      { concepto: "TOTAL INGRESOS", saldoFinal: 150, esTotal: true },
      { concepto: "TOTAL GASTOS OPERATIVOS", saldoFinal: 90, esTotal: true },
      { concepto: "Utilidad o pérdida del ejercicio", saldoFinal: 60, esTotal: true },
    ] },
    { periodo: "2024-12", filas: [
      { concepto: "TOTAL INGRESOS", saldoFinal: 120, esTotal: true },
      { concepto: "TOTAL GASTOS OPERATIVOS", saldoFinal: 80, esTotal: true },
      { concepto: "Utilidad o pérdida del ejercicio", saldoFinal: 40, esTotal: true },
    ] },
    "2025", "2024",
  );
  assert.equal(reporte.fuente, "Estados de Resultado Integral 2025-12 y 2024-12");
  assert.deepEqual(reporte.filas.map(fila => [fila.concepto, fila.actual, fila.anterior, fila.variacion]), [
    ["TOTAL INGRESOS", 150, 120, 30],
    ["TOTAL GASTOS OPERATIVOS", 90, 80, 10],
    ["Utilidad o pérdida del ejercicio", 60, 40, 20],
  ]);
});

test("las exportaciones Excel usan las hojas y fórmulas del formato empresarial", async () => {
  const { reporteBalanzaAnualDesdeMeses, reporteResultadoComparativoDesdeEstados, reporteSituacionComparativaDesdeSituaciones } = await import(`../lib/reportes.ts?reportes-xlsx=${Date.now()}`);
  const { exportarBalanzaAnualExcel, exportarResultadoComparativoExcel, exportarSituacionComparativaExcel } = await import(`../lib/reportes-contables-excel.ts?reportes-xlsx=${Date.now()}`);
  const plantilla = await readFile(new URL("../public/plantillas/reportes-comparativos.xlsx", import.meta.url));
  const buffer = plantilla.buffer.slice(plantilla.byteOffset, plantilla.byteOffset + plantilla.byteLength);
  const balanza = reporteBalanzaAnualDesdeMeses([{ periodo: "2025-01", filas: [cuenta("10000000", "ACTIVOS", 50, 20, 130)] }], 2025);
  const archivoBalanza = exportarBalanzaAnualExcel(balanza, buffer);
  const libroBalanza = XLSX.read(archivoBalanza, { type: "array", cellFormula: true });
  const hojaBalanza = libroBalanza.Sheets["Balanza 2025"];
  assert.equal(hojaBalanza.A5.v, "Balanza de Comprobacion al 31 de Diciembre 2025");
  assert.equal(hojaBalanza.B9.v, "ACTIVOS");
  assert.equal(hojaBalanza.C9.v, 100);
  assert.equal(hojaBalanza.E9.v, 50);
  assert.equal(hojaBalanza.G9.f, "C9+E9-F9");
  assert.equal(libroBalanza.Workbook.Sheets[2].Hidden ?? 0, 0);
  assert.equal(libroBalanza.Workbook.Sheets[0].Hidden, 2);

  const resultado = reporteResultadoComparativoDesdeEstados(
    { periodo: "2025-12", filas: [{ concepto: "TOTAL INGRESOS", saldoFinal: 150, esTotal: true }] },
    { periodo: "2024-12", filas: [{ concepto: "TOTAL INGRESOS", saldoFinal: 120, esTotal: true }] },
    "2025", "2024",
  );
  const archivoResultado = exportarResultadoComparativoExcel(resultado, buffer);
  const libroResultado = XLSX.read(archivoResultado, { type: "array", cellFormula: true });
  const hojaResultado = libroResultado.Sheets["Resultado 2025-12"];
  assert.equal(hojaResultado.D6.v, "2024-12");
  assert.equal(hojaResultado.F6.v, "2025-12");
  assert.equal(hojaResultado.B13.v, "TOTAL INGRESOS");
  assert.equal(hojaResultado.D13.v, 120);
  assert.equal(hojaResultado.F13.v, 150);
  assert.equal(hojaResultado.H13.f, "F13-D13");
  assert.equal(libroResultado.Workbook.Sheets[1].Hidden ?? 0, 0);
  assert.equal(libroResultado.Workbook.Sheets[2].Hidden, 2);

  const situacion = reporteSituacionComparativaDesdeSituaciones(
    { periodo: "2026-03", filas: [{ concepto: "CAJA GENERAL", saldoFinal: 817.78, esTotal: false }, { concepto: "TOTAL EFECTIVO", saldoFinal: 758368.33, esTotal: true }] },
    { periodo: "2026-02", filas: [{ concepto: "CAJA GENERAL", saldoFinal: 105799.56, esTotal: false }, { concepto: "TOTAL EFECTIVO", saldoFinal: 737913.21, esTotal: true }] },
    "marzo de 2026", "febrero de 2026",
  );
  const archivoSituacion = exportarSituacionComparativaExcel(situacion, buffer);
  const libroSituacion = XLSX.read(archivoSituacion, { type: "array", cellFormula: true });
  const hojaSituacion = libroSituacion.Sheets["Situación 2026-03"];
  assert.equal(hojaSituacion.C5.v, "2026-02");
  assert.equal(hojaSituacion.E5.v, "2026-03");
  assert.equal(hojaSituacion.C14.v, 105799.56);
  assert.equal(hojaSituacion.E14.v, 817.78);
  assert.equal(hojaSituacion.G14.f, "E14-C14");
  assert.equal(hojaSituacion.D20.v, 737913.21);
  assert.equal(hojaSituacion.F20.v, 758368.33);
  assert.equal(hojaSituacion.G20.f, "F20-D20");
  assert.equal(libroSituacion.Workbook.Sheets[0].Hidden ?? 0, 0);
  assert.equal(libroSituacion.Workbook.Sheets[1].Hidden, 2);
  const partesSituacion = unzipSync(archivoSituacion);
  assert.equal(partesSituacion["xl/calcChain.xml"], undefined);
  assert.doesNotMatch(strFromU8(partesSituacion["xl/_rels/workbook.xml.rels"]), /relationships\/calcChain/);
  assert.doesNotMatch(strFromU8(partesSituacion["[Content_Types].xml"]), /\/xl\/calcChain\.xml/);
});
