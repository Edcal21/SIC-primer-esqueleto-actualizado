"use client";
import { type FormEvent, useEffect, useState } from "react";
import { dinero, statusClass, type CuentaBancaria, type LineaBanco, type Reporte, type RequestConfirmation } from "../shared";
import CuentasBancariasPanel from "./CuentasBancariasPanel";

export default function Bancos({ canUpload, canManageAccounts, notify, requestConfirmation }: { canUpload: boolean; canManageAccounts: boolean; notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState("");
  const [detalle, setDetalle] = useState<{ reporte: Reporte; lineas: LineaBanco[] } | null>(null);
  const [detalleId, setDetalleId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarReportes() {
    setLoading(true);
    try {
      const response = await fetch("/api/banco/reportes");
      const data = await response.json().catch(() => ({})) as { reportes?: Reporte[]; error?: string };
      if (response.ok) {
        setReportes(data.reportes ?? []);
        setError("");
      } else {
        setError(data.error ?? `No se pudo cargar el historial bancario (HTTP ${response.status})`);
      }
    } catch {
      setError("No se pudo conectar con el servicio de reportes bancarios");
    } finally { setLoading(false); }
  }

  async function cargarCuentas() {
    try {
      const response = await fetch("/api/cuentas-bancarias?estado=todas");
      const data = await response.json().catch(() => ({})) as { cuentasBancarias?: CuentaBancaria[]; error?: string };
      if (response.ok) setCuentas(data.cuentasBancarias ?? []);
    } catch { setError("No se pudo cargar el catálogo de cuentas bancarias"); }
  }

  useEffect(() => { void Promise.resolve().then(cargarReportes); void Promise.resolve().then(cargarCuentas); }, []);

  async function verDetalle(reporte: Reporte) {
    if (detalleId === reporte.id) { setDetalleId(""); setDetalle(null); return; }
    setDetalleId(reporte.id); setDetalle(null);
    try {
      const response = await fetch(`/api/banco/reportes/${reporte.id}`);
      const data = await response.json().catch(() => ({})) as { reporte?: Reporte; lineas?: LineaBanco[]; error?: string };
      if (!response.ok || !data.reporte) return setError(data.error ?? "No se pudo cargar el detalle del reporte");
      setDetalle({ reporte: data.reporte, lineas: data.lineas ?? [] });
    } catch { setError("No se pudo conectar con el servicio de reportes bancarios"); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Seleccione un archivo CSV o Excel");
    if (!cuentaSeleccionada) return setError("Seleccione la cuenta bancaria del estado de cuenta");
    const formElement = event.currentTarget;
    setSaving(true); setError("");
    const form = new FormData();
    form.append("archivo", file);
    form.append("cuentaBancariaNumero", cuentaSeleccionada);
    try {
      const response = await fetch("/api/banco/reportes", { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { reporte?: Reporte; error?: string };
      if (!response.ok || !result.reporte) return setError(result.error ?? `No se pudo procesar el reporte bancario (HTTP ${response.status})`);
      setReportes(current => [result.reporte!, ...current]);
      setFile(null);
      formElement.reset();
      notify(`Estado bancario procesado: ${result.reporte.totalLineas ?? 0} movimientos guardados`);
    } catch {
      setError("No se pudo conectar con el servicio de reportes bancarios");
    } finally { setSaving(false); }
  }

  const activas = cuentas.filter(cuenta => (cuenta.estado ?? "activa") === "activa");
  const ultimo = reportes[0];
  const lineasGuardadas = reportes.reduce((total, reporte) => total + (reporte.totalLineas ?? 0), 0);
  return <><div className="pageHead"><div><span className="eyebrow">BANCOS</span><h1>Reportes bancarios</h1><p>Carga, procesamiento y consulta de estados de cuenta almacenados en PostgreSQL.</p></div></div>
    <section className="metrics compactMetrics">
      <article className="metric featured"><p>Archivos recibidos</p><strong>{loading ? "..." : reportes.length}</strong><small>{reportes.filter(item => item.estado === "procesado").length} procesados correctamente</small></article>
      <article className="metric"><p>Movimientos guardados</p><strong>{loading ? "..." : lineasGuardadas}</strong><small>Líneas persistidas en la base de datos</small></article>
      <article className="metric"><p>Última carga</p><strong>{ultimo ? new Date(ultimo.creadoEn ?? ultimo.fecha).toLocaleDateString("es-NI") : "Sin cargas"}</strong><small>{ultimo?.nombre ?? "No hay reportes bancarios"}</small></article>
      <article className="metric"><p>Estado reciente</p><strong>{ultimo?.estado ?? "Pendiente"}</strong><span className={statusClass(ultimo?.estado ?? "pendiente")}>{ultimo?.estado ?? "sin archivo"}</span></article>
    </section>
    {canUpload ? <form className="panel uploadPanel bankUploadPanel" onSubmit={upload}>
      <div><h2>Subir estado de cuenta</h2><p>El archivo se procesa al recibirlo: cada movimiento queda guardado y disponible para conciliación.</p></div>
      <label className="uploadField">Cuenta bancaria<select value={cuentaSeleccionada} onChange={event => setCuentaSeleccionada(event.target.value)} required disabled={!activas.length}><option value="" disabled>{activas.length ? "Seleccione una cuenta bancaria" : "Sin cuentas bancarias activas"}</option>{activas.map(cuenta => <option key={cuenta.numeroCuenta} value={cuenta.numeroCuenta}>{cuenta.nombre} · {cuenta.numeroCuenta} · {cuenta.moneda}</option>)}</select></label>
      <label className="fileDrop"><input type="file" accept=".csv,.xls,.xlsx" onChange={event => setFile(event.target.files?.[0] ?? null)}/><span>{file ? file.name : "Seleccionar CSV o Excel"}</span>{file ? <small>{Math.round(file.size / 1024)} KB · listo para procesar</small> : <small>Se requieren columnas de descripción y de débito, crédito o monto</small>}</label>
      <button className="primary" type="submit" disabled={saving || !activas.length}>{saving ? "Procesando..." : "Procesar reporte"}</button>
      {error ? <span className="uploadError">{error}</span> : null}
    </form> : <div className="readOnlyBanner">Acceso de solo lectura: puede consultar reportes bancarios, pero no cargarlos.</div>}
    {!canUpload && error ? <div className="authError adminError">{error}</div> : null}
    <section className="panel tablePanel">
      <div className="panelHead"><div><h2>Historial bancario</h2><p>{loading ? "Cargando desde PostgreSQL" : `${reportes.length} archivos disponibles`}</p></div><button onClick={cargarReportes}>Actualizar</button></div>
      <div className="tableWrap"><table><thead><tr><th>ARCHIVO</th><th>CUENTA</th><th>PERÍODO</th><th>LÍNEAS</th><th>DÉBITOS</th><th>CRÉDITOS</th><th>ESTADO</th><th>CONCILIACIÓN</th><th/></tr></thead><tbody>{reportes.map(item => <tr key={item.id}>
        <td><b>{item.nombre}</b><small>{item.cargadoPor} · {new Date(item.fecha).toLocaleDateString("es-NI")}</small></td>
        <td>{item.cuentaBancariaNumero ?? "No asignada"}</td>
        <td>{item.periodoInicio && item.periodoFin ? `${item.periodoInicio} a ${item.periodoFin}` : "Sin fechas en el archivo"}</td>
        <td>{item.totalLineas ?? 0}</td>
        <td className="amount">{dinero.format(Number(item.totalDebitos ?? 0))}</td>
        <td className="amount">{dinero.format(Number(item.totalCreditos ?? 0))}</td>
        <td><span className={statusClass(item.estado)}>{item.estado}</span>{item.mensajeError ? <small>{item.mensajeError}</small> : null}</td>
        <td>{item.conciliacionEstado ? <span className={item.conciliacionEstado === "aprobada" ? "status done" : item.conciliacionEstado === "rechazada" ? "status danger" : "status pending"}>{item.conciliacionEstado}</span> : <small>Sin conciliar</small>}</td>
        <td>{item.estado === "procesado" ? <button className="linkButton" type="button" onClick={() => verDetalle(item)}>{detalleId === item.id ? "Ocultar" : "Ver detalle"}</button> : null}</td>
      </tr>)}</tbody></table></div>
      {!loading && !reportes.length ? <div className="emptyReport">Todavía no hay reportes bancarios guardados. Use el formulario superior para procesar el primer estado de cuenta.</div> : null}
    </section>
    {detalleId ? <section className="panel tablePanel">
      <div className="panelHead"><div><h2>Movimientos del estado de cuenta</h2><p>{detalle ? `${detalle.lineas.length} líneas guardadas de ${detalle.reporte.nombre}` : "Cargando líneas desde PostgreSQL"}</p></div></div>
      {detalle ? <div className="tableWrap"><table><thead><tr><th>#</th><th>FECHA</th><th>REFERENCIA</th><th>DESCRIPCIÓN</th><th>DÉBITO</th><th>CRÉDITO</th><th>SALDO</th><th>CONCILIACIÓN</th></tr></thead><tbody>{detalle.lineas.map(linea => <tr key={linea.id}>
        <td>{linea.numeroLinea}</td>
        <td>{linea.fecha ?? "Sin fecha"}</td>
        <td>{linea.referencia ?? "Sin referencia"}</td>
        <td>{linea.descripcion}</td>
        <td className="amount">{Number(linea.debito) ? dinero.format(Number(linea.debito)) : "-"}</td>
        <td className="amount">{Number(linea.credito) ? dinero.format(Number(linea.credito)) : "-"}</td>
        <td className="amount">{linea.saldo === null ? "-" : dinero.format(Number(linea.saldo))}</td>
        <td><span className={estadoLineaClass(linea.estadoConciliacion)}>{linea.estadoConciliacion}</span></td>
      </tr>)}</tbody></table></div> : null}
    </section> : null}
    {canManageAccounts ? <CuentasBancariasPanel cuentas={cuentas} onChanged={cargarCuentas} notify={notify} requestConfirmation={requestConfirmation}/> : null}
  </>;
}
