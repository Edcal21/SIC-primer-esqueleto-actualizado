import { asc, desc, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { importacionesBalanza, importacionesSituacionFinanciera, lineasBalanza, lineasSituacionFinanciera, reportesCatalogo } from "../db/schema";

export type TipoReporte = "flujo-efectivo" | "balanza-anual" | "cambio-patrimonio" | "situacion-comparativa" | "resultado-comparativo";
export type Granularidad = "dia" | "mes" | "trimestre" | "anio";
export type FilaReporte = { concepto: string; codigo?: string; actual: number; anterior?: number; variacion?: number; esTotal?: boolean; esEncabezado?: boolean };
export type ReporteFinanciero = { tipo: TipoReporte; titulo: string; descripcion: string; periodo: number; periodoComparativo?: number; periodoFuente?: string; periodoComparativoFuente?: string; moneda: "NIO"; fuente: string; columnas: string[]; filas: FilaReporte[]; generadoEn: string; advertencias?: string[] };
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
    return rows.length ? rows.map(row => ({ ...row, tipo: row.tipo as TipoReporte })) : catalogoReportes.map((item, index) => ({ ...item, icono: ["bank", "catalog", "dashboard", "reports", "entry"][index] ?? "reports" }));
  } catch {
    return catalogoReportes.map((item, index) => ({ ...item, icono: ["bank", "catalog", "dashboard", "reports", "entry"][index] ?? "reports" }));
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
/** Los saldos vienen con dos decimales; restarlos en coma flotante deja ruido como 162447.3700000001.
 *  El flujo se redondea a dos decimales para que la cifra impresa sea la cifra calculada. */
const dosDecimales = (valor: number) => Math.round(valor * 100) / 100;
/** Etiqueta de las dos filas de saldo de efectivo; el exportador Excel las ubica por este nombre. */
export const etiquetaFinPeriodo = (periodo: string) => {
  const [year, month] = periodo.split("-").map(Number);
  const fecha = new Date(Date.UTC(year, month, 0));
  const mes = new Intl.DateTimeFormat("es-NI", { month: "long", timeZone: "UTC" }).format(fecha);
  return `Efectivo al ${fecha.getUTCDate()} de ${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${year}`;
};

/**
 * Construye el flujo de efectivo por el método indirecto a partir de dos Estados de Situación
 * Financiera importados. Sirve tanto para comparación mensual como anual.
 *
 * Convención de signos: el reporte muestra el efecto sobre el efectivo, con las salidas en
 * negativo. Por eso cada línea aplica su signo según la naturaleza de la cuenta y NO se niega el
 * total al final:
 *
 *   - resultado del período      → tal cual (una pérdida consume efectivo)
 *   - depreciación               → se suma de vuelta (es gasto que no salió de caja)
 *   - variación de activos       → con signo invertido (comprar un activo consume efectivo)
 *   - variación de pasivos       → tal cual (deber más libera efectivo)
 *   - variación de patrimonio    → tal cual (aportar capital ingresa efectivo)
 *
 * El resultado del período se toma como la VARIACIÓN del excedente entre ambos estados, no como su
 * saldo. El sistema de origen arrastra el acumulado mes a mes (el "acumulados" de un mes es el
 * total del mes anterior), así que usar el saldo arrastraría resultados ya reportados. La variación
 * funciona igual comparando meses o años y no necesita un caso especial para el cambio de año.
 */
export function reporteFlujoDesdeSituaciones(actual: SituacionPeriodo, anterior: SituacionPeriodo | null, etiqueta: string, etiquetaComparativa: string): ReporteFinanciero {
  // Un concepto que no está en ninguno de los dos estados devuelve cero y se vuelve invisible. Se
  // registra para advertirlo: puede ser una cuenta renombrada en el origen, y un cero silencioso en
  // un flujo de efectivo es indistinguible de una cuenta que no se movió.
  const ausentes: string[] = [];
  const presente = (conceptos: string[]) => {
    const claves = conceptos.map(claveConcepto);
    return [actual, anterior].some(estado => estado?.filas.some(fila => claves.includes(claveConcepto(fila.concepto))));
  };
  const registrar = <T>(conceptos: string[], valor: T) => {
    if (!presente(conceptos)) ausentes.push(conceptos[0]);
    return valor;
  };
  /** Variación de una cuenta de activo: aumentar el activo consume efectivo. */
  const usoPorActivo = (...conceptos: string[]) => registrar(conceptos, dosDecimales(-variacionSaldo(actual, anterior, ...conceptos)));
  /** Variación de una cuenta de pasivo o patrimonio: aumentarla libera efectivo. */
  const origenPorPasivo = (...conceptos: string[]) => registrar(conceptos, dosDecimales(variacionSaldo(actual, anterior, ...conceptos)));

  const resultadoPeriodo = dosDecimales(sumar([
    registrar(["Excedente Ingresos s/Egresos acumulados"], variacionSaldo(actual, anterior, "Excedente Ingresos s/Egresos acumulados")),
    registrar(["Excedente Ingresos s/Egresos del ejercicio"], variacionSaldo(actual, anterior, "Excedente Ingresos s/Egresos del ejercicio")),
  ]));
  // Las cuentas de depreciación son negativas y se vuelven más negativas: invertir su variación
  // devuelve el gasto del período, que se suma porque nunca salió de caja.
  const depreciacion = dosDecimales(-sumar([
    registrar(["DEPRECIACION DE VEHICULOS"], variacionSaldo(actual, anterior, "DEPRECIACION DE VEHICULOS")),
    registrar(["DEPRECIACION DE MOB Y EQUIPO", "DEPRECIACION DE MOBILIARIO Y EQUIPOS"], variacionSaldo(actual, anterior, "DEPRECIACION DE MOB Y EQUIPO", "DEPRECIACION DE MOBILIARIO Y EQUIPOS")),
  ]));

  const operacion = [
    resultadoPeriodo,
    depreciacion,
    0, 0, 0, 0,
    usoPorActivo("Total ACTIVOS POR IMPUESTOS DIFERIDOS"),
    0, 0, 0,
    origenPorPasivo("Total ACREEDORES COMERCIALES"),
    0,
    origenPorPasivo("Total IMPUESTOS CORRIENTES POR PAGAR"),
    0,
    origenPorPasivo("Total OBLIGACIONES A C/P POR BENEF. A LOS EMPLEADOS"),
    0, 0,
  ];
  const inversion = [
    usoPorActivo("EDIFICIOS"),
    usoPorActivo("MOBILIARIO Y EQUIPOS", "MOBILIARIO Y EQUIPO DE OFICINA"),
    usoPorActivo("VEHICULOS"),
    usoPorActivo("TERRENOS"),
    origenPorPasivo("Total INCREMENTO O DECREMENTO"),
    // El arrastre del excedente acumulado es una reclasificación dentro del patrimonio: ya está
    // recogido en el resultado del período y no mueve efectivo.
    0,
  ];

  const totalOperacion = dosDecimales(sumar(operacion)), totalInversion = dosDecimales(sumar(inversion));
  const aportesPatrimonio = origenPorPasivo("Total PATRIMONIO IGLESIA UNIVERSAL DEL REINO DE DIOS");
  const aumentoNeto = dosDecimales(totalOperacion + totalInversion + aportesPatrimonio);
  // "Total EFECTIVO" es el saldo de caja y bancos. Se cae a activos corrientes solo si el estado no
  // trae esa línea: no son equivalentes en cuanto exista una cuenta por cobrar corriente.
  registrar(["Total EFECTIVO"], null);
  const efectivoInicial = saldoPorConcepto(anterior, "Total EFECTIVO", "Total ACTIVOS CORRIENTES");
  const efectivoFinal = dosDecimales(efectivoInicial + aumentoNeto);
  const efectivoDeclarado = saldoPorConcepto(actual, "Total EFECTIVO", "Total ACTIVOS CORRIENTES");
  const descuadre = dosDecimales(efectivoFinal - efectivoDeclarado);

  // Las posiciones que el formato oficial contempla pero el estado de origen no alimenta. Se listan
  // como advertencia informativa para que nadie las lea como "no hubo movimiento".
  const sinFuente = ["Cuentas por cobrar a empleados", "Anticipos a justificar", "Cuentas por cobrar por servicios", "Deudores comerciales y otras cuentas por Cobrar", "Pagos anticipados", "Depósito en garantía", "Póliza de seguros", "Certificados a plazo fijo (fondos restringidos)", "Retenciones por pagar", "Cuentas transitorias", "Depósito sin identificar"];
  const nombresOperacion = ["Utilidad o pérdida del período", "Depreciación", "Cuentas por cobrar a empleados", "Anticipos a justificar", "Cuentas por cobrar por servicios", "Deudores comerciales y otras cuentas por Cobrar", "Impuestos pagados por adelantado", "Pagos anticipados", "Depósito en garantía", "Póliza de seguros", "Acreedores Comerciales", "Certificados a plazo fijo (fondos restringidos)", "Impuestos por pagar", "Retenciones por pagar", "Gastos acumulados por pagar", "Cuentas transitorias", "Depósito sin identificar"];
  const nombresInversion = ["Edificios", "Mobiliario y Equipo de Oficina", "Vehículos", "Terrenos", "Incremento o Decremento", "Excedente Ingresos/Egresos Acumulados"];
  const filas: FilaReporte[] = [
    { concepto: "Actividades de operación", actual: 0, esTotal: true, esEncabezado: true },
    { concepto: "Flujo de efectivo de las actividades de operación", actual: 0, esTotal: true, esEncabezado: true },
    ...nombresOperacion.map((concepto, index) => ({ concepto, actual: operacion[index] })),
    { concepto: "Efectivo neto utilizado en las actividades de operación", actual: totalOperacion, esTotal: true },
    { concepto: "Flujo de efectivo de las actividades de inversión", actual: 0, esTotal: true, esEncabezado: true },
    { concepto: "Patrimonio", actual: aportesPatrimonio },
    ...nombresInversion.map((concepto, index) => ({ concepto, actual: inversion[index] })),
    { concepto: "Efectivo neto utilizado en las actividades de inversión", actual: totalInversion, esTotal: true },
    { concepto: "Efectivo neto utilizado en las actividades de financiamiento", actual: 0, esTotal: true },
    { concepto: "Aumento (Disminución) neto en el efectivo", actual: aumentoNeto, esTotal: true },
    { concepto: etiquetaFinPeriodo(anterior?.periodo ?? actual.periodo), actual: efectivoInicial, esTotal: true },
    { concepto: etiquetaFinPeriodo(actual.periodo), actual: efectivoFinal, esTotal: true },
    // Control de calidad: el flujo debe reconstruir el efectivo que declara el propio estado.
    // Sin esta comprobación el reporte cuadra siempre consigo mismo aunque el modelo esté mal.
    { concepto: "Efectivo declarado en el Estado de Situación Financiera", actual: efectivoDeclarado, esTotal: true },
    { concepto: "Diferencia contra el efectivo declarado", actual: descuadre, esTotal: true },
  ];
  const meta = catalogoReportes.find(item => item.tipo === "flujo-efectivo")!;
  return {
    tipo: "flujo-efectivo", titulo: meta.titulo, descripcion: meta.descripcion,
    periodo: Number(actual.periodo.slice(0, 4)), periodoComparativo: anterior ? Number(anterior.periodo.slice(0, 4)) : undefined,
    periodoFuente: actual.periodo, periodoComparativoFuente: anterior?.periodo,
    moneda: "NIO", fuente: `Estado de Situación Financiera ${actual.periodo}`,
    columnas: ["Concepto", `${etiqueta} vs ${etiquetaComparativa}`], filas, generadoEn: new Date().toISOString(),
    advertencias: [
      ...(ausentes.length
        ? [`No se encontraron en ninguno de los dos estados: ${[...new Set(ausentes)].join(", ")}. Esas líneas salen en cero; verifique si la cuenta cambió de nombre en el archivo de origen.`]
        : []),
      ...(Math.abs(descuadre) >= 0.01
        ? [`El flujo no reconstruye el efectivo declarado: diferencia de ${descuadre.toFixed(2)}. Revise que ambos estados correspondan a períodos consecutivos y que el archivo cuadre.`]
        : []),
      ...(sinFuente.length
        ? [`Líneas del formato oficial que el sistema no alimenta desde el Estado de Situación Financiera y quedan en cero: ${sinFuente.join(", ")}.`]
        : []),
    ],
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

/** Códigos reales del catálogo de esta institución para los componentes del patrimonio. La
 *  balanza no distingue "cuenta de patrimonio" con un campo propio — igual que el resto del
 *  sistema (ver claseCuenta), la única señal es el código, así que aquí se referencian los
 *  códigos exactos en vez de inferir por prefijo, porque el ECP necesita cada componente por
 *  separado, no la suma de la clase "3". */
const CODIGOS_PATRIMONIO = {
  patrimonio: "31010000",
  patrimonioDonado: "31020000",
  incrementoDecremento: "33010100",
  utilidadesAcumuladas: "33010200",
  revaluacion: "33010300",
} as const;

/**
 * Construye el Estado de Cambio en el Patrimonio a partir de dos balanzas de comprobación
 * anuales (31 de diciembre de dos años consecutivos). Es un reporte anual, no mensual (confirmado
 * con contabilidad): compara únicamente cierre contra cierre.
 *
 * La balanza no registra movimientos individuales de patrimonio (aportes, traslados, ajustes) —
 * solo saldos por cuenta y período, igual que el flujo de efectivo se deriva por diferencia entre
 * dos Estados de Situación Financiera. Por eso "Utilidades Acumuladas" se construye por
 * diferencia entre los saldos reales de la cuenta 33010200 en ambos años, y el traslado esperado
 * (el resultado del ejercicio anterior) se contrasta contra esa diferencia real como control de
 * calidad — nunca se asume que coinciden. Si no coinciden, hay un ajuste adicional en esa cuenta
 * que el sistema no puede explicar por sí solo, y se advierte en vez de ocultarlo.
 *
 * "Utilidad del Ejercicio" de cada año se calcula como Ingresos menos Gastos de esa balanza (clases
 * "4" y "5" por código, igual que el resto del sistema) porque el resultado de un año no se
 * traslada a Utilidades Acumuladas hasta el cierre del año siguiente — al 31 de diciembre del año
 * que se reporta, ese resultado todavía es una línea abierta, no parte de Utilidades Acumuladas.
 */
export function reporteCambioPatrimonioDesdeBalanza(actual: BalanzaPeriodo, anterior: BalanzaPeriodo, etiqueta: string, etiquetaComparativa: string): ReporteFinanciero {
  const ausentes: string[] = [];
  const valorCuenta = (balanza: BalanzaPeriodo, codigo: string, nombre: string) => {
    const fila = balanza.filas.find(item => item.codigo === codigo);
    if (!fila) ausentes.push(`${nombre} (${codigo}) en ${balanza.periodo}`);
    return fila?.saldo ?? 0;
  };
  const resultadoEjercicio = (balanza: BalanzaPeriodo) => {
    const ingresos = balanza.filas.filter(fila => claseCuenta(fila.codigo) === "ingreso").reduce((total, fila) => total + fila.saldo, 0);
    const gastos = balanza.filas.filter(fila => claseCuenta(fila.codigo) === "gasto").reduce((total, fila) => total + fila.saldo, 0);
    return dosDecimales(ingresos - gastos);
  };

  const patrimonioIni = valorCuenta(anterior, CODIGOS_PATRIMONIO.patrimonio, "Patrimonio");
  const donadoIni = valorCuenta(anterior, CODIGOS_PATRIMONIO.patrimonioDonado, "Patrimonio Donado");
  const incDecIni = valorCuenta(anterior, CODIGOS_PATRIMONIO.incrementoDecremento, "Incremento o Decremento del Patrimonio");
  const uaIni = valorCuenta(anterior, CODIGOS_PATRIMONIO.utilidadesAcumuladas, "Utilidades Acumuladas");
  const revaluacionIni = valorCuenta(anterior, CODIGOS_PATRIMONIO.revaluacion, "Incremento o Decremento por Revaluación de Activos");
  const resultadoAnterior = resultadoEjercicio(anterior);
  const totalIni = dosDecimales(patrimonioIni + donadoIni + incDecIni + uaIni + revaluacionIni + resultadoAnterior);

  const patrimonioFin = valorCuenta(actual, CODIGOS_PATRIMONIO.patrimonio, "Patrimonio");
  const donadoFin = valorCuenta(actual, CODIGOS_PATRIMONIO.patrimonioDonado, "Patrimonio Donado");
  const incDecFin = valorCuenta(actual, CODIGOS_PATRIMONIO.incrementoDecremento, "Incremento o Decremento del Patrimonio");
  const uaFin = valorCuenta(actual, CODIGOS_PATRIMONIO.utilidadesAcumuladas, "Utilidades Acumuladas");
  const revaluacionFin = valorCuenta(actual, CODIGOS_PATRIMONIO.revaluacion, "Incremento o Decremento por Revaluación de Activos");
  const resultadoActual = resultadoEjercicio(actual);
  const totalFin = dosDecimales(patrimonioFin + donadoFin + incDecFin + uaFin + revaluacionFin + resultadoActual);

  const deltaUA = dosDecimales(uaFin - uaIni);
  const diferenciaUA = dosDecimales(deltaUA - resultadoAnterior);

  const filas: FilaReporte[] = [
    { concepto: `Saldos al 31 de diciembre de ${etiquetaComparativa}`, actual: 0, esTotal: true, esEncabezado: true },
    { concepto: "Patrimonio", actual: patrimonioIni },
    { concepto: "Patrimonio Donado", actual: donadoIni },
    { concepto: "Incremento o Decremento del Patrimonio", actual: incDecIni },
    { concepto: "Utilidades Acumuladas", actual: uaIni },
    { concepto: "Incremento o Decremento por Revaluación de Activos", actual: revaluacionIni },
    { concepto: `Utilidad (pérdida) del Ejercicio ${etiquetaComparativa}`, actual: resultadoAnterior },
    { concepto: "Total Patrimonio (saldo inicial)", actual: totalIni, esTotal: true },

    { concepto: `Movimientos del ejercicio ${etiqueta}`, actual: 0, esTotal: true, esEncabezado: true },
    { concepto: "Variación en Patrimonio", actual: dosDecimales(patrimonioFin - patrimonioIni) },
    { concepto: "Variación en Patrimonio Donado", actual: dosDecimales(donadoFin - donadoIni) },
    { concepto: "Variación en Incremento o Decremento del Patrimonio", actual: dosDecimales(incDecFin - incDecIni) },
    { concepto: "Variación en Utilidades Acumuladas", actual: deltaUA },
    { concepto: "Variación en Incremento o Decremento por Revaluación de Activos", actual: dosDecimales(revaluacionFin - revaluacionIni) },
    { concepto: `Utilidad (pérdida) del Ejercicio ${etiqueta}`, actual: resultadoActual },
    { concepto: `Salida de la Utilidad del Ejercicio ${etiquetaComparativa} (trasladada a Utilidades Acumuladas)`, actual: dosDecimales(-resultadoAnterior) },
    { concepto: "Total movimientos del ejercicio", actual: dosDecimales(totalFin - totalIni), esTotal: true },

    { concepto: `Saldos al 31 de diciembre de ${etiqueta}`, actual: 0, esTotal: true, esEncabezado: true },
    { concepto: "Patrimonio", actual: patrimonioFin },
    { concepto: "Patrimonio Donado", actual: donadoFin },
    { concepto: "Incremento o Decremento del Patrimonio", actual: incDecFin },
    { concepto: "Utilidades Acumuladas", actual: uaFin },
    { concepto: "Incremento o Decremento por Revaluación de Activos", actual: revaluacionFin },
    { concepto: `Utilidad (pérdida) del Ejercicio ${etiqueta}`, actual: resultadoActual },
    { concepto: "Total Patrimonio (saldo final)", actual: totalFin, esTotal: true },

    { concepto: "Control: traslado a Utilidades Acumuladas", actual: 0, esTotal: true, esEncabezado: true },
    { concepto: `Traslado esperado (resultado del ejercicio ${etiquetaComparativa})`, actual: resultadoAnterior },
    { concepto: `Variación real de Utilidades Acumuladas (${etiquetaComparativa} → ${etiqueta})`, actual: deltaUA },
    { concepto: "Diferencia sin explicar en Utilidades Acumuladas", actual: diferenciaUA, esTotal: true },
  ];

  const meta = catalogoReportes.find(item => item.tipo === "cambio-patrimonio")!;
  return {
    tipo: "cambio-patrimonio", titulo: meta.titulo, descripcion: meta.descripcion,
    periodo: Number(actual.periodo.slice(0, 4)), periodoComparativo: Number(anterior.periodo.slice(0, 4)),
    periodoFuente: actual.periodo, periodoComparativoFuente: anterior.periodo,
    moneda: "NIO", fuente: `Balanza de comprobación ${anterior.periodo} y ${actual.periodo}`,
    columnas: ["Concepto", `${etiquetaComparativa} → ${etiqueta}`], filas, generadoEn: new Date().toISOString(),
    advertencias: [
      ...(ausentes.length
        ? [`No se encontraron en la balanza importada: ${[...new Set(ausentes)].join(", ")}. Verifique que el archivo de balanza incluya esos códigos de cuenta.`]
        : []),
      ...(Math.abs(diferenciaUA) >= 0.01
        ? [`Utilidades Acumuladas no se explica completamente por el traslado del resultado de ${etiquetaComparativa}: diferencia de ${diferenciaUA.toFixed(2)}. Puede haber un ajuste adicional registrado en esa cuenta durante el ejercicio — verifique con contabilidad antes de emitir.`]
        : []),
    ],
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
  const actualDatos = datosPeriodo(granularidad, periodo), anteriorDatos = datosPeriodo(granularidad, comparar);
  if (tipo === "cambio-patrimonio") {
    if (granularidad !== "anio") throw new Error("El Estado de Cambio en el Patrimonio es un reporte anual; seleccione la vista Año.");
    const periodoActual = periodoBalanza(granularidad, periodo), periodoAnterior = periodoBalanza(granularidad, comparar);
    const actual = await obtenerBalanza(db, periodoActual);
    if (!actual) throw new Error(`No hay balanza importada para ${periodoActual}`);
    const anterior = await obtenerBalanza(db, periodoAnterior);
    if (!anterior) throw new Error(`No hay balanza importada para el período comparativo ${periodoAnterior}`);
    const reporte = reporteCambioPatrimonioDesdeBalanza(actual, anterior, actualDatos.etiqueta, anteriorDatos.etiqueta);
    return { ...reporte, granularidad, periodoEtiqueta: actualDatos.etiqueta, comparativoEtiqueta: anteriorDatos.etiqueta };
  }
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
