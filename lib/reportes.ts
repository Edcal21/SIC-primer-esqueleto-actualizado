import { asc, desc, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { importacionesBalanza, importacionesSituacionFinanciera, lineasBalanza, lineasSituacionFinanciera, reportesCatalogo } from "../db/schema";

export type TipoReporte = "flujo-efectivo" | "balanza-anual" | "cambio-patrimonio" | "situacion-comparativa" | "resultado-comparativo" | "minutas";
export type Granularidad = "dia" | "mes" | "trimestre" | "anio";
export type FilaReporte = { concepto: string; codigo?: string; actual: number; anterior?: number; variacion?: number; valores?: number[]; esTotal?: boolean; esEncabezado?: boolean };
export type ValidacionReporte = { conciliado: boolean; diferencias: { concepto: string; calculado: number; estadoFinanciero: number; diferencia: number }[] };
export type ReporteFinanciero = { tipo: TipoReporte; titulo: string; descripcion: string; periodo: number; periodoComparativo?: number; periodoFuente?: string; periodoComparativoFuente?: string; moneda: "NIO"; fuente: string; columnas: string[]; filas: FilaReporte[]; validacion?: ValidacionReporte; generadoEn: string; advertencias?: string[] };
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
    // El reporte de minutas no depende de una migración de catálogo para existir: si la fila
    // "minutas" todavía no está en reportes_catalogo (instalación no migrada a la última versión),
    // se agrega en memoria para que la opción no desaparezca del centro de reportes.
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
/** Una cuenta "de mayor" (p. ej. 40000000, 41000000) repite el mismo saldo acumulado que sus
 *  cuentas hijas en varios niveles de la jerarquía del catálogo — sumar todas las filas de una
 *  clase por prefijo de código, sin distinguir mayor de detalle, multiplica el total varias veces.
 *  Una fila es "de detalle" cuando ninguna otra fila de la misma balanza usa su código (sin los
 *  ceros de relleno finales) como prefijo, es decir, cuando es una hoja del catálogo. */
const filasDetalle = (filas: BalanzaPeriodo["filas"]) => filas.filter(fila => {
  const prefijo = fila.codigo.replace(/0+$/, "");
  return !filas.some(otra => otra.codigo !== fila.codigo && otra.codigo.startsWith(prefijo));
});

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

const redondearCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

/**
 * Construye el Estado de Cambio en el Patrimonio en el formato oficial (matriz de 6 columnas:
 * Patrimonio, Patrimonio donado, Utilidades acumuladas, Revaluación, Utilidad del ejercicio,
 * Total) a partir de dos cierres al 31 de diciembre del Estado de Situación Financiera. Es un
 * reporte anual: compara únicamente cierre contra cierre.
 *
 * Se autovalida: cada columna calculada por movimientos (apertura + traslado + impuesto +
 * resultado) se contrasta contra el saldo que el propio Estado de Situación Financiera reporta
 * para ese concepto al cierre actual (`validacion.diferencias`). Si no coincide, `conciliado`
 * queda en false en vez de mostrar una cifra que aparenta cuadrar sin estarlo.
 *
 * NOTA IMPORTANTE sobre "Pago de Impuesto IR": esta línea toma el saldo de la cuenta "PAGO MINIMO
 * DEFINITIVO" del período anterior. Es una hipótesis de trabajo sobre cómo se traslada el pago de
 * IR al patrimonio, NO un ajuste confirmado con contabilidad — al día de este cambio no hay
 * certeza documentada de que esta cifra corresponda al mismo concepto que aparece en el Estado de
 * Situación Financiera bajo ese nombre. Verifique con contabilidad antes de tomar este reporte
 * como definitivo si `validacion.conciliado` es true pero esta línea no está confirmada.
 */
export function reporteCambioPatrimonioDesdeSituaciones(actual: SituacionPeriodo, anterior: SituacionPeriodo): ReporteFinanciero {
  const anioActual = Number(actual.periodo.slice(0, 4));
  const anioAnterior = Number(anterior.periodo.slice(0, 4));
  const saldo = (periodo: SituacionPeriodo, ...conceptos: string[]) => redondearCentavos(saldoPorConcepto(periodo, ...conceptos));
  const patrimonioAnterior = saldo(anterior, "Patrimonio Iglesia Universal del Reino de Dios");
  const donadoAnterior = saldo(anterior, "Patrimonio Donado");
  const acumuladasAnterior = saldo(anterior, "Utilidades Acumuladas");
  const revaluacionAnterior = saldo(anterior, "Incremento o Decremento por Revaluacion de Activos");
  const utilidadAnterior = redondearCentavos(totalExcedentes(anterior));
  const impuestoAnterior = -saldo(anterior, "PAGO MINIMO DEFINITIVO");
  const utilidadActual = redondearCentavos(totalExcedentes(actual));

  const componentesApertura = [patrimonioAnterior, donadoAnterior, acumuladasAnterior, revaluacionAnterior, utilidadAnterior];
  const apertura = [...componentesApertura, redondearCentavos(sumar(componentesApertura))];
  const traslado = [0, 0, utilidadAnterior, 0, -utilidadAnterior, 0];
  const impuesto = [0, 0, impuestoAnterior, 0, 0, impuestoAnterior];
  const resultado = [0, 0, 0, 0, utilidadActual, utilidadActual];
  const totales = apertura.map((valor, indice) => redondearCentavos(valor + traslado[indice] + impuesto[indice] + resultado[indice]));
  const esperados = [
    saldo(actual, "Patrimonio Iglesia Universal del Reino de Dios"),
    saldo(actual, "Patrimonio Donado"),
    saldo(actual, "Utilidades Acumuladas"),
    saldo(actual, "Incremento o Decremento por Revaluacion de Activos"),
    utilidadActual,
    saldo(actual, "Total PATRIMONIO"),
  ];
  const conceptosValidacion = ["Patrimonio", "Patrimonio donado", "Utilidades acumuladas", "Revaluación de activos", "Utilidad del ejercicio", "Total patrimonio"];
  const diferencias = conceptosValidacion.map((concepto, indice) => ({
    concepto,
    calculado: totales[indice],
    estadoFinanciero: esperados[indice],
    diferencia: redondearCentavos(totales[indice] - esperados[indice]),
  }));
  const filas: FilaReporte[] = [
    { concepto: `Saldos al 31/12/${anioAnterior}`, actual: apertura[0], valores: apertura },
    { concepto: `Traslado a utilidades acumuladas/${anioAnterior}`, actual: traslado[0], valores: traslado },
    { concepto: `Pago de Impuesto IR ${anioAnterior} (sin confirmar con contabilidad)`, actual: impuesto[0], valores: impuesto },
    { concepto: `Utilidades del Ejercicio ${anioActual}`, actual: resultado[0], valores: resultado },
    { concepto: "Totales C$", actual: totales[0], valores: totales, esTotal: true },
  ];
  const meta = catalogoReportes.find(item => item.tipo === "cambio-patrimonio")!;
  return {
    tipo: "cambio-patrimonio", titulo: meta.titulo, descripcion: meta.descripcion,
    periodo: anioActual, periodoComparativo: anioAnterior,
    periodoFuente: actual.periodo, periodoComparativoFuente: anterior.periodo,
    moneda: "NIO", fuente: `Estados de Situación Financiera al 31/12/${anioActual} y 31/12/${anioAnterior}`,
    columnas: ["Descripción", "Patrimonio", "Patrimonio donado", "Utilidades acumuladas", "Incremento o decremento por revaluación de activo", "Utilidad ejercicio", "Total patrimonio"],
    filas, validacion: { conciliado: diferencias.every(item => Math.abs(item.diferencia) < 0.01), diferencias }, generadoEn: new Date().toISOString(),
  };
}

/** Total de una clase contable: si existe la cuenta de mayor (p. ej. "40000000"), se usa su saldo
 *  reportado directamente en vez de sumar las cuentas de detalle — es el total que la propia
 *  balanza declara para la clase, y evita depender de que el catálogo esté completo. */
function totalClase(filas: BalanzaPeriodo["filas"], clase: string) {
  const prefijo = { activo: "1", pasivo: "2", patrimonio: "3", ingreso: "4", gasto: "5" }[clase];
  if (!prefijo) return 0;
  const cuentaMayor = filas.find(fila => fila.codigo === `${prefijo}0000000`);
  if (cuentaMayor) return cuentaMayor.saldo;
  return filasDetalle(filas).filter(fila => claseCuenta(fila.codigo) === clase).reduce((total, fila) => total + fila.saldo, 0);
}

export function reporteBalanza(tipo: TipoReporte, actual: BalanzaPeriodo, anterior: BalanzaPeriodo | null, etiqueta: string, etiquetaComparativa: string): ReporteFinanciero {
  const meta = catalogoReportes.find(item => item.tipo === tipo)!;
  if (tipo === "balanza-anual") {
    const filas: FilaReporte[] = actual.filas.map(fila => ({ codigo: fila.codigo, concepto: fila.concepto, actual: fila.debe, anterior: fila.haber, variacion: fila.debe - fila.haber }));
    const debitos = filas.reduce((total, fila) => total + fila.actual, 0), creditos = filas.reduce((total, fila) => total + (fila.anterior ?? 0), 0);
    filas.push({ concepto: "Total", actual: debitos, anterior: creditos, variacion: debitos - creditos, esTotal: true });
    return { tipo, titulo: meta.titulo, descripcion: meta.descripcion, periodo: Number(actual.periodo.slice(0,4)), moneda: "NIO", fuente: `Balanza importada ${actual.periodo}`, columnas: ["Cuenta", "Débito", "Crédito", "Diferencia"], filas, generadoEn: new Date().toISOString() };
  }

  const anteriores = new Map((anterior?.filas ?? []).map(fila => [fila.codigo, fila]));
  const clases = tipo === "resultado-comparativo" ? ["ingreso", "gasto"] : ["activo", "pasivo", "patrimonio"];
  // Solo cuentas de detalle: sumar también las de mayor duplicaría el total (ver filasDetalle).
  const detalleActual = filasDetalle(actual.filas);
  const filas = detalleActual
    .filter(fila => clases.includes(claseCuenta(fila.codigo)))
    .map(fila => {
      const saldoAnterior = anteriores.get(fila.codigo)?.saldo ?? 0;
      return filaComparativa(fila.concepto, fila.saldo, saldoAnterior, { codigo: fila.codigo });
    });

  for (const clase of clases) {
    const actuales = totalClase(actual.filas, clase);
    const previos = totalClase(anterior?.filas ?? [], clase);
    filas.push(filaComparativa(`Total ${clase}`, actuales, previos, { esTotal: true }));
  }

  return { tipo, titulo: meta.titulo, descripcion: meta.descripcion, periodo: Number(actual.periodo.slice(0,4)), periodoComparativo: anterior ? Number(anterior.periodo.slice(0,4)) : undefined, moneda: "NIO", fuente: `Balanza importada ${actual.periodo}`, columnas: ["Concepto", etiqueta, etiquetaComparativa, "Variación"], filas, generadoEn: new Date().toISOString() };
}

export async function generarReportePorPeriodoDesdeDb(db: Db, tipo: TipoReporte, granularidad: Granularidad, periodo: string, comparar: string): Promise<ReporteFinanciero & { granularidad: Granularidad; periodoEtiqueta: string; comparativoEtiqueta: string }> {
  if (tipo === "minutas") throw new Error("El reporte de minutas utiliza filtros de iglesia y rango de fechas, no período/comparar");
  const actualDatos = datosPeriodo(granularidad, periodo), anteriorDatos = datosPeriodo(granularidad, comparar);
  if (tipo === "flujo-efectivo" || tipo === "situacion-comparativa" || tipo === "cambio-patrimonio") {
    // El ECP es un reporte anual (confirmado con contabilidad): compara únicamente cierre contra
    // cierre al 31 de diciembre, sin importar la granularidad solicitada. La UI ya restringe la
    // selección a "Año" para este tipo; este chequeo es una segunda barrera por si se llama a la
    // API directamente con otra granularidad, para no devolver en silencio un reporte anual cuando
    // se pidió uno mensual o trimestral.
    if (tipo === "cambio-patrimonio" && granularidad !== "anio") throw new Error("El Estado de Cambio en el Patrimonio es un reporte anual; seleccione la vista Año.");
    const esCambioPatrimonio = tipo === "cambio-patrimonio";
    const periodoActual = esCambioPatrimonio ? `${periodo.slice(0, 4)}-12` : periodoBalanza(granularidad, periodo);
    const periodoAnterior = esCambioPatrimonio ? `${comparar.slice(0, 4)}-12` : periodoBalanza(granularidad, comparar);
    const actual = await obtenerSituacionFinanciera(db, periodoActual);
    if (!actual) throw new Error(`No hay Estado de Situación Financiera importado para ${periodoActual}`);
    const anterior = await obtenerSituacionFinanciera(db, periodoAnterior);
    if (!anterior) throw new Error(`No hay Estado de Situación Financiera importado para el período comparativo ${periodoAnterior}`);
    const reporte = tipo === "flujo-efectivo"
      ? reporteFlujoDesdeSituaciones(actual, anterior, actualDatos.etiqueta, anteriorDatos.etiqueta)
      : tipo === "situacion-comparativa"
        ? reporteSituacionComparativaDesdeSituaciones(actual, anterior, actualDatos.etiqueta, anteriorDatos.etiqueta)
        : reporteCambioPatrimonioDesdeSituaciones(actual, anterior);
    return { ...reporte, granularidad: esCambioPatrimonio ? "anio" : granularidad, periodoEtiqueta: esCambioPatrimonio ? String(reporte.periodo) : actualDatos.etiqueta, comparativoEtiqueta: esCambioPatrimonio ? String(reporte.periodoComparativo) : anteriorDatos.etiqueta };
  }
  const actual = await obtenerBalanza(db, periodoBalanza(granularidad, periodo));
  if (!actual) throw new Error(`No hay balanza importada para ${periodoBalanza(granularidad, periodo)}`);
  const anterior = await obtenerBalanza(db, periodoBalanza(granularidad, comparar));
  return { ...reporteBalanza(tipo, actual, anterior, actualDatos.etiqueta, anteriorDatos.etiqueta), granularidad, periodoEtiqueta: actualDatos.etiqueta, comparativoEtiqueta: anteriorDatos.etiqueta };
}

export function reporteCsv(reporte:ReporteFinanciero):string {
  const escape=(value:string|number|undefined)=>`"${String(value??"").replaceAll('"','""')}"`;
  const rows=[reporte.columnas.map(escape).join(","),...reporte.filas.map(f=>[f.codigo?`${f.codigo} · ${f.concepto}`:f.concepto,...(f.valores ?? [f.actual,f.anterior,f.variacion])].slice(0,reporte.columnas.length).map(escape).join(","))];
  return `\uFEFF${rows.join("\n")}`;
}
