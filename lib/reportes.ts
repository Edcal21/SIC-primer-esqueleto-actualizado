import { asc, desc, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { importacionesBalanza, importacionesSituacionFinanciera, lineasBalanza, lineasSituacionFinanciera, reportesCatalogo } from "../db/schema";

export type TipoReporte = "flujo-efectivo" | "balanza-anual" | "cambio-patrimonio" | "situacion-comparativa" | "resultado-comparativo" | "minutas";
export type Granularidad = "dia" | "mes" | "trimestre" | "anio";
export type FilaReporte = { concepto: string; codigo?: string; actual: number; anterior?: number; variacion?: number; esTotal?: boolean; esEncabezado?: boolean };
export type ReporteFinanciero = { tipo: TipoReporte; titulo: string; descripcion: string; periodo: number; periodoComparativo?: number; periodoFuente?: string; periodoComparativoFuente?: string; moneda: "NIO"; fuente: string; columnas: string[]; filas: FilaReporte[]; generadoEn: string };
type Db = ReturnType<typeof getDb>;
type BalanzaPeriodo = { periodo: string; filas: { codigo: string; concepto: string; debe: number; haber: number; saldo: number }[] };
type SituacionPeriodo = { periodo: string; filas: { concepto: string; saldoFinal: number; esTotal: boolean }[] };
const filaComparativa = (concepto:string, actual:number, anterior:number, extra:Partial<FilaReporte>={}):FilaReporte => ({ concepto, actual, anterior, variacion:actual-anterior, ...extra });

export const catalogoReportes: { tipo: TipoReporte; titulo: string; descripcion: string }[] = [
  { tipo:"flujo-efectivo", titulo:"Estado de flujo de efectivo", descripcion:"Compara el Saldo Final del Estado de Situación Financiera entre períodos." },
  { tipo:"balanza-anual", titulo:"Balanza de comprobación anual", descripcion:"Saldos deudores y acreedores acumulados del período." },
  { tipo:"cambio-patrimonio", titulo:"Estado de cambio en el patrimonio", descripcion:"Movimientos que explican la variación del patrimonio institucional." },
  { tipo:"situacion-comparativa", titulo:"Estado de situación comparativo", descripcion:"Activos, pasivos y patrimonio comparados entre dos períodos." },
  { tipo:"resultado-comparativo", titulo:"Estado de resultado comparativo", descripcion:"Ingresos, gastos y resultado neto comparados entre dos períodos." },
  { tipo:"minutas", titulo:"Reporte de minutas", descripcion:"Minutas ingresadas filtradas por iglesia y período de tiempo." },
];

export function esTipoReporte(value:string): value is TipoReporte { return catalogoReportes.some(item=>item.tipo===value); }

export async function obtenerCatalogoReportes(db: Db) {
  try {
    const rows = await db.select({
      tipo: reportesCatalogo.tipo,
      titulo: reportesCatalogo.titulo,
      descripcion: reportesCatalogo.descripcion,
      icono: reportesCatalogo.icono,
    }).from(reportesCatalogo).where(eq(reportesCatalogo.estado, "activo")).orderBy(asc(reportesCatalogo.orden));
    if (!rows.length) return catalogoReportes.map((item, index) => ({ ...item, icono: ["bank", "catalog", "dashboard", "reports", "entry", "reports"][index] ?? "reports" }));
    const disponibles = rows.map(row => ({ ...row, tipo: row.tipo as TipoReporte }));
    if (!disponibles.some(item => item.tipo === "minutas")) disponibles.push({ ...catalogoReportes.find(item => item.tipo === "minutas")!, icono: "reports" });
    return disponibles;
  } catch {
    return catalogoReportes.map((item, index) => ({ ...item, icono: ["bank", "catalog", "dashboard", "reports", "entry", "reports"][index] ?? "reports" }));
  }
}

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

async function obtenerSituacionFinanciera(db: Db, periodo: string): Promise<SituacionPeriodo | null> {
  const [importacion] = await db.select().from(importacionesSituacionFinanciera)
    .where(eq(importacionesSituacionFinanciera.periodo, periodo))
    .orderBy(desc(importacionesSituacionFinanciera.creadoEn)).limit(1);
  if (!importacion) return null;
  const filas = await db.select().from(lineasSituacionFinanciera)
    .where(eq(lineasSituacionFinanciera.importacionId, importacion.id))
    .orderBy(asc(lineasSituacionFinanciera.numeroLinea));
  return { periodo: importacion.periodo, filas: filas.map(fila => ({ concepto: fila.concepto, saldoFinal: Number(fila.saldoFinal), esTotal: fila.esTotal })) };
}

const claveConcepto = (concepto: string) => concepto.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

const saldoPorConcepto = (periodo: SituacionPeriodo | null, ...conceptos: string[]) => {
  const claves = conceptos.map(claveConcepto);
  return periodo?.filas.find(fila => claves.includes(claveConcepto(fila.concepto)))?.saldoFinal ?? 0;
};
const variacionSaldo = (actual: SituacionPeriodo, anterior: SituacionPeriodo | null, ...conceptos: string[]) =>
  saldoPorConcepto(actual, ...conceptos) - saldoPorConcepto(anterior, ...conceptos);
const sumar = (valores: number[]) => valores.reduce((total, valor) => total + valor, 0);
const totalExcedentes = (periodo: SituacionPeriodo | null) => sumar([
  saldoPorConcepto(periodo, "Excedente Ingresos s/Egresos acumulados"),
  saldoPorConcepto(periodo, "Excedente Ingresos s/Egresos del ejercicio"),
]);
const etiquetaFinPeriodo = (periodo: string) => {
  const [year, month] = periodo.split("-").map(Number);
  const fecha = new Date(Date.UTC(year, month, 0));
  const mes = new Intl.DateTimeFormat("es-NI", { month: "long", timeZone: "UTC" }).format(fecha);
  return `Efectivo al ${fecha.getUTCDate()} de ${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${year}`;
};

/** Construye las líneas del formato oficial a partir de las variaciones de Saldo Final. */
export function reporteFlujoDesdeSituaciones(actual: SituacionPeriodo, anterior: SituacionPeriodo | null, etiqueta: string, etiquetaComparativa: string): ReporteFinanciero {
  const utilidad = totalExcedentes(actual) - totalExcedentes(anterior);
  const depreciacion = sumar([
    variacionSaldo(actual, anterior, "DEPRECIACION DE VEHICULOS"),
    variacionSaldo(actual, anterior, "DEPRECIACION DE MOB Y EQUIPO", "DEPRECIACION DE MOBILIARIO Y EQUIPOS"),
  ]);
  const operacion = [
    utilidad,
    depreciacion,
    0, 0, 0, 0,
    variacionSaldo(actual, anterior, "Total ACTIVOS POR IMPUESTOS DIFERIDOS"),
    0, 0, 0,
    variacionSaldo(actual, anterior, "Total ACREEDORES COMERCIALES"),
    0,
    variacionSaldo(actual, anterior, "Total IMPUESTOS CORRIENTES POR PAGAR"),
    0,
    variacionSaldo(actual, anterior, "Total OBLIGACIONES A C/P POR BENEF. A LOS EMPLEADOS"),
    0, 0,
  ];
  const cambioDeAnio = Boolean(anterior && actual.periodo.slice(0, 4) !== anterior.periodo.slice(0, 4));
  const excedenteAcumulado = cambioDeAnio ? -totalExcedentes(anterior) : 0;
  const inversion = [
    variacionSaldo(actual, anterior, "EDIFICIOS"),
    variacionSaldo(actual, anterior, "MOBILIARIO Y EQUIPOS", "MOBILIARIO Y EQUIPO DE OFICINA"),
    variacionSaldo(actual, anterior, "VEHICULOS"),
    variacionSaldo(actual, anterior, "TERRENOS"),
    variacionSaldo(actual, anterior, "Total INCREMENTO O DECREMENTO"),
    excedenteAcumulado,
  ];
  const totalOperacion = sumar(operacion), totalInversion = sumar(inversion);
  const aumentoNeto = -totalOperacion - totalInversion;
  const efectivoInicial = saldoPorConcepto(anterior, "Total ACTIVOS CORRIENTES");
  const efectivoFinal = efectivoInicial + aumentoNeto;
  const nombresOperacion = ["Utilidad o pérdida del período", "Depreciación", "Cuentas por cobrar a empleados", "Anticipos a justificar", "Cuentas por cobrar por servicios", "Deudores comerciales y otras cuentas por Cobrar", "Impuestos pagados por adelantado", "Pagos anticipados", "Depósito en garantía", "Póliza de seguros", "Acreedores Comerciales", "Certificados a plazo fijo (fondos restringidos)", "Impuestos por pagar", "Retenciones por pagar", "Gastos acumulados por pagar", "Cuentas transitorias", "Depósito sin identificar"];
  const nombresInversion = ["Edificios", "Mobiliario y Equipo de Oficina", "Vehículos", "Terrenos", "Incremento o Decremento", "Excedente Ingresos/Egresos Acumulados"];
  const filas: FilaReporte[] = [
    { concepto: "Actividades de operación", actual: 0, esTotal: true, esEncabezado: true },
    { concepto: "Flujo de efectivo de las actividades de operación", actual: 0, esTotal: true, esEncabezado: true },
    ...nombresOperacion.map((concepto, index) => ({ concepto, actual: operacion[index] })),
    { concepto: "Efectivo neto utilizado en las actividades de operación", actual: totalOperacion, esTotal: true },
    { concepto: "Flujo de efectivo de las actividades de inversión", actual: 0, esTotal: true, esEncabezado: true },
    { concepto: "Patrimonio", actual: variacionSaldo(actual, anterior, "Total PATRIMONIO IGLESIA UNIVERSAL DEL REINO DE DIOS") },
    ...nombresInversion.map((concepto, index) => ({ concepto, actual: inversion[index] })),
    { concepto: "Efectivo neto utilizado en las actividades de inversión", actual: totalInversion, esTotal: true },
    { concepto: "Efectivo neto utilizado en las actividades de financiamiento", actual: 0, esTotal: true },
    { concepto: "Aumento (Disminución) neto en el efectivo", actual: aumentoNeto, esTotal: true },
    { concepto: etiquetaFinPeriodo(anterior?.periodo ?? actual.periodo), actual: efectivoInicial, esTotal: true },
    { concepto: etiquetaFinPeriodo(actual.periodo), actual: efectivoFinal, esTotal: true },
  ];
  const meta = catalogoReportes.find(item => item.tipo === "flujo-efectivo")!;
  return {
    tipo: "flujo-efectivo", titulo: meta.titulo, descripcion: meta.descripcion,
    periodo: Number(actual.periodo.slice(0, 4)), periodoComparativo: anterior ? Number(anterior.periodo.slice(0, 4)) : undefined,
    periodoFuente: actual.periodo, periodoComparativoFuente: anterior?.periodo,
    moneda: "NIO", fuente: `Estado de Situación Financiera ${actual.periodo}`,
    columnas: ["Concepto", `${etiqueta} vs ${etiquetaComparativa}`], filas, generadoEn: new Date().toISOString(),
  };
}

/** Compara todas las líneas importadas de dos Estados de Situación Financiera. */
export function reporteSituacionComparativaDesdeSituaciones(actual: SituacionPeriodo, anterior: SituacionPeriodo | null, etiqueta: string, etiquetaComparativa: string): ReporteFinanciero {
  const filasAnteriores = new Map<string, SituacionPeriodo["filas"]>();
  for (const fila of anterior?.filas ?? []) {
    const clave = claveConcepto(fila.concepto);
    filasAnteriores.set(clave, [...(filasAnteriores.get(clave) ?? []), fila]);
  }

  const filas: FilaReporte[] = actual.filas.map(fila => {
    const clave = claveConcepto(fila.concepto);
    const coincidencias = filasAnteriores.get(clave) ?? [];
    const filaAnterior = coincidencias.shift();
    if (coincidencias.length) filasAnteriores.set(clave, coincidencias); else filasAnteriores.delete(clave);
    return filaComparativa(fila.concepto, fila.saldoFinal, filaAnterior?.saldoFinal ?? 0, { esTotal: fila.esTotal || filaAnterior?.esTotal });
  });

  for (const pendientes of filasAnteriores.values()) {
    for (const fila of pendientes) filas.push(filaComparativa(fila.concepto, 0, fila.saldoFinal, { esTotal: fila.esTotal }));
  }

  const meta = catalogoReportes.find(item => item.tipo === "situacion-comparativa")!;
  return {
    tipo: "situacion-comparativa", titulo: meta.titulo, descripcion: meta.descripcion,
    periodo: Number(actual.periodo.slice(0, 4)), periodoComparativo: anterior ? Number(anterior.periodo.slice(0, 4)) : undefined,
    periodoFuente: actual.periodo, periodoComparativoFuente: anterior?.periodo,
    moneda: "NIO", fuente: `Estados de Situación Financiera ${actual.periodo} y ${anterior?.periodo ?? etiquetaComparativa}`,
    columnas: ["Concepto", etiqueta, etiquetaComparativa, "Variación"], filas, generadoEn: new Date().toISOString(),
  };
}

function reporteBalanza(tipo: TipoReporte, actual: BalanzaPeriodo, anterior: BalanzaPeriodo | null, etiqueta: string, etiquetaComparativa: string): ReporteFinanciero {
  const meta = catalogoReportes.find(item => item.tipo === tipo)!;
  if (tipo === "balanza-anual") {
    const filas: FilaReporte[] = actual.filas.map(fila => ({ codigo: fila.codigo, concepto: fila.concepto, actual: fila.debe, anterior: fila.haber, variacion: fila.debe - fila.haber }));
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

export async function generarReportePorPeriodoDesdeDb(db: Db, tipo: TipoReporte, granularidad: Granularidad, periodo: string, comparar: string): Promise<ReporteFinanciero & { granularidad: Granularidad; periodoEtiqueta: string; comparativoEtiqueta: string }> {
  if (tipo === "minutas") throw new Error("El reporte de minutas utiliza filtros de iglesia y rango de fechas");
  const actualDatos = datosPeriodo(granularidad, periodo), anteriorDatos = datosPeriodo(granularidad, comparar);
  if (tipo === "flujo-efectivo" || tipo === "situacion-comparativa") {
    const periodoActual = periodoBalanza(granularidad, periodo), periodoAnterior = periodoBalanza(granularidad, comparar);
    const actual = await obtenerSituacionFinanciera(db, periodoActual);
    if (!actual) throw new Error(`No hay Estado de Situación Financiera importado para ${periodoActual}`);
    const anterior = await obtenerSituacionFinanciera(db, periodoAnterior);
    if (!anterior) throw new Error(`No hay Estado de Situación Financiera importado para el período comparativo ${periodoAnterior}`);
    const reporte = tipo === "flujo-efectivo"
      ? reporteFlujoDesdeSituaciones(actual, anterior, actualDatos.etiqueta, anteriorDatos.etiqueta)
      : reporteSituacionComparativaDesdeSituaciones(actual, anterior, actualDatos.etiqueta, anteriorDatos.etiqueta);
    return { ...reporte, granularidad, periodoEtiqueta: actualDatos.etiqueta, comparativoEtiqueta: anteriorDatos.etiqueta };
  }
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
