import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { archivosImportados } from "../../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "importaciones:administrar") && !puede(user, "auditoria:ver")) return jsonError("Permiso insuficiente", 403);

  const archivos = await getDb().select({
    id: archivosImportados.id,
    tipo: archivosImportados.tipo,
    archivoNombre: archivosImportados.archivoNombre,
    archivoMime: archivosImportados.archivoMime,
    archivoTamano: archivosImportados.archivoTamano,
    archivoHashSha256: archivosImportados.archivoHashSha256,
    cuentaBancariaNumero: archivosImportados.cuentaBancariaNumero,
    periodo: archivosImportados.periodo,
    version: archivosImportados.version,
    cantidadRegistros: archivosImportados.cantidadRegistros,
    totalesControl: archivosImportados.totalesControl,
    estado: archivosImportados.estado,
    mensajeError: archivosImportados.mensajeError,
    importadoPor: archivosImportados.importadoPor,
    importadoPorNombre: archivosImportados.importadoPorNombre,
    creadoEn: archivosImportados.creadoEn,
  }).from(archivosImportados).orderBy(desc(archivosImportados.creadoEn)).limit(100);

  return Response.json({ archivos }, { headers: { "Cache-Control": "no-store" } });
}
