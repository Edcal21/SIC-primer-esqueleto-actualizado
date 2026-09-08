// Pruebas de comportamiento contra una base PostgreSQL real (no búsquedas de texto). Requieren
// DATABASE_URL configurado (ver .dev.vars); se documentan como suite separada (`pnpm test:db`)
// porque, a diferencia del resto de `pnpm test`, necesitan una base de datos disponible.
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import test, { after, before } from "node:test";
import * as schema from "../db/schema.ts";
import {
  autoConciliar,
  completarLineasPendientesDeTasa,
  construirLineasConMoneda,
  estaPendienteDeTasa,
  movimientosConciliables,
  recalcularConciliacion,
} from "../lib/banco.ts";
import { construirDetallesMovimiento } from "../lib/movimientos.ts";
import { actualizarTasa, crearTasa, obtenerTasaVigente } from "../lib/tasas.ts";
import { tieneMovimientosIncompatibles } from "../lib/cuentasBancarias.ts";

// Nunca tomar la base operativa de .dev.vars para una suite que inserta y borra.
if (!process.env.SIC_TEST_DATABASE_URL) throw new Error("Configure SIC_TEST_DATABASE_URL con una BD desechable migrada");
process.env.DATABASE_URL = process.env.SIC_TEST_DATABASE_URL;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está configurado; estas pruebas requieren una base PostgreSQL de pruebas (ver .dev.vars.example).");
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

const USUARIO_ADMIN = "usr-admin";
const PREFIJO = "TST-USD-";
const CUENTA_USD = `${PREFIJO}A`;
const CUENTA_USD_B = `${PREFIJO}B`;
const CUENTA_NIO = `${PREFIJO}NIO`;
const IGLESIA = "TSTUSD01";

async function limpiar() {
  const cuentas = await db.select({ numeroCuenta: schema.cuentasBancarias.numeroCuenta }).from(schema.cuentasBancarias);
  const propias = cuentas.map(c => c.numeroCuenta).filter(numero => numero.startsWith(PREFIJO));
  for (const numeroCuenta of propias) {
    const reportes = await db.select({ id: schema.reportesBancarios.id }).from(schema.reportesBancarios).where(eq(schema.reportesBancarios.cuentaBancariaNumero, numeroCuenta));
    for (const reporte of reportes) {
      await db.delete(schema.conciliacionesBancarias).where(eq(schema.conciliacionesBancarias.reporteId, reporte.id));
      await db.delete(schema.lineasReporteBancario).where(eq(schema.lineasReporteBancario.reporteId, reporte.id));
    }
    await db.delete(schema.reportesBancarios).where(eq(schema.reportesBancarios.cuentaBancariaNumero, numeroCuenta));
    // Se borra movimientos_cuentas directamente: el ON DELETE CASCADE arrastra sus detalles en el
    // mismo comando, así que el trigger diferido de partida doble encuentra el encabezado ya
    // ausente al validar (y se omite) en vez de ver una minuta con menos de dos líneas.
    await db.delete(schema.movimientosCuentas).where(eq(schema.movimientosCuentas.cuentaBancariaNumero, numeroCuenta));
    await db.delete(schema.cuentasBancarias).where(eq(schema.cuentasBancarias.numeroCuenta, numeroCuenta));
  }
  await db.delete(schema.tasasCambio).where(eq(schema.tasasCambio.fuente, "prueba-automatizada"));
  await db.delete(schema.iglesias).where(eq(schema.iglesias.codigo, IGLESIA));
}

before(async () => {
  await limpiar();
  await db.insert(schema.iglesias).values({ codigo: IGLESIA, nombre: "Iglesia de prueba" });
  await db.insert(schema.cuentasBancarias).values([
    { numeroCuenta: CUENTA_USD, nombre: "Cuenta USD de prueba A", moneda: "USD" },
    { numeroCuenta: CUENTA_USD_B, nombre: "Cuenta USD de prueba B", moneda: "USD" },
    { numeroCuenta: CUENTA_NIO, nombre: "Cuenta NIO de prueba", moneda: "NIO" },
  ]);
});

after(async () => {
  await limpiar();
  await client.end({ timeout: 1 });
});

async function crearMovimientoUsd(fecha, montoOriginalUsd, tasa, referencia) {
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "10100001", cuentaNombre: "Banco USD", afectaCuentaBancaria: true, montoOriginal: montoOriginalUsd },
      { tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: (() => {
        // El equivalente NIO se calcula igual que la línea marcada, para mantener la partida doble.
        const [entero, decimales = "00"] = montoOriginalUsd.split(".");
        return (Number(`${entero}.${decimales}`) * Number(tasa)).toFixed(2);
      })() },
    ],
    { cuentaBancariaMoneda: "USD", tasaUsd: { tasa } },
  );
  assert.equal(resultado.ok, true, resultado.ok ? "" : resultado.error);
  if (!resultado.ok) throw new Error(resultado.error);

  return db.transaction(async tx => {
    const [movimiento] = await tx.insert(schema.movimientosCuentas).values({
      fecha, iglesiaCodigo: IGLESIA, cuentaBancariaNumero: CUENTA_USD, referencia, concepto: `Prueba ${referencia}`, creadoPor: USUARIO_ADMIN,
    }).returning();
    await tx.insert(schema.detallesMovimientos).values(resultado.detalles.map(detalle => ({ ...detalle, movimientoId: movimiento.id })));
    return movimiento;
  });
}

test("USD 100 x tasa 36.50 se persiste como NIO 3650.00 en la línea que afecta el banco", async () => {
  const movimiento = await crearMovimientoUsd("2026-01-10", "100.00", "36.500000", "REF-100-A");
  const detalles = await db.select().from(schema.detallesMovimientos).where(eq(schema.detallesMovimientos.movimientoId, movimiento.id));
  const banco = detalles.find(detalle => detalle.afectaCuentaBancaria);
  assert.equal(banco.moneda, "USD");
  assert.equal(banco.montoOriginal, "100.00");
  assert.equal(banco.tasaCambio, "36.500000");
  assert.equal(banco.monto, "3650.00");
});

test("dos movimientos de USD 100 con tasas distintas concilian cada uno por USD 100 exactos", async () => {
  // El catálogo también debe tener la tasa de cada fecha: es lo que usa construirLineasConMoneda
  // para resolver el equivalente NIO de las líneas del estado de cuenta (nunca una tasa única).
  await crearTasa(db, { fecha: "2026-01-11", tasa: "36.500000", fuente: "prueba-automatizada", usuarioId: USUARIO_ADMIN });
  await crearTasa(db, { fecha: "2026-01-12", tasa: "37.100000", fuente: "prueba-automatizada", usuarioId: USUARIO_ADMIN });
  const movimientoA = await crearMovimientoUsd("2026-01-11", "100.00", "36.500000", "REF-100-B");
  const movimientoB = await crearMovimientoUsd("2026-01-12", "100.00", "37.100000", "REF-100-C");

  const [reporte] = await db.insert(schema.reportesBancarios).values({
    nombre: "estado-prueba.csv", fecha: "2026-01-12", estado: "procesado", archivoTamano: 10,
    cargadoPor: USUARIO_ADMIN, cargadoPorNombre: "Administrador", cuentaBancariaNumero: CUENTA_USD,
    periodoInicio: "2026-01-11", periodoFin: "2026-01-12", totalLineas: 2, totalDebitos: "0", totalCreditos: "200.00",
  }).returning();

  const lineasCrudas = [
    { numeroLinea: 1, fecha: "2026-01-11", referencia: "REF-100-B", descripcion: "Depósito", debito: "0.00", credito: "100.00", saldo: null },
    { numeroLinea: 2, fecha: "2026-01-12", referencia: "REF-100-C", descripcion: "Depósito", debito: "0.00", credito: "100.00", saldo: null },
  ];
  const lineasConMoneda = await construirLineasConMoneda(db, lineasCrudas, "USD");
  assert.ok(lineasConMoneda.every(linea => linea.tasaCambio !== null), "ambas líneas deben resolver tasa por su propia fecha");
  await db.insert(schema.lineasReporteBancario).values(lineasConMoneda.map(linea => ({ ...linea, reporteId: reporte.id })));

  const enlazadas = await autoConciliar(db, reporte.id, CUENTA_USD, USUARIO_ADMIN);
  assert.equal(enlazadas, 2, "cada línea de USD 100 debe enlazar con su propia minuta de USD 100, sin confundirse por el distinto equivalente en NIO");

  const [conciliacion] = await db.insert(schema.conciliacionesBancarias).values({
    reporteId: reporte.id, cuentaBancariaNumero: CUENTA_USD, periodo: "2026-01", creadoPor: USUARIO_ADMIN,
  }).returning();
  const totales = await recalcularConciliacion(db, conciliacion.id);
  assert.equal(totales.totalBanco, "200.00", "los totales de la conciliación quedan en la moneda original de la cuenta (USD), no convertidos con una tasa única");
  assert.equal(totales.totalConciliado, "200.00");
  assert.equal(totales.lineasConciliadas, 2);

  const lineasFinales = await db.select().from(schema.lineasReporteBancario).where(eq(schema.lineasReporteBancario.reporteId, reporte.id));
  const porMovimiento = new Map(lineasFinales.map(linea => [linea.movimientoId, linea]));
  assert.equal(porMovimiento.get(movimientoA.id).credito, "100.00");
  assert.equal(porMovimiento.get(movimientoB.id).credito, "100.00");
  assert.equal(porMovimiento.get(movimientoA.id).creditoNio, "3650.00");
  assert.equal(porMovimiento.get(movimientoB.id).creditoNio, "3710.00");
});

test("rechaza tasa ausente o inválida y bloquea el registro con error claro", async () => {
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "10100001", cuentaNombre: "Banco USD", afectaCuentaBancaria: true, montoOriginal: "50.00" },
      { tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: "1825.00" },
    ],
    { cuentaBancariaMoneda: "USD", tasaUsd: await obtenerTasaVigente(db, "2099-01-01") }, // fecha sin tasa registrada
  );
  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /Falta registrar la tasa de cambio/);

  await assert.rejects(() => crearTasa(db, { fecha: "2026-01-15", tasa: "0", fuente: "prueba-automatizada", usuarioId: USUARIO_ADMIN }));
  await assert.rejects(() => crearTasa(db, { fecha: "2026-01-15", tasa: "-3", fuente: "prueba-automatizada", usuarioId: USUARIO_ADMIN }));
  await assert.rejects(() => crearTasa(db, { fecha: "2026-01-15", tasa: "abc", fuente: "prueba-automatizada", usuarioId: USUARIO_ADMIN }));
});

test("moneda incompatible: no se puede cambiar la moneda de una cuenta con movimientos", async () => {
  await crearMovimientoUsd("2026-01-13", "10.00", "36.500000", "REF-BLOQUEO");
  assert.equal(await tieneMovimientosIncompatibles(db, CUENTA_USD), true);
  assert.equal(await tieneMovimientosIncompatibles(db, CUENTA_USD_B), false, "una cuenta sin movimientos sí puede cambiar de moneda");
});

test("redondeo y partida doble: la base de datos rechaza un monto que no cuadra con importe original x tasa", async () => {
  let error = null;
  try {
    await db.transaction(async tx => {
      const [movimiento] = await tx.insert(schema.movimientosCuentas).values({
        fecha: "2026-01-14", iglesiaCodigo: IGLESIA, cuentaBancariaNumero: CUENTA_USD, referencia: "REF-CHECK", concepto: "Prueba de restricción", creadoPor: USUARIO_ADMIN,
      }).returning();
      await tx.insert(schema.detallesMovimientos).values([
        { movimientoId: movimiento.id, tipo: "debito", cuentaCodigo: "10100001", cuentaNombre: "Banco USD", monto: "999.99", afectaCuentaBancaria: true, moneda: "USD", montoOriginal: "100.00", tasaCambio: "36.500000", orden: 1 },
        { movimientoId: movimiento.id, tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: "999.99", moneda: "NIO", montoOriginal: "999.99", tasaCambio: "1", orden: 2 },
      ]);
    });
  } catch (cause) {
    error = cause;
  }
  assert.ok(error, "debe rechazar el monto que no cuadra con importeOriginal x tasa");
  assert.equal(error.cause?.constraint_name ?? error.cause?.code, "ck_detalles_movimientos_conversion");

  // La misma minuta, pero cuadrada (monto = round(montoOriginal x tasaCambio, 2)), sí se acepta.
  await db.transaction(async tx => {
    const [movimiento] = await tx.insert(schema.movimientosCuentas).values({
      fecha: "2026-01-14", iglesiaCodigo: IGLESIA, cuentaBancariaNumero: CUENTA_USD, referencia: "REF-CHECK-OK", concepto: "Prueba de restricción cuadrada", creadoPor: USUARIO_ADMIN,
    }).returning();
    await tx.insert(schema.detallesMovimientos).values([
      { movimientoId: movimiento.id, tipo: "debito", cuentaCodigo: "10100001", cuentaNombre: "Banco USD", monto: "3650.00", afectaCuentaBancaria: true, moneda: "USD", montoOriginal: "100.00", tasaCambio: "36.500000", orden: 1 },
      { movimientoId: movimiento.id, tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: "3650.00", moneda: "NIO", montoOriginal: "3650.00", tasaCambio: "1", orden: 2 },
    ]);
  });
});

test("históricos USD incompletos (sin tasa) quedan pendientes y bloqueados para enlace automático", async () => {
  const [reporte] = await db.insert(schema.reportesBancarios).values({
    nombre: "historico.csv", fecha: "2026-01-16", estado: "procesado", archivoTamano: 5,
    cargadoPor: USUARIO_ADMIN, cargadoPorNombre: "Administrador", cuentaBancariaNumero: CUENTA_USD,
    periodoInicio: "2026-01-16", periodoFin: "2026-01-16", totalLineas: 1, totalDebitos: "0", totalCreditos: "25.00",
  }).returning();
  // Simula el estado que deja la migración para una línea histórica: moneda conocida, tasa nula.
  const [lineaPendiente] = await db.insert(schema.lineasReporteBancario).values({
    reporteId: reporte.id, numeroLinea: 1, fecha: "2026-01-16", referencia: "HIST-1", descripcion: "Depósito histórico sin tasa",
    debito: "0.00", credito: "25.00", moneda: "USD", tasaCambio: null,
  }).returning();
  assert.equal(estaPendienteDeTasa(lineaPendiente), true);

  await crearMovimientoUsd("2026-01-16", "25.00", "36.800000", "HIST-1");
  const enlazadas = await autoConciliar(db, reporte.id, CUENTA_USD, USUARIO_ADMIN);
  assert.equal(enlazadas, 0, "una línea USD pendiente de tasa nunca se enlaza automáticamente, aunque el monto coincida");

  const [linea] = await db.select().from(schema.lineasReporteBancario).where(eq(schema.lineasReporteBancario.id, lineaPendiente.id));
  assert.equal(linea.estadoConciliacion, "pendiente");
  assert.equal(linea.movimientoId, null);

  // Al registrar la tasa del día en el catálogo, la línea se completa (nunca se infiere: se toma del catálogo real).
  await crearTasa(db, { fecha: "2026-01-16", tasa: "36.800000", fuente: "prueba-automatizada", usuarioId: USUARIO_ADMIN });
  const completadas = await completarLineasPendientesDeTasa(db, reporte.id);
  assert.equal(completadas, 1);
  const [lineaCompleta] = await db.select().from(schema.lineasReporteBancario).where(eq(schema.lineasReporteBancario.id, lineaPendiente.id));
  assert.equal(estaPendienteDeTasa(lineaCompleta), false);
  assert.equal(lineaCompleta.creditoNio, "920.00"); // 25.00 * 36.80

  const enlazadasAhora = await autoConciliar(db, reporte.id, CUENTA_USD, USUARIO_ADMIN);
  assert.equal(enlazadasAhora, 1, "una vez completa la tasa, la línea sí puede enlazarse automáticamente");
});

test("cambiar el catálogo de tasas no recalcula movimientos ya registrados", async () => {
  const tasaOriginal = await crearTasa(db, { fecha: "2026-01-18", tasa: "37.000000", fuente: "prueba-automatizada", usuarioId: USUARIO_ADMIN });
  const movimiento = await crearMovimientoUsd("2026-01-18", "40.00", "37.000000", "REF-INMUTABLE");

  await actualizarTasa(db, tasaOriginal.id, { tasa: "50.000000", usuarioId: USUARIO_ADMIN });

  const [detalle] = await db.select().from(schema.detallesMovimientos).where(and(eq(schema.detallesMovimientos.movimientoId, movimiento.id), eq(schema.detallesMovimientos.afectaCuentaBancaria, true)));
  assert.equal(detalle.tasaCambio, "37.000000", "la tasa aplicada en el momento del registro no cambia con el catálogo");
  assert.equal(detalle.monto, "1480.00"); // 40.00 x 37.00, no 40.00 x 50.00
});

test("regresión NIO: una minuta en córdobas conserva tasa 1 y su importe original es igual al monto contable", async () => {
  const resultado = construirDetallesMovimiento(
    [
      { tipo: "debito", cuentaCodigo: "10100002", cuentaNombre: "Banco NIO", afectaCuentaBancaria: true, monto: "850.00" },
      { tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: "850.00" },
    ],
    { cuentaBancariaMoneda: "NIO", tasaUsd: null },
  );
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  await db.transaction(async tx => {
    const [movimiento] = await tx.insert(schema.movimientosCuentas).values({
      fecha: "2026-01-19", iglesiaCodigo: IGLESIA, cuentaBancariaNumero: CUENTA_NIO, referencia: "REF-NIO-1", concepto: "Prueba NIO", creadoPor: USUARIO_ADMIN,
    }).returning();
    await tx.insert(schema.detallesMovimientos).values(resultado.detalles.map(detalle => ({ ...detalle, movimientoId: movimiento.id })));
  });

  const [conciliable] = await movimientosConciliables(db, CUENTA_NIO, "2026-01-19", "2026-01-19");
  assert.equal(conciliable.completo, true);
  assert.equal(conciliable.moneda, "NIO");
  assert.equal(conciliable.montoOriginal, 850);
  assert.equal(conciliable.monto, 850);
});

test("regresión NIO: una minuta histórica sin línea marcada conserva el cálculo legado (suma de débitos)", async () => {
  await db.transaction(async tx => {
    const [movimiento] = await tx.insert(schema.movimientosCuentas).values({
      fecha: "2026-01-20", iglesiaCodigo: IGLESIA, cuentaBancariaNumero: CUENTA_NIO, referencia: "REF-LEGADO", concepto: "Minuta histórica sin marcar", creadoPor: USUARIO_ADMIN,
    }).returning();
    await tx.insert(schema.detallesMovimientos).values([
      { movimientoId: movimiento.id, tipo: "debito", cuentaCodigo: "10100002", cuentaNombre: "Banco NIO", monto: "300.00", moneda: "NIO", montoOriginal: "300.00", tasaCambio: "1", orden: 1 },
      { movimientoId: movimiento.id, tipo: "credito", cuentaCodigo: "40100001", cuentaNombre: "Ingresos", monto: "300.00", moneda: "NIO", montoOriginal: "300.00", tasaCambio: "1", orden: 2 },
    ]);
  });

  const [conciliable] = await movimientosConciliables(db, CUENTA_NIO, "2026-01-20", "2026-01-20");
  assert.equal(conciliable.completo, false, "sin línea marcada, la minuta se trata como histórica/legada");
  assert.equal(conciliable.monto, 300);
});

// Rutas reales, sesión firmada y conexiones independientes contra BD de pruebas.
// Ejecutar con SIC_TEST_WORKER_ENV=true para resolver el binding de Cloudflare.
async function rutas() {
  const [{ PATCH: conciliar }, { PATCH: anular }, { crearCookieSesion }] = await Promise.all([
    import('../app/api/conciliaciones/[id]/route.ts'),
    import('../app/api/movimientos/[id]/route.ts'),
    import('../lib/auth.ts'),
  ]);
  const enviar = (fn, id, body, usuario = 'usr-banco') => fn(new Request('http://localhost/api/test', {
    method:'PATCH', headers:{'Content-Type':'application/json', cookie:crearCookieSesion({id:usuario}).split(';')[0]}, body:JSON.stringify(body),
  }), {params:Promise.resolve({id})});
  return {conciliar,anular,enviar};
}
async function escenario(nombre, legado = false) {
  const movimiento = legado ? await db.transaction(async tx => {
    const [m] = await tx.insert(schema.movimientosCuentas).values({fecha:'2026-03-10',iglesiaCodigo:IGLESIA,cuentaBancariaNumero:CUENTA_USD,referencia:nombre,concepto:nombre,creadoPor:USUARIO_ADMIN}).returning();
    await tx.insert(schema.detallesMovimientos).values(['debito','credito'].map((tipo,i)=>({movimientoId:m.id,tipo,cuentaCodigo:'10100001',cuentaNombre:'Legado',monto:'100',montoOriginal:'100',moneda:'NIO',tasaCambio:'1',orden:i+1})));
    return m;
  }) : await crearMovimientoUsd('2026-03-10','100.00','36.5',nombre);
  const [reporte] = await db.insert(schema.reportesBancarios).values({nombre,fecha:'2026-03-10',estado:'procesado',archivoTamano:1,cargadoPor:USUARIO_ADMIN,cargadoPorNombre:'Test',cuentaBancariaNumero:CUENTA_USD,periodoInicio:'2026-03-10',periodoFin:'2026-03-10'}).returning();
  const [linea] = await db.insert(schema.lineasReporteBancario).values({reporteId:reporte.id,numeroLinea:1,fecha:'2026-03-10',descripcion:nombre,credito:'100',debito:'0',moneda:'USD',tasaCambio:'36.5',creditoNio:'3650',debitoNio:'0'}).returning();
  const [conciliacion] = await db.insert(schema.conciliacionesBancarias).values({reporteId:reporte.id,cuentaBancariaNumero:CUENTA_USD,periodo:'2026-03',creadoPor:'usr-banco'}).returning();
  return {movimiento,reporte,linea,conciliacion};
}

test('USD histórico no enlaza manualmente ni permite aprobar un enlace inválido', async () => {
  const e = await escenario('LEGADO-INVALIDO',true);
  assert.equal(await autoConciliar(db,e.reporte.id,CUENTA_USD,'usr-banco'),0);
  const {conciliar,enviar} = await rutas();
  assert.equal((await enviar(conciliar,e.conciliacion.id,{accion:'conciliar' ,lineaId:e.linea.id,movimientoId:e.movimiento.id})).status,409);
  // Simular un enlace incorrecto previo a la corrección.
  await db.update(schema.lineasReporteBancario).set({estadoConciliacion:'conciliada',movimientoId:e.movimiento.id}).where(eq(schema.lineasReporteBancario.id,e.linea.id));
  assert.equal((await enviar(conciliar,e.conciliacion.id,{accion:'aprobar'},'usr-admin')).status,409);
});

test('anular y conciliar concurrentemente no deja una minuta anulada enlazada', async () => {
  const e = await escenario('CARRERA-ANULAR');
  const {conciliar,anular,enviar} = await rutas();
  const resultados = await Promise.all([
    enviar(anular,e.movimiento.id,{estado:'anulado',motivo:'Prueba concurrente de anulación'}),
    enviar(conciliar,e.conciliacion.id,{accion:'conciliar',lineaId:e.linea.id,movimientoId:e.movimiento.id}),
  ]);
  assert.equal(resultados.filter(r=>r.status===200).length,1);
  const [m] = await db.select().from(schema.movimientosCuentas).where(eq(schema.movimientosCuentas.id,e.movimiento.id));
  const [l] = await db.select().from(schema.lineasReporteBancario).where(eq(schema.lineasReporteBancario.id,e.linea.id));
  assert.ok(m.estado!=='anulado' || l.movimientoId===null);
});

test('reabrir y aprobar simultáneamente mantienen estado coherente', async () => {
  const e = await escenario('CARRERA-REABRIR');
  const {conciliar,enviar} = await rutas();
  assert.equal((await enviar(conciliar,e.conciliacion.id,{accion:'conciliar',lineaId:e.linea.id,movimientoId:e.movimiento.id})).status,200);
  const resultados = await Promise.all([
    enviar(conciliar,e.conciliacion.id,{accion:'reabrir',lineaId:e.linea.id}),
    enviar(conciliar,e.conciliacion.id,{accion:'aprobar'},'usr-admin'),
  ]);
  assert.equal(resultados.filter(r=>r.status===200).length,1);
  const [c] = await db.select().from(schema.conciliacionesBancarias).where(eq(schema.conciliacionesBancarias.id,e.conciliacion.id));
  const [l] = await db.select().from(schema.lineasReporteBancario).where(eq(schema.lineasReporteBancario.id,e.linea.id));
  assert.ok(c.estado!=='aprobada' || l.estadoConciliacion==='conciliada');
});

test('dos aprobaciones simultáneas producen una transición y un evento', async () => {
  const e = await escenario('CARRERA-APROBAR');
  const {conciliar,enviar} = await rutas();
  assert.equal((await enviar(conciliar,e.conciliacion.id,{accion:'conciliar',lineaId:e.linea.id,movimientoId:e.movimiento.id})).status,200);
  const resultados = await Promise.all([1,2].map(()=>enviar(conciliar,e.conciliacion.id,{accion:'aprobar'},'usr-admin')));
  assert.deepEqual(resultados.map(r=>r.status).sort(),[200,409]);
  const eventos = await db.select().from(schema.auditoriaEventos).where(and(eq(schema.auditoriaEventos.entidadId,e.conciliacion.id),eq(schema.auditoriaEventos.accion,'Aprobó conciliación bancaria')));
  assert.equal(eventos.length,1);
});

test('CSV ISO selecciona tasa del día correcto y conserva período', async () => {
  const { leerEstadoBancario, resumenEstadoBancario, periodoDesdeFecha } = await import('../lib/banco.ts');
  await crearTasa(db,{fecha:'2026-09-07',tasa:'36.5',fuente:'prueba-automatizada',usuarioId:USUARIO_ADMIN});
  await crearTasa(db,{fecha:'2026-07-09',tasa:'40',fuente:'prueba-automatizada',usuarioId:USUARIO_ADMIN});
  const lineas = await leerEstadoBancario(new File(['Fecha,Descripcion,Credito\n2026-09-07,Deposito,100'],'iso.csv'));
  const [linea] = await construirLineasConMoneda(db,lineas,'USD');
  assert.equal(linea.tasaCambio,'36.500000');
  assert.equal(linea.creditoNio,'3650.00');
  assert.equal(periodoDesdeFecha(resumenEstadoBancario(lineas).periodoFin),'2026-09');
});

test('auto-enlace y anulación concurrentes conservan integridad', async () => {
  const e = await escenario('CARRERA-AUTO');
  // Aislar fecha para asegurar un único candidato automático.
  await db.update(schema.movimientosCuentas).set({fecha:'2026-04-11'}).where(eq(schema.movimientosCuentas.id,e.movimiento.id));
  await db.update(schema.lineasReporteBancario).set({fecha:'2026-04-11'}).where(eq(schema.lineasReporteBancario.id,e.linea.id));
  const {anular,enviar} = await rutas();
  await Promise.all([
    autoConciliar(db,e.reporte.id,CUENTA_USD,'usr-banco'),
    enviar(anular,e.movimiento.id,{estado:'anulado',motivo:'Anulación simultánea con automático'}),
  ]);
  const [m] = await db.select().from(schema.movimientosCuentas).where(eq(schema.movimientosCuentas.id,e.movimiento.id));
  const [l] = await db.select().from(schema.lineasReporteBancario).where(eq(schema.lineasReporteBancario.id,e.linea.id));
  assert.ok(m.estado!=='anulado' || l.movimientoId===null);
});
