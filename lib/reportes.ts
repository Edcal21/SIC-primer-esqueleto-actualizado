import { desc, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { importacionesBalanza, lineasBalanza } from "../db/schema";

export type TipoReporte = "flujo-efectivo" | "balanza-anual" | "cambio-patrimonio" | "situacion-comparativa" | "resultado-comparativo";
export type Granularidad = "dia" | "mes" | "trimestre" | "anio";
export type FilaReporte = { concepto: string; codigo?: string; actual: number; anterior?: number; variacion?: number; esTotal?: boolean };
export type ReporteFinanciero = { tipo: TipoReporte; titulo: string; descripcion: string; periodo: number; periodoComparativo?: number; moneda: "NIO"; fuente: string; columnas: string[]; filas: FilaReporte[]; generadoEn: string };
type Db = ReturnType<typeof getDb>;
type BalanzaPeriodo = { periodo: string; filas: { codigo: string; concepto: string; debe: number; haber: number; saldo: number }[] };

type CuentaSaldo = { codigo: string; concepto: string; clase: "activo"|"pasivo"|"patrimonio"|"ingreso"|"gasto"; saldo2025: number; saldo2026: number };
const cuentas: CuentaSaldo[] = [
  { codigo:"11010101", concepto:"Caja general", clase:"activo", saldo2025:185000, saldo2026:240000 },
  { codigo:"11010201", concepto:"Bancos", clase:"activo", saldo2025:890000, saldo2026:1125000 },
  { codigo:"12010101", concepto:"Cuentas por cobrar", clase:"activo", saldo2025:310000, saldo2026:275000 },
  { codigo:"13010101", concepto:"Propiedad y equipo", clase:"activo", saldo2025:2350000, saldo2026:2510000 },
  { codigo:"21010101", concepto:"Proveedores", clase:"pasivo", saldo2025:420000, saldo2026:385000 },
  { codigo:"22010101", concepto:"Obligaciones financieras", clase:"pasivo", saldo2025:730000, saldo2026:650000 },
  { codigo:"31010101", concepto:"Patrimonio institucional", clase:"patrimonio", saldo2025:2315000, saldo2026:2800000 },
  { codigo:"41010101", concepto:"Ofrendas recibidas", clase:"ingreso", saldo2025:2740000, saldo2026:3020000 },
  { codigo:"41010102", concepto:"Diezmos recibidos", clase:"ingreso", saldo2025:1680000, saldo2026:1890000 },
  { codigo:"51010101", concepto:"Gastos de personal", clase:"gasto", saldo2025:2050000, saldo2026:2240000 },
  { codigo:"51020101", concepto:"Servicios y mantenimiento", clase:"gasto", saldo2025:980000, saldo2026:1075000 },
  { codigo:"51030101", concepto:"Programas institucionales", clase:"gasto", saldo2025:1120000, saldo2026:1280000 },
];

const valor = (cuenta: CuentaSaldo, anio: number) => anio === 2025 ? cuenta.saldo2025 : cuenta.saldo2026;
const sum = (items: CuentaSaldo[], anio: number) => items.reduce((total,item)=>total+valor(item,anio),0);
const filaComparativa = (concepto:string, actual:number, anterior:number, extra:Partial<FilaReporte>={}):FilaReporte => ({ concepto, actual, anterior, variacion:actual-anterior, ...extra });
const porClase = (clase:CuentaSaldo["clase"]) => cuentas.filter(c=>c.clase===clase);

export const catalogoReportes: { tipo: TipoReporte; titulo: string; descripcion: string }[] = [
  { tipo:"flujo-efectivo", titulo:"Estado de flujo de efectivo", descripcion:"Entradas y salidas clasificadas por operación, inversión y financiamiento." },
  { tipo:"balanza-anual", titulo:"Balanza de comprobación anual", descripcion:"Saldos deudores y acreedores acumulados del período." },
  { tipo:"cambio-patrimonio", titulo:"Estado de cambio en el patrimonio", descripcion:"Movimientos que explican la variación del patrimonio institucional." },
  { tipo:"situacion-comparativa", titulo:"Estado de situación comparativo", descripcion:"Activos, pasivos y patrimonio comparados entre dos períodos." },
  { tipo:"resultado-comparativo", titulo:"Estado de resultado comparativo", descripcion:"Ingresos, gastos y resultado neto comparados entre dos períodos." },
];

export function esTipoReporte(value:string): value is TipoReporte { return catalogoReportes.some(item=>item.tipo===value); }

export function generarReporte(tipo:TipoReporte, anio:number, comparar:number):ReporteFinanciero {
  if (![2025,2026].includes(anio) || ![2025,2026].includes(comparar)) throw new Error("Solo existen datos demostrativos para 2025 y 2026");
  const meta=catalogoReportes.find(item=>item.tipo===tipo)!;
  let filas:FilaReporte[]=[]; let columnas=["Concepto",String(anio)];
  if(tipo==="balanza-anual") {
    filas=cuentas.map(c=>({codigo:c.codigo,concepto:c.concepto,actual:c.clase==="activo"||c.clase==="gasto"?valor(c,anio):0,anterior:c.clase==="pasivo"||c.clase==="patrimonio"||c.clase==="ingreso"?valor(c,anio):0}));
    const debitos=filas.reduce((t,f)=>t+f.actual,0), creditos=filas.reduce((t,f)=>t+(f.anterior??0),0);
    filas.push({concepto:"Total",actual:debitos,anterior:creditos,variacion:debitos-creditos,esTotal:true}); columnas=["Cuenta","Débito","Crédito","Diferencia"];
  } else if(tipo==="resultado-comparativo") {
    const ingresos=porClase("ingreso"), gastos=porClase("gasto");
    filas=[...ingresos.map(c=>filaComparativa(c.concepto,valor(c,anio),valor(c,comparar),{codigo:c.codigo})),{concepto:"Total ingresos",actual:sum(ingresos,anio),anterior:sum(ingresos,comparar),variacion:sum(ingresos,anio)-sum(ingresos,comparar),esTotal:true},...gastos.map(c=>filaComparativa(c.concepto,-valor(c,anio),-valor(c,comparar),{codigo:c.codigo})),filaComparativa("Resultado neto",sum(ingresos,anio)-sum(gastos,anio),sum(ingresos,comparar)-sum(gastos,comparar),{esTotal:true})]; columnas=["Concepto",String(anio),String(comparar),"Variación"];
  } else if(tipo==="situacion-comparativa") {
    const activos=porClase("activo"),pasivos=porClase("pasivo"),patrimonio=porClase("patrimonio"),resultadoActual=sum(porClase("ingreso"),anio)-sum(porClase("gasto"),anio),resultadoAnterior=sum(porClase("ingreso"),comparar)-sum(porClase("gasto"),comparar);
    filas=[...activos.map(c=>filaComparativa(c.concepto,valor(c,anio),valor(c,comparar),{codigo:c.codigo})),filaComparativa("Total activos",sum(activos,anio),sum(activos,comparar),{esTotal:true}),...pasivos.map(c=>filaComparativa(c.concepto,valor(c,anio),valor(c,comparar),{codigo:c.codigo})),...patrimonio.map(c=>filaComparativa(c.concepto,valor(c,anio),valor(c,comparar),{codigo:c.codigo})),filaComparativa("Resultado del período",resultadoActual,resultadoAnterior),filaComparativa("Total pasivo y patrimonio",sum(pasivos,anio)+sum(patrimonio,anio)+resultadoActual,sum(pasivos,comparar)+sum(patrimonio,comparar)+resultadoAnterior,{esTotal:true})]; columnas=["Concepto",String(anio),String(comparar),"Variación"];
  } else if(tipo==="cambio-patrimonio") {
    const inicial=valor(porClase("patrimonio")[0],comparar), resultado=sum(porClase("ingreso"),anio)-sum(porClase("gasto"),anio), ajustes=valor(porClase("patrimonio")[0],anio)-inicial-resultado;
    filas=[{concepto:"Saldo inicial",actual:inicial},{concepto:"Resultado del período",actual:resultado},{concepto:"Ajustes y aportes institucionales",actual:ajustes},{concepto:"Saldo final",actual:inicial+resultado+ajustes,esTotal:true}]; columnas=["Movimiento",String(anio)];
  } else {
    const resultado=sum(porClase("ingreso"),anio)-sum(porClase("gasto"),anio), inversion=-(valor(cuentas[3],anio)-valor(cuentas[3],comparar)), financiamiento=-(valor(cuentas[5],anio)-valor(cuentas[5],comparar)), inicial=valor(cuentas[0],comparar)+valor(cuentas[1],comparar);
    filas=[{concepto:"Flujo de actividades de operación",actual:resultado},{concepto:"Flujo de actividades de inversión",actual:inversion},{concepto:"Flujo de actividades de financiamiento",actual:financiamiento},{concepto:"Variación neta del efectivo",actual:resultado+inversion+financiamiento,esTotal:true},{concepto:"Efectivo al inicio",actual:inicial},{concepto:"Efectivo al cierre",actual:inicial+resultado+inversion+financiamiento,esTotal:true}]; columnas=["Actividad",String(anio)];
  }
  return {tipo,titulo:meta.titulo,descripcion:meta.descripcion,periodo:anio,periodoComparativo:columnas.includes(String(comparar))?comparar:undefined,moneda:"NIO",fuente:"Datos demostrativos",columnas,filas,generadoEn:new Date().toISOString()};
}

function datosPeriodo(granularidad:Granularidad, periodo:string){
  const anio=Number(periodo.slice(0,4)); if(![2025,2026].includes(anio))throw new Error("Solo existen datos demostrativos para 2025 y 2026");
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
  if (!["balanza-anual", "situacion-comparativa", "resultado-comparativo"].includes(tipo)) return null;
  const actualDatos = datosPeriodo(granularidad, periodo), anteriorDatos = datosPeriodo(granularidad, comparar);
  const actual = await obtenerBalanza(db, periodoBalanza(granularidad, periodo));
  if (!actual) return null;
  const anterior = await obtenerBalanza(db, periodoBalanza(granularidad, comparar));
  return { ...reporteBalanza(tipo, actual, anterior, actualDatos.etiqueta, anteriorDatos.etiqueta), granularidad, periodoEtiqueta: actualDatos.etiqueta, comparativoEtiqueta: anteriorDatos.etiqueta };
}

export function generarReportePorPeriodo(tipo:TipoReporte,granularidad:Granularidad,periodo:string,comparar:string):ReporteFinanciero&{granularidad:Granularidad;periodoEtiqueta:string;comparativoEtiqueta:string}{
  const actual=datosPeriodo(granularidad,periodo),anterior=datosPeriodo(granularidad,comparar),reporte=generarReporte(tipo,actual.anio,anterior.anio);
  reporte.filas=reporte.filas.map(fila=>{
    const factorAnterior=tipo==="balanza-anual"?actual.factor:anterior.factor;
    const scaledActual=fila.actual*actual.factor,scaledAnterior=fila.anterior===undefined?undefined:fila.anterior*factorAnterior;
    return{...fila,actual:scaledActual,anterior:scaledAnterior,variacion:fila.variacion===undefined?undefined:scaledActual-(scaledAnterior??0)};
  });
  reporte.columnas=reporte.columnas.map((col,index)=>index===1?actual.etiqueta:index===2?anterior.etiqueta:col);
  return{...reporte,granularidad,periodoEtiqueta:actual.etiqueta,comparativoEtiqueta:anterior.etiqueta};
}

export function reporteCsv(reporte:ReporteFinanciero):string {
  const escape=(value:string|number|undefined)=>`"${String(value??"").replaceAll('"','""')}"`;
  const rows=[reporte.columnas.map(escape).join(","),...reporte.filas.map(f=>[f.codigo?`${f.codigo} · ${f.concepto}`:f.concepto,f.actual,f.anterior,f.variacion].slice(0,reporte.columnas.length).map(escape).join(","))];
  return `\uFEFF${rows.join("\n")}`;
}
