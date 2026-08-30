import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditoriaEventos, cuentasContables, iglesias, importacionesBalanza, movimientosCuentas, reportesBancarios } from "../../../db/schema";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";

async function total(db: ReturnType<typeof getDb>, table: typeof cuentasContables | typeof iglesias | typeof importacionesBalanza | typeof movimientosCuentas | typeof reportesBancarios | typeof auditoriaEventos) {
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(table);
  return row?.total ?? 0;
}

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "panel:ver")) return jsonError("Permiso insuficiente", 403);

  const db = getDb();
  const [ultimaImportacion] = await db.select().from(importacionesBalanza).orderBy(desc(importacionesBalanza.creadoEn)).limit(1);
  const [ultimoMovimiento] = await db.select().from(movimientosCuentas).orderBy(desc(movimientosCuentas.creadoEn)).limit(1);
  const eventos = await db.select({
    fecha: auditoriaEventos.creadoEn,
    usuario: auditoriaEventos.usuarioNombre,
    accion: auditoriaEventos.accion,
    modulo: auditoriaEventos.modulo,
    resultado: auditoriaEventos.resultado,
  }).from(auditoriaEventos).orderBy(desc(auditoriaEventos.creadoEn)).limit(5);

  const [
    cuentas,
    cuentasMovimiento,
    iglesiasActivas,
    importaciones,
    movimientos,
    reportesBanco,
    eventosAuditoria,
  ] = await Promise.all([
    total(db, cuentasContables),
    db.select({ total: sql<number>`count(*)::int` }).from(cuentasContables).where(eq(cuentasContables.esCuentaMovimiento, true)).then(([row]) => row?.total ?? 0),
    db.select({ total: sql<number>`count(*)::int` }).from(iglesias).where(eq(iglesias.estado, "activa")).then(([row]) => row?.total ?? 0),
    total(db, importacionesBalanza),
    total(db, movimientosCuentas),
    total(db, reportesBancarios),
    total(db, auditoriaEventos),
  ]);

  return Response.json({
    resumen: {
      cuentas,
      cuentasMovimiento,
      iglesiasActivas,
      importaciones,
      movimientos,
      reportesBanco,
      eventosAuditoria,
      ultimaImportacion,
      ultimoMovimiento,
      eventos,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
