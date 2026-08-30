import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { cuentasContables } from "../../../../../db/schema";
import { registrarAuditoria } from "../../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../../lib/auth";

type CuentaUpdatePayload = {
  descripcion?: string;
  naturaleza?: "deudora" | "acreedora";
  clasificacionFlujo?: "operación" | "inversión" | "financiamiento" | "no aplica";
  esCuentaMovimiento?: boolean;
  estado?: "activa" | "inactiva";
};

const naturalezas = new Set(["deudora", "acreedora"]);
const flujos = new Set(["operación", "inversión", "financiamiento", "no aplica"]);
const estados = new Set(["activa", "inactiva"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "catalogo:administrar")) return jsonError("Permiso insuficiente", 403);

  const { codigo } = await params;
  let body: CuentaUpdatePayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const values: Partial<typeof cuentasContables.$inferInsert> = {};
  if (body.descripcion !== undefined) {
    const descripcion = body.descripcion.trim();
    if (!descripcion) return jsonError("La descripción es obligatoria", 400);
    values.descripcion = descripcion;
  }
  if (body.naturaleza !== undefined) {
    if (!naturalezas.has(body.naturaleza)) return jsonError("Naturaleza inválida", 400);
    values.naturaleza = body.naturaleza;
  }
  if (body.clasificacionFlujo !== undefined) {
    if (!flujos.has(body.clasificacionFlujo)) return jsonError("Clasificación de flujo inválida", 400);
    values.clasificacionFlujo = body.clasificacionFlujo;
  }
  if (body.esCuentaMovimiento !== undefined) values.esCuentaMovimiento = body.esCuentaMovimiento;
  if (body.estado !== undefined) {
    if (!estados.has(body.estado)) return jsonError("Estado inválido", 400);
    values.estado = body.estado;
  }

  if (!Object.keys(values).length) return jsonError("No hay cambios para actualizar", 400);

  const db = getDb();
  const [cuenta] = await db.update(cuentasContables).set(values).where(eq(cuentasContables.codigo, codigo)).returning();
  if (!cuenta) return jsonError("Cuenta no encontrada", 404);
  await registrarAuditoria(db, { user, modulo: "Catálogo", accion: "Actualizó cuenta contable", entidad: "cuentas_contables", entidadId: codigo, detalle: Object.keys(values).join(", ") });
  return Response.json({ cuenta }, { headers: { "Cache-Control": "no-store" } });
}
