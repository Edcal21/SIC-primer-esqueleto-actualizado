import { getDb } from "../../../db";
import { registrarAuditoria } from "../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";
import { abrirPeriodo, esPeriodoValido, impedimentosParaCerrar, listarPeriodos, periodosConActividad } from "../../../lib/periodos";
import { codigoPostgres } from "../../../lib/security";

type PeriodoPayload = { periodo?: string };

/**
 * Listado de períodos administrados. Lo consulta cualquier sesión autenticada porque las pantallas
 * de captura necesitan saber si el período está cerrado para deshabilitar sus acciones.
 */
export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);

  const db = getDb();
  try {
    const periodos = await listarPeriodos(db);
    // Los impedimentos solo interesan a quien administra el cierre; para el resto son ruido.
    const puedeAdministrar = puede(user, "configuracion:administrar");
    const impedimentos = puedeAdministrar
      ? Object.fromEntries(await Promise.all(
        periodos.filter(fila => fila.estado !== "cerrado").map(async fila => [fila.periodo, await impedimentosParaCerrar(db, fila.periodo)] as const),
      ))
      : {};

    return Response.json({
      periodos,
      impedimentos,
      periodosConActividad: puedeAdministrar ? await periodosConActividad(db) : [],
      puedeAdministrar,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Accounting period listing failed", error);
    return jsonError("No se pudo cargar el control de períodos contables", 500);
  }
}

export async function POST(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "configuracion:administrar")) return jsonError("No tiene permiso para administrar períodos contables", 403);

  let body: PeriodoPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const periodo = body.periodo?.trim();
  if (!periodo || !esPeriodoValido(periodo)) return jsonError("Período inválido; use el formato AAAA-MM", 400);

  const db = getDb();
  try {
    const creado = await abrirPeriodo(db, periodo);
    await registrarAuditoria(db, {
      user,
      modulo: "Cierre contable",
      accion: "Abrió período contable",
      entidad: "periodos_contables",
      entidadId: periodo,
      detalle: `Período ${periodo} abierto para captura`,
    });
    return Response.json({ periodo: creado }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Accounting period creation failed", error);
    if (codigoPostgres(error) === "23505") {
      return jsonError("Ese período ya está registrado", 409);
    }
    return jsonError("No se pudo abrir el período contable", 500);
  }
}
