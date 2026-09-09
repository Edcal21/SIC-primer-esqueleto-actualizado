import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { ReporteFinanciero } from "./reportes";

const rutaHoja = "xl/worksheets/sheet1.xml";

function escaparXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function reemplazarCelda(xml: string, referencia: string, contenido: string, tipo?: "inlineStr") {
  const prefijo = xml.includes("<x:worksheet") ? "x:" : "";
  const patron = new RegExp(`<${prefijo}c([^>]*\\br="${referencia}"[^>]*)>[\\s\\S]*?<\\/${prefijo}c>`);
  if (!patron.test(xml)) throw new Error(`La plantilla no contiene la celda ${referencia}`);
  return xml.replace(patron, (_celda, atributos: string) => {
    const limpios = atributos.replace(/\s+t="[^"]*"/g, "");
    const contenidoConPrefijo = prefijo ? contenido.replace(/<(\/?)(is|t|f|v)(?=[ >])/g, `<$1${prefijo}$2`) : contenido;
    return `<${prefijo}c${limpios}${tipo ? ` t="${tipo}"` : ""}>${contenidoConPrefijo}</${prefijo}c>`;
  });
}

const celdaTexto = (value: string) => `<is><t xml:space="preserve">${escaparXml(value)}</t></is>`;
const celdaNumero = (value: number, formula?: string) => `${formula ? `<f>${escaparXml(formula)}</f>` : ""}<v>${Number.isFinite(value) ? value : 0}</v>`;

/** Conserva el diseño oficial y rellena sus cinco filas con fórmulas auditables. */
export function exportarCambioPatrimonioExcel(reporte: ReporteFinanciero, plantilla: ArrayBuffer): Uint8Array {
  if (reporte.tipo !== "cambio-patrimonio" || !reporte.periodoFuente || !reporte.periodoComparativoFuente || reporte.filas.length !== 5) {
    throw new Error("El reporte no contiene los períodos o filas requeridos para exportar Excel");
  }
  const archivos = unzipSync(new Uint8Array(plantilla));
  let hoja = strFromU8(archivos[rutaHoja]);
  const anioActual = reporte.periodoFuente.slice(0, 4);

  hoja = reemplazarCelda(hoja, "A3", celdaTexto(`Al 31 de Diciembre de ${anioActual}`), "inlineStr");
  for (let indiceFila = 0; indiceFila < reporte.filas.length; indiceFila += 1) {
    const numeroFila = indiceFila + 7;
    const fila = reporte.filas[indiceFila];
    const valores = fila.valores;
    if (!valores || valores.length !== 6) throw new Error(`La fila ${fila.concepto} no contiene las seis columnas patrimoniales`);
    hoja = reemplazarCelda(hoja, `A${numeroFila}`, celdaTexto(fila.concepto), "inlineStr");
    for (let indiceColumna = 0; indiceColumna < 5; indiceColumna += 1) {
      const columna = String.fromCharCode("B".charCodeAt(0) + indiceColumna);
      const formula = numeroFila === 11 ? `SUM(${columna}7:${columna}10)` : undefined;
      hoja = reemplazarCelda(hoja, `${columna}${numeroFila}`, celdaNumero(valores[indiceColumna], formula));
    }
    const formulaTotal = numeroFila === 11 ? "SUM(G7:G10)" : `SUM(B${numeroFila}:F${numeroFila})`;
    hoja = reemplazarCelda(hoja, `G${numeroFila}`, celdaNumero(valores[5], formulaTotal));
  }
  archivos[rutaHoja] = strToU8(hoja);

  const rutaLibro = "xl/workbook.xml";
  let libro = strFromU8(archivos[rutaLibro]);
  const nombreHoja = escaparXml(`Cambio Patrimonio ${anioActual}`.slice(0, 31));
  const prefijoLibro = libro.includes("<x:workbook") ? "x:" : "";
  libro = libro.replace(new RegExp(`<${prefijoLibro}sheet\\b([^>]*?)name="[^"]*"([^>]*?)\\/>`), `<${prefijoLibro}sheet$1name="${nombreHoja}"$2/>`);
  libro = libro.replace(new RegExp(`<${prefijoLibro}calcPr[^>]*\\/>`), `<${prefijoLibro}calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>`);
  archivos[rutaLibro] = strToU8(libro);
  return zipSync(archivos, { level: 6 });
}
