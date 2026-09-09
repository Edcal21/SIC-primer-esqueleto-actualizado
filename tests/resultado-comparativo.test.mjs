import assert from "node:assert/strict";
import test from "node:test";
import { reporteBalanza } from "../lib/reportes.ts";

/**
 * reporteBalanza no tenía ninguna prueba (ni "resultado-comparativo" ni "balanza-anual") antes de
 * esta sesión, y por eso un bug real de doble conteo pasó desapercibido: sumar todas las filas de
 * una clase contable por prefijo de código, sin distinguir cuenta de mayor de cuenta de detalle,
 * multiplica el total tantas veces como niveles de jerarquía tenga el catálogo. Las cifras son
 * sintéticas, pero la forma jerárquica (mayor → sub-mayor → detalle) reproduce la balanza real de
 * la institución.
 */
const balanza = (periodo, cuentas) => ({
  periodo,
  filas: cuentas.map(([codigo, concepto, saldo]) => ({ codigo, concepto, debe: 0, haber: 0, saldo })),
});

const linea = (reporte, concepto) => reporte.filas.find(fila => fila.concepto === `Total ${concepto}`)?.actual;

test("resultado-comparativo suma solo cuentas de detalle, no las de mayor que repiten el total", () => {
  const anterior = balanza("2024-12", [
    ["40000000", "INGRESOS", 50000],
    ["41000000", "INGRESOS / DIEZMOS Y OFRENDAS", 50000],
    ["41010000", "DIEZMOS / OFRENDAS", 50000],
    ["41010101", "Diezmos Iglesia Sede Nacional", 30000],
    ["41010102", "Diezmos Iglesia Bello Horizonte", 20000],
    ["50000000", "GASTOS OPERATIVOS", 45000],
    ["51000000", "GASTOS DE OPERACION", 45000],
    ["51010101", "Gastos de personal", 45000],
  ]);
  const actual = balanza("2025-12", [
    ["40000000", "INGRESOS", 60000],
    ["41000000", "INGRESOS / DIEZMOS Y OFRENDAS", 60000],
    ["41010000", "DIEZMOS / OFRENDAS", 60000],
    ["41010101", "Diezmos Iglesia Sede Nacional", 38000],
    ["41010102", "Diezmos Iglesia Bello Horizonte", 22000],
    ["50000000", "GASTOS OPERATIVOS", 50000],
    ["51000000", "GASTOS DE OPERACION", 50000],
    ["51010101", "Gastos de personal", 50000],
  ]);

  const reporte = reporteBalanza("resultado-comparativo", actual, anterior, "2025", "2024");
  assert.equal(linea(reporte, "ingreso"), 60000, "no debe sumar los tres niveles de mayor del ingreso");
  assert.equal(linea(reporte, "gasto"), 50000, "no debe sumar los dos niveles de mayor del gasto");

  // Las filas de detalle (hojas) sí deben listarse una por una para el detalle del reporte.
  const codigosListados = reporte.filas.map(fila => fila.codigo).filter(Boolean);
  assert.ok(codigosListados.includes("41010101"));
  assert.ok(codigosListados.includes("41010102"));
  assert.ok(!codigosListados.includes("40000000"), "la cuenta de mayor no debe listarse como detalle");
  assert.ok(!codigosListados.includes("41000000"), "el sub-mayor tampoco debe listarse como detalle");
});

test("balanza-anual lista todas las cuentas sin filtrar por detalle (es un volcado completo)", () => {
  const actual = balanza("2025-12", [
    ["40000000", "INGRESOS", 60000],
    ["41000000", "INGRESOS / DIEZMOS Y OFRENDAS", 60000],
  ]);
  const reporte = reporteBalanza("balanza-anual", actual, null, "2025", "2024");
  assert.equal(reporte.filas.length, 3, "las 2 cuentas más la fila Total");
});
