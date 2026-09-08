import assert from "node:assert/strict";
import test from "node:test";
import { reporteFlujoDesdeSituaciones } from "../lib/reportes.ts";

/**
 * Datos sintéticos con la misma estructura que el Estado de Situación Financiera que emite la
 * institución: "Excedente acumulados" arrastra el total del período anterior y "del ejercicio"
 * lleva el resultado propio del período. Las cifras no son reales.
 */
const estado = (periodo, valores) => ({
  periodo,
  filas: Object.entries(valores).map(([concepto, saldoFinal]) => ({
    concepto, saldoFinal, esTotal: /^total\b/i.test(concepto),
  })),
});

const ANTERIOR = estado("2026-04", {
  "Total EFECTIVO": 100000,
  "Total ACTIVOS CORRIENTES": 100000,
  "EDIFICIOS": 500000,
  "MOBILIARIO Y EQUIPOS": 50000,
  "VEHICULOS": 0,
  "TERRENOS": 0,
  "DEPRECIACION DE VEHICULOS": -10000,
  "DEPRECIACION DE MOB Y EQUIPO": -5000,
  "Total ACTIVOS POR IMPUESTOS DIFERIDOS": 2000,
  "Total ACREEDORES COMERCIALES": 30000,
  "Total IMPUESTOS CORRIENTES POR PAGAR": 8000,
  "Total OBLIGACIONES A C/P POR BENEF. A LOS EMPLEADOS": 20000,
  "Total PATRIMONIO IGLESIA UNIVERSAL DEL REINO DE DIOS": 400000,
  "Total INCREMENTO O DECREMENTO": 100000,
  "Excedente Ingresos s/Egresos acumulados": -10000,
  "Excedente Ingresos s/Egresos del ejercicio": -3000,
});

const ACTUAL = estado("2026-05", {
  "Total EFECTIVO": 92500,
  "Total ACTIVOS CORRIENTES": 92500,
  "EDIFICIOS": 500000,
  "MOBILIARIO Y EQUIPOS": 56000,      // compra por 6000
  "VEHICULOS": 0,
  "TERRENOS": 0,
  "DEPRECIACION DE VEHICULOS": -12000, // depreciación del período: 2000
  "DEPRECIACION DE MOB Y EQUIPO": -6000, // depreciación del período: 1000
  "Total ACTIVOS POR IMPUESTOS DIFERIDOS": 2500,
  "Total ACREEDORES COMERCIALES": 28000,
  "Total IMPUESTOS CORRIENTES POR PAGAR": 9000,
  "Total OBLIGACIONES A C/P POR BENEF. A LOS EMPLEADOS": 21000,
  "Total PATRIMONIO IGLESIA UNIVERSAL DEL REINO DE DIOS": 400000,
  "Total INCREMENTO O DECREMENTO": 100000,
  "Excedente Ingresos s/Egresos acumulados": -13000, // arrastra el total de abril
  "Excedente Ingresos s/Egresos del ejercicio": -4000, // resultado propio de mayo
});

const linea = (reporte, concepto) => reporte.filas.find(fila => fila.concepto === concepto)?.actual;

test("el flujo mensual reconstruye el efectivo declarado en el estado", () => {
  const reporte = reporteFlujoDesdeSituaciones(ACTUAL, ANTERIOR, "May 2026", "Abr 2026");

  assert.equal(linea(reporte, "Utilidad o pérdida del período"), -4000, "el resultado es el del período, no el acumulado");
  assert.equal(linea(reporte, "Depreciación"), 3000, "la depreciación se suma de vuelta");
  assert.equal(linea(reporte, "Impuestos pagados por adelantado"), -500, "aumentar un activo consume efectivo");
  assert.equal(linea(reporte, "Acreedores Comerciales"), -2000, "bajar un pasivo consume efectivo");
  assert.equal(linea(reporte, "Impuestos por pagar"), 1000, "subir un pasivo libera efectivo");
  assert.equal(linea(reporte, "Mobiliario y Equipo de Oficina"), -6000, "comprar equipo consume efectivo");

  assert.equal(linea(reporte, "Efectivo neto utilizado en las actividades de operación"), -1500);
  assert.equal(linea(reporte, "Efectivo neto utilizado en las actividades de inversión"), -6000);
  assert.equal(linea(reporte, "Aumento (Disminución) neto en el efectivo"), -7500);
  assert.equal(linea(reporte, "Efectivo al 31 de Mayo 2026"), 92500);
  assert.equal(linea(reporte, "Efectivo declarado en el Estado de Situación Financiera"), 92500);
  assert.equal(linea(reporte, "Diferencia contra el efectivo declarado"), 0, "el flujo debe cuadrar contra el propio estado");
});

test("el flujo anual usa la misma lógica sin caso especial por cambio de año", () => {
  const diciembre = { ...ACTUAL, periodo: "2026-12" };
  const diciembreAnterior = { ...ANTERIOR, periodo: "2025-12" };
  const reporte = reporteFlujoDesdeSituaciones(diciembre, diciembreAnterior, "2026", "2025");

  assert.equal(linea(reporte, "Utilidad o pérdida del período"), -4000);
  assert.equal(linea(reporte, "Aumento (Disminución) neto en el efectivo"), -7500);
  assert.equal(linea(reporte, "Diferencia contra el efectivo declarado"), 0);
});

test("un estado incoherente produce una diferencia visible en vez de cuadrar solo", () => {
  // El efectivo declarado no corresponde a los movimientos: el reporte debe delatarlo.
  const inconsistente = estado("2026-05", Object.fromEntries(
    ACTUAL.filas.map(fila => [fila.concepto, fila.concepto === "Total EFECTIVO" ? 99999 : fila.saldoFinal]),
  ));
  const reporte = reporteFlujoDesdeSituaciones(inconsistente, ANTERIOR, "May 2026", "Abr 2026");
  assert.equal(linea(reporte, "Diferencia contra el efectivo declarado"), 92500 - 99999);
});

test("usa Total EFECTIVO y no Total ACTIVOS CORRIENTES cuando difieren", () => {
  // Una cuenta por cobrar corriente hace que activos corrientes deje de ser el efectivo.
  const conCobrar = estado("2026-05", Object.fromEntries(
    ACTUAL.filas.map(fila => [fila.concepto, fila.concepto === "Total ACTIVOS CORRIENTES" ? 150000 : fila.saldoFinal]),
  ));
  const reporte = reporteFlujoDesdeSituaciones(conCobrar, ANTERIOR, "May 2026", "Abr 2026");
  assert.equal(linea(reporte, "Efectivo declarado en el Estado de Situación Financiera"), 92500);
  assert.equal(linea(reporte, "Diferencia contra el efectivo declarado"), 0);
});

// --- Revisión del Estado de Situación Financiera al importarlo ---

const { revisarSituacionFinanciera } = await import("../lib/situacion-financiera.ts");
const filaEstado = (concepto, saldoFinal) => ({ numeroLinea: 1, concepto, saldoFinal: saldoFinal.toFixed(2), esTotal: /^total\b/i.test(concepto) });

test("un estado que cuadra pasa como procesado", () => {
  const revision = revisarSituacionFinanciera([
    filaEstado("Total ACTIVOS", 1000),
    filaEstado("Total PASIVOS CORRIENTES", 400),
    filaEstado("Total PATRIMONIO", 600),
  ]);
  assert.equal(revision.estado, "procesado");
  assert.deepEqual(revision.observaciones, []);
});

test("un estado descuadrado queda con diferencias y explica la brecha", () => {
  const revision = revisarSituacionFinanciera([
    filaEstado("Total ACTIVOS", 1000),
    filaEstado("TOTAL PASIVOS Y PATRIMONIO + PATRIMONIO", 950),
  ]);
  assert.equal(revision.estado, "con_diferencias");
  assert.match(revision.observaciones[0], /no cuadra/);
  assert.match(revision.observaciones[0], /50\.00/);
});

test("si falta una de las dos líneas de cierre lo dice en vez de darlo por bueno", () => {
  const revision = revisarSituacionFinanciera([filaEstado("Total ACTIVOS", 1000)]);
  assert.equal(revision.estado, "procesado", "no se puede afirmar que esté mal");
  assert.match(revision.observaciones[0], /No se pudo verificar el cuadre/);
});

test("un concepto repetido con el mismo importe se anota pero no bloquea", () => {
  // El formato real de la institución repite la línea de total del incremento patrimonial.
  const revision = revisarSituacionFinanciera([
    filaEstado("Total ACTIVOS", 1000),
    filaEstado("Total PASIVOS CORRIENTES", 400),
    filaEstado("Total PATRIMONIO", 600),
    filaEstado("Total INCREMENTO O DECREMENTO", 500),
    filaEstado("Total INCREMENTO O DECREMENTO", 500),
  ]);
  assert.equal(revision.estado, "procesado", "el archivo real de la institución debe seguir importándose");
  assert.match(revision.observaciones.join(" "), /aparece 2 veces con el mismo importe/);
});

test("un concepto repetido con importes distintos queda con diferencias", () => {
  const revision = revisarSituacionFinanciera([
    filaEstado("Total ACTIVOS", 1000),
    filaEstado("Total PASIVOS CORRIENTES", 400),
    filaEstado("Total PATRIMONIO", 600),
    filaEstado("Total INCREMENTO O DECREMENTO", 500),
    filaEstado("Total INCREMENTO O DECREMENTO", 700),
  ]);
  assert.equal(revision.estado, "con_diferencias");
  assert.match(revision.observaciones.join(" "), /importes distintos/);
});

// --- Advertencias del reporte ---

test("advierte los conceptos que no aparecen en ninguno de los dos estados", () => {
  const sinDepreciacion = estado("2026-05", Object.fromEntries(
    ACTUAL.filas.filter(fila => !fila.concepto.startsWith("DEPRECIACION")).map(fila => [fila.concepto, fila.saldoFinal]),
  ));
  const anteriorSinDepreciacion = estado("2026-04", Object.fromEntries(
    ANTERIOR.filas.filter(fila => !fila.concepto.startsWith("DEPRECIACION")).map(fila => [fila.concepto, fila.saldoFinal]),
  ));
  const reporte = reporteFlujoDesdeSituaciones(sinDepreciacion, anteriorSinDepreciacion, "May 2026", "Abr 2026");
  const aviso = reporte.advertencias.find(item => item.includes("No se encontraron"));
  assert.ok(aviso, "debe advertir los conceptos ausentes");
  assert.match(aviso, /DEPRECIACION DE VEHICULOS/);
});

test("advierte cuando el flujo no reconstruye el efectivo declarado", () => {
  const inconsistente = estado("2026-05", Object.fromEntries(
    ACTUAL.filas.map(fila => [fila.concepto, fila.concepto === "Total EFECTIVO" ? 99999 : fila.saldoFinal]),
  ));
  const reporte = reporteFlujoDesdeSituaciones(inconsistente, ANTERIOR, "May 2026", "Abr 2026");
  assert.ok(reporte.advertencias.some(item => item.includes("no reconstruye el efectivo declarado")));
});

test("lista las posiciones del formato oficial que el estado no alimenta", () => {
  const reporte = reporteFlujoDesdeSituaciones(ACTUAL, ANTERIOR, "May 2026", "Abr 2026");
  const aviso = reporte.advertencias.find(item => item.includes("no alimenta"));
  assert.ok(aviso);
  assert.match(aviso, /Cuentas por cobrar a empleados/);
  assert.match(aviso, /Retenciones por pagar/);
});

test("un flujo correcto y completo no genera advertencias de descuadre", () => {
  const reporte = reporteFlujoDesdeSituaciones(ACTUAL, ANTERIOR, "May 2026", "Abr 2026");
  assert.equal(reporte.advertencias.some(item => item.includes("no reconstruye")), false);
  assert.equal(reporte.advertencias.some(item => item.includes("No se encontraron")), false);
});
