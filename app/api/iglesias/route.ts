import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { iglesias } from "../../../db/schema";
import { registrarAuditoria } from "../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";

type IglesiaPayload = {
  codigo?: string;
  nombre?: string;
};

const codigoRegex = /^\d{8}$/;

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "movimientos:escribir") && !puede(user, "iglesias:administrar")) return jsonError("Permiso insuficiente", 403);

  const url = new URL(request.url);
  const soloActivas = url.searchParams.get("estado") !== "todas" || !puede(user, "iglesias:administrar");
  const db = getDb();
  const rows = await db.select({ codigo: iglesias.codigo, nombre: iglesias.nombre, estado: iglesias.estado })
    .from(iglesias)
    .where(soloActivas ? eq(iglesias.estado, "activa") : undefined)
    .orderBy(asc(iglesias.codigo));

  return Response.json({ iglesias: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "iglesias:administrar")) return jsonError("No tiene permiso para administrar iglesias", 403);

  let body: IglesiaPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const codigo = body.codigo?.trim();
  const nombre = body.nombre?.trim();

  if (!codigo || !codigoRegex.test(codigo)) return jsonError("El código de iglesia debe tener 8 dígitos", 400);
  if (!nombre) return jsonError("El nombre de la iglesia es obligatorio", 400);

  const db = getDb();
  try {
    const [iglesia] = await db.insert(iglesias).values({ codigo, nombre }).returning();
    await registrarAuditoria(db, { user, modulo: "Iglesias", accion: "Creó iglesia", entidad: "iglesias", entidadId: iglesia.codigo, detalle: iglesia.nombre });
    return Response.json({ iglesia }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Church creation failed", error);
    return jsonError("No se pudo crear la iglesia; verifique que el código no exista", 409);
  }
}
