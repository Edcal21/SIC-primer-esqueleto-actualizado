// Pruebas de comportamiento de obtenerEstadoRespaldos contra PostgreSQL real. Requieren
// SIC_TEST_DATABASE_URL apuntando a una base desechable ya migrada (ver `pnpm test:db`).
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.ts";
import { obtenerEstadoRespaldos } from "../lib/respaldo.ts";

if (!process.env.SIC_TEST_DATABASE_URL) throw new Error("Configure SIC_TEST_DATABASE_URL con una BD desechable migrada");
process.env.DATABASE_URL = process.env.SIC_TEST_DATABASE_URL;

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

async function limpiar() {
  await db.delete(schema.respaldosSistema);
}

const horasAtras = (horas) => new Date(Date.now() - horas * 3_600_000);

const evento = (overrides = {}) => ({
  iniciadoEn: horasAtras(1),
  finalizadoEn: horasAtras(1),
  estado: "correcto",
  modo: "programado",
  archivo: "sic-prueba.dump",
  tamanoBytes: "12345",
  duracionSegundos: 3,
  copiaSecundariaOk: true,
  servidor: "test",
  mensaje: null,
  ...overrides,
});

before(limpiar);
after(async () => { await limpiar(); await client.end({ timeout: 1 }); });

test("sin ningún registro, el estado es sin_datos (no se confunde con al_dia)", async () => {
  await limpiar();
  const estado = await obtenerEstadoRespaldos(db);
  assert.equal(estado.salud, "sin_datos");
  assert.equal(estado.ultimoCorrecto, null);
});

test("un respaldo correcto de hace 2 horas se lee como al_dia", async () => {
  await limpiar();
  await db.insert(schema.respaldosSistema).values(evento({ iniciadoEn: horasAtras(2), finalizadoEn: horasAtras(2) }));
  const estado = await obtenerEstadoRespaldos(db);
  assert.equal(estado.salud, "al_dia");
  assert.ok(estado.ultimoCorrecto);
});

test("un respaldo correcto de hace 30 horas se lee como atrasado, no crítico", async () => {
  await limpiar();
  await db.insert(schema.respaldosSistema).values(evento({ iniciadoEn: horasAtras(30), finalizadoEn: horasAtras(30) }));
  const estado = await obtenerEstadoRespaldos(db);
  assert.equal(estado.salud, "atrasado");
});

test("un respaldo correcto de hace 60 horas se lee como crítico", async () => {
  await limpiar();
  await db.insert(schema.respaldosSistema).values(evento({ iniciadoEn: horasAtras(60), finalizadoEn: horasAtras(60) }));
  const estado = await obtenerEstadoRespaldos(db);
  assert.equal(estado.salud, "critico");
});

test("el intento más reciente en error marca crítico aunque haya un correcto más viejo", async () => {
  await limpiar();
  await db.insert(schema.respaldosSistema).values([
    evento({ iniciadoEn: horasAtras(24), finalizadoEn: horasAtras(24) }),
    evento({ iniciadoEn: horasAtras(1), finalizadoEn: horasAtras(1), estado: "error", mensaje: "conexión rechazada", tamanoBytes: null }),
  ]);
  const estado = await obtenerEstadoRespaldos(db);
  assert.equal(estado.salud, "critico");
  assert.ok(estado.ultimoCorrecto, "debe seguir reportando cuál fue el último correcto, para saber qué tan atrás quedó");
});

test("todos los intentos en error, sin ningún correcto, es crítico y ultimoCorrecto es null", async () => {
  await limpiar();
  await db.insert(schema.respaldosSistema).values(evento({ estado: "error", tamanoBytes: null, mensaje: "disco lleno" }));
  const estado = await obtenerEstadoRespaldos(db);
  assert.equal(estado.salud, "critico");
  assert.equal(estado.ultimoCorrecto, null);
});

test("devuelve como máximo los 20 eventos más recientes, ordenados del más nuevo al más viejo", async () => {
  await limpiar();
  const filas = Array.from({ length: 25 }, (_, indice) => evento({ iniciadoEn: horasAtras(indice), finalizadoEn: horasAtras(indice), archivo: `sic-${indice}.dump` }));
  await db.insert(schema.respaldosSistema).values(filas);
  const estado = await obtenerEstadoRespaldos(db);
  assert.equal(estado.recientes.length, 20);
  assert.equal(estado.recientes[0].archivo, "sic-0.dump");
  assert.ok(estado.recientes[0].iniciadoEn.getTime() > estado.recientes[1].iniciadoEn.getTime());
});
