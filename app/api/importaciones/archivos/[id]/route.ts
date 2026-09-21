import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { archivosImportados } from "../../../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../../lib/auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  const autorizado = puede(user, "importaciones:administrar") || puede(user, "auditoria:ver") || puede(user, "banco:ver") || puede(user, "conciliacion:ver");
  if (!autorizado) return jsonError("Permiso insuficiente", 403);

  const { id } = await context.params;
  const [archivo] = await getDb().select().from(archivosImportados).where(eq(archivosImportados.id, id)).limit(1);
  if (!archivo) return jsonError("Archivo importado no encontrado", 404);

  const nombreSeguro = archivo.archivoNombre.replace(/[\r\n"]/g, "_");
  const bytes = new Uint8Array(archivo.archivoOriginal);
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
    headers: {
      "Content-Type": archivo.archivoMime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${nombreSeguro}"; filename*=UTF-8''${encodeURIComponent(archivo.archivoNombre)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
