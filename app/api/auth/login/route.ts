import { autenticar, crearCookieSesion, jsonError, problemaConfiguracionSeguridad } from "../../../../lib/auth";

export async function POST(request: Request) {
  const problema = problemaConfiguracionSeguridad();
  if (problema) {
    console.error("Refusing to authenticate with an unsafe production configuration:", problema);
    return jsonError("El sistema no está configurado para operar de forma segura. Avise al administrador.", 503);
  }

  let body: { usuario?: string; password?: string };
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }
  if (!body.usuario || !body.password) return jsonError("Usuario y contraseña son obligatorios", 400);
  const user = await autenticar(body.usuario, body.password);
  if (!user) return jsonError("Credenciales incorrectas", 401);
  return Response.json({ user }, { headers: { "Set-Cookie": crearCookieSesion(user), "Cache-Control": "no-store" } });
}
