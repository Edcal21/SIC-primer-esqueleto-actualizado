"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { dinero, type ReporteMinutasData } from "../shared";

const hoy = () => new Date().toLocaleDateString("en-CA");
const inicioMes = () => `${hoy().slice(0, 7)}-01`;

export default function ReporteMinutas({ canDownload }: { canDownload: boolean }) {
  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoy());
  const [iglesia, setIglesia] = useState("");
  const [reporte, setReporte] = useState<ReporteMinutasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const url = (formato = "json") => `/api/reportes/minutas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}${iglesia ? `&iglesia=${encodeURIComponent(iglesia)}` : ""}${formato === "csv" ? "&formato=csv" : ""}`;

  async function consultar(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (desde > hasta) return setError("La fecha inicial no puede ser posterior a la fecha final");
    setLoading(true); setError("");
    try {
      const response = await fetch(url());
      const data = await response.json().catch(() => ({})) as { reporte?: ReporteMinutasData; error?: string };
      if (!response.ok || !data.reporte) return setError(data.error ?? "No se pudo generar el reporte de minutas");
      setReporte(data.reporte);
    } catch {
      setError("No se pudo conectar con el generador del reporte de minutas");
    } finally { setLoading(false); }
  }

  const consultaInicial = useRef(consultar);
  useEffect(() => { void Promise.resolve().then(() => consultaInicial.current()); }, []);

  return <>
    <div className="reportTitle">
      <div><span className="status done">Movimientos contables registrados</span><h2>Reporte de minutas</h2><p>Consulte las minutas por iglesia y rango de fechas · Córdobas NIO</p></div>
      <div className="reportActions">{canDownload && reporte ? <button className="secondary" type="button" onClick={() => { window.location.href = url("csv"); }}>Descargar CSV</button> : null}</div>
    </div>
    <form className="formGrid reportMinuteFilters" onSubmit={consultar}>
      <label>Desde<input type="date" value={desde} max={hasta} onChange={event => setDesde(event.target.value)} required /></label>
      <label>Hasta<input type="date" value={hasta} min={desde} onChange={event => setHasta(event.target.value)} required /></label>
      <label>Iglesia<select value={iglesia} onChange={event => setIglesia(event.target.value)}><option value="">Todas las iglesias</option>{reporte?.iglesias.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} · {item.nombre}{item.estado === "inactiva" ? " (inactiva)" : ""}</option>)}</select></label>
      <div className="formActions"><button className="primary" type="submit" disabled={loading}>{loading ? "Consultando…" : "Aplicar filtros"}</button></div>
    </form>
    {error ? <div className="authError adminError">{error}</div> : null}
    {loading ? <div className="reportLoadingOverlay" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/><span className="loadingText">GENERANDO REPORTE</span><small>Consultando minutas en PostgreSQL...</small></div> : reporte ? <>
      <section className="metrics compactMetrics">
        <article className="metric featured"><p>Minutas encontradas</p><strong>{reporte.resumen.total}</strong><small>{reporte.desde} al {reporte.hasta}</small></article>
        <article className="metric"><p>Vigentes</p><strong>{reporte.resumen.vigentes}</strong><small>{reporte.resumen.anuladas} anuladas</small></article>
        <article className="metric"><p>Monto vigente</p><strong>{dinero.format(reporte.resumen.montoVigente)}</strong><small>Suma de débitos en NIO</small></article>
      </section>
      {reporte.truncado ? <div className="readOnlyBanner">Se muestran las primeras 1,000 minutas. Reduzca el rango de fechas o seleccione una iglesia para obtener el detalle completo.</div> : null}
      <div className="tableWrap"><table className="financialTable"><thead><tr><th>FECHA</th><th>IGLESIA</th><th>CONCEPTO</th><th>CUENTA BANCARIA</th><th>REFERENCIA</th><th>MONTO</th><th>ESTADO</th></tr></thead><tbody>{reporte.filas.map(fila => <tr key={fila.id}>
        <td>{fila.fecha}</td><td><b>{fila.iglesiaCodigo ?? "Sin código"}</b><small>{fila.iglesiaNombre ?? "Sin iglesia"}</small></td><td><b>{fila.concepto}</b><small>{fila.lineas} líneas contables</small></td><td>{fila.cuentaBancariaNumero ?? "Sin cuenta"}</td><td>{fila.referencia ?? "Sin referencia"}</td><td className="amount">{dinero.format(fila.monto)}</td><td><span className={fila.estado === "registrado" ? "status done" : "status danger"}>{fila.estado === "registrado" ? "Vigente" : "Anulada"}</span></td>
      </tr>)}</tbody></table></div>
      {!reporte.filas.length ? <div className="emptyReport">No hay minutas que coincidan con los filtros seleccionados.</div> : null}
      <footer><span>Generado: {new Date(reporte.generadoEn).toLocaleString("es-NI")}</span><span>{reporte.filas.length} minutas</span></footer>
    </> : null}
  </>;
}
