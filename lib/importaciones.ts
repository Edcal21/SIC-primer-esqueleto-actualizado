import { createHash } from "node:crypto";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { archivosImportados, conciliacionesArchivosImportados, conciliacionesBancarias, lineasReporteBancario, movimientosCuentas, reportesBancarios } from "../db/schema";
import type { UsuarioSesion } from "./auth";

export type TipoArchivoImportado = "estado_bancario" | "balanza" | "situacion_financiera" | "estado_resultado" | "catalogo_contable" | "auxiliar_contable";
export type TotalesControl = Record<string, string | number>;
type Db = ReturnType<typeof getDb>;

export type EvidenciaArchivo = {
  nombre: string;
  mime: string;
  tamano: number;
  hashSha256: string;
  bytes: Uint8Array;
  arrayBuffer: ArrayBuffer;
};

export async function prepararEvidenciaArchivo(archivo: File): Promise<EvidenciaArchivo> {
  const arrayBuffer = await archivo.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  return {
    nombre: archivo.name,
    mime: archivo.type || "application/octet-stream",
    tamano: bytes.byteLength,
    hashSha256: createHash("sha256").update(bytes).digest("hex"),
    bytes,
    arrayBuffer,
  };
}

export function claveVersionImportacion(tipo: TipoArchivoImportado, cuentaBancariaNumero: string | null, periodo: string | null) {
  return `${tipo}|${cuentaBancariaNumero?.trim() || "-"}|${periodo?.trim() || "-"}`;
}

export async function registrarArchivoImportado(db: Db, input: {
  evidencia: EvidenciaArchivo;
  tipo: TipoArchivoImportado;
  user: UsuarioSesion;
  cuentaBancariaNumero?: string | null;
  periodo?: string | null;
  cantidadRegistros: number;
  totalesControl?: TotalesControl;
  estado?: "procesado" | "error";
  mensajeError?: string | null;
}) {
  const cuenta = input.cuentaBancariaNumero?.trim() || null;
  const periodo = input.periodo?.trim() || null;
  const claveVersion = claveVersionImportacion(input.tipo, cuenta, periodo);
  // Evita que dos cargas simultáneas del mismo ámbito reciban la misma versión.
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${claveVersion}))`);
  const [ultima] = await db.select({ version: archivosImportados.version }).from(archivosImportados)
    .where(eq(archivosImportados.claveVersion, claveVersion)).orderBy(desc(archivosImportados.version)).limit(1);
  const [registrado] = await db.insert(archivosImportados).values({
    tipo: input.tipo,
    archivoNombre: input.evidencia.nombre,
    archivoMime: input.evidencia.mime,
    archivoTamano: input.evidencia.tamano,
    archivoHashSha256: input.evidencia.hashSha256,
    archivoOriginal: input.evidencia.bytes,
    cuentaBancariaNumero: cuenta,
    periodo,
    claveVersion,
    version: (ultima?.version ?? 0) + 1,
    cantidadRegistros: input.cantidadRegistros,
    totalesControl: input.totalesControl ?? {},
    estado: input.estado ?? "procesado",
    mensajeError: input.mensajeError ?? null,
    importadoPor: input.user.id,
    importadoPorNombre: input.user.nombre,
  }).returning();
  return registrado;
}

export const serializarArchivoImportado = (archivo: typeof archivosImportados.$inferSelect) => ({
  id: archivo.id,
  tipo: archivo.tipo,
  archivoNombre: archivo.archivoNombre,
  archivoMime: archivo.archivoMime,
  archivoTamano: archivo.archivoTamano,
  archivoHashSha256: archivo.archivoHashSha256,
  cuentaBancariaNumero: archivo.cuentaBancariaNumero,
  periodo: archivo.periodo,
  version: archivo.version,
  cantidadRegistros: archivo.cantidadRegistros,
  totalesControl: archivo.totalesControl,
  estado: archivo.estado,
  mensajeError: archivo.mensajeError,
  importadoPor: archivo.importadoPor,
  importadoPorNombre: archivo.importadoPorNombre,
  creadoEn: archivo.creadoEn,
});

export function relacionesArchivosConciliacion(conciliacionId: string, archivoBancoId: string | null, archivosMovimientos: Array<string | null>) {
  return [
    ...(archivoBancoId ? [{ conciliacionId, archivoImportadoId: archivoBancoId, rol: "estado_bancario" as const }] : []),
    ...[...new Set(archivosMovimientos.filter((id): id is string => Boolean(id)))]
      .map(archivoImportadoId => ({ conciliacionId, archivoImportadoId, rol: "movimientos" as const })),
  ];
}

/** Sincroniza la evidencia exacta mientras la conciliación está en borrador. Una vez aprobada,
 * sus relaciones no se vuelven a calcular y funcionan como fotografía histórica. */
export async function sincronizarArchivosConciliacion(db: Db, conciliacionId: string) {
  const [conciliacion] = await db.select().from(conciliacionesBancarias).where(eq(conciliacionesBancarias.id, conciliacionId)).limit(1);
  if (!conciliacion || conciliacion.estado !== "borrador") return [];
  const [reporte] = await db.select({ archivoImportadoId: reportesBancarios.archivoImportadoId }).from(reportesBancarios)
    .where(eq(reportesBancarios.id, conciliacion.reporteId)).limit(1);
  const movimientos = await db.select({ archivoImportadoId: movimientosCuentas.archivoImportadoId })
    .from(lineasReporteBancario)
    .innerJoin(movimientosCuentas, eq(movimientosCuentas.id, lineasReporteBancario.movimientoId))
    .where(and(
      eq(lineasReporteBancario.reporteId, conciliacion.reporteId),
      eq(lineasReporteBancario.estadoConciliacion, "conciliada"),
      isNotNull(movimientosCuentas.archivoImportadoId),
    ));

  const relaciones = relacionesArchivosConciliacion(conciliacionId, reporte?.archivoImportadoId ?? null, movimientos.map(item => item.archivoImportadoId));
  await db.delete(conciliacionesArchivosImportados).where(eq(conciliacionesArchivosImportados.conciliacionId, conciliacionId));
  if (relaciones.length) await db.insert(conciliacionesArchivosImportados).values(relaciones).onConflictDoNothing();
  return relaciones;
}
