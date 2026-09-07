"use client";
import { type FormEvent, useEffect, useState } from "react";
import { currentMonth, dinero, estadoImportacion, statusClass, type ImportacionBalanza } from "../shared";

export default function Importaciones({ notify }: { notify: (message: string) => void }) {
  const [importaciones, setImportaciones] = useState<ImportacionBalanza[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [periodo, setPeriodo] = useState(currentMonth());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function cargarHistorial() {
    const response = await fetch("/api/importaciones/balanza");
    const data = await response.json();
    if (response.ok) setImportaciones(data.importaciones ?? []);
    else setError(data.error ?? "No se pudo cargar el historial");
  }

  useEffect(() => { void Promise.resolve().then(cargarHistorial); }, []);

  async function importar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Seleccione el archivo de balanza");
    setSaving(true); setError("");
    const form = new FormData();
    form.append("periodo", periodo);
    form.append("archivo", file);
    const response = await fetch("/api/importaciones/balanza", { method: "POST", body: form });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error ?? "No se pudo importar la balanza");
    setImportaciones(current => [result.importacion, ...current]);
    setFile(null);
    notify(`${estadoImportacion(result.importacion.estado)}: ${result.importacion.totalLineas} líneas`);
  }

  const ultimo = importaciones[0];
  const diferencia = ultimo ? Number(ultimo.totalDebe) - Number(ultimo.totalHaber) : 0;
  return <><div className="pageHead"><div><span className="eyebrow">IMPORTACIONES</span><h1>Balanza de comprobación</h1><p>Importe el Excel mensual del contador con Cuenta, Descripción, Saldo Inicial, Débitos, Créditos y Saldo Final.</p></div></div>{ultimo?<section className="metrics compactMetrics"><article className="metric featured"><p>Última importación</p><strong>{ultimo.periodo}</strong><span className={statusClass(ultimo.estado)}>{estadoImportacion(ultimo.estado)}</span></article><article className="metric"><p>Líneas leídas</p><strong>{ultimo.totalLineas}</strong><small>{ultimo.archivoNombre}</small></article><article className="metric"><p>Total débitos</p><strong>{dinero.format(Number(ultimo.totalDebe))}</strong></article><article className="metric"><p>Diferencia</p><strong className={Math.abs(diferencia)<0.01?"positive":"negative"}>{dinero.format(diferencia)}</strong></article></section>:null}<form className="panel formPanel importPanel" onSubmit={importar}><div className="panelHead compact"><div><h2>Importar archivo</h2><p>Formato esperado: balance de comprobación en CSV, XLS o XLSX.</p></div></div><div className="formGrid"><label>Período<input type="month" value={periodo} onChange={event=>setPeriodo(event.target.value)} required/></label><label>Archivo<input type="file" accept=".csv,.xls,.xlsx" onChange={event=>setFile(event.target.files?.[0]??null)} required/></label><label className="wide">Campos detectados<input readOnly value="Cuenta, Descripción, Saldo Inicial, Débitos, Créditos, Saldo Final"/></label></div>{file?<div className="readOnlyBanner">Archivo seleccionado: {file.name} · {Math.round(file.size/1024)} KB</div>:null}{error?<div className="authError adminError">{error}</div>:null}<div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Importando…":"Importar balanza"}</button></div></form><section className="panel tablePanel"><div className="panelHead"><div><h2>Historial de importaciones</h2><p>{importaciones.length} archivos procesados</p></div></div><div className="tableWrap"><table><thead><tr><th>ARCHIVO</th><th>PERÍODO</th><th>LÍNEAS</th><th>TOTAL DÉBITOS</th><th>TOTAL CRÉDITOS</th><th>DIFERENCIA</th><th>FECHA</th><th>ESTADO</th></tr></thead><tbody>{importaciones.map(item=>{const diff=Number(item.totalDebe)-Number(item.totalHaber);return <tr key={item.id}><td><b>{item.archivoNombre}</b><small>{Math.round(item.archivoTamano/1024)} KB</small></td><td>{item.periodo}</td><td>{item.totalLineas}</td><td className="amount">{dinero.format(Number(item.totalDebe))}</td><td className="amount">{dinero.format(Number(item.totalHaber))}</td><td className={Math.abs(diff)<0.01?"amount positive":"amount negative"}>{dinero.format(diff)}</td><td>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</td><td><span className={statusClass(item.estado)}>{estadoImportacion(item.estado)}</span></td></tr>})}</tbody></table></div></section></>;
}
