import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";
import { getDb } from "../../../db";
import { registrarAuditoria } from "../../../lib/auditoria";
import { crearTasa, listarTasas } from "../../../lib/tasas";

type TasaPayload = { fecha?: string; tasa?: string | number; fuente?: string };

const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "configuracion:administrar") && !puede(user, "banco:ver")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  const tasas = await listarTasas(db);
  return Response.json({ tasas }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "configuracion:administrar")) return jsonError("No tiene permiso para administrar tasas de cambio", 403);

  let body: TasaPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const fecha = body.fecha?.trim();
  const fuente = body.fuente?.trim();
  if (!fecha || !fechaRegex.test(fecha)) return jsonError("Fecha inválida", 400);
  if (!fuente) return jsonError("Indique la fuente de la tasa (por ejemplo, BCN o el banco correspondiente)", 400);
  if (body.tasa === undefined || body.tasa === null || body.tasa === "") return jsonError("La tasa es obligatoria", 400);

  const db = getDb();
  try {
    const tasa = await crearTasa(db, { fecha, tasa: body.tasa as string, fuente, usuarioId: user.id });
    await registrarAuditoria(db, {
      user,
      modulo: "Configuración",
      accion: "Registró tasa de cambio USD → NIO",
      entidad: "tasas_cambio",
      entidadId: tasa.id,
      detalle: `${fecha} · ${tasa.tasa} · fuente: ${fuente}`,
    });
    return Response.json({ tasa }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Exchange rate creation failed", error);
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return jsonError("Ya existe una tasa registrada para esa fecha; edítela en vez de crear una nueva", 409);
    }
    if (error instanceof Error && /tasa de cambio/.test(error.message)) return jsonError(error.message, 400);
    return jsonError("No se pudo registrar la tasa de cambio", 500);
  }
}
