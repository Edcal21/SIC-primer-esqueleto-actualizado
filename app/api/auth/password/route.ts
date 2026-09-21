import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { usuarios } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, usuarioDesdeRequest } from "../../../../lib/auth";
import { jsonSeguro, verificarRateLimit } from "../../../../lib/security";

const PASSWORD_MINIMO = 12;

type PasswordPayload = {
  actual?: string;
  nueva?: string;
};

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return { salt, passwordHash: pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex") };
}

function passwordValida(password: string, salt: string, passwordHash: string) {
  const calculated = pbkdf2Sync(password, salt, 210000, 32, "sha256");
  const expected = Buffer.from(passwordHash, "hex");
  return calculated.length === expected.length && timingSafeEqual(calculated, expected);
}

export async function PATCH(request: Request) {
  const limited = verificarRateLimit(request, { keyPrefix: "auth:password", limit: 6, windowMs: 60_000 });
  if (limited) return limited;

  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);

  let body: PasswordPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const actual = body.actual ?? "";
  const nueva = body.nueva ?? "";
  if (!actual || !nueva) return jsonError("Indique la contraseña actual y la nueva contraseña", 400);
  if (nueva.length < PASSWORD_MINIMO) return jsonError(`La nueva contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres`, 400);
  if (actual === nueva) return jsonError("La nueva contraseña debe ser distinta a la actual", 400);

  const db = getDb();
  const [found] = await db.select().from(usuarios).where(eq(usuarios.id, user.id)).limit(1);
  if (!found || found.estado !== "activo") return jsonError("Usuario no encontrado o inactivo", 404);
  if (!passwordValida(actual, found.salt, found.passwordHash)) return jsonError("La contraseña actual no coincide", 401);

  const { salt, passwordHash } = hashPassword(nueva);
  await db.update(usuarios).set({
    salt,
    passwordHash,
    debeCambiarPassword: false,
  }).where(eq(usuarios.id, user.id));

  await registrarAuditoria(db, {
    user: { ...user, permisos: [] },
    modulo: "Autenticación",
    accion: "Cambió su contraseña",
    entidad: "usuarios",
    entidadId: user.id,
    detalle: user.debeCambiarPassword ? "Rotación obligatoria completada" : "Cambio voluntario",
  });

  return jsonSeguro({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
