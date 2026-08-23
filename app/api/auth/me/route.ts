import { jsonError, usuarioDesdeRequest } from "../../../../lib/auth";
export async function GET(request: Request) { const user = usuarioDesdeRequest(request); return user ? Response.json({ user }, { headers: { "Cache-Control": "no-store" } }) : jsonError("No autenticado", 401); }
