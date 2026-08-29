import { randomBytes, randomUUID, pbkdf2Sync } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { roles, usuarios } from "../../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest, type UsuarioSesion } from "../../../../lib/auth";

type UsuarioPayload = {
  usuario?: string;
  nombre?: string;
  rolId?: string;
  password?: string;
};

const usuarioRegex = /^[a-z0-9._-]{3,40}$/;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
  return { salt, passwordHash };
}

type AdminAuth = { user: UsuarioSesion; error?: never } | { user?: never; error: Response };

async function requireAdmin(request: Request): Promise<AdminAuth> {
  const user = await usuarioDesdeRequest(request);
  if (!user) return { error: jsonError("No autenticado", 401) };
  if (!puede(user, "usuarios:administrar")) return { error: jsonError("Permiso insuficiente", 403) };
  return { user };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const db = getDb();
  const rows = await db
    .select({
      id: usuarios.id,
      usuario: usuarios.usuario,
      nombre: usuarios.nombre,
      rolId: usuarios.rolId,
      estado: usuarios.estado,
      creadoEn: usuarios.creadoEn,
      rolNombre: roles.nombre,
    })
    .from(usuarios)
    .leftJoin(roles, eq(roles.id, usuarios.rolId))
    .orderBy(asc(usuarios.usuario));

  return Response.json({ usuarios: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: UsuarioPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const usuario = body.usuario?.trim().toLowerCase();
  const nombre = body.nombre?.trim();
  const rolId = body.rolId?.trim();
  const password = body.password ?? "";

  if (!usuario || !usuarioRegex.test(usuario)) return jsonError("Usuario inválido; use 3 a 40 caracteres en minúsculas, números, punto, guion o guion bajo", 400);
  if (!nombre) return jsonError("Nombre es obligatorio", 400);
  if (!rolId) return jsonError("Rol es obligatorio", 400);
  if (password.length < 8) return jsonError("La contraseña debe tener al menos 8 caracteres", 400);

  const db = getDb();
  const [rol] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, rolId)).limit(1);
  if (!rol) return jsonError("Rol no encontrado", 404);

  const { salt, passwordHash } = hashPassword(password);
  try {
    const [created] = await db.insert(usuarios).values({
      id: `usr-${randomUUID()}`,
      usuario,
      nombre,
      rolId,
      salt,
      passwordHash,
    }).returning({
      id: usuarios.id,
      usuario: usuarios.usuario,
      nombre: usuarios.nombre,
      rolId: usuarios.rolId,
      estado: usuarios.estado,
      creadoEn: usuarios.creadoEn,
    });

    return Response.json({ usuario: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("User creation failed", error);
    return jsonError("No se pudo crear el usuario; verifique que el nombre de usuario no exista", 409);
  }
}
