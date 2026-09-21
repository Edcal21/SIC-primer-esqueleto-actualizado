import assert from "node:assert/strict";
import test from "node:test";
import { reporteCambioPatrimonioDesdeSituaciones } from "../lib/reportes.ts";

/**
 * El Estado de Cambio en el Patrimonio se construye a partir de dos cierres del Estado de
 * Situación Financiera (no de la balanza de comprobación): el formato oficial es una matriz de 6
 * columnas (Patrimonio, Patrimonio donado, Utilidades acumuladas, Revaluación, Utilidad del
 * ejercicio, Total) en 5 filas (apertura, traslado, impuesto, resultado, totales). Las cifras son
 * sintéticas.
 */
const situacion = (periodo, filas) => ({
  periodo,
  filas: filas.map(([concepto, saldoFinal, esTotal = false]) => ({ concepto, saldoFinal, esTotal })),
});

const fila = (reporte, concepto) => reporte.filas.find(item => item.concepto.startsWith(concepto));

test("un ECP consistente concilia exacto contra el cierre del Estado de Situación Financiera", () => {
  // Año anterior: patrimonio 100000, donado 10000, acumuladas -20000, revaluación 8000, y una
  // utilidad del ejercicio de 5000 (excedentes). Sin pago de IR (no hay línea PAGO MINIMO DEFINITIVO).
  const anterior = situacion("2024-12", [
    ["Patrimonio Iglesia Universal del Reino de Dios", 100000],
    ["Patrimonio Donado", 10000],
    ["Utilidades Acumuladas", -20000],
    ["Incremento o Decremento por Revaluacion de Activos", 8000],
    ["Excedente Ingresos s/Egresos acumulados", 0],
    ["Excedente Ingresos s/Egresos del ejercicio", 5000],
  ]);
  // Año actual: Utilidades Acumuladas subió exactamente los 5000 trasladados del ejercicio
  // anterior (sin pago de IR), y el resto de saldos se mantiene; utilidad del ejercicio actual = 8000.
  const actual = situacion("2025-12", [
    ["Patrimonio Iglesia Universal del Reino de Dios", 100000],
    ["Patrimonio Donado", 10000],
    ["Utilidades Acumuladas", -15000],
    ["Incremento o Decremento por Revaluacion de Activos", 8000],
    ["Excedente Ingresos s/Egresos acumulados", 0],
    ["Excedente Ingresos s/Egresos del ejercicio", 8000],
    ["Total PATRIMONIO", 111000],
  ]);

  const reporte = reporteCambioPatrimonioDesdeSituaciones(actual, anterior);

  assert.equal(reporte.tipo, "cambio-patrimonio");
  assert.equal(reporte.periodo, 2025);
  assert.equal(reporte.periodoComparativo, 2024);
  assert.equal(reporte.filas.length, 5, "apertura, traslado, impuesto, resultado y totales");
  assert.ok(reporte.filas.every(item => item.valores?.length === 6), "cada fila trae las 6 columnas patrimoniales");

  assert.equal(fila(reporte, "Traslado a utilidades acumuladas").valores[2], 5000, "traslada la utilidad 2024 a Utilidades Acumuladas");
  assert.equal(fila(reporte, "Traslado a utilidades acumuladas").valores[4], -5000, "sale de la columna de Utilidad del Ejercicio al trasladarse");
  assert.equal(Math.abs(fila(reporte, "Pago de Impuesto IR").valores[2]), 0, "sin PAGO MINIMO DEFINITIVO el impuesto es cero");
  assert.equal(fila(reporte, "Utilidades del Ejercicio").valores[4], 8000, "utilidad del ejercicio actual (excedentes 2025)");

  const totales = fila(reporte, "Totales").valores;
  assert.equal(totales[2], -15000, "Utilidades Acumuladas calculada: -20000 + 5000 trasladado");
  assert.equal(totales[5], 111000, "Total = suma de las 5 columnas patrimoniales");

  assert.ok(reporte.validacion, "el ECP se autovalida contra el cierre del Estado de Situación Financiera");
  assert.equal(reporte.validacion.conciliado, true, "los totales calculados coinciden con lo que reporta el ESF al cierre actual");
  assert.ok(reporte.validacion.diferencias.every(item => Math.abs(item.diferencia) < 0.01));
});

test("una diferencia contra el cierre del ESF se advierte con conciliado:false, no se oculta", () => {
  const anterior = situacion("2024-12", [
    ["Patrimonio Iglesia Universal del Reino de Dios", 100000],
    ["Patrimonio Donado", 10000],
    ["Utilidades Acumuladas", -20000],
    ["Incremento o Decremento por Revaluacion de Activos", 8000],
    ["Excedente Ingresos s/Egresos acumulados", 0],
    ["Excedente Ingresos s/Egresos del ejercicio", 5000],
  ]);
  // Utilidades Acumuladas del cierre actual no cuadra con el traslado esperado (hay un ajuste de
  // -3000 que el sistema no puede explicar por sí solo).
  const actual = situacion("2025-12", [
    ["Patrimonio Iglesia Universal del Reino de Dios", 100000],
    ["Patrimonio Donado", 10000],
    ["Utilidades Acumuladas", -18000],
    ["Incremento o Decremento por Revaluacion de Activos", 8000],
    ["Excedente Ingresos s/Egresos acumulados", 0],
    ["Excedente Ingresos s/Egresos del ejercicio", 8000],
    ["Total PATRIMONIO", 111000],
  ]);

  const reporte = reporteCambioPatrimonioDesdeSituaciones(actual, anterior);
  assert.equal(reporte.validacion.conciliado, false);
  const diferenciaUA = reporte.validacion.diferencias.find(item => item.concepto === "Utilidades acumuladas");
  assert.equal(diferenciaUA.calculado, -15000);
  assert.equal(diferenciaUA.estadoFinanciero, -18000);
  assert.equal(diferenciaUA.diferencia, 3000);
});

test("el pago de IR del ejercicio anterior (PAGO MINIMO DEFINITIVO) se resta en Utilidades Acumuladas y en el Total", () => {
  // NOTA: esta línea es una hipótesis de trabajo sin confirmar con contabilidad (ver comentario en
  // reporteCambioPatrimonioDesdeSituaciones); esta prueba solo verifica el cálculo, no que el
  // concepto sea correcto contablemente.
  const anterior = situacion("2024-12", [
    ["Patrimonio Iglesia Universal del Reino de Dios", 100000],
    ["Patrimonio Donado", 10000],
    ["Utilidades Acumuladas", -20000],
    ["Incremento o Decremento por Revaluacion de Activos", 8000],
    ["Excedente Ingresos s/Egresos acumulados", 0],
    ["Excedente Ingresos s/Egresos del ejercicio", 5000],
    ["PAGO MINIMO DEFINITIVO", 1200],
  ]);
  const actual = situacion("2025-12", [
    ["Patrimonio Iglesia Universal del Reino de Dios", 100000],
    ["Patrimonio Donado", 10000],
    ["Utilidades Acumuladas", -16200],
    ["Incremento o Decremento por Revaluacion de Activos", 8000],
    ["Excedente Ingresos s/Egresos acumulados", 0],
    ["Excedente Ingresos s/Egresos del ejercicio", 8000],
    ["Total PATRIMONIO", 109800],
  ]);

  const reporte = reporteCambioPatrimonioDesdeSituaciones(actual, anterior);
  const impuesto = fila(reporte, "Pago de Impuesto IR").valores;
  assert.equal(impuesto[2], -1200, "columna Utilidades acumuladas: -saldo de PAGO MINIMO DEFINITIVO");
  assert.equal(impuesto[5], -1200, "columna Total: mismo efecto, arrastra el impuesto");

  const totales = fila(reporte, "Totales").valores;
  assert.equal(totales[2], -16200, "-20000 + 5000 trasladado - 1200 de impuesto");
  assert.equal(reporte.validacion.conciliado, true, "el ECP reconstruye exacto el cierre cuando se incluye el ajuste de IR");
});

test("saldos inicial + movimientos (traslado + impuesto + resultado) reconstruyen exacto cada columna del total", () => {
  const anterior = situacion("2024-12", [
    ["Patrimonio Iglesia Universal del Reino de Dios", 100000],
    ["Patrimonio Donado", 10000],
    ["Utilidades Acumuladas", -20000],
    ["Incremento o Decremento por Revaluacion de Activos", 8000],
    ["Excedente Ingresos s/Egresos acumulados", 0],
    ["Excedente Ingresos s/Egresos del ejercicio", 5000],
  ]);
  const actual = situacion("2025-12", [
    ["Patrimonio Iglesia Universal del Reino de Dios", 105000],
    ["Patrimonio Donado", 12000],
    ["Utilidades Acumuladas", -15000],
    ["Incremento o Decremento por Revaluacion de Activos", 9200],
    ["Excedente Ingresos s/Egresos acumulados", 0],
    ["Excedente Ingresos s/Egresos del ejercicio", 8000],
  ]);

  const reporte = reporteCambioPatrimonioDesdeSituaciones(actual, anterior);
  const apertura = fila(reporte, "Saldos al 31/12").valores;
  const traslado = fila(reporte, "Traslado a utilidades acumuladas").valores;
  const impuesto = fila(reporte, "Pago de Impuesto IR").valores;
  const resultado = fila(reporte, "Utilidades del Ejercicio").valores;
  const totales = fila(reporte, "Totales").valores;
  for (let indice = 0; indice < 6; indice += 1) {
    const reconstruido = Math.round((apertura[indice] + traslado[indice] + impuesto[indice] + resultado[indice] + Number.EPSILON) * 100) / 100;
    assert.equal(reconstruido, totales[indice], `columna ${indice}: apertura + movimientos debe reconstruir el total, por construcción`);
  }
});
