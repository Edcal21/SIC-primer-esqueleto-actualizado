import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { claveVersionImportacion, prepararEvidenciaArchivo, relacionesArchivosConciliacion } from "../lib/importaciones.ts";

test("conserva los bytes originales y calcula SHA-256 reproducible", async () => {
  const contenido = new TextEncoder().encode("SIC,2026-06,C$ 1250.00\n");
  const archivo = new File([contenido], "estado-junio.csv", { type: "text/csv" });
  const evidencia = await prepararEvidenciaArchivo(archivo);

  assert.equal(evidencia.nombre, "estado-junio.csv");
  assert.equal(evidencia.mime, "text/csv");
  assert.equal(evidencia.tamano, contenido.byteLength);
  assert.equal(evidencia.hashSha256, "131c0287feeeb29e64be1ea187e7a29f28e49ade58a8b6fb6db5b38058fe731e");
  assert.deepEqual([...evidencia.bytes], [...contenido]);
});

test("la versión se separa por tipo, cuenta y período", () => {
  assert.equal(claveVersionImportacion("estado_bancario", " 123 ", "2026-06"), "estado_bancario|123|2026-06");
  assert.equal(claveVersionImportacion("balanza", null, "2026-06"), "balanza|-|2026-06");
  assert.notEqual(claveVersionImportacion("balanza", null, "2026-06"), claveVersionImportacion("balanza", null, "2026-07"));
});

test("la conciliación fija un estado bancario y elimina auxiliares duplicados", () => {
  assert.deepEqual(relacionesArchivosConciliacion("c1", "banco-v2", ["aux-v1", "aux-v1", null, "aux-v3"]), [
    { conciliacionId: "c1", archivoImportadoId: "banco-v2", rol: "estado_bancario" },
    { conciliacionId: "c1", archivoImportadoId: "aux-v1", rol: "movimientos" },
    { conciliacionId: "c1", archivoImportadoId: "aux-v3", rol: "movimientos" },
  ]);
});

test("la migración y todas las rutas de importación incluyen trazabilidad", async () => {
  const migration = await readFile(new URL("../drizzle/0027_trazabilidad_importaciones.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE "archivos_importados"/);
  assert.match(migration, /"archivo_original" bytea NOT NULL/);
  assert.match(migration, /"archivo_hash_sha256" varchar\(64\) NOT NULL/);
  assert.match(migration, /CREATE TABLE "conciliaciones_archivos_importados"/);

  for (const route of [
    "../app/api/importaciones/balanza/route.ts",
    "../app/api/importaciones/situacion-financiera/route.ts",
    "../app/api/importaciones/estado-resultado/route.ts",
    "../app/api/importaciones/catalogo/route.ts",
    "../app/api/importaciones/auxiliar/route.ts",
    "../app/api/banco/reportes/route.ts",
  ]) {
    const source = await readFile(new URL(route, import.meta.url), "utf8");
    assert.match(source, /prepararEvidenciaArchivo/);
    assert.match(source, /registrarArchivoImportado/);
  }
});
