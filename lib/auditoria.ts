import { auditoriaEventos } from "../db/schema";
import type { UsuarioSesion } from "./auth";

type AuditDb = { insert: (table: typeof auditoriaEventos) => { values: (value: typeof auditoriaEventos.$inferInsert) => Promise<unknown> } };

type AuditoriaInput = {
  user: UsuarioSesion;
  modulo: string;
  accion: string;
  entidad?: string;
  entidadId?: string;
  resultado?: "correcto" | "error";
  detalle?: string;
};

export async function registrarAuditoria(db: AuditDb, input: AuditoriaInput) {
  try {
    await db.insert(auditoriaEventos).values({
      usuarioId: input.user.id,
      usuarioNombre: input.user.nombre,
      modulo: input.modulo,
      accion: input.accion,
      entidad: input.entidad,
      entidadId: input.entidadId,
      resultado: input.resultado ?? "correcto",
      detalle: input.detalle,
    });
  } catch (error) {
    console.warn("No se pudo registrar auditoría", error);
  }
}
