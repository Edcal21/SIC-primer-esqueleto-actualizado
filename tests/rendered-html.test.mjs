import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the SIC login shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /SIC · Sistema de Información Contable/);
  assert.match(html, /Gestión de ingresos, conciliación bancaria y estados financieros/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|react-loading-skeleton/);
});

test("keeps sample data out of SIC runtime files", async () => {
  const [page, reportes, auth, readme] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reportes.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /Datos demostrativos|datos de muestra|2026-06|2025-06|2025-12/);
  assert.match(page, /Iniciar sesión/);
  assert.match(page, /ACCESO SEGURO/);
  assert.match(page, /Universal Nicaragua/);
  assert.doesNotMatch(reportes, /saldo2025|saldo2026|Datos demostrativos|Ofrendas recibidas|BAC Credomatic/);
  assert.doesNotMatch(auth, /Falling back to local development/);
  assert.match(auth, /SIC_ALLOW_LOCAL_AUTH_FALLBACK/);
  assert.doesNotMatch(readme, /maqueta|prototipo funcional con datos demostrativos|Las rutas se orientan a demostración/);
});

test("every navigable module has a real screen wired in the shell", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const menu = page.slice(page.indexOf("const menu = ["), page.indexOf("const menuGroups"));
  const nombres = [...menu.matchAll(/nombre: "([^"]+)"/g)].map(match => match[1]);

  assert.ok(nombres.length >= 8, "el menú debe exponer los módulos del sistema");
  for (const nombre of nombres) {
    assert.match(page, new RegExp(`active === "${nombre}" \\?`), `El módulo "${nombre}" no tiene pantalla conectada y caería en el placeholder`);
  }
});

test("bank statements and reconciliation persist to PostgreSQL", async () => {
  const [carga, conciliacion, configuracion] = await Promise.all([
    readFile(new URL("../app/api/banco/reportes/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/conciliaciones/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/configuracion/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(carga, /leerEstadoBancario/, "la carga bancaria debe procesar el contenido del archivo");
  assert.match(carga, /insert\(lineasReporteBancario\)/, "las líneas del estado de cuenta deben guardarse");
  assert.match(carga, /puede\(user, "banco:cargar"\)/);
  assert.match(conciliacion, /puede\(user, "conciliacion:aprobar"\)/, "aprobar conciliaciones exige el permiso correspondiente");
  assert.match(conciliacion, /registrarAuditoria/, "las acciones de conciliación deben auditarse");
  assert.match(configuracion, /puede\(user, "configuracion:administrar"\)/);
});

test("production auth configuration fails closed", async () => {
  const [auth, login, security, envExample] = await Promise.all([
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/security.ts", import.meta.url), "utf8"),
    readFile(new URL("../.dev.vars.example", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /esProduccion/, "el módulo debe distinguir el entorno de producción");
  assert.match(auth, /!esProduccion\(\) && leerVariable\("SIC_ALLOW_LOCAL_AUTH_FALLBACK"\)/, "el fallback local debe quedar bloqueado en producción");
  assert.match(auth, /esProduccion\(\) \? "; Secure" : ""/, "la cookie de sesión debe ser Secure en producción");
  assert.match(auth, /SIC_SESSION_SECRET no está configurado/, "producción debe exigir SIC_SESSION_SECRET");
  assert.match(login, /problemaConfiguracionSeguridad/, "el login debe rechazar una configuración insegura");
  assert.match(login, /verificarRateLimit/, "el login debe limitar intentos repetidos");
  assert.match(security, /X-Frame-Options/, "las respuestas protegidas deben bloquear iframes");
  assert.match(security, /Content-Security-Policy/, "las respuestas protegidas deben incluir CSP");
  assert.match(security, /status: 429/, "el rate limit debe responder 429 cuando se excede");
  assert.match(envExample, /SIC_ENTORNO/);
  assert.match(envExample, /SIC_SESSION_SECRET/);
});

test("sensitive uploads are rate limited", async () => {
  const [bankUpload, balanceUpload] = await Promise.all([
    readFile(new URL("../app/api/banco/reportes/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/importaciones/balanza/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(bankUpload, /verificarRateLimit/, "la carga bancaria debe limitar intentos por IP");
  assert.match(balanceUpload, /verificarRateLimit/, "la importación de balanza debe limitar intentos por IP");
});

test("church catalog is administrable from API and UI", async () => {
  const [page, auth, iglesias, iglesiaPatch, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/iglesias/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/iglesias/[codigo]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0019_iglesias_administrables.sql", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /iglesias:administrar/, "debe existir un permiso explícito para administrar iglesias");
  assert.match(migration, /iglesias:administrar/, "la migración debe sembrar el permiso de iglesias");
  assert.match(page, /IglesiasAdmin/, "la UI debe exponer una pantalla de administración de iglesias");
  assert.match(page, /active === "Iglesias"/, "el módulo Iglesias debe estar conectado al switch principal");
  assert.match(iglesias, /export async function POST/, "la API debe permitir crear iglesias");
  assert.match(iglesiaPatch, /export async function PATCH/, "la API debe permitir actualizar iglesias");
});

test("movement annulment preserves accounting detail", async () => {
  const anular = await readFile(new URL("../app/api/movimientos/[id]/route.ts", import.meta.url), "utf8");

  assert.match(anular, /puede\(user, "movimientos:escribir"\)/, "la anulación exige permiso de escritura");
  assert.match(anular, /estado: "anulado"/, "la anulación solo cambia el estado");
  assert.match(anular, /registrarAuditoria/, "la anulación debe auditarse");
  assert.doesNotMatch(anular, /delete\(detallesMovimientos\)|delete\(movimientosCuentas\)/, "la anulación nunca borra el asiento ni su detalle");
});

test("database protects accounting entries with double-entry and duplicate constraints", async () => {
  const [schema, migration, movimientos] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0020_partida_doble_unique_minuta.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/movimientos/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /ux_movimientos_unico/, "el esquema debe documentar el índice único parcial de minutas");
  assert.match(migration, /CREATE OR REPLACE FUNCTION validar_partida_doble_movimiento/, "la migración debe crear la función de validación contable");
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/, "el trigger debe diferirse hasta terminar la transacción");
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS ux_movimientos_unico/, "la migración debe crear el índice único parcial");
  assert.match(movimientos, /23505/, "la API debe traducir duplicados de BD a una respuesta clara");
  assert.match(movimientos, /23514/, "la API debe traducir violaciones contables de BD a una respuesta clara");
});
