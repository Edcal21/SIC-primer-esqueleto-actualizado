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
  const [page, login, shared, reportes, auth, readme] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Login.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reportes.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  const frontendShell = `${page}\n${login}\n${shared}`;
  assert.doesNotMatch(frontendShell, /Datos demostrativos|datos de muestra|2026-06|2025-06|2025-12/);
  assert.match(login, /Iniciar sesión/);
  assert.match(login, /ACCESO SEGURO/);
  assert.match(shared, /Universal Nicaragua/);
  assert.doesNotMatch(reportes, /saldo2025|saldo2026|Datos demostrativos|Ofrendas recibidas|BAC Credomatic/);
  assert.doesNotMatch(auth, /Falling back to local development/);
  assert.match(auth, /SIC_ALLOW_LOCAL_AUTH_FALLBACK/);
  assert.doesNotMatch(readme, /maqueta|prototipo funcional con datos demostrativos|Las rutas se orientan a demostración/);
});

test("every navigable module has a real screen wired in the shell", async () => {
  const [page, shared] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared.ts", import.meta.url), "utf8"),
  ]);
  const menu = shared.slice(shared.indexOf("export const menu = ["), shared.indexOf("export const menuGroups"));
  const nombres = [...menu.matchAll(/nombre: "([^"]+)"/g)].map(match => match[1]);

  assert.ok(nombres.length >= 8, "el menú debe exponer los módulos del sistema");
  for (const nombre of nombres) {
    assert.match(page, new RegExp(`case "${nombre}"`), `El módulo "${nombre}" no tiene pantalla conectada y caería en el placeholder`);
  }

  const lazyModules = [
    "Resumen",
    "UsuariosAdmin",
    "Movimiento",
    "Minutas",
    "CatalogoContable",
    "IglesiasAdmin",
    "Bancos",
    "ConciliacionBancaria",
    "Importaciones",
    "Reportes",
    "Auditoria",
    "ConfiguracionInstitucional",
    "ModuleFallback",
  ];

  assert.ok(page.split("\n").length < 200, "page.tsx debe limitarse al shell y enrutamiento de la interfaz");
  for (const moduleName of lazyModules) {
    assert.match(page, new RegExp(`lazy\\(\\(\\) => import\\("\\.\\/modules\\/${moduleName}"\\)\\)`), `${moduleName} debe cargarse con división de código`);
    const moduleSource = await readFile(new URL(`../app/modules/${moduleName}.tsx`, import.meta.url), "utf8");
    assert.match(moduleSource, /export default function /, `${moduleName} debe ser un módulo independiente`);
  }

  const movimiento = await readFile(new URL("../app/modules/Movimiento.tsx", import.meta.url), "utf8");
  assert.match(movimiento, /import \{[^}]*useRef[^}]*\} from "react"/, "Movimiento debe importar cada hook de React que utiliza");
});

test("bank statements and reconciliation persist to PostgreSQL", async () => {
  const [carga, conciliacion, conciliacionUi, auditoria, configuracion] = await Promise.all([
    readFile(new URL("../app/api/banco/reportes/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/conciliaciones/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/modules/ConciliacionBancaria.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/auditoria.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/configuracion/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(carga, /leerEstadoBancario/, "la carga bancaria debe procesar el contenido del archivo");
  assert.match(carga, /insert\(lineasReporteBancario\)/, "las líneas del estado de cuenta deben guardarse");
  assert.match(carga, /puede\(user, "banco:cargar"\)/);
  assert.match(conciliacion, /puede\(user, "conciliacion:aprobar"\)/, "aprobar conciliaciones exige el permiso correspondiente");
  assert.match(conciliacion, /registrarAuditoria/, "las acciones de conciliación deben auditarse");
  assert.match(conciliacionUi, /canReconcile && canApprove/, "la interfaz debe advertir cuando un usuario concentra conciliación y aprobación");
  assert.match(conciliacionUi, /Advertencia: Usted tiene permisos de conciliación Y aprobación/);
  assert.match(conciliacion, /registrarAdvertenciaSegregacionConciliacion/, "una aprobación sin segregación debe generar una alerta de auditoría");
  assert.match(auditoria, /mismo usuario concilió y aprobó/);
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
  const [bankUpload, balanceUpload, catalogUpload, auxiliarUpload] = await Promise.all([
    readFile(new URL("../app/api/banco/reportes/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/importaciones/balanza/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/importaciones/catalogo/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/importaciones/auxiliar/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(bankUpload, /verificarRateLimit/, "la carga bancaria debe limitar intentos por IP");
  assert.match(balanceUpload, /verificarRateLimit/, "la importación de balanza debe limitar intentos por IP");
  assert.match(catalogUpload, /verificarRateLimit/, "la importación de catálogo debe limitar intentos por IP");
  assert.match(auxiliarUpload, /verificarRateLimit/, "la importación de auxiliar debe limitar intentos por IP");
});

test("chart of accounts import is a dedicated function", async () => {
  const [catalogRoute, importacionesUi] = await Promise.all([
    readFile(new URL("../app/api/importaciones/catalogo/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/modules/Importaciones.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(catalogRoute, /leerCatalogoContable/, "la API debe procesar archivos de catálogo contable");
  assert.match(catalogRoute, /puede\(user, "catalogo:administrar"\)/, "la importación de catálogo debe exigir administración de catálogo");
  assert.match(catalogRoute, /insert\(cuentasContables\)/, "la importación debe crear o actualizar cuentas contables");
  assert.match(catalogRoute, /Importó catálogo contable/, "la importación debe quedar auditada");
  assert.match(importacionesUi, /Importar catálogo contable/, "la pantalla de importaciones debe exponer la carga de catálogo");
  assert.match(importacionesUi, /\/api\/importaciones\/catalogo/, "la UI debe llamar la API dedicada de catálogo");
});

test("auxiliary ledger import creates accounting movements", async () => {
  const [auxiliarRoute, importacionesUi] = await Promise.all([
    readFile(new URL("../app/api/importaciones/auxiliar/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/modules/Importaciones.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(auxiliarRoute, /leerAuxiliarContable/, "la API debe procesar archivos de auxiliar contable");
  assert.match(auxiliarRoute, /puede\(user, "importaciones:administrar"\)/, "la importación de auxiliar debe exigir permiso de importaciones");
  assert.match(auxiliarRoute, /insert\(movimientosCuentas\)/, "la importación debe crear movimientos contables");
  assert.match(auxiliarRoute, /insert\(detallesMovimientos\)/, "la importación debe crear líneas de partida doble");
  assert.match(auxiliarRoute, /Importó auxiliar contable/, "la importación debe quedar auditada");
  assert.match(importacionesUi, /Importar auxiliar contable/, "la pantalla de importaciones debe exponer la carga de auxiliar");
  assert.match(importacionesUi, /\/api\/importaciones\/auxiliar/, "la UI debe llamar la API dedicada de auxiliar");
});

test("church catalog is administrable from API and UI", async () => {
  const [page, iglesiasUi, auth, iglesias, iglesiaPatch, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/modules/IglesiasAdmin.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/iglesias/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/iglesias/[codigo]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0019_iglesias_administrables.sql", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /iglesias:administrar/, "debe existir un permiso explícito para administrar iglesias");
  assert.match(migration, /iglesias:administrar/, "la migración debe sembrar el permiso de iglesias");
  assert.match(page, /lazy\(\(\) => import\("\.\/modules\/IglesiasAdmin"\)\)/, "la UI debe cargar la administración de iglesias como módulo independiente");
  assert.match(page, /case "Iglesias"/, "el módulo Iglesias debe estar conectado al switch principal");
  assert.match(iglesiasUi, /export default function IglesiasAdmin/);
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

test("trial balance parser ignores report totals and preserves Excel row numbers", async () => {
  const parserUrl = new URL(`../lib/balanza.ts?test=${process.pid}-${Date.now()}`, import.meta.url);
  const { extraerFilasBalanza } = await import(parserUrl.href);
  const result = extraerFilasBalanza([
    ["Balance de Comprobación"],
    ["Cuenta", "Descripción", "Saldo Inicial", "Débitos", "Créditos", "Saldo Final"],
    ["11010203", "Banco LA FISE", 100, 25, 10, 115],
    ["Sumas Iguales :", "", "", 25, 25, ""],
    ["Powered By Controles y Sistemas S.A."],
  ]);

  assert.equal(result.filas.length, 1);
  assert.equal(result.filas[0].numeroLinea, 3);
  assert.equal(result.filas[0].cuentaCodigo, "11010203");
  assert.equal(result.totalDebe, 25);
  assert.equal(result.totalHaber, 25);
});

test("chart of accounts parser accepts common accounting headers", async () => {
  const parserUrl = new URL(`../lib/catalogo.ts?test=${process.pid}-${Date.now()}`, import.meta.url);
  const { extraerFilasCatalogo } = await import(parserUrl.href);
  const result = extraerFilasCatalogo([
    ["Plan de cuentas"],
    ["Código", "Descripción", "Nivel", "Naturaleza", "Flujo", "Movimiento", "Estado"],
    ["10000000", "Activos", 1, "Deudora", "No aplica", "No", "Activa"],
    ["11010203", "Banco LA FISE", 5, "Deudora", "Operación", "Sí", "Activa"],
  ]);

  assert.equal(result.filas.length, 2);
  assert.equal(result.filas[1].numeroLinea, 4);
  assert.equal(result.filas[1].codigo, "11010203");
  assert.equal(result.filas[1].esCuentaMovimiento, true);
  assert.equal(result.filas[1].clasificacionFlujo, "operación");
  assert.equal(result.cuentasMovimiento, 1);
  assert.equal(result.cuentasActivas, 2);
});

test("auxiliary ledger parser groups balanced accounting lines", async () => {
  const parserUrl = new URL(`../lib/auxiliar.ts?test=${process.pid}-${Date.now()}`, import.meta.url);
  const { extraerMovimientosAuxiliar } = await import(parserUrl.href);
  const result = extraerMovimientosAuxiliar([
    ["Auxiliar contable"],
    ["Fecha", "Iglesia", "Cuenta bancaria", "Referencia", "Concepto", "Cuenta", "Nombre cuenta", "Débito", "Crédito"],
    ["2026-06-15", "00000001", "11010203", "EG-001", "Pago servicios", "51010101", "Servicios básicos", 150, ""],
    ["2026-06-15", "00000001", "11010203", "EG-001", "Pago servicios", "11010203", "Banco LA FISE", "", 150],
  ]);

  assert.equal(result.movimientos.length, 1);
  assert.equal(result.totalLineas, 2);
  assert.equal(result.movimientos[0].detalles.length, 2);
  assert.equal(result.movimientos[0].totalDebitos, 150);
  assert.equal(result.movimientos[0].totalCreditos, 150);
});
