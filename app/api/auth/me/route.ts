import { jsonError, usuarioDesdeRequest } from "../../../../lib/auth";
import { jsonSeguro } from "../../../../lib/security";

export async function GET(request: Request) { const user = await usuarioDesdeRequest(request); return user ? jsonSeguro({ user }, { headers: { "Cache-Control": "no-store" } }) : jsonError("No autenticado", 401); }
