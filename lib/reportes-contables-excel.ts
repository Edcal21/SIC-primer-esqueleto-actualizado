import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { FilaReporte, ReporteFinanciero } from "./reportes";

const hojaResultado = "xl/worksheets/sheet2.xml";
const hojaBalanza = "xl/worksheets/sheet3.xml";
const hojaSituacion = "xl/worksheets/sheet1.xml";

function escaparXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const celdaTexto = (value: string) => `<is><t xml:space="preserve">${escaparXml(value)}</t></is>`;
const celdaNumero = (value: number, formula?: string) => `${formula ? `<f>${escaparXml(formula)}</f>` : ""}<v>${Number.isFinite(value) ? value : 0}</v>`;

function reemplazarCelda(xml: string, referencia: string, contenido: string, tipo?: "inlineStr") {
  const patronVacio = new RegExp(`<c([^>]*\\br="${referencia}"[^>]*)\\s*\\/>`);
  const patronCompleto = new RegExp(`<c([^>]*\\br="${referencia}"[^>]*)>[\\s\\S]*?<\\/c>`);
  const patron = patronVacio.test(xml) ? patronVacio : patronCompleto;
  if (patron.test(xml)) {
    return xml.replace(patron, (_celda, atributos: string) => {
      const limpios = atributos.replace(/\s+t="[^"]*"/g, "").replace(/\s*\/$/, "");
      return contenido
        ? `<c${limpios}${tipo ? ` t="${tipo}"` : ""}>${contenido}</c>`
        : `<c${limpios}/>`;
    });
  }
  const numeroFila = referencia.match(/\d+$/)?.[0];
  const columna = referencia.match(/^[A-Z]+/)?.[0];
  if (!numeroFila || !columna) throw new Error(`Referencia de celda inválida: ${referencia}`);
  const indiceColumna = (value: string) => [...value].reduce((total, letra) => total * 26 + letra.charCodeAt(0) - 64, 0);
  const inicioFila = xml.indexOf(`<row r="${numeroFila}"`);
  if (inicioFila < 0) throw new Error(`La plantilla no contiene la fila ${numeroFila}`);
  const finApertura = xml.indexOf(">", inicioFila);
  const finFila = xml.indexOf("</row>", finApertura);
  if (finApertura < 0 || finFila < 0) throw new Error(`La fila ${numeroFila} de la plantilla no es válida`);
  const apertura = xml.slice(inicioFila, finApertura + 1);
  const cuerpo = xml.slice(finApertura + 1, finFila);
  const estilo = cuerpo.match(/<c\b[^>]*\bs="([^"]+)"/)?.[1];
  const celda = contenido
    ? `<c r="${referencia}"${estilo ? ` s="${estilo}"` : ""}${tipo ? ` t="${tipo}"` : ""}>${contenido}</c>`
    : `<c r="${referencia}"${estilo ? ` s="${estilo}"` : ""}/>`;
  let posicion = cuerpo.length;
  const celdas = /<c\b[^>]*\br="([A-Z]+)\d+"/g;
  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = celdas.exec(cuerpo))) {
    if (indiceColumna(coincidencia[1]) > indiceColumna(columna)) { posicion = coincidencia.index; break; }
  }
  const nuevaFila = `${apertura}${cuerpo.slice(0, posicion)}${celda}${cuerpo.slice(posicion)}</row>`;
  return `${xml.slice(0, inicioFila)}${nuevaFila}${xml.slice(finFila + 6)}`;
}

function prepararLibro(archivos: Record<string, Uint8Array>, indiceVisible: number, nombreHoja: string, rangoImpresion: string) {
  const rutaLibro = "xl/workbook.xml";
  let libro = strFromU8(archivos[rutaLibro]);
  let indice = -1;
  libro = libro.replace(/<sheet\b[^>]*\/>/g, etiqueta => {
    indice += 1;
    const limpia = etiqueta.replace(/\sstate="[^"]*"/g, "");
    if (indice === indiceVisible) return limpia.replace(/name="[^"]*"/, `name="${escaparXml(nombreHoja.slice(0, 31))}"`);
    return limpia.replace(/\/>$/, ' state="veryHidden"/>');
  });
  libro = libro.replace(/<workbookView\b([^>]*)\/>/, (_etiqueta, atributos: string) => {
    const limpios = atributos.replace(/\sactiveTab="[^"]*"/g, "");
    return `<workbookView${limpios} activeTab="${indiceVisible}"/>`;
  });
  const nombreDefinido = `<definedName name="_xlnm.Print_Area" localSheetId="${indiceVisible}">'${escaparXml(nombreHoja.slice(0, 31)).replace(/'/g, "''")}'!${rangoImpresion}</definedName>`;
  const patronArea = new RegExp(`<definedName name="_xlnm.Print_Area" localSheetId="${indiceVisible}">[\\s\\S]*?<\\/definedName>`);
  if (patronArea.test(libro)) libro = libro.replace(patronArea, nombreDefinido);
  else if (libro.includes("</definedNames>")) libro = libro.replace("</definedNames>", `${nombreDefinido}</definedNames>`);
  else libro = libro.replace("</sheets>", `</sheets><definedNames>${nombreDefinido}</definedNames>`);
  libro = libro.replace(/<calcPr[^>]*\/>/, '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');
  archivos[rutaLibro] = strToU8(libro);

  // Las fórmulas se regeneran durante la exportación. La cadena de cálculo de la
  // plantilla contiene referencias antiguas y Excel intenta repararla si se conserva.
  delete archivos["xl/calcChain.xml"];
  const rutaRelaciones = "xl/_rels/workbook.xml.rels";
  archivos[rutaRelaciones] = strToU8(strFromU8(archivos[rutaRelaciones]).replace(
    /<Relationship\b[^>]*relationships\/calcChain[^>]*\/>/g,
    "",
  ));
  const rutaTipos = "[Content_Types].xml";
  archivos[rutaTipos] = strToU8(strFromU8(archivos[rutaTipos]).replace(
    /<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g,
    "",
  ));
}

function valoresBalanza(fila: FilaReporte) {
  if (!fila.valores || fila.valores.length !== 6) throw new Error(`La cuenta ${fila.concepto} no contiene las seis columnas de la balanza anual`);
  return fila.valores;
}

const filasSituacion = [
  8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49,
  51, 53, 55, 58, 60, 62, 64, 66, 67, 68, 69, 70, 71, 73, 75, 77, 79, 81, 83, 85, 87,
  89, 91, 93, 95, 97, 99, 101, 103, 105, 107, 109, 111, 113, 115, 117, 119, 121, 123,
  126, 128, 131, 133, 136, 139, 141,
];

const normalizarConcepto = (valor: string) => valor
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Z0-9]+/gi, " ")
  .trim()
  .replace(/\s+/g, " ")
  .toUpperCase();

const desescaparXml = (valor: string) => valor
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

function textosCompartidos(archivos: Record<string, Uint8Array>) {
  const contenido = archivos["xl/sharedStrings.xml"];
  if (!contenido) return [];
  return [...strFromU8(contenido).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(coincidencia =>
    [...coincidencia[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(texto => desescaparXml(texto[1])).join(""),
  );
}

function textoCelda(xml: string, referencia: string, compartidos: string[]) {
  const coincidencia = xml.match(new RegExp(`<c([^>]*\\br="${referencia}"[^>]*)>([\\s\\S]*?)<\\/c>`));
  if (!coincidencia) return "";
  const inline = coincidencia[2].match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/);
  if (inline) return desescaparXml(inline[1]);
  const valor = coincidencia[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  return /\bt="s"/.test(coincidencia[1]) ? compartidos[Number(valor)] ?? "" : desescaparXml(valor);
}

/** Conserva la hoja empresarial del Estado de Situación Financiera comparativo. */
export function exportarSituacionComparativaExcel(reporte: ReporteFinanciero, plantilla: ArrayBuffer): Uint8Array {
  if (reporte.tipo !== "situacion-comparativa" || !reporte.periodoFuente || !reporte.periodoComparativoFuente) {
    throw new Error("El reporte no contiene los períodos requeridos para exportar la situación comparativa");
  }

  const archivos = unzipSync(new Uint8Array(plantilla));
  let hoja = strFromU8(archivos[hojaSituacion]);
  const compartidos = textosCompartidos(archivos);
  const filasPorConcepto = new Map<string, number[]>();
  for (const numeroFila of filasSituacion) {
    const concepto = textoCelda(hoja, `B${numeroFila}`, compartidos);
    if (!concepto) continue;
    const clave = normalizarConcepto(concepto);
    const existentes = filasPorConcepto.get(clave) ?? [];
    existentes.push(numeroFila);
    filasPorConcepto.set(clave, existentes);
  }

  hoja = reemplazarCelda(hoja, "B3", celdaTexto("Estado de Situación Financiera Comparativo"), "inlineStr");
  hoja = reemplazarCelda(hoja, "C5", celdaTexto(reporte.periodoComparativoFuente), "inlineStr");
  hoja = reemplazarCelda(hoja, "E5", celdaTexto(reporte.periodoFuente), "inlineStr");
  hoja = reemplazarCelda(hoja, "G5", celdaTexto("Variación"), "inlineStr");
  for (const numeroFila of filasSituacion) {
    for (const columna of ["C", "D", "E", "F", "G"]) hoja = reemplazarCelda(hoja, `${columna}${numeroFila}`, "");
  }

  for (const fila of reporte.filas) {
    const disponibles = filasPorConcepto.get(normalizarConcepto(fila.concepto));
    const numeroFila = disponibles?.shift();
    if (!numeroFila) continue;
    hoja = reemplazarCelda(hoja, `B${numeroFila}`, celdaTexto(fila.concepto), "inlineStr");
    const anterior = fila.anterior ?? 0;
    const variacion = fila.variacion ?? fila.actual - anterior;
    const esEncabezado = !fila.esTotal && fila.actual === 0 && anterior === 0 && variacion === 0;
    if (esEncabezado) continue;
    const columnaAnterior = fila.esTotal ? "D" : "C";
    const columnaActual = fila.esTotal ? "F" : "E";
    hoja = reemplazarCelda(hoja, `${columnaAnterior}${numeroFila}`, celdaNumero(anterior));
    hoja = reemplazarCelda(hoja, `${columnaActual}${numeroFila}`, celdaNumero(fila.actual));
    hoja = reemplazarCelda(hoja, `G${numeroFila}`, celdaNumero(variacion, `${columnaActual}${numeroFila}-${columnaAnterior}${numeroFila}`));
  }

  archivos[hojaSituacion] = strToU8(hoja);
  prepararLibro(archivos, 0, `Situación ${reporte.periodoFuente}`, "$B$2:$J$149");
  return zipSync(archivos, { level: 6 });
}

/** Conserva el formato empresarial y llena la balanza anual con el consolidado mensual. */
export function exportarBalanzaAnualExcel(reporte: ReporteFinanciero, plantilla: ArrayBuffer): Uint8Array {
  if (reporte.tipo !== "balanza-anual") throw new Error("El reporte recibido no es una balanza anual");
  const detalle = reporte.filas.filter(fila => !fila.esTotal);
  const total = reporte.filas.find(fila => fila.esTotal);
  if (!total || detalle.length > 329) throw new Error("La balanza anual excede la capacidad del formato empresarial");

  const archivos = unzipSync(new Uint8Array(plantilla));
  let hoja = strFromU8(archivos[hojaBalanza]);
  hoja = reemplazarCelda(hoja, "A5", celdaTexto(`Balanza de Comprobacion al 31 de Diciembre ${reporte.periodo}`), "inlineStr");
  hoja = reemplazarCelda(hoja, "C7", celdaTexto(`Saldos Acumulados del periodo ${reporte.periodo - 1}`), "inlineStr");
  hoja = reemplazarCelda(hoja, "E7", celdaTexto(`Movimientos del Periodo ${reporte.periodo}`), "inlineStr");
  hoja = reemplazarCelda(hoja, "G7", celdaTexto(`Saldos Acumulados al Periodo ${reporte.periodo}`), "inlineStr");

  for (let numeroFila = 9; numeroFila <= 338; numeroFila += 1) {
    for (const columna of ["B", "C", "D", "E", "F", "G", "H"]) hoja = reemplazarCelda(hoja, `${columna}${numeroFila}`, "");
  }
  for (let indice = 0; indice < detalle.length; indice += 1) {
    const numeroFila = indice + 9;
    const fila = detalle[indice];
    const valores = valoresBalanza(fila);
    hoja = reemplazarCelda(hoja, `B${numeroFila}`, celdaTexto(fila.concepto), "inlineStr");
    for (let columna = 0; columna < 4; columna += 1) {
      hoja = reemplazarCelda(hoja, `${String.fromCharCode(67 + columna)}${numeroFila}`, celdaNumero(valores[columna]));
    }
    const deudora = ["1", "5"].includes(fila.codigo?.charAt(0) ?? "");
    hoja = reemplazarCelda(hoja, `G${numeroFila}`, celdaNumero(valores[4], deudora ? `C${numeroFila}+E${numeroFila}-F${numeroFila}` : undefined));
    hoja = reemplazarCelda(hoja, `H${numeroFila}`, celdaNumero(valores[5], deudora ? undefined : `D${numeroFila}+F${numeroFila}-E${numeroFila}`));
  }
  hoja = reemplazarCelda(hoja, "B338", celdaTexto("Saldos"), "inlineStr");
  const totales = valoresBalanza(total);
  for (let columna = 0; columna < 6; columna += 1) hoja = reemplazarCelda(hoja, `${String.fromCharCode(67 + columna)}338`, celdaNumero(totales[columna]));
  archivos[hojaBalanza] = strToU8(hoja);
  prepararLibro(archivos, 2, `Balanza ${reporte.periodo}`, "$A$1:$H$346");
  return zipSync(archivos, { level: 6 });
}

const filasResultado = [13, 15, 17, 19, 21, 23, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76];

/** Conserva el formato empresarial y compara los saldos finales de dos Estados de Resultado Integral. */
export function exportarResultadoComparativoExcel(reporte: ReporteFinanciero, plantilla: ArrayBuffer): Uint8Array {
  if (reporte.tipo !== "resultado-comparativo" || !reporte.periodoFuente || !reporte.periodoComparativoFuente) {
    throw new Error("El reporte no contiene los períodos requeridos para exportar el resultado comparativo");
  }
  if (reporte.filas.length > filasResultado.length) throw new Error("El Estado de Resultado Integral excede la capacidad del formato empresarial");
  const archivos = unzipSync(new Uint8Array(plantilla));
  let hoja = strFromU8(archivos[hojaResultado]);
  const etiquetaAnterior = reporte.granularidad === "anio" ? reporte.periodoComparativoFuente.slice(0, 4) : reporte.periodoComparativoFuente;
  const etiquetaActual = reporte.granularidad === "anio" ? reporte.periodoFuente.slice(0, 4) : reporte.periodoFuente;
  hoja = reemplazarCelda(hoja, "B3", celdaTexto("Estado de Resultado Comparativo"), "inlineStr");
  hoja = reemplazarCelda(hoja, "D6", celdaTexto(etiquetaAnterior), "inlineStr");
  hoja = reemplazarCelda(hoja, "F6", celdaTexto(etiquetaActual), "inlineStr");
  hoja = reemplazarCelda(hoja, "H6", celdaTexto("Variación"), "inlineStr");
  for (const numeroFila of filasResultado) {
    for (const columna of ["B", "D", "F", "H"]) hoja = reemplazarCelda(hoja, `${columna}${numeroFila}`, "");
  }
  for (let indice = 0; indice < reporte.filas.length; indice += 1) {
    const numeroFila = filasResultado[indice];
    const fila = reporte.filas[indice];
    hoja = reemplazarCelda(hoja, `B${numeroFila}`, celdaTexto(fila.concepto), "inlineStr");
    hoja = reemplazarCelda(hoja, `D${numeroFila}`, celdaNumero(fila.anterior ?? 0));
    hoja = reemplazarCelda(hoja, `F${numeroFila}`, celdaNumero(fila.actual));
    hoja = reemplazarCelda(hoja, `H${numeroFila}`, celdaNumero(fila.variacion ?? fila.actual - (fila.anterior ?? 0), `F${numeroFila}-D${numeroFila}`));
  }
  archivos[hojaResultado] = strToU8(hoja);
  prepararLibro(archivos, 1, `Resultado ${reporte.periodoFuente}`, "$B$1:$I$84");
  return zipSync(archivos, { level: 6 });
}
