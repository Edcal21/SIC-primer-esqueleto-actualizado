import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { ReporteFinanciero } from "./reportes";

const rutaHoja = "xl/worksheets/sheet1.xml";

function escaparXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function reemplazarCelda(xml: string, referencia: string, contenido: string, tipo?: "inlineStr") {
  const patron = new RegExp(`<c([^>]*\\br="${referencia}"[^>]*)>[\\s\\S]*?<\\/c>`);
  if (!patron.test(xml)) throw new Error(`La plantilla no contiene la celda ${referencia}`);
  return xml.replace(patron, (_celda, atributos: string) => {
    const limpios = atributos.replace(/\s+t="[^"]*"/g, "");
    return `<c${limpios}${tipo ? ` t="${tipo}"` : ""}>${contenido}</c>`;
  });
}

const celdaTexto = (value: string) => `<is><t xml:space="preserve">${escaparXml(value)}</t></is>`;
const celdaNumero = (value: number, formula?: string) => `${formula ? `<f>${escaparXml(formula)}</f>` : ""}<v>${Number.isFinite(value) ? value : 0}</v>`;
const clave = (value: string) => value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

function fechaFin(periodo: string) {
  const [year, month] = periodo.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0));
}

function textosPeriodo(periodo: string) {
  const fecha = fechaFin(periodo), year = fecha.getUTCFullYear();
  const mes = new Intl.DateTimeFormat("es-NI", { month: "long", timeZone: "UTC" }).format(fecha);
  const mesTitulo = `${mes.charAt(0).toUpperCase()}${mes.slice(1)}`;
  return {
    corte: `AL ${fecha.getUTCDate()} DE ${mes.toUpperCase()} DEL ${year}`,
    rango: `Del 1 al ${fecha.getUTCDate()} de ${mesTitulo} del ${year}`,
  };
}

/** Rellena la primera hoja de la plantilla oficial sin reconstruir estilos, logo ni configuración de impresión. */
export function exportarFlujoExcel(reporte: ReporteFinanciero, plantilla: ArrayBuffer): Uint8Array {
  if (reporte.tipo !== "flujo-efectivo" || !reporte.periodoFuente || !reporte.periodoComparativoFuente) {
    throw new Error("El reporte no contiene los períodos requeridos para exportar Excel");
  }
  const archivos = unzipSync(new Uint8Array(plantilla));
  let hoja = strFromU8(archivos[rutaHoja]);
  const valores = new Map(reporte.filas.map(fila => [clave(fila.concepto), fila.actual]));
  const valor = (concepto: string) => valores.get(clave(concepto)) ?? 0;
  const actual = textosPeriodo(reporte.periodoFuente);

  hoja = reemplazarCelda(hoja, "B3", celdaTexto(actual.corte), "inlineStr");
  hoja = reemplazarCelda(hoja, "B4", celdaTexto(actual.rango), "inlineStr");
  const celdas: [string, string][] = [
    ["D9", "Utilidad o pérdida del período"], ["D10", "Depreciación"],
    ["D11", "Cuentas por cobrar a empleados"], ["D12", "Anticipos a justificar"],
    ["D13", "Cuentas por cobrar por servicios"], ["D14", "Deudores comerciales y otras cuentas por Cobrar"],
    ["D15", "Impuestos pagados por adelantado"], ["D16", "Pagos anticipados"],
    ["D17", "Depósito en garantía"], ["D18", "Póliza de seguros"],
    ["D19", "Acreedores Comerciales"], ["D20", "Certificados a plazo fijo (fondos restringidos)"],
    ["D21", "Impuestos por pagar"], ["D22", "Retenciones por pagar"],
    ["D23", "Gastos acumulados por pagar"], ["D24", "Cuentas transitorias"], ["D25", "Depósito sin identificar"],
    ["D28", "Patrimonio"], ["D29", "Edificios"], ["D30", "Mobiliario y Equipo de Oficina"],
    ["D31", "Vehículos"], ["D32", "Terrenos"], ["D33", "Incremento o Decremento"],
    ["D34", "Excedente Ingresos/Egresos Acumulados"],
    ["D36", "Efectivo neto utilizado en las actividades de financiamiento"],
    ["D38", reporte.filas.at(-2)?.concepto ?? ""],
  ];
  for (const [celda, concepto] of celdas) hoja = reemplazarCelda(hoja, celda, celdaNumero(valor(concepto)));
  hoja = reemplazarCelda(hoja, "D26", celdaNumero(valor("Efectivo neto utilizado en las actividades de operación"), "SUM(D9:D25)"));
  hoja = reemplazarCelda(hoja, "D35", celdaNumero(valor("Efectivo neto utilizado en las actividades de inversión"), "SUM(D29:D34)"));
  hoja = reemplazarCelda(hoja, "D37", celdaNumero(valor("Aumento (Disminución) neto en el efectivo"), "SUM(-D26-D35)"));
  hoja = reemplazarCelda(hoja, "D39", celdaNumero(reporte.filas.at(-1)?.actual ?? 0, "SUM(D38+D37)"));
  hoja = reemplazarCelda(hoja, "B38", celdaTexto(reporte.filas.at(-2)?.concepto ?? ""), "inlineStr");
  hoja = reemplazarCelda(hoja, "B39", celdaTexto(reporte.filas.at(-1)?.concepto ?? ""), "inlineStr");
  archivos[rutaHoja] = strToU8(hoja);

  const rutaLibro = "xl/workbook.xml";
  let libro = strFromU8(archivos[rutaLibro]);
  const nombreHoja = escaparXml(`Flujo de Efectivo ${reporte.periodoFuente}`.slice(0, 31));
  let indiceHoja = 0;
  libro = libro.replace(/<sheet\b[^>]*\/>/g, etiqueta => {
    indiceHoja += 1;
    const limpia = etiqueta.replace(/\sstate="[^"]*"/g, "");
    if (indiceHoja === 1) return limpia.replace(/name="[^"]*"/, `name="${nombreHoja}"`);
    return limpia.replace(/\/>$/, ' state="veryHidden"/>');
  });
  libro = libro.replace(/<calcPr[^>]*\/>/, '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');
  archivos[rutaLibro] = strToU8(libro);
  return zipSync(archivos, { level: 6 });
}
