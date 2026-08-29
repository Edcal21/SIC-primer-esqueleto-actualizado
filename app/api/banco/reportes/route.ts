import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

const reportes = [{ id: "rb-001", nombre: "Estado de cuenta BAC - junio 2026.csv", fecha: "2026-06-30", estado: "Procesado", cargadoPor: "Operador Bancario" }];

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "banco:ver")) return jsonError("Permiso insuficiente", 403);
  return Response.json({ reportes });
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "banco:cargar")) return jsonError("No tiene permiso para cargar reportes bancarios", 403);
  const form = await request.formData(); const archivo = form.get("archivo");
  if (!(archivo instanceof File) || !archivo.name) return jsonError("Seleccione un archivo", 400);
  if (archivo.size > 10 * 1024 * 1024) return jsonError("El archivo supera el límite de 10 MB", 413);
  if (!/\.(csv|xlsx|xls)$/i.test(archivo.name)) return jsonError("Formato no permitido; use CSV o Excel", 415);
  return Response.json({ reporte: { id: `rb-${Date.now()}`, nombre: archivo.name, fecha: new Date().toISOString().slice(0, 10), estado: "Recibido", cargadoPor: user.nombre } }, { status: 201 });
}
