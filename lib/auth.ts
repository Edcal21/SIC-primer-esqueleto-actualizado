import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { env as workerEnv } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { rolesPermisos, usuarios as usuariosTable } from "../db/schema";
import { jsonSeguro } from "./security";

export type RolId = "administrador" | "contador_general" | "operador_bancario" | "auditor_general";
export type Permiso = "panel:ver" | "usuarios:administrar" | "roles:administrar" | "movimientos:escribir" | "catalogo:administrar" | "iglesias:administrar" | "banco:ver" | "banco:cargar" | "conciliacion:ver" | "conciliacion:gestionar" | "conciliacion:aprobar" | "importaciones:administrar" | "reportes:ver" | "reportes:descargar" | "auditoria:ver" | "configuracion:administrar";

export type UsuarioSesion = { id: string; usuario: string; nombre: string; rol: RolId; permisos: Permiso[]; debeCambiarPassword?: boolean };
type UsuarioInterno = UsuarioSesion & { salt: string; passwordHash: string };

const COOKIE = "sic_session";
const SESSION_SECONDS = 60 * 60 * 8;
const SECRETO_DESARROLLO = "sic-local-development-secret-change-in-production";
const SECRETO_LONGITUD_MINIMA = 32;

/** Las variables llegan como binding del worker o por process.env según el entorno de ejecución. */
function leerVariable(clave: string): string | undefined {
  let valor: unknown;
  try { valor = (workerEnv as unknown as Record<string, unknown>)[clave]; } catch { valor = undefined; }
  if (typeof valor !== "string" || !valor) valor = process.env[clave];
  return typeof valor === "string" && valor ? valor : undefined;
}

export function esProduccion() {
  const entorno = leerVariable("SIC_ENTORNO")?.toLowerCase();
  if (entorno) return entorno === "produccion" || entorno === "production";
  return leerVariable("NODE_ENV")?.toLowerCase() !== "development";
}

/**
 * Devuelve el motivo por el que la configuración de seguridad no sirve para producción,
 * o null si es válida. En desarrollo nunca bloquea.
 */
export function problemaConfiguracionSeguridad(): string | null {
  if (!esProduccion()) return null;
  const configurado = leerVariable("SIC_SESSION_SECRET");
  if (!configurado) return "SIC_SESSION_SECRET no está configurado; el sistema no puede firmar sesiones en producción";
  if (configurado === SECRETO_DESARROLLO) return "SIC_SESSION_SECRET conserva el valor de desarrollo; genere un secreto aleatorio propio";
  if (configurado.length < SECRETO_LONGITUD_MINIMA) return `SIC_SESSION_SECRET debe tener al menos ${SECRETO_LONGITUD_MINIMA} caracteres`;
  return null;
}

function secret() {
  const problema = problemaConfiguracionSeguridad();
  if (problema) throw new Error(problema);
  return leerVariable("SIC_SESSION_SECRET") ?? SECRETO_DESARROLLO;
}

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");
const atributosCookie = () => `Path=/; HttpOnly; SameSite=Strict${esProduccion() ? "; Secure" : ""}`;

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
    permisos: found.debeCambiarPassword ? [] : permisos.map(item => item.permisoId as Permiso),
    debeCambiarPassword: found.debeCambiarPassword,
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
    permisos: found.debeCambiarPassword ? [] : permisos.map(item => item.permisoId as Permiso),
    debeCambiarPassword: found.debeCambiarPassword,
  };
}

async function resolverUsuarioPorUsuario(usuario: string): Promise<UsuarioInterno | null> {
  return await usuarioDesdeDbPorUsuario(usuario);
}

async function resolverUsuarioPorId(id: string): Promise<UsuarioSesion | null> {
  return await usuarioDesdeDbPorId(id);
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
  return `${COOKIE}=${payload}.${sign(payload)}; ${atributosCookie()}; Max-Age=${SESSION_SECONDS}`;
}

export function eliminarCookieSesion(): string { return `${COOKIE}=; ${atributosCookie()}; Max-Age=0`; }

export async function usuarioDesdeRequest(request: Request): Promise<UsuarioSesion | null> {
  const raw = request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  let firmaEsperada: string;
  try { firmaEsperada = sign(payload); } catch (error) { console.error("Session verification is disabled by configuration", error); return null; }
  const valid = Buffer.from(firmaEsperada); const supplied = Buffer.from(signature);
  if (valid.length !== supplied.length || !timingSafeEqual(valid, supplied)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string; exp: number };
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return await resolverUsuarioPorId(data.sub);
  } catch { return null; }
}

export function puede(user: UsuarioSesion, permiso: Permiso) { return user.permisos.includes(permiso); }
export function jsonError(message: string, status: number) { return jsonSeguro({ error: message }, { status }); }
