import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { rolesPermisos, usuarios as usuariosTable } from "../db/schema";

export type RolId = "administrador" | "contador_general" | "operador_bancario" | "auditor_general";
export type Permiso = "panel:ver" | "usuarios:administrar" | "roles:administrar" | "movimientos:escribir" | "catalogo:administrar" | "banco:ver" | "banco:cargar" | "conciliacion:aprobar" | "importaciones:administrar" | "reportes:ver" | "reportes:descargar" | "auditoria:ver";

export type UsuarioSesion = { id: string; usuario: string; nombre: string; rol: RolId; permisos: Permiso[] };
type UsuarioInterno = UsuarioSesion & { salt: string; passwordHash: string };

const permisosPorRol: Record<RolId, Permiso[]> = {
  administrador: ["panel:ver", "usuarios:administrar", "roles:administrar", "auditoria:ver"],
  contador_general: ["panel:ver", "importaciones:administrar", "reportes:ver", "reportes:descargar"],
  operador_bancario: ["panel:ver", "movimientos:escribir", "banco:ver", "banco:cargar", "reportes:ver"],
  auditor_general: ["panel:ver", "banco:ver", "reportes:ver", "reportes:descargar", "auditoria:ver"],
};

const usuariosLocales: UsuarioInterno[] = [
  { id: "usr-admin", usuario: "administrador", nombre: "Administrador del Sistema", rol: "administrador", permisos: permisosPorRol.administrador, salt: "4836377235e90964097682ebfda61e05", passwordHash: "d913ff8d9bf0ca9a71ce0d5625886395f1f32922d52ae740513f870ae5227ddd" },
  { id: "usr-contador", usuario: "contador", nombre: "Contador General", rol: "contador_general", permisos: permisosPorRol.contador_general, salt: "b04259fa5a05cd95fda1a4af06b926d8", passwordHash: "a84233f4147da5048daef1e3d0d875df1d9ad96a9b77b35c399001793f9b5253" },
  { id: "usr-banco", usuario: "banco", nombre: "Operador Bancario", rol: "operador_bancario", permisos: permisosPorRol.operador_bancario, salt: "cd15b6c7a108464a98ed72733da083aa", passwordHash: "07ec8bed948731f1ccb8d4f5e49ac38ed62eab2f213cbb120950d2f9233525cc" },
  { id: "usr-auditor", usuario: "auditor", nombre: "Auditor General", rol: "auditor_general", permisos: permisosPorRol.auditor_general, salt: "1ae524d779667e6470265d096ab2efec", passwordHash: "563dff2b46b224cec7a76817f514431c2167f0a7c05ca16db989ba01013670ba" },
];

const COOKIE = "sic_session";
const SESSION_SECONDS = 60 * 60 * 8;
const secret = () => process.env.SIC_SESSION_SECRET ?? "sic-local-development-secret-change-in-production";
const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");
const allowLocalFallback = () => process.env.SIC_ALLOW_LOCAL_AUTH_FALLBACK === "true";

async function usuarioDesdeDbPorUsuario(usuario: string): Promise<UsuarioInterno | null> {
  const db = getDb();
  const [found] = await db.select().from(usuariosTable).where(eq(usuariosTable.usuario, usuario.trim().toLowerCase())).limit(1);
  if (!found || found.estado !== "activo") return null;
  const permisos = await db.select({ permisoId: rolesPermisos.permisoId }).from(rolesPermisos).where(eq(rolesPermisos.rolId, found.rolId));
  return {
    id: found.id,
    usuario: found.usuario,
    nombre: found.nombre,
    rol: found.rolId as RolId,
    permisos: permisos.map(item => item.permisoId as Permiso),
    salt: found.salt,
    passwordHash: found.passwordHash,
  };
}

async function usuarioDesdeDbPorId(id: string): Promise<UsuarioSesion | null> {
  const db = getDb();
  const [found] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, id)).limit(1);
  if (!found || found.estado !== "activo") return null;
  const permisos = await db.select({ permisoId: rolesPermisos.permisoId }).from(rolesPermisos).where(eq(rolesPermisos.rolId, found.rolId));
  return {
    id: found.id,
    usuario: found.usuario,
    nombre: found.nombre,
    rol: found.rolId as RolId,
    permisos: permisos.map(item => item.permisoId as Permiso),
  };
}

function usuarioLocalPorUsuario(usuario: string): UsuarioInterno | null {
  return usuariosLocales.find(item => item.usuario === usuario.trim().toLowerCase()) ?? null;
}

function usuarioLocalPorId(id: string): UsuarioSesion | null {
  const found = usuariosLocales.find(item => item.id === id);
  if (!found) return null;
  const { salt: _salt, passwordHash: _passwordHash, ...safeUser } = found;
  void _salt; void _passwordHash;
  return safeUser;
}

async function resolverUsuarioPorUsuario(usuario: string): Promise<UsuarioInterno | null> {
  try {
    return await usuarioDesdeDbPorUsuario(usuario);
  } catch (error) {
    if (!allowLocalFallback()) throw error;
    console.warn("Using local development users because SIC_ALLOW_LOCAL_AUTH_FALLBACK=true", error);
    return usuarioLocalPorUsuario(usuario);
  }
}

async function resolverUsuarioPorId(id: string): Promise<UsuarioSesion | null> {
  try {
    return await usuarioDesdeDbPorId(id);
  } catch (error) {
    if (!allowLocalFallback()) throw error;
    console.warn("Using local development session users because SIC_ALLOW_LOCAL_AUTH_FALLBACK=true", error);
    return usuarioLocalPorId(id);
  }
}

export async function autenticar(usuario: string, password: string): Promise<UsuarioSesion | null> {
  const found = await resolverUsuarioPorUsuario(usuario);
  if (!found) return null;
  const calculated = pbkdf2Sync(password, found.salt, 210000, 32, "sha256");
  const expected = Buffer.from(found.passwordHash, "hex");
  if (calculated.length !== expected.length || !timingSafeEqual(calculated, expected)) return null;
  const { salt: _salt, passwordHash: _passwordHash, ...safeUser } = found;
  void _salt; void _passwordHash;
  return safeUser;
}

export function crearCookieSesion(user: UsuarioSesion): string {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function eliminarCookieSesion(): string { return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`; }

export async function usuarioDesdeRequest(request: Request): Promise<UsuarioSesion | null> {
  const raw = request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const valid = Buffer.from(sign(payload)); const supplied = Buffer.from(signature);
  if (valid.length !== supplied.length || !timingSafeEqual(valid, supplied)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string; exp: number };
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return await resolverUsuarioPorId(data.sub);
  } catch { return null; }
}

export function puede(user: UsuarioSesion, permiso: Permiso) { return user.permisos.includes(permiso); }
export function jsonError(message: string, status: number) { return Response.json({ error: message }, { status }); }
