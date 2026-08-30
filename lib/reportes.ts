import { desc, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { importacionesBalanza, lineasBalanza } from "../db/schema";

export type TipoReporte = "flujo-efectivo" | "balanza-anual" | "cambio-patrimonio" | "situacion-comparativa" | "resultado-comparativo";
export type Granularidad = "dia" | "mes" | "trimestre" | "anio";
export type FilaReporte = { concepto: string; codigo?: string; actual: number; anterior?: number; variacion?: number; esTotal?: boolean };
export type ReporteFinanciero = { tipo: TipoReporte; titulo: string; descripcion: string; periodo: number; periodoComparativo?: number; moneda: "NIO"; fuente: string; columnas: string[]; filas: FilaReporte[]; generadoEn: string };
type Db = ReturnType<typeof getDb>;
type BalanzaPeriodo = { periodo: string; filas: { codigo: string; concepto: string; debe: number; haber: number; saldo: number }[] };
const filaComparativa = (concepto:string, actual:number, anterior:number, extra:Partial<FilaReporte>={}):FilaReporte => ({ concepto, actual, anterior, variacion:actual-anterior, ...extra });

export const catalogoReportes: { tipo: TipoReporte; titulo: string; descripcion: string }[] = [
  { tipo:"flujo-efectivo", titulo:"Estado de flujo de efectivo", descripcion:"Entradas y salidas clasificadas por operación, inversión y financiamiento." },
  { tipo:"balanza-anual", titulo:"Balanza de comprobación anual", descripcion:"Saldos deudores y acreedores acumulados del período." },
  { tipo:"cambio-patrimonio", titulo:"Estado de cambio en el patrimonio", descripcion:"Movimientos que explican la variación del patrimonio institucional." },
  { tipo:"situacion-comparativa", titulo:"Estado de situación comparativo", descripcion:"Activos, pasivos y patrimonio comparados entre dos períodos." },
  { tipo:"resultado-comparativo", titulo:"Estado de resultado comparativo", descripcion:"Ingresos, gastos y resultado neto comparados entre dos períodos." },
];

export function esTipoReporte(value:string): value is TipoReporte { return catalogoReportes.some(item=>item.tipo===value); }

function datosPeriodo(granularidad:Granularidad, periodo:string){
  const anio=Number(periodo.slice(0,4)); if(!Number.isInteger(anio) || anio < 2000 || anio > 2100)throw new Error("Período inválido");
  if(granularidad==="anio")return{anio,factor:1,etiqueta:String(anio)};
  if(granularidad==="trimestre"){const quarter=Number(periodo.split("T")[1]);if(quarter<1||quarter>4)throw new Error("Trimestre inválido");return{anio,factor:.25,etiqueta:`T${quarter} ${anio}`};}
  if(granularidad==="mes"){const month=Number(periodo.slice(5,7));if(month<1||month>12)throw new Error("Mes inválido");const etiqueta=new Intl.DateTimeFormat("es-NI",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(anio,month-1,1)));return{anio,factor:1/12,etiqueta};}
  const date=new Date(`${periodo}T00:00:00Z`);if(Number.isNaN(date.getTime()))throw new Error("Fecha inválida");return{anio,factor:1/365,etiqueta:new Intl.DateTimeFormat("es-NI",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(date)};
}

const periodoBalanza = (granularidad: Granularidad, periodo: string) => granularidad === "anio" ? `${periodo.slice(0,4)}-12` : periodo.slice(0,7);
const claseCuenta = (codigo: string) => codigo.startsWith("1") ? "activo" : codigo.startsWith("2") ? "pasivo" : codigo.startsWith("3") ? "patrimonio" : codigo.startsWith("4") ? "ingreso" : codigo.startsWith("5") ? "gasto" : "otra";

async function obtenerBalanza(db: Db, periodo: string): Promise<BalanzaPeriodo | null> {
  const [importacion] = await db.select().from(importacionesBalanza).where(eq(importacionesBalanza.periodo, periodo)).orderBy(desc(importacionesBalanza.creadoEn)).limit(1);
  if (!importacion) return null;
  const filas = await db.select().from(lineasBalanza).where(eq(lineasBalanza.importacionId, importacion.id));
  return { periodo: importacion.periodo, filas: filas.map(fila => ({ codigo: fila.cuentaCodigo, concepto: fila.cuentaNombre, debe: Number(fila.debe), haber: Number(fila.haber), saldo: Number(fila.saldo) })) };
}

function reporteBalanza(tipo: TipoReporte, actual: BalanzaPeriodo, anterior: BalanzaPeriodo | null, etiqueta: string, etiquetaComparativa: string): ReporteFinanciero {
  const meta = catalogoReportes.find(item => item.tipo === tipo)!;
  if (tipo === "balanza-anual") {
    const filas = actual.filas.map(fila => ({ codigo: fila.codigo, concepto: fila.concepto, actual: fila.debe, anterior: fila.haber, variacion: fila.debe - fila.haber }));
    const debitos = filas.reduce((total, fila) => total + fila.actual, 0), creditos = filas.reduce((total, fila) => total + (fila.anterior ?? 0), 0);
    filas.push({ concepto: "Total", actual: debitos, anterior: creditos, variacion: debitos - creditos, esTotal: true });
    return { tipo, titulo: meta.titulo, descripcion: meta.descripcion, periodo: Number(actual.periodo.slice(0,4)), moneda: "NIO", fuente: `Balanza importada ${actual.periodo}`, columnas: ["Cuenta", "Débito", "Crédito", "Diferencia"], filas, generadoEn: new Date().toISOString() };
  }

  const anteriores = new Map((anterior?.filas ?? []).map(fila => [fila.codigo, fila]));
  const clases = tipo === "resultado-comparativo" ? ["ingreso", "gasto"] : ["activo", "pasivo", "patrimonio"];
  const filas = actual.filas
    .filter(fila => clases.includes(claseCuenta(fila.codigo)))
    .map(fila => {
      const saldoAnterior = anteriores.get(fila.codigo)?.saldo ?? 0;
      return filaComparativa(fila.concepto, fila.saldo, saldoAnterior, { codigo: fila.codigo });
    });

  for (const clase of clases) {
    const actuales = actual.filas.filter(fila => claseCuenta(fila.codigo) === clase).reduce((total, fila) => total + fila.saldo, 0);
    const previos = (anterior?.filas ?? []).filter(fila => claseCuenta(fila.codigo) === clase).reduce((total, fila) => total + fila.saldo, 0);
    filas.push(filaComparativa(`Total ${clase}`, actuales, previos, { esTotal: true }));
  }

  return { tipo, titulo: meta.titulo, descripcion: meta.descripcion, periodo: Number(actual.periodo.slice(0,4)), periodoComparativo: anterior ? Number(anterior.periodo.slice(0,4)) : undefined, moneda: "NIO", fuente: `Balanza importada ${actual.periodo}`, columnas: ["Concepto", etiqueta, etiquetaComparativa, "Variación"], filas, generadoEn: new Date().toISOString() };
}

export async function generarReportePorPeriodoDesdeDb(db: Db, tipo: TipoReporte, granularidad: Granularidad, periodo: string, comparar: string): Promise<(ReporteFinanciero & { granularidad: Granularidad; periodoEtiqueta: string; comparativoEtiqueta: string }) | null> {
  const actualDatos = datosPeriodo(granularidad, periodo), anteriorDatos = datosPeriodo(granularidad, comparar);
  const actual = await obtenerBalanza(db, periodoBalanza(granularidad, periodo));
  if (!actual) throw new Error(`No hay balanza importada para ${periodoBalanza(granularidad, periodo)}`);
  const anterior = await obtenerBalanza(db, periodoBalanza(granularidad, comparar));
  return { ...reporteBalanza(tipo, actual, anterior, actualDatos.etiqueta, anteriorDatos.etiqueta), granularidad, periodoEtiqueta: actualDatos.etiqueta, comparativoEtiqueta: anteriorDatos.etiqueta };
}

export function reporteCsv(reporte:ReporteFinanciero):string {
  const escape=(value:string|number|undefined)=>`"${String(value??"").replaceAll('"','""')}"`;
  const rows=[reporte.columnas.map(escape).join(","),...reporte.filas.map(f=>[f.codigo?`${f.codigo} · ${f.concepto}`:f.concepto,f.actual,f.anterior,f.variacion].slice(0,reporte.columnas.length).map(escape).join(","))];
  return `\uFEFF${rows.join("\n")}`;
}
