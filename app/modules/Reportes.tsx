"use client";
import { useEffect, useState } from "react";
import MenuIcon from "../components/MenuIcon";
import PeriodoControl from "../components/PeriodoControl";
import { currentYear, dinero, opcionesReportesIniciales, periodoAnterior, type Granularidad, type OpcionReporte, type ReporteFinanciero, type TipoReporte } from "../shared";

export default function Reportes({canDownload}:{canDownload:boolean}){
  const initialYear = currentYear();
  const [opcionesReportes,setOpcionesReportes]=useState<OpcionReporte[]>(opcionesReportesIniciales);
  const [tipo,setTipo]=useState<TipoReporte>("flujo-efectivo");
  const [granularidad,setGranularidad]=useState<Granularidad>("anio");
  const [periodo,setPeriodo]=useState(String(initialYear));
  const [comparar,setComparar]=useState(String(initialYear-1));
  const [reporte,setReporte]=useState<ReporteFinanciero|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const url=(selected=tipo,format?:string)=>`/api/reportes/${selected}?granularidad=${granularidad}&periodo=${encodeURIComponent(periodo)}&comparar=${encodeURIComponent(comparar)}${format?`&formato=${format}`:""}`;

  async function generar(selected=tipo){
    setLoading(true); setError(""); setTipo(selected);
    try {
      const response=await fetch(url(selected));
      const data=await response.json();
      if(response.ok)setReporte(data.reporte);else setError(data.error);
    } catch {
      setError("No se pudo conectar con el generador de reportes");
    } finally { setLoading(false); }
  }

  useEffect(()=>{
    fetch("/api/reportes").then(response=>response.json()).then(data=>{if(data.reportes?.length)setOpcionesReportes(data.reportes);}).catch(()=>setOpcionesReportes(opcionesReportesIniciales));
    const year=currentYear();
    fetch(`/api/reportes/flujo-efectivo?granularidad=anio&periodo=${year}&comparar=${year-1}`)
      .then(response=>response.json().then(data=>({ok:response.ok,data})))
      .then(({ok,data})=>{if(ok)setReporte(data.reporte);else setError(data.error);})
      .catch(()=>setError("No se pudo conectar con el generador de reportes"))
      .finally(()=>setLoading(false));
  },[]);

  function cambiarGranularidad(value:Granularidad){
    const now=new Date(),year=now.getFullYear(),month=String(now.getMonth()+1).padStart(2,"0"),day=String(now.getDate()).padStart(2,"0"),quarter=Math.floor(now.getMonth()/3)+1;
    const actual={dia:`${year}-${month}-${day}`,mes:`${year}-${month}`,trimestre:`${year}-T${quarter}`,anio:String(year)}[value];
    setGranularidad(value);setPeriodo(actual);setComparar(periodoAnterior(actual,value));
  }
  function cambiarPeriodoPrincipal(value:string){setPeriodo(value);setComparar(periodoAnterior(value,granularidad));}
  const descargar=()=>{window.location.href=url(tipo,"csv");};
  const descargarExcel=()=>{window.location.href=url(tipo,"xlsx");};

  const fuenteRequerida = tipo === "flujo-efectivo" || tipo === "situacion-comparativa" ? "Estado de Situación Financiera" : "balanza";
  return <><div className="pageHead reportPageHead"><div><span className="eyebrow">ESTADOS FINANCIEROS</span><h1>Centro de reportes</h1><p>Compare períodos con una experiencia temporal clara y flexible.</p></div></div><section className="timelineSlicer panel"><div className="slicerTop"><div><span className="slicerIcon"><MenuIcon name="reports"/></span><div><b>Comparación temporal</b><small>Elija el nivel de detalle y los períodos a analizar</small></div></div><div className="granularity" role="group" aria-label="Nivel de detalle temporal">{(["dia","mes","trimestre","anio"] as Granularidad[]).map(item=><button key={item} className={granularidad===item?"active":""} onClick={()=>cambiarGranularidad(item)}>{item==="dia"?"Día":item==="mes"?"Mes":item==="trimestre"?"Trimestre":"Año"}</button>)}</div></div><div className="periodCompare"><PeriodoControl label="Período principal" value={periodo} onChange={cambiarPeriodoPrincipal} granularidad={granularidad}/><div className="compareArrow"><span>VS</span><i>→</i></div><PeriodoControl label="Comparar contra" value={comparar} onChange={setComparar} granularidad={granularidad}/><button className="primary compareButton" onClick={()=>generar()} disabled={loading}>{loading?"Actualizando…":"Aplicar comparación"}</button></div><div className="timelineTrack"><span/><i/><i/><i/><b/></div></section>{reporte?<div className="sourceBanner"><b>Fuente real</b><span>{reporte.fuente}</span></div>:null}<section className="reportLayout"><aside className="reportCatalog">{opcionesReportes.map(item=><button key={item.tipo} className={tipo===item.tipo?"selected":""} onClick={()=>generar(item.tipo)} disabled={loading}><span><MenuIcon name={item.icono}/></span><div><b>{item.titulo}</b><small>{item.descripcion}</small></div></button>)}</aside><section className="panel reportViewer">{loading?<div className="reportLoadingOverlay" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/><span className="loadingText">GENERANDO REPORTE</span><small>Consultando y consolidando datos contables...</small></div>:error?<div className="emptyReport">{error}. Importe el {fuenteRequerida} del período para generar este reporte.</div>:reporte?<><div className="reportTitle"><div><span className="status done">{reporte.fuente}</span><h2>{reporte.titulo}</h2><p>{reporte.periodoEtiqueta??reporte.periodo}{reporte.periodoComparativo?` frente a ${reporte.comparativoEtiqueta??reporte.periodoComparativo}`:""} · Córdobas NIO</p></div><div className="reportActions"><button className="secondary" onClick={()=>window.print()}>Imprimir</button>{canDownload?<button className="secondary" onClick={descargar}>Descargar CSV</button>:null}{canDownload&&tipo==="flujo-efectivo"?<button className="secondary" onClick={descargarExcel}>Descargar Excel</button>:null}</div></div>{reporte.advertencias?.length?<div className="reportWarnings" role="status"><b>Revise antes de emitir</b><ul>{reporte.advertencias.map(aviso=><li key={aviso}>{aviso}</li>)}</ul></div>:null}<div className="tableWrap"><table className="financialTable"><thead><tr>{reporte.columnas.map(col=><th key={col}>{col}</th>)}</tr></thead><tbody>{reporte.filas.map((fila,index)=><tr key={`${fila.concepto}-${index}`} className={fila.esTotal?"totalRow":""}><td>{fila.codigo?<small>{fila.codigo}</small>:null}<b>{fila.concepto}</b></td><td className="amount">{fila.esEncabezado?null:dinero.format(fila.actual)}</td>{reporte.columnas.length>2?<td className="amount">{dinero.format(fila.anterior??0)}</td>:null}{reporte.columnas.length>3?<td className={(fila.variacion??0)<0?"amount negative":"amount positive"}>{dinero.format(fila.variacion??0)}</td>:null}</tr>)}</tbody></table></div><footer><span>Generado: {new Date(reporte.generadoEn).toLocaleString("es-NI")}</span><span>{reporte.filas.length} líneas</span></footer></>:<div className="emptyReport">Seleccione un reporte para generarlo.</div>}</section></section></>;
}
