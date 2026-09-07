import { eliminarCookieSesion } from "../../../../lib/auth";
import { jsonSeguro } from "../../../../lib/security";

export async function POST() { return jsonSeguro({ ok: true }, { headers: { "Set-Cookie": eliminarCookieSesion(), "Cache-Control": "no-store" } }); }
