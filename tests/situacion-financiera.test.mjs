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
  assert.equal(valores.get("Acreedores Comerciales"), -40);
  assert.equal(valores.get("Impuestos por pagar"), 10);
  assert.equal(valores.get("Gastos acumulados por pagar"), -20);
  assert.equal(valores.get("Patrimonio"), 100);
  assert.equal(valores.get("Mobiliario y Equipo de Oficina"), 10);
  assert.equal(valores.get("Excedente Ingresos/Egresos Acumulados"), 0);
  assert.equal(valores.get("Cuentas por cobrar a empleados"), 0);
  assert.equal(valores.get("Efectivo neto utilizado en las actividades de operación"), -90);
  assert.equal(valores.get("Efectivo neto utilizado en las actividades de inversión"), 60);
  assert.equal(valores.get("Aumento (Disminución) neto en el efectivo"), 30);
  assert.equal(valores.get("Efectivo al 31 de Mayo 2026"), 800);
  assert.equal(valores.get("Efectivo al 30 de Junio 2026"), 830);
});

test("al cambiar de año traslada los excedentes del período comparativo con signo inverso", async () => {
  const { reporteFlujoDesdeSituaciones } = await import(`../lib/reportes.ts?anual=${Date.now()}`);
  const actual = { periodo: "2026-06", filas: [fila("Excedente Ingresos s/Egresos acumulados", 30), fila("Excedente Ingresos s/Egresos del ejercicio", 20)] };
  const anterior = { periodo: "2025-12", filas: [fila("Excedente Ingresos s/Egresos acumulados", 1000), fila("Excedente Ingresos s/Egresos del ejercicio", 250), fila("Total ACTIVOS CORRIENTES", 5000)] };
  const reporte = reporteFlujoDesdeSituaciones(actual, anterior, "junio de 2026", "diciembre de 2025");
  const valores = new Map(reporte.filas.map(item => [item.concepto, item.actual]));
  assert.equal(valores.get("Utilidad o pérdida del período"), 1200);
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
  assert.equal(flujo.filas.find(item => item.concepto === "Utilidad o pérdida del período")?.actual, 50);
});

test("el flujo real de junio 2026 cuadra contra el efectivo final del Estado de Situación", async () => {
  const { reporteFlujoDesdeSituaciones } = await import(`../lib/reportes.ts?real-flujo=${Date.now()}`);
  const actual = { periodo: "2026-06", filas: [
    fila("Total ACTIVOS CORRIENTES", 608636.09),
    fila("Excedente Ingresos s/Egresos acumulados", -1150276.77), fila("Excedente Ingresos s/Egresos del ejercicio", 78548.57),
    fila("DEPRECIACION DE VEHICULOS", -2848393.22), fila("DEPRECIACION DE MOB Y EQUIPO", -1694006.76),
    fila("Total ACTIVOS POR IMPUESTOS DIFERIDOS", 230902.63), fila("Total ACREEDORES COMERCIALES", 1461703.86),
    fila("Total IMPUESTOS CORRIENTES POR PAGAR", 501002.64), fila("Total OBLIGACIONES A C/P POR BENEF. A LOS EMPLEADOS", 4739781.33),
    fila("Total PATRIMONIO IGLESIA UNIVERSAL DEL REINO DE DIOS", 18848167.86),
    fila("EDIFICIOS", 76421621.07), fila("MOBILIARIO Y EQUIPOS", 6765515.40), fila("VEHICULOS", 5528915.56), fila("TERRENOS", 15725500.25),
    fila("Total INCREMENTO O DECREMENTO", 76259763.53),
  ] };
  const anterior = { periodo: "2026-05", filas: [
    fila("Total ACTIVOS CORRIENTES", 501152.60),
    fila("Excedente Ingresos s/Egresos acumulados", -1013951.51), fila("Excedente Ingresos s/Egresos del ejercicio", -136325.26),
    fila("DEPRECIACION DE VEHICULOS", -2794494.53), fila("DEPRECIACION DE MOB Y EQUIPO", -1585458.08),
    fila("Total ACTIVOS POR IMPUESTOS DIFERIDOS", 190561.06), fila("Total ACREEDORES COMERCIALES", 1579461.95),
    fila("Total IMPUESTOS CORRIENTES POR PAGAR", 482206.45), fila("Total OBLIGACIONES A C/P POR BENEF. A LOS EMPLEADOS", 4707167.97),
    fila("Total PATRIMONIO IGLESIA UNIVERSAL DEL REINO DE DIOS", 18848167.86),
    fila("EDIFICIOS", 76421621.07), fila("MOBILIARIO Y EQUIPOS", 6738693.06), fila("VEHICULOS", 5528915.56), fila("TERRENOS", 15725500.25),
    fila("Total INCREMENTO O DECREMENTO", 76259763.53),
  ] };

  const reporte = reporteFlujoDesdeSituaciones(actual, anterior, "junio de 2026", "mayo de 2026");
  const valores = new Map(reporte.filas.map(item => [item.concepto, item.actual]));
  assert.equal(Math.round((valores.get("Aumento (Disminución) neto en el efectivo") ?? 0) * 100) / 100, 107483.49);
  assert.equal(Math.round((valores.get("Efectivo al 30 de Junio 2026") ?? 0) * 100) / 100, 608636.09);
});

test("los reportes comparativos desde balanza no suman cuentas padre e hijas dos veces", async () => {
  const { reporteBalanza } = await import(`../lib/reportes.ts?balanza-jerarquia=${Date.now()}`);
  const actual = { periodo: "2026-06", filas: [
    { codigo: "40000000", concepto: "INGRESOS", debe: 0, haber: 100, saldo: 100 },
    { codigo: "41000000", concepto: "INGRESOS ORDINARIOS", debe: 0, haber: 100, saldo: 100 },
    { codigo: "41010100", concepto: "DIEZMOS", debe: 0, haber: 100, saldo: 100 },
    { codigo: "50000000", concepto: "GASTOS", debe: 40, haber: 0, saldo: 40 },
    { codigo: "51000000", concepto: "GASTOS ADMINISTRATIVOS", debe: 40, haber: 0, saldo: 40 },
    { codigo: "51010100", concepto: "SERVICIOS BASICOS", debe: 40, haber: 0, saldo: 40 },
    { codigo: "30000000", concepto: "PATRIMONIO", debe: 0, haber: 0, saldo: 500 },
    { codigo: "31000000", concepto: "PATRIMONIO INSTITUCIONAL", debe: 0, haber: 0, saldo: 500 },
    { codigo: "31010100", concepto: "PATRIMONIO", debe: 0, haber: 0, saldo: 500 },
  ] };
  const anterior = { periodo: "2026-05", filas: [
    { codigo: "40000000", concepto: "INGRESOS", debe: 0, haber: 70, saldo: 70 },
    { codigo: "41000000", concepto: "INGRESOS ORDINARIOS", debe: 0, haber: 70, saldo: 70 },
    { codigo: "41010100", concepto: "DIEZMOS", debe: 0, haber: 70, saldo: 70 },
    { codigo: "50000000", concepto: "GASTOS", debe: 25, haber: 0, saldo: 25 },
    { codigo: "51000000", concepto: "GASTOS ADMINISTRATIVOS", debe: 25, haber: 0, saldo: 25 },
    { codigo: "51010100", concepto: "SERVICIOS BASICOS", debe: 25, haber: 0, saldo: 25 },
    { codigo: "30000000", concepto: "PATRIMONIO", debe: 0, haber: 0, saldo: 450 },
  ] };

  const resultado = reporteBalanza("resultado-comparativo", actual, anterior, "junio de 2026", "mayo de 2026");
  const patrimonio = reporteBalanza("cambio-patrimonio", actual, anterior, "junio de 2026", "mayo de 2026");
  assert.equal(resultado.filas.find(item => item.concepto === "Total ingreso")?.actual, 100);
  assert.equal(resultado.filas.find(item => item.concepto === "Total gasto")?.actual, 40);
  assert.equal(resultado.filas.filter(item => item.codigo).length, 2);
  assert.equal(patrimonio.filas.find(item => item.concepto === "Total patrimonio")?.actual, 500);
  assert.equal(patrimonio.filas.some(item => item.codigo?.startsWith("1") || item.codigo?.startsWith("2")), false);
});

test("el cambio en el patrimonio anual aplica traslado, IR y utilidad con los signos del formato oficial", async () => {
  const { reporteCambioPatrimonioDesdeSituaciones } = await import(`../lib/reportes.ts?patrimonio=${Date.now()}`);
  const anterior = { periodo: "2024-12", filas: [
    fila("Patrimonio Iglesia Universal del Reino de Dios", 18703328.66),
    fila("Patrimonio Donado", 144839.20),
    fila("Utilidades Acumuladas", -13179212.23),
    fila("Incremento o Decremento por Revaluacion de Activos", 91703581.13),
    fila("Excedente Ingresos s/Egresos acumulados", -89043.81),
    fila("Excedente Ingresos s/Egresos del ejercicio", 0),
    fila("PAGO MINIMO DEFINITIVO", 220200.57),
    fila("Total PATRIMONIO", 97283492.95),
  ] };
  const actual = { periodo: "2025-12", filas: [
    fila("Patrimonio Iglesia Universal del Reino de Dios", 18703328.66),
    fila("Patrimonio Donado", 144839.20),
    fila("Utilidades Acumuladas", -13488456.61),
    fila("Incremento o Decremento por Revaluacion de Activos", 91703581.13),
    fila("Excedente Ingresos s/Egresos acumulados", -1505507.75),
    fila("Excedente Ingresos s/Egresos del ejercicio", 0),
    fila("Total PATRIMONIO", 95557784.63),
  ] };

  const reporte = reporteCambioPatrimonioDesdeSituaciones(actual, anterior);
  assert.deepEqual(reporte.columnas, ["Descripción", "Patrimonio", "Patrimonio donado", "Utilidades acumuladas", "Incremento o decremento por revaluación de activo", "Utilidad ejercicio", "Total patrimonio"]);
  assert.deepEqual(reporte.filas.map(item => [item.concepto, item.valores]), [
    ["Saldos al 31/12/2024", [18703328.66, 144839.20, -13179212.23, 91703581.13, -89043.81, 97283492.95]],
    ["Traslado a utilidades acumuladas/2024", [0, 0, -89043.81, 0, 89043.81, 0]],
    ["Pago de Impuesto IR 2024", [0, 0, -220200.57, 0, 0, -220200.57]],
    ["Utilidades del Ejercicio 2025", [0, 0, 0, 0, -1505507.75, -1505507.75]],
    ["Totales C$", [18703328.66, 144839.20, -13488456.61, 91703581.13, -1505507.75, 95557784.63]],
  ]);
  assert.equal(reporte.validacion?.conciliado, true);
  assert.ok(reporte.validacion?.diferencias.every(item => item.diferencia === 0));
});

test("el cambio en el patrimonio advierte cuando las operaciones no concilian con el cierre principal", async () => {
  const { reporteCambioPatrimonioDesdeSituaciones } = await import(`../lib/reportes.ts?patrimonio-diferencia=${Date.now()}`);
  const anterior = { periodo: "2024-12", filas: [fila("Patrimonio Iglesia Universal del Reino de Dios", 100), fila("Total PATRIMONIO", 100)] };
  const actual = { periodo: "2025-12", filas: [fila("Patrimonio Iglesia Universal del Reino de Dios", 100), fila("Total PATRIMONIO", 125)] };
  const reporte = reporteCambioPatrimonioDesdeSituaciones(actual, anterior);
  assert.equal(reporte.validacion?.conciliado, false);
  assert.equal(reporte.validacion?.diferencias.find(item => item.concepto === "Total patrimonio")?.diferencia, -25);
});

test("la exportación Excel del patrimonio mantiene el orden y fórmulas del formato anual", async () => {
  const { reporteCambioPatrimonioDesdeSituaciones } = await import(`../lib/reportes.ts?patrimonio-xlsx-report=${Date.now()}`);
  const { exportarCambioPatrimonioExcel } = await import(`../lib/patrimonio-excel.ts?patrimonio-xlsx=${Date.now()}`);
  const anterior = { periodo: "2024-12", filas: [
    fila("Patrimonio Iglesia Universal del Reino de Dios", 10), fila("Patrimonio Donado", 20),
    fila("Utilidades Acumuladas", 30), fila("Incremento o Decremento por Revaluacion de Activos", 40),
    fila("Excedente Ingresos s/Egresos acumulados", 5), fila("PAGO MINIMO DEFINITIVO", 2), fila("Total PATRIMONIO", 105),
  ] };
  const actual = { periodo: "2025-12", filas: [
    fila("Patrimonio Iglesia Universal del Reino de Dios", 10), fila("Patrimonio Donado", 20),
    fila("Utilidades Acumuladas", 33), fila("Incremento o Decremento por Revaluacion de Activos", 40),
    fila("Excedente Ingresos s/Egresos del ejercicio", 7), fila("Total PATRIMONIO", 110),
  ] };
  const reporte = reporteCambioPatrimonioDesdeSituaciones(actual, anterior);
  const plantilla = await readFile(new URL("../public/plantillas/cambio-patrimonio.xlsx", import.meta.url));
  const bytes = exportarCambioPatrimonioExcel(reporte, plantilla.buffer.slice(plantilla.byteOffset, plantilla.byteOffset + plantilla.byteLength));
  const workbook = XLSX.read(bytes, { type: "array", cellFormula: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  assert.equal(sheet.A3.v, "Al 31 de Diciembre de 2025");
  assert.equal(sheet.A8.v, "Traslado a utilidades acumuladas/2024");
  assert.equal(sheet.D8.v, 5);
  assert.equal(sheet.F8.v, -5);
  assert.equal(sheet.D9.v, -2);
  assert.equal(sheet.G9.f, "SUM(B9:F9)");
  assert.equal(sheet.B11.f, "SUM(B7:B10)");
  assert.equal(sheet.G11.f, "SUM(G7:G10)");
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
