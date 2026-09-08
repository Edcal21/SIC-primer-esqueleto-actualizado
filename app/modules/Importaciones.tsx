"use client";
import { type FormEvent, useEffect, useState } from "react";
import { currentMonth, dinero, estadoImportacion, statusClass, type ImportacionBalanza, type ImportacionSituacionFinanciera } from "../shared";

export default function Importaciones({ notify }: { notify: (message: string) => void }) {
  const [importaciones, setImportaciones] = useState<ImportacionBalanza[]>([]);
  const [situaciones, setSituaciones] = useState<ImportacionSituacionFinanciera[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [situacionFile, setSituacionFile] = useState<File | null>(null);
  const [periodo, setPeriodo] = useState(currentMonth());
  const [situacionPeriodo, setSituacionPeriodo] = useState(currentMonth());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSituacion, setSavingSituacion] = useState(false);

  async function cargarHistorial() {
    try {
      const [balanzaResponse, situacionResponse] = await Promise.all([
        fetch("/api/importaciones/balanza"), fetch("/api/importaciones/situacion-financiera"),
      ]);
      const [balanzaData, situacionData] = await Promise.all([balanzaResponse.json(), situacionResponse.json()]);
      if (!balanzaResponse.ok) throw new Error(balanzaData.error ?? "No se pudo cargar el historial de balanzas");
      if (!situacionResponse.ok) throw new Error(situacionData.error ?? "No se pudo cargar el historial de estados financieros");
      setImportaciones(balanzaData.importaciones ?? []); setSituaciones(situacionData.importaciones ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial"); }
  }

  useEffect(() => { void Promise.resolve().then(cargarHistorial); }, []);

  async function enviarArchivo(endpoint: string, archivo: File, periodoArchivo: string) {
    const form = new FormData(); form.append("periodo", periodoArchivo); form.append("archivo", archivo);
    const response = await fetch(endpoint, { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "No se pudo importar el archivo");
    return result.importacion;
  }

  async function importar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!file) return setError("Seleccione el archivo de balanza");
    setSaving(true); setError("");
    try {
      const importacion = await enviarArchivo("/api/importaciones/balanza", file, periodo);
      setImportaciones(current => [importacion, ...current]); setFile(null);
      notify(`${estadoImportacion(importacion.estado)}: ${importacion.totalLineas} líneas`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo importar la balanza"); }
    finally { setSaving(false); }
  }

  async function importarSituacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!situacionFile) return setError("Seleccione el Estado de Situación Financiera");
    setSavingSituacion(true); setError("");
    try {
      const importacion = await enviarArchivo("/api/importaciones/situacion-financiera", situacionFile, situacionPeriodo);
      setSituaciones(current => [importacion, ...current]); setSituacionFile(null);
      notify(`Estado de Situación Financiera procesado: ${importacion.totalLineas} saldos finales`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo importar el Estado de Situación Financiera"); }
    finally { setSavingSituacion(false); }
  }

  const ultimo = importaciones[0];
  const diferencia = ultimo ? Number(ultimo.totalDebe) - Number(ultimo.totalHaber) : 0;
  return <>
    <div className="pageHead"><div><span className="eyebrow">IMPORTACIONES</span><h1>Estados financieros</h1><p>Cargue la balanza para los reportes contables y el Estado de Situación Financiera para el flujo de efectivo.</p></div></div>
    {ultimo?<section className="metrics compactMetrics"><article className="metric featured"><p>Última balanza</p><strong>{ultimo.periodo}</strong><span className={statusClass(ultimo.estado)}>{estadoImportacion(ultimo.estado)}</span></article><article className="metric"><p>Líneas leídas</p><strong>{ultimo.totalLineas}</strong><small>{ultimo.archivoNombre}</small></article><article className="metric"><p>Total débitos</p><strong>{dinero.format(Number(ultimo.totalDebe))}</strong></article><article className="metric"><p>Diferencia</p><strong className={Math.abs(diferencia)<0.01?"positive":"negative"}>{dinero.format(diferencia)}</strong></article></section>:null}
    {error?<div className="authError adminError">{error}</div>:null}
    <form className="panel formPanel importPanel" onSubmit={importarSituacion}>
      <div className="panelHead compact"><div><h2>Estado de Situación Financiera</h2><p>Fuente exclusiva del flujo de efectivo. Se comparará el campo Saldo Final entre períodos.</p></div></div>
      <div className="formGrid"><label>Período<input type="month" value={situacionPeriodo} onChange={event=>setSituacionPeriodo(event.target.value)} required/></label><label>Archivo<input type="file" accept=".csv,.xls,.xlsx" onChange={event=>setSituacionFile(event.target.files?.[0]??null)} required/></label><label className="wide">Campos detectados<input readOnly value="Descripción, Saldo Final"/></label></div>
      {situacionFile?<div className="readOnlyBanner">Archivo seleccionado: {situacionFile.name} · {Math.round(situacionFile.size/1024)} KB</div>:null}
      <div className="formActions"><button className="primary" type="submit" disabled={savingSituacion}>{savingSituacion?"Importando…":"Importar estado financiero"}</button></div>
    </form>
    <section className="panel tablePanel"><div className="panelHead"><div><h2>Estados de Situación Financiera</h2><p>{situaciones.length} archivos procesados</p></div></div><div className="tableWrap"><table><thead><tr><th>ARCHIVO</th><th>PERÍODO</th><th>SALDOS FINALES</th><th>FECHA</th><th>ESTADO</th></tr></thead><tbody>{situaciones.map(item=><tr key={item.id}><td><b>{item.archivoNombre}</b><small>{Math.round(item.archivoTamano/1024)} KB</small></td><td>{item.periodo}</td><td>{item.totalLineas}</td><td>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</td><td><span className={statusClass(item.estado)}>{item.estado==="procesado"?"Procesado":"Error"}</span></td></tr>)}</tbody></table></div>{!situaciones.length?<div className="emptyReport">Todavía no hay Estados de Situación Financiera importados.</div>:null}</section>
    <form className="panel formPanel importPanel" onSubmit={importar}>
      <div className="panelHead compact"><div><h2>Balanza de comprobación</h2><p>Continúa alimentando los demás estados y reportes contables.</p></div></div>
      <div className="formGrid"><label>Período<input type="month" value={periodo} onChange={event=>setPeriodo(event.target.value)} required/></label><label>Archivo<input type="file" accept=".csv,.xls,.xlsx" onChange={event=>setFile(event.target.files?.[0]??null)} required/></label><label className="wide">Campos detectados<input readOnly value="Cuenta, Descripción, Saldo Inicial, Débitos, Créditos, Saldo Final"/></label></div>
      {file?<div className="readOnlyBanner">Archivo seleccionado: {file.name} · {Math.round(file.size/1024)} KB</div>:null}
      <div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Importando…":"Importar balanza"}</button></div>
    </form>
    <section className="panel tablePanel"><div className="panelHead"><div><h2>Historial de balanzas</h2><p>{importaciones.length} archivos procesados</p></div></div><div className="tableWrap"><table><thead><tr><th>ARCHIVO</th><th>PERÍODO</th><th>LÍNEAS</th><th>TOTAL DÉBITOS</th><th>TOTAL CRÉDITOS</th><th>DIFERENCIA</th><th>FECHA</th><th>ESTADO</th></tr></thead><tbody>{importaciones.map(item=>{const diff=Number(item.totalDebe)-Number(item.totalHaber);return <tr key={item.id}><td><b>{item.archivoNombre}</b><small>{Math.round(item.archivoTamano/1024)} KB</small></td><td>{item.periodo}</td><td>{item.totalLineas}</td><td className="amount">{dinero.format(Number(item.totalDebe))}</td><td className="amount">{dinero.format(Number(item.totalHaber))}</td><td className={Math.abs(diff)<0.01?"amount positive":"amount negative"}>{dinero.format(diff)}</td><td>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</td><td><span className={statusClass(item.estado)}>{estadoImportacion(item.estado)}</span></td></tr>})}</tbody></table></div></section>
  </>;
}
