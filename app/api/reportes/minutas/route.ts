import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { detallesMovimientos, iglesias, movimientosCuentas } from "../../../../db/schema";
import { registrarAuditoria } from "../../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../../lib/auth";

const fechaRegex = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const codigoIglesiaRegex = /^\d{8}$/;

function fechaValida(value: string) {
  if (!fechaRegex.test(value)) return false;
  const fecha = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === value;
}

function centavos(value: string) {
  const [entero, decimal = ""] = value.split(".");
  return Number(entero) * 100 + Number(decimal.padEnd(2, "0").slice(0, 2));
}

function numeroDesdeCentavos(value: number) {
  return value / 100;
}

function csv(reporte: { filas: Array<{ fecha:string; iglesiaCodigo:string|null; iglesiaNombre:string|null; cuentaBancariaNumero:string|null; referencia:string|null; concepto:string; monto:number; lineas:number; estado:string }> }) {
  const escapar = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const encabezado = ["Fecha", "Código iglesia", "Iglesia", "Cuenta bancaria", "Referencia", "Concepto", "Monto NIO", "Líneas", "Estado"];
  const filas = reporte.filas.map(fila => [fila.fecha, fila.iglesiaCodigo, fila.iglesiaNombre, fila.cuentaBancariaNumero, fila.referencia, fila.concepto, fila.monto.toFixed(2), fila.lineas, fila.estado]);
  return `\uFEFF${[encabezado, ...filas].map(fila => fila.map(escapar).join(",")).join("\n")}`;
}

export async function GET(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "reportes:ver")) return jsonError("Permiso insuficiente", 403);

  const url = new URL(request.url);
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = url.searchParams.get("desde") ?? `${hoy.slice(0, 7)}-01`;
  const hasta = url.searchParams.get("hasta") ?? hoy;
  const iglesiaCodigo = url.searchParams.get("iglesia")?.trim() || null;
  const formato = url.searchParams.get("formato") ?? "json";
  if (!fechaValida(desde) || !fechaValida(hasta)) return jsonError("El rango de fechas es inválido", 400);
  if (desde > hasta) return jsonError("La fecha inicial no puede ser posterior a la fecha final", 400);
  if (iglesiaCodigo && !codigoIglesiaRegex.test(iglesiaCodigo)) return jsonError("El código de iglesia es inválido", 400);
  if (!['json', 'csv'].includes(formato)) return jsonError("Formato no soportado", 400);

  const db = getDb();
  const filtros = [gte(movimientosCuentas.fecha, desde), lte(movimientosCuentas.fecha, hasta)];
  if (iglesiaCodigo) filtros.push(eq(movimientosCuentas.iglesiaCodigo, iglesiaCodigo));
  const movimientos = await db.select({
    id: movimientosCuentas.id,
    fecha: movimientosCuentas.fecha,
    iglesiaCodigo: movimientosCuentas.iglesiaCodigo,
    iglesiaNombre: iglesias.nombre,
    cuentaBancariaNumero: movimientosCuentas.cuentaBancariaNumero,
    referencia: movimientosCuentas.referencia,
    concepto: movimientosCuentas.concepto,
    estado: movimientosCuentas.estado,
  }).from(movimientosCuentas)
    .leftJoin(iglesias, eq(movimientosCuentas.iglesiaCodigo, iglesias.codigo))
    .where(and(...filtros)).orderBy(desc(movimientosCuentas.fecha), desc(movimientosCuentas.creadoEn)).limit(1001);

  const truncado = movimientos.length > 1000;
  const seleccionados = movimientos.slice(0, 1000);
  const ids = seleccionados.map(item => item.id);
  const detalles = ids.length ? await db.select({
    movimientoId: detallesMovimientos.movimientoId,
    tipo: detallesMovimientos.tipo,
    monto: detallesMovimientos.monto,
  }).from(detallesMovimientos).where(inArray(detallesMovimientos.movimientoId, ids)).orderBy(asc(detallesMovimientos.orden)) : [];

  const resumenDetalles = new Map<string, { monto: number; lineas: number }>();
  for (const detalle of detalles) {
    const acumulado = resumenDetalles.get(detalle.movimientoId) ?? { monto: 0, lineas: 0 };
    acumulado.lineas += 1;
    if (detalle.tipo === "debito") acumulado.monto += centavos(detalle.monto);
    resumenDetalles.set(detalle.movimientoId, acumulado);
  }
  const filas = seleccionados.map(movimiento => ({
    ...movimiento,
    monto: numeroDesdeCentavos(resumenDetalles.get(movimiento.id)?.monto ?? 0),
    lineas: resumenDetalles.get(movimiento.id)?.lineas ?? 0,
  }));
  const montoVigente = seleccionados.filter(fila => fila.estado === "registrado").reduce((total, fila) => total + (resumenDetalles.get(fila.id)?.monto ?? 0), 0);
  const catalogoIglesias = await db.select({ codigo: iglesias.codigo, nombre: iglesias.nombre, estado: iglesias.estado }).from(iglesias).orderBy(asc(iglesias.codigo));
  const reporte = {
    titulo: "Reporte de minutas", desde, hasta, iglesiaCodigo, filas,
    resumen: { total: filas.length, vigentes: filas.filter(fila => fila.estado === "registrado").length, anuladas: filas.filter(fila => fila.estado === "anulado").length, montoVigente: numeroDesdeCentavos(montoVigente) },
    iglesias: catalogoIglesias, truncado, generadoEn: new Date().toISOString(),
  };

  if (formato === "json") return Response.json({ reporte }, { headers: { "Cache-Control": "no-store" } });
  if (!puede(user, "reportes:descargar")) return jsonError("No tiene permiso para descargar reportes", 403);
  await registrarAuditoria(db, { user, modulo: "Reportes", accion: "Descargó reporte CSV", entidad: "reporte", entidadId: "minutas", detalle: `${desde} a ${hasta}${iglesiaCodigo ? ` · Iglesia ${iglesiaCodigo}` : ""}` });
  return new Response(csv(reporte), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="minutas-${desde}-${hasta}.csv"`,
    "Cache-Control": "no-store",
  } });
}
