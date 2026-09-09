import { desc } from "drizzle-orm";
import type { getDb } from "../db";
import { respaldosSistema } from "../db/schema";

type Db = ReturnType<typeof getDb>;

export type EventoRespaldo = typeof respaldosSistema.$inferSelect;
export type SaludRespaldo = "al_dia" | "atrasado" | "critico" | "sin_datos";

export type EstadoRespaldos = {
  salud: SaludRespaldo;
  mensaje: string;
  ultimoCorrecto: EventoRespaldo | null;
  recientes: EventoRespaldo[];
};

/** Ventanas de tolerancia para el respaldo nocturno: dan margen a que cron corra un poco
 *  tarde una noche puntual antes de mostrar advertencia, y a dos noches seguidas falladas
 *  antes de mostrar crítico. Se asume una corrida programada por día. */
const HORAS_ATRASO_ADVERTENCIA = 26;
const HORAS_ATRASO_CRITICO = 50;

/**
 * Estado de los respaldos para la pantalla de Configuración. No lee el disco del servidor
 * ni ejecuta nada: solo consulta la bitácora que escribe scripts/respaldo-postgresql.sh.
 * Por eso la ausencia total de registros también cuenta como crítico — si el script nunca
 * corrió o nunca pudo conectarse a la base, no hay fila que leer, y eso es tan grave como
 * un registro con estado "error".
 */
export async function obtenerEstadoRespaldos(db: Db): Promise<EstadoRespaldos> {
  const recientes = await db.select().from(respaldosSistema).orderBy(desc(respaldosSistema.iniciadoEn)).limit(20);

  if (!recientes.length) {
    return {
      salud: "sin_datos",
      mensaje: "Todavía no hay ningún respaldo registrado. Verifique que scripts/respaldo-postgresql.sh esté programado en el servidor.",
      ultimoCorrecto: null,
      recientes: [],
    };
  }

  const ultimoCorrecto = recientes.find(evento => evento.estado === "correcto") ?? null;
  const ultimo = recientes[0];

  if (!ultimoCorrecto) {
    return { salud: "critico", mensaje: "Ningún respaldo reciente terminó correctamente.", ultimoCorrecto: null, recientes };
  }

  const horasDesdeUltimo = (Date.now() - ultimoCorrecto.iniciadoEn.getTime()) / 3_600_000;

  if (ultimo.estado === "error" && ultimo.id !== ultimoCorrecto.id) {
    return {
      salud: "critico",
      mensaje: `El respaldo más reciente falló (${fechaLegible(ultimo.iniciadoEn)}). El último correcto fue ${fechaLegible(ultimoCorrecto.iniciadoEn)}.`,
      ultimoCorrecto,
      recientes,
    };
  }
  if (horasDesdeUltimo > HORAS_ATRASO_CRITICO) {
    return {
      salud: "critico",
      mensaje: `No hay un respaldo correcto desde ${fechaLegible(ultimoCorrecto.iniciadoEn)}. Verifique que el respaldo programado siga corriendo en el servidor.`,
      ultimoCorrecto,
      recientes,
    };
  }
  if (horasDesdeUltimo > HORAS_ATRASO_ADVERTENCIA) {
    return {
      salud: "atrasado",
      mensaje: `El último respaldo correcto fue ${fechaLegible(ultimoCorrecto.iniciadoEn)}. Debería haber uno más reciente.`,
      ultimoCorrecto,
      recientes,
    };
  }
  return {
    salud: "al_dia",
    mensaje: `Último respaldo correcto: ${fechaLegible(ultimoCorrecto.iniciadoEn)}.`,
    ultimoCorrecto,
    recientes,
  };
}

function fechaLegible(fecha: Date) {
  return fecha.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" });
}
