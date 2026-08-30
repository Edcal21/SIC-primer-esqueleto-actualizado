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
