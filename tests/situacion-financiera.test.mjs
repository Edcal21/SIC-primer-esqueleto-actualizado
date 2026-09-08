import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { unzipSync } from "fflate";
import * as XLSX from "xlsx";

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
  const excedente = vacias(); excedente[0] = "Excedente Ingresos s/Egresos acumulados"; excedente[6] = -125;
  const excedenteEjercicio = vacias(); excedenteEjercicio[0] = "Excedente Ingresos s/Egresos del ejercicio"; excedenteEjercicio[6] = 35;
  const fueraSaldoFinal = vacias(); fueraSaldoFinal[0] = "Cálculo auxiliar"; fueraSaldoFinal[6] = 999;

  const result = extraerFilasSituacionFinanciera([["Estado de Situación Financiera"], encabezado, detalle, total, excedente, excedenteEjercicio, fueraSaldoFinal]);
  assert.deepEqual(result.filas, [
    { numeroLinea: 3, concepto: "EFECTIVO EN BANCOS", saldoFinal: "500.00", esTotal: false },
    { numeroLinea: 4, concepto: "Total EFECTIVO", saldoFinal: "500.00", esTotal: true },
    { numeroLinea: 5, concepto: "Excedente Ingresos s/Egresos acumulados", saldoFinal: "-125.00", esTotal: false },
    { numeroLinea: 6, concepto: "Excedente Ingresos s/Egresos del ejercicio", saldoFinal: "35.00", esTotal: false },
  ]);
});

function fila(concepto, saldoFinal) { return { concepto, saldoFinal, esTotal: concepto.startsWith("Total ") }; }

test("el flujo aplica el mapeo oficial y conserva en cero las actividades sin fuente", async () => {
  const { reporteFlujoDesdeSituaciones } = await import(`../lib/reportes.ts?reporte=${Date.now()}`);
  const actual = { periodo: "2026-06", filas: [
    fila("Excedente Ingresos s/Egresos acumulados", -1000), fila("Excedente Ingresos s/Egresos del ejercicio", 200),
    fila("DEPRECIACION DE VEHICULOS", -300), fila("DEPRECIACION DE MOB Y EQUIPO", -100),
    fila("Total ACTIVOS POR IMPUESTOS DIFERIDOS", 130), fila("Total ACREEDORES COMERCIALES", 440),
    fila("Total IMPUESTOS CORRIENTES POR PAGAR", 190), fila("Total OBLIGACIONES A C/P POR BENEF. A LOS EMPLEADOS", 520),
    fila("Total PATRIMONIO IGLESIA UNIVERSAL DEL REINO DE DIOS", 1100), fila("EDIFICIOS", 105),
    fila("MOBILIARIO Y EQUIPOS", 210), fila("VEHICULOS", 295), fila("TERRENOS", 400),
    fila("Total INCREMENTO O DECREMENTO", 550), fila("Total ACTIVOS CORRIENTES", 900),
  ] };
  const anterior = { periodo: "2026-05", filas: [
    fila("Excedente Ingresos s/Egresos acumulados", -900), fila("Excedente Ingresos s/Egresos del ejercicio", 100),
    fila("DEPRECIACION DE VEHICULOS", -250), fila("DEPRECIACION DE MOB Y EQUIPO", -80),
    fila("Total ACTIVOS POR IMPUESTOS DIFERIDOS", 100), fila("Total ACREEDORES COMERCIALES", 400),
    fila("Total IMPUESTOS CORRIENTES POR PAGAR", 200), fila("Total OBLIGACIONES A C/P POR BENEF. A LOS EMPLEADOS", 500),
    fila("Total PATRIMONIO IGLESIA UNIVERSAL DEL REINO DE DIOS", 1000), fila("EDIFICIOS", 100),
    fila("MOBILIARIO Y EQUIPOS", 200), fila("VEHICULOS", 300), fila("TERRENOS", 400),
    fila("Total INCREMENTO O DECREMENTO", 500), fila("Total ACTIVOS CORRIENTES", 800),
  ] };

  const reporte = reporteFlujoDesdeSituaciones(actual, anterior, "junio de 2026", "mayo de 2026");
  const valores = new Map(reporte.filas.map(item => [item.concepto, item.actual]));
  assert.equal(reporte.fuente, "Estado de Situación Financiera 2026-06");
  assert.equal(valores.get("Utilidad o pérdida del período"), 0);
  assert.equal(valores.get("Depreciación"), -70);
  assert.equal(valores.get("Impuestos pagados por adelantado"), 30);
  assert.equal(valores.get("Acreedores Comerciales"), 40);
  assert.equal(valores.get("Impuestos por pagar"), -10);
  assert.equal(valores.get("Gastos acumulados por pagar"), 20);
  assert.equal(valores.get("Patrimonio"), 100);
  assert.equal(valores.get("Mobiliario y Equipo de Oficina"), 10);
  assert.equal(valores.get("Excedente Ingresos/Egresos Acumulados"), 0);
  assert.equal(valores.get("Cuentas por cobrar a empleados"), 0);
  assert.equal(valores.get("Efectivo neto utilizado en las actividades de operación"), 10);
  assert.equal(valores.get("Efectivo neto utilizado en las actividades de inversión"), 60);
  assert.equal(valores.get("Aumento (Disminución) neto en el efectivo"), -70);
  assert.equal(valores.get("Efectivo al 31 de Mayo 2026"), 800);
  assert.equal(valores.get("Efectivo al 30 de Junio 2026"), 730);
});

test("al cambiar de año traslada los excedentes del período comparativo con signo inverso", async () => {
  const { reporteFlujoDesdeSituaciones } = await import(`../lib/reportes.ts?anual=${Date.now()}`);
  const actual = { periodo: "2026-06", filas: [fila("Excedente Ingresos s/Egresos acumulados", 30), fila("Excedente Ingresos s/Egresos del ejercicio", 20)] };
  const anterior = { periodo: "2025-12", filas: [fila("Excedente Ingresos s/Egresos acumulados", 1000), fila("Excedente Ingresos s/Egresos del ejercicio", 250), fila("Total ACTIVOS CORRIENTES", 5000)] };
  const reporte = reporteFlujoDesdeSituaciones(actual, anterior, "junio de 2026", "diciembre de 2025");
  const valores = new Map(reporte.filas.map(item => [item.concepto, item.actual]));
  assert.equal(valores.get("Utilidad o pérdida del período"), -1200);
  assert.equal(valores.get("Excedente Ingresos/Egresos Acumulados"), -1250);
  assert.equal(valores.get("Efectivo al 31 de Diciembre 2025"), 5000);
});

test("la vista comparativa conserva todas las líneas de ambos estados y calcula su variación", async () => {
  const { reporteSituacionComparativaDesdeSituaciones } = await import(`../lib/reportes.ts?comparativo=${Date.now()}`);
  const actual = { periodo: "2026-05", filas: [
    fila("CAJA GENERAL", 120), fila("Total ACTIVOS CORRIENTES", 900), fila("Solo período actual", 25),
  ] };
  const anterior = { periodo: "2026-04", filas: [
    fila("CAJA GENERAL", 100), fila("Total ACTIVOS CORRIENTES", 800), fila("Solo período anterior", 40),
  ] };

  const reporte = reporteSituacionComparativaDesdeSituaciones(actual, anterior, "mayo de 2026", "abril de 2026");
  assert.deepEqual(reporte.columnas, ["Concepto", "mayo de 2026", "abril de 2026", "Variación"]);
  assert.equal(reporte.fuente, "Estados de Situación Financiera 2026-05 y 2026-04");
  assert.deepEqual(reporte.filas.map(item => [item.concepto, item.actual, item.anterior, item.variacion]), [
    ["CAJA GENERAL", 120, 100, 20],
    ["Total ACTIVOS CORRIENTES", 900, 800, 100],
    ["Solo período actual", 25, 0, 25],
    ["Solo período anterior", 0, 40, -40],
  ]);
  assert.equal(reporte.filas[1].esTotal, true);
});

test("los dos excedentes aparecen en la comparación y la variación de sus sumas alimenta la utilidad del flujo", async () => {
  const { reporteFlujoDesdeSituaciones, reporteSituacionComparativaDesdeSituaciones } = await import(`../lib/reportes.ts?excedentes=${Date.now()}`);
  const actual = { periodo: "2026-06", filas: [
    fila("Excedente Ingresos s/Egresos acumulados", -1200),
    fila("Excedente Ingresos s/Egresos del ejercicio", 350),
  ] };
  const anterior = { periodo: "2026-05", filas: [
    fila("Excedente Ingresos s/Egresos acumulados", -1000),
    fila("Excedente Ingresos s/Egresos del ejercicio", 200),
  ] };

  const comparativo = reporteSituacionComparativaDesdeSituaciones(actual, anterior, "junio de 2026", "mayo de 2026");
  const filas = new Map(comparativo.filas.map(item => [item.concepto, item]));
  assert.deepEqual(filas.get("Excedente Ingresos s/Egresos acumulados"), {
    concepto: "Excedente Ingresos s/Egresos acumulados", actual: -1200, anterior: -1000, variacion: -200, esTotal: false,
  });
  assert.deepEqual(filas.get("Excedente Ingresos s/Egresos del ejercicio"), {
    concepto: "Excedente Ingresos s/Egresos del ejercicio", actual: 350, anterior: 200, variacion: 150, esTotal: false,
  });

  const flujo = reporteFlujoDesdeSituaciones(actual, anterior, "junio de 2026", "mayo de 2026");
  assert.equal(flujo.filas.find(item => item.concepto === "Utilidad o pérdida del período")?.actual, -50);
});

test("la exportación Excel conserva la plantilla, las fórmulas y los recursos gráficos", async () => {
  const { reporteFlujoDesdeSituaciones } = await import(`../lib/reportes.ts?xlsx-report=${Date.now()}`);
  const { exportarFlujoExcel } = await import(`../lib/flujo-excel.ts?xlsx=${Date.now()}`);
  const actual = { periodo: "2026-06", filas: [fila("Excedente Ingresos s/Egresos acumulados", 30), fila("Excedente Ingresos s/Egresos del ejercicio", 20)] };
  const anterior = { periodo: "2025-12", filas: [fila("Total ACTIVOS CORRIENTES", 5000)] };
  const reporte = reporteFlujoDesdeSituaciones(actual, anterior, "junio de 2026", "diciembre de 2025");
  const plantilla = await readFile(new URL("../public/plantillas/flujo-efectivo.xlsx", import.meta.url));
  const bytes = exportarFlujoExcel(reporte, plantilla.buffer.slice(plantilla.byteOffset, plantilla.byteOffset + plantilla.byteLength));
  const workbook = XLSX.read(bytes, { type: "array", cellFormula: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  assert.equal(sheet.B3.v, "AL 30 DE JUNIO DEL 2026");
  assert.equal(sheet.B38.v, "Efectivo al 31 de Diciembre 2025");
  assert.equal(sheet.D38.v, 5000);
  assert.equal(sheet.D26.f, "SUM(D9:D25)");
  assert.equal(sheet.D35.f, "SUM(D29:D34)");
  assert.equal(sheet.D37.f, "SUM(-D26-D35)");
  assert.equal(sheet.D39.f, "SUM(D38+D37)");
  assert.equal(workbook.Workbook.Sheets[1].Hidden, 2);
  const contenido = unzipSync(bytes);
  assert.ok(contenido["xl/media/image1.jpeg"]);
  assert.ok(contenido["xl/drawings/drawing1.xml"]);
});
