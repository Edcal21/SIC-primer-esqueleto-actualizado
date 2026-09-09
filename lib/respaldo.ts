import { desc, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { respaldosSistema, respaldosSolicitudes } from "../db/schema";

type Db = ReturnType<typeof getDb>;

export type EventoRespaldo = typeof respaldosSistema.$inferSelect;
export type SolicitudRespaldo = typeof respaldosSolicitudes.$inferSelect;
export type SaludRespaldo = "al_dia" | "atrasado" | "critico" | "sin_datos";

export type EstadoRespaldos = {
  salud: SaludRespaldo;
  mensaje: string;
  ultimoCorrecto: EventoRespaldo | null;
  recientes: EventoRespaldo[];
  solicitudPendiente: (SolicitudRespaldo & { minutosPendiente: number; demorada: boolean }) | null;
};

/** Ventanas de tolerancia para el respaldo nocturno: dan margen a que cron corra un poco
 *  tarde una noche puntual antes de mostrar advertencia, y a dos noches seguidas falladas
 *  antes de mostrar crítico. Se asume una corrida programada por día. */
const HORAS_ATRASO_ADVERTENCIA = 26;
const HORAS_ATRASO_CRITICO = 50;

/** Minutos a partir de los cuales una solicitud pendiente se marca como "demorada": el
 *  cron corto (--atender-solicitudes) está pensado para correr cada pocos minutos, así
 *  que pasado este margen lo más probable es que no esté programado en el servidor. */
const MINUTOS_SOLICITUD_DEMORADA = 10;

/**
 * Estado de los respaldos para la pantalla de Configuración. No lee el disco del servidor
 * ni ejecuta nada: solo consulta la bitácora que escribe scripts/respaldo-postgresql.sh.
 * Por eso la ausencia total de registros también cuenta como crítico — si el script nunca
 * corrió o nunca pudo conectarse a la base, no hay fila que leer, y eso es tan grave como
 * un registro con estado "error".
 */
export async function obtenerEstadoRespaldos(db: Db): Promise<EstadoRespaldos> {
  const [recientes, solicitudFila] = await Promise.all([
    db.select().from(respaldosSistema).orderBy(desc(respaldosSistema.iniciadoEn)).limit(20),
    db.select().from(respaldosSolicitudes).where(eq(respaldosSolicitudes.estado, "pendiente")).orderBy(respaldosSolicitudes.solicitadoEn).limit(1),
  ]);

  const solicitudPendiente = solicitudFila[0]
    ? (() => {
        const minutosPendiente = Math.round((Date.now() - solicitudFila[0].solicitadoEn.getTime()) / 60_000);
        return { ...solicitudFila[0], minutosPendiente, demorada: minutosPendiente >= MINUTOS_SOLICITUD_DEMORADA };
      })()
    : null;

  if (!recientes.length) {
    return {
      salud: "sin_datos",
      mensaje: "Todavía no hay ningún respaldo registrado. Verifique que scripts/respaldo-postgresql.sh esté programado en el servidor.",
      ultimoCorrecto: null,
      recientes: [],
      solicitudPendiente,
    };
  }

  const ultimoCorrecto = recientes.find(evento => evento.estado === "correcto") ?? null;
  const ultimo = recientes[0];

  if (!ultimoCorrecto) {
    return { salud: "critico", mensaje: "Ningún respaldo reciente terminó correctamente.", ultimoCorrecto: null, recientes, solicitudPendiente };
  }

  const horasDesdeUltimo = (Date.now() - ultimoCorrecto.iniciadoEn.getTime()) / 3_600_000;

  if (ultimo.estado === "error" && ultimo.id !== ultimoCorrecto.id) {
    return {
      salud: "critico",
      mensaje: `El respaldo más reciente falló (${fechaLegible(ultimo.iniciadoEn)}). El último correcto fue ${fechaLegible(ultimoCorrecto.iniciadoEn)}.`,
      ultimoCorrecto,
      recientes,
      solicitudPendiente,
    };
  }
  if (horasDesdeUltimo > HORAS_ATRASO_CRITICO) {
    return {
      salud: "critico",
      mensaje: `No hay un respaldo correcto desde ${fechaLegible(ultimoCorrecto.iniciadoEn)}. Verifique que el respaldo programado siga corriendo en el servidor.`,
      ultimoCorrecto,
      recientes,
      solicitudPendiente,
    };
  }
  if (horasDesdeUltimo > HORAS_ATRASO_ADVERTENCIA) {
    return {
      salud: "atrasado",
      mensaje: `El último respaldo correcto fue ${fechaLegible(ultimoCorrecto.iniciadoEn)}. Debería haber uno más reciente.`,
      ultimoCorrecto,
      recientes,
      solicitudPendiente,
    };
  }
  return {
    salud: "al_dia",
    mensaje: `Último respaldo correcto: ${fechaLegible(ultimoCorrecto.iniciadoEn)}.`,
    ultimoCorrecto,
    recientes,
    solicitudPendiente,
  };
}

export type ResultadoSolicitud = { creada: boolean; solicitud: SolicitudRespaldo };

/**
 * Deja pedido un respaldo manual para que scripts/respaldo-postgresql.sh
 * --atender-solicitudes lo genere en su próxima corrida (pensada cada pocos minutos). La
 * aplicación nunca ejecuta pg_dump por sí misma.
 *
 * Idempotente: si ya hay una solicitud pendiente, no crea una segunda — dos clics seguidos
 * (o dos administradores a la vez) no deben encolar dos respaldos.
 */
export async function solicitarRespaldo(db: Db, usuario: { id: string; nombre: string }): Promise<ResultadoSolicitud> {
  const [pendiente] = await db.select().from(respaldosSolicitudes)
    .where(eq(respaldosSolicitudes.estado, "pendiente")).orderBy(respaldosSolicitudes.solicitadoEn).limit(1);
  if (pendiente) return { creada: false, solicitud: pendiente };

  const [solicitud] = await db.insert(respaldosSolicitudes).values({
    solicitadoPor: usuario.id,
    solicitadoPorNombre: usuario.nombre,
  }).returning();
  return { creada: true, solicitud };
}

function fechaLegible(fecha: Date) {
  return fecha.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" });
}
