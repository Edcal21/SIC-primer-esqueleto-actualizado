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

export async function registrarAdvertenciaSegregacionConciliacion(
  db: AuditDb,
  input: { user: UsuarioSesion; conciliacionId: string; periodo: string; cuentaBancariaNumero: string; origen: "creacion" | "lineas" | "creacion_y_lineas" },
) {
  const origen = input.origen === "creacion_y_lineas"
    ? "generó la conciliación y modificó sus líneas"
    : input.origen === "creacion"
      ? "generó la conciliación"
      : "modificó líneas de la conciliación";

  await registrarAuditoria(db, {
    user: input.user,
    modulo: "Conciliación",
    accion: "Advertencia SoD: mismo usuario concilió y aprobó",
    entidad: "conciliaciones_bancarias",
    entidadId: input.conciliacionId,
    resultado: "correcto",
    detalle: `Excepción de segregación de funciones: el usuario ${origen} y posteriormente la aprobó · período ${input.periodo} · cuenta ${input.cuentaBancariaNumero}`,
  });
}
