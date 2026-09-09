// Pruebas de comportamiento del cierre contable contra PostgreSQL real. Requieren
// SIC_TEST_DATABASE_URL apuntando a una base desechable ya migrada (ver `pnpm test:db`).
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.ts";
import {
  abrirPeriodo,
  cerrarPeriodo,
  impactoDeReapertura,
  impedimentosParaCerrar,
  obtenerPeriodo,
  periodoAnterior,
  primerPeriodoCerrado,
  reabrirPeriodo,
  validarCierreSecuencial,
  verificarPeriodosAbiertos,
} from "../lib/periodos.ts";

if (!process.env.SIC_TEST_DATABASE_URL) throw new Error("Configure SIC_TEST_DATABASE_URL con una BD desechable migrada");
process.env.DATABASE_URL = process.env.SIC_TEST_DATABASE_URL;

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

const ADMIN = { id: "usr-admin", nombre: "Administrador del Sistema" };
const PREFIJO = "TSTPER-";
const CUENTA = `${PREFIJO}NIO`;
const IGLESIA = "TSTPER01";
const CERRADO = "2026-03";
const ABIERTO = "2026-04";
const CON_PENDIENTES = "2026-05";
const CON_DIFERENCIAS = "2026-06";

async function limpiar() {
  const reportes = await db.select({ id: schema.reportesBancarios.id }).from(schema.reportesBancarios).where(eq(schema.reportesBancarios.cuentaBancariaNumero, CUENTA));
  for (const reporte of reportes) {
    await db.delete(schema.conciliacionesBancarias).where(eq(schema.conciliacionesBancarias.reporteId, reporte.id));
    await db.delete(schema.lineasReporteBancario).where(eq(schema.lineasReporteBancario.reporteId, reporte.id));
  }
  await db.delete(schema.reportesBancarios).where(eq(schema.reportesBancarios.cuentaBancariaNumero, CUENTA));
  await db.delete(schema.movimientosCuentas).where(eq(schema.movimientosCuentas.cuentaBancariaNumero, CUENTA));
  await db.delete(schema.cuentasBancarias).where(eq(schema.cuentasBancarias.numeroCuenta, CUENTA));
  await db.delete(schema.iglesias).where(eq(schema.iglesias.codigo, IGLESIA));
  for (const periodo of [CERRADO, ABIERTO, CON_PENDIENTES, CON_DIFERENCIAS]) {
    await db.delete(schema.importacionesBalanza).where(eq(schema.importacionesBalanza.periodo, periodo));
    await db.delete(schema.importacionesSituacionFinanciera).where(eq(schema.importacionesSituacionFinanciera.periodo, periodo));
    await db.delete(schema.periodosContables).where(eq(schema.periodosContables.periodo, periodo));
  }
}

before(async () => {
  await limpiar();
  await db.insert(schema.iglesias).values({ codigo: IGLESIA, nombre: "Iglesia de prueba de períodos" });
  await db.insert(schema.cuentasBancarias).values({ numeroCuenta: CUENTA, nombre: "Cuenta de prueba de períodos", moneda: "NIO" });
  await abrirPeriodo(db, CERRADO);
  await cerrarPeriodo(db, CERRADO, ADMIN);
  await abrirPeriodo(db, ABIERTO);
});

after(async () => {
  await limpiar();
  await client.end({ timeout: 1 });
});

test("un período cerrado bloquea cualquier fecha que caiga dentro de él", async () => {
  assert.equal(await primerPeriodoCerrado(db, [CERRADO]), CERRADO);

  const bloqueo = await verificarPeriodosAbiertos(db, ["2026-03-15"]);
  assert.ok(bloqueo, "una fecha de marzo debe quedar bloqueada");
  assert.equal(bloqueo.periodo, CERRADO);
  assert.match(bloqueo.mensaje, /cerrado/);
});

test("un período abierto o nunca administrado no bloquea nada", async () => {
  assert.equal(await verificarPeriodosAbiertos(db, ["2026-04-15"]), null, "abierto explícitamente");
  assert.equal(await verificarPeriodosAbiertos(db, ["2019-07-15"]), null, "nunca administrado = abierto");
  assert.equal(await verificarPeriodosAbiertos(db, [null]), null, "sin fecha no toca ningún período");
});

test("una operación que cruza meses se bloquea si cualquiera de ellos está cerrado", async () => {
  // Caso real: un estado de cuenta que va del 25 de marzo al 5 de abril.
  const bloqueo = await verificarPeriodosAbiertos(db, ["2026-03-25", "2026-04-05"]);
  assert.ok(bloqueo, "basta con que un mes esté cerrado");
  assert.equal(bloqueo.periodo, CERRADO);
});

test("el cierre contable exige cerrar primero el período anterior", async () => {
  assert.equal(periodoAnterior("2026-01"), "2025-12");
  assert.equal(periodoAnterior("2026-04"), "2026-03");
  assert.equal(await validarCierreSecuencial(db, ABIERTO), null, "marzo cerrado permite cerrar abril");

  const bloqueo = await validarCierreSecuencial(db, CON_PENDIENTES);
  assert.ok(bloqueo, "mayo no puede cerrar si abril sigue abierto");
  assert.equal(bloqueo.motivo, "Período anterior sin cerrar");
  assert.match(bloqueo.detalle, /2026-04/);
});

test("no se puede cerrar un período con conciliaciones en borrador o rechazadas", async () => {
  await abrirPeriodo(db, CON_PENDIENTES);
  const [reporte] = await db.insert(schema.reportesBancarios).values({
    nombre: "pendiente.csv", fecha: "2026-05-31", estado: "procesado", archivoTamano: 10,
    cargadoPor: ADMIN.id, cargadoPorNombre: ADMIN.nombre, cuentaBancariaNumero: CUENTA,
  }).returning();
  await db.insert(schema.conciliacionesBancarias).values({
    reporteId: reporte.id, cuentaBancariaNumero: CUENTA, periodo: CON_PENDIENTES, estado: "borrador", creadoPor: ADMIN.id,
  });

  const impedimentos = await impedimentosParaCerrar(db, CON_PENDIENTES);
  assert.equal(impedimentos.length, 1);
  assert.match(impedimentos[0].motivo, /sin aprobar/);

  // Rechazada tampoco deja cerrar.
  await db.update(schema.conciliacionesBancarias).set({ estado: "rechazada" }).where(eq(schema.conciliacionesBancarias.reporteId, reporte.id));
  const trasRechazo = await impedimentosParaCerrar(db, CON_PENDIENTES);
  assert.equal(trasRechazo.length, 1);
  assert.match(trasRechazo[0].motivo, /rechazadas/);

  // Aprobada sí libera el cierre.
  await db.update(schema.conciliacionesBancarias).set({ estado: "aprobada" }).where(eq(schema.conciliacionesBancarias.reporteId, reporte.id));
  assert.deepEqual(await impedimentosParaCerrar(db, CON_PENDIENTES), []);
});

test("no se puede cerrar un período con balanza importada con diferencias", async () => {
  await abrirPeriodo(db, CON_DIFERENCIAS);
  await db.insert(schema.importacionesBalanza).values({
    archivoNombre: "balanza-descuadrada.xlsx", archivoTamano: 100, periodo: CON_DIFERENCIAS,
    estado: "con_diferencias", totalLineas: 3, totalDebe: "100.00", totalHaber: "90.00", importadoPor: ADMIN.id,
  });

  const impedimentos = await impedimentosParaCerrar(db, CON_DIFERENCIAS);
  assert.equal(impedimentos.length, 1);
  assert.match(impedimentos[0].motivo, /diferencias/);
  assert.match(impedimentos[0].detalle, /balanza-descuadrada\.xlsx/);
});

test("un período sin pendientes no tiene impedimentos para cerrarse", async () => {
  assert.deepEqual(await impedimentosParaCerrar(db, ABIERTO), []);
});

test("cerrar registra quién y cuándo; reabrir exige motivo y lo conserva", async () => {
  const cerrado = await obtenerPeriodo(db, CERRADO);
  assert.equal(cerrado.estado, "cerrado");
  assert.equal(cerrado.cerradoPor, ADMIN.id);
  assert.equal(cerrado.cerradoPorNombre, ADMIN.nombre);
  assert.ok(cerrado.fechaCierre instanceof Date);

  const motivo = "Ajuste de auditoría externa solicitado por contabilidad";
  const reabierto = await reabrirPeriodo(db, CERRADO, ADMIN, motivo);
  assert.equal(reabierto.estado, "abierto", "reabrir devuelve el período a abierto");
  assert.equal(reabierto.motivoReapertura, motivo);
  assert.equal(reabierto.reabiertoPor, ADMIN.id);
  assert.ok(reabierto.reabiertoEn instanceof Date);

  // Y el candado efectivamente se levanta.
  assert.equal(await verificarPeriodosAbiertos(db, ["2026-03-15"]), null);
});

test("la reapertura no borra ni recalcula la información del período", async () => {
  // Encabezado y detalles van en la misma transacción: el trigger diferido de partida doble
  // valida al commit y rechazaría una minuta sin líneas.
  await db.transaction(async tx => {
    const [movimiento] = await tx.insert(schema.movimientosCuentas).values({
      fecha: "2026-04-10", iglesiaCodigo: IGLESIA, cuentaBancariaNumero: CUENTA,
      referencia: "PER-INTACTO", concepto: "Movimiento previo al cierre", creadoPor: ADMIN.id,
    }).returning();
    await tx.insert(schema.detallesMovimientos).values([
      { movimientoId: movimiento.id, tipo: "debito", cuentaCodigo: "10100002", cuentaNombre: "Banco NIO", monto: "250.00", moneda: "NIO", montoOriginal: "250.00", tasaCambio: "1", afectaCuentaBancaria: true, orden: 1 },
      { movimientoId: movimiento.id, tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: "250.00", moneda: "NIO", montoOriginal: "250.00", tasaCambio: "1", orden: 2 },
    ]);
  });
  const antes = await db.select().from(schema.movimientosCuentas).where(eq(schema.movimientosCuentas.referencia, "PER-INTACTO"));
  const detallesAntes = await db.select().from(schema.detallesMovimientos).where(eq(schema.detallesMovimientos.movimientoId, antes[0].id));

  await cerrarPeriodo(db, ABIERTO, ADMIN);
  await reabrirPeriodo(db, ABIERTO, ADMIN, "Reapertura para corregir una minuta mal clasificada");

  const despues = await db.select().from(schema.movimientosCuentas).where(eq(schema.movimientosCuentas.referencia, "PER-INTACTO"));
  const detallesDespues = await db.select().from(schema.detallesMovimientos).where(eq(schema.detallesMovimientos.movimientoId, antes[0].id));
  assert.deepEqual(despues, antes, "los movimientos del período quedan exactamente igual tras cerrar y reabrir");
  assert.deepEqual(detallesDespues, detallesAntes, "los importes y tasas del detalle tampoco se recalculan");
});

test("la reapertura advierte qué queda desactualizado sin bloquear la acción", async () => {
  // CERRADO = 2026-03; CON_PENDIENTES = 2026-05 y CON_DIFERENCIAS = 2026-06 son posteriores.
  await db.insert(schema.importacionesBalanza).values({
    archivoNombre: "balanza-marzo.xlsx", archivoTamano: 1024, periodo: CERRADO, estado: "procesado",
    totalLineas: 10, totalDebe: "100.00", totalHaber: "100.00", importadoPor: ADMIN.id,
  });
  await db.insert(schema.importacionesSituacionFinanciera).values({
    archivoNombre: "situacion-mayo.xlsx", archivoTamano: 512, periodo: CON_PENDIENTES,
    estado: "procesado", totalLineas: 5, importadoPor: ADMIN.id,
  });
  await cerrarPeriodo(db, CON_DIFERENCIAS, ADMIN);

  const impactos = await impactoDeReapertura(db, CERRADO);
  const motivos = impactos.map(item => item.motivo).join(" | ");

  assert.match(motivos, /Balanzas de comprobación/);
  assert.match(motivos, /Estados de situación financiera/);
  assert.match(motivos, /Períodos posteriores ya cerrados/);

  const posteriores = impactos.find(item => item.motivo.includes("Períodos posteriores"));
  assert.match(posteriores.detalle, new RegExp(CON_DIFERENCIAS));

  // La advertencia informa: la reapertura sigue siendo posible.
  const reabierto = await reabrirPeriodo(db, CERRADO, ADMIN, "Auditoría externa solicita reproceso");
  assert.equal(reabierto.estado, "abierto");

  // Un período sin nada posterior ni importado no genera advertencias.
  const sinImpacto = await impactoDeReapertura(db, "2099-12");
  assert.equal(sinImpacto.length, 0);
});
