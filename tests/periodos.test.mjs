import assert from "node:assert/strict";
import test from "node:test";
import {
  esPeriodoValido,
  mensajePeriodoCerrado,
  MOTIVO_REAPERTURA_MINIMO,
  periodoDeFecha,
  periodosDeFechas,
  permiteEscritura,
} from "../lib/periodos.ts";

test("deriva el período contable de una fecha", () => {
  assert.equal(periodoDeFecha("2026-09-07"), "2026-09");
  assert.equal(periodoDeFecha("2026-01-31"), "2026-01");
  assert.equal(periodoDeFecha("2026-12-01"), "2026-12");
});

test("rechaza fechas de las que no se puede derivar un período válido", () => {
  assert.throws(() => periodoDeFecha("2026-13-01"), /período contable/);
  assert.throws(() => periodoDeFecha("2026-00-01"), /período contable/);
  assert.throws(() => periodoDeFecha("no es fecha"), /período contable/);
});

test("valida el formato YYYY-MM", () => {
  assert.equal(esPeriodoValido("2026-09"), true);
  assert.equal(esPeriodoValido("2026-12"), true);
  assert.equal(esPeriodoValido("2026-13"), false);
  assert.equal(esPeriodoValido("2026-00"), false);
  assert.equal(esPeriodoValido("2026-9"), false);
  assert.equal(esPeriodoValido("202609"), false);
});

test("agrupa fechas en períodos distintos, ordenados y sin repetir", () => {
  const periodos = periodosDeFechas(["2026-09-30", "2026-10-01", "2026-09-07", null, undefined, "2026-08-15"]);
  assert.deepEqual(periodos, ["2026-08", "2026-09", "2026-10"]);
});

test("un estado de cuenta sin fechas no toca ningún período", () => {
  assert.deepEqual(periodosDeFechas([null, undefined]), []);
});

test("solo el estado cerrado bloquea la escritura", () => {
  assert.equal(permiteEscritura({ estado: "abierto" }), true);
  assert.equal(permiteEscritura({ estado: "revision" }), true, "revisión señala, no bloquea");
  assert.equal(permiteEscritura({ estado: "cerrado" }), false);
});

test("un período nunca administrado se considera abierto", () => {
  // La migración nace vacía: los períodos anteriores al módulo no deben quedar bloqueados.
  assert.equal(permiteEscritura(null), true);
  assert.equal(permiteEscritura(undefined), true);
});

test("el mensaje de bloqueo nombra el período y explica cómo desbloquearlo", () => {
  const mensaje = mensajePeriodoCerrado("2026-09");
  assert.match(mensaje, /2026-09/);
  assert.match(mensaje, /reabrirlo/);
  assert.match(mensaje, /motivo/);
});

test("el motivo de reapertura exige al menos 15 caracteres", () => {
  assert.equal(MOTIVO_REAPERTURA_MINIMO, 15);
});
