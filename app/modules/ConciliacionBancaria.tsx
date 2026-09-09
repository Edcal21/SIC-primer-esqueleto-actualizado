"use client";
import { useEffect, useState } from "react";
import { formatearMoneda, type Conciliacion, type LineaBanco, type LineaConciliacion, type MovimientoConciliable, type ReporteDisponible, type RequestConfirmation } from "../shared";

const estadoLineaClass = (estado: LineaBanco["estadoConciliacion"]) => estado === "conciliada" ? "status done" : estado === "descartada" ? "status danger" : "status pending";
const estadoConciliacionClass = (estado: Conciliacion["estado"]) => estado === "aprobada" ? "status done" : estado === "rechazada" ? "status danger" : "status pending";
const netoLinea = (linea: LineaBanco) => Number(linea.credito) - Number(linea.debito);
const pendienteDeTasa = (linea: LineaBanco) => linea.moneda === "USD" && linea.tasaCambio === null;

export default function ConciliacionBancaria({ canReconcile, canApprove, notify, requestConfirmation }: { canReconcile: boolean; canApprove: boolean; notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [conciliaciones, setConciliaciones] = useState<Conciliacion[]>([]);
  const [disponibles, setDisponibles] = useState<ReporteDisponible[]>([]);
  const [seleccionada, setSeleccionada] = useState("");
  const [detalle, setDetalle] = useState<{ conciliacion: Conciliacion; lineas: LineaConciliacion[]; movimientos: MovimientoConciliable[] } | null>(null);
  const [reporteNuevo, setReporteNuevo] = useState("");
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState("");
  const [filtroLineas, setFiltroLineas] = useState("");
  const [estadoLineas, setEstadoLineas] = useState<LineaBanco["estadoConciliacion"] | "todas">("todas");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarLista() {
    setLoading(true);
    try {
      const response = await fetch("/api/conciliaciones");
      const data = await response.json().catch(() => ({})) as { conciliaciones?: Conciliacion[]; reportesDisponibles?: ReporteDisponible[]; error?: string };
      if (!response.ok) return setError(data.error ?? "No se pudo cargar el historial de conciliaciones");
      setConciliaciones(data.conciliaciones ?? []);
      setDisponibles(data.reportesDisponibles ?? []);
      setError("");
    } catch {
      setError("No se pudo conectar con el servicio de conciliaciones");
    } finally { setLoading(false); }
  }

  async function cargarDetalle(id: string) {
    setSeleccionada(id); setDetalle(null); setEnlaces({}); setObservaciones("");
    try {
      const response = await fetch(`/api/conciliaciones/${id}`);
      const data = await response.json().catch(() => ({})) as { conciliacion?: Conciliacion; lineas?: LineaConciliacion[]; movimientos?: MovimientoConciliable[]; error?: string };
      if (!response.ok || !data.conciliacion) return setError(data.error ?? "No se pudo cargar la conciliación");
      setDetalle({ conciliacion: data.conciliacion, lineas: data.lineas ?? [], movimientos: data.movimientos ?? [] });
      setError("");
    } catch { setError("No se pudo conectar con el servicio de conciliaciones"); }
  }

  useEffect(() => { void Promise.resolve().then(cargarLista); }, []);

  async function generar() {
    if (!reporteNuevo) return setError("Seleccione un estado de cuenta procesado");
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/conciliaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporteId: reporteNuevo }),
      });
      const result = await response.json().catch(() => ({})) as { conciliacion?: Conciliacion; enlazadasAutomaticamente?: number; error?: string };
      if (!response.ok || !result.conciliacion) return setError(result.error ?? "No se pudo generar la conciliación");
      setReporteNuevo("");
      await cargarLista();
      await cargarDetalle(result.conciliacion.id);
      notify(`Conciliación generada: ${result.enlazadasAutomaticamente ?? 0} líneas enlazadas automáticamente`);
    } finally { setSaving(false); }
  }

  async function accionLinea(accion: "conciliar" | "descartar" | "reabrir", linea: LineaConciliacion) {
    if (!detalle) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/conciliaciones/${detalle.conciliacion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, lineaId: linea.id, movimientoId: accion === "conciliar" ? enlaces[linea.id] : undefined }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setError(result.error ?? "No se pudo actualizar la línea");
      await cargarDetalle(detalle.conciliacion.id);
      await cargarLista();
      notify(accion === "conciliar" ? "Línea enlazada con el movimiento contable" : accion === "descartar" ? "Línea descartada de la conciliación" : "Línea devuelta a pendiente");
    } finally { setSaving(false); }
  }

  function revisar(accion: "aprobar" | "rechazar") {
    if (!detalle) return;
    if (accion === "rechazar" && !observaciones.trim()) return setError("Indique el motivo del rechazo en las observaciones");
    requestConfirmation({
      title: accion === "aprobar" ? "Aprobar conciliación bancaria" : "Rechazar conciliación bancaria",
      message: accion === "aprobar"
        ? `Se aprobará la conciliación del período ${detalle.conciliacion.periodo} para la cuenta ${detalle.conciliacion.cuentaBancariaNombre ?? detalle.conciliacion.cuentaBancariaNumero}. La conciliación quedará cerrada y auditada.`
        : `Se rechazará la conciliación del período ${detalle.conciliacion.periodo}. El motivo quedará registrado en la auditoría del sistema.`,
      confirmLabel: accion === "aprobar" ? "Aprobar" : "Rechazar",
      isDanger: accion === "rechazar",
      onConfirm: async () => {
        const response = await fetch(`/api/conciliaciones/${detalle.conciliacion.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion, observaciones: observaciones.trim() || undefined }),
        });
        const result = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) return setError(result.error ?? "No se pudo revisar la conciliación");
        await cargarDetalle(detalle.conciliacion.id);
        await cargarLista();
        notify(accion === "aprobar" ? "Conciliación aprobada" : "Conciliación rechazada");
      },
    });
  }

  const conciliacion = detalle?.conciliacion;
  const editable = Boolean(conciliacion && conciliacion.estado === "borrador" && canReconcile);
  const disponiblesMovimientos = (detalle?.movimientos ?? []).filter(movimiento => !movimiento.lineaId);
  const lineasDetalle = (detalle?.lineas ?? []).filter(linea => {
    const texto = filtroLineas.trim().toLowerCase();
    const coincideTexto = !texto || [linea.descripcion, linea.referencia, linea.fecha, linea.movimiento?.concepto].some(value => String(value ?? "").toLowerCase().includes(texto));
    const coincideEstado = estadoLineas === "todas" || linea.estadoConciliacion === estadoLineas;
    return coincideTexto && coincideEstado;
  });

  function movimientoCell(linea: LineaConciliacion) {
    if (linea.movimiento) {
      return <div className="matchCell"><b>{linea.movimiento.concepto}</b><small>{linea.movimiento.fecha} · {formatearMoneda(linea.movimiento.montoOriginal, linea.movimiento.moneda)}{!linea.movimiento.completo ? " · minuta histórica sin línea bancaria marcada" : ""}</small>{editable ? <button className="linkButton" type="button" onClick={() => accionLinea("reabrir", linea)} disabled={saving}>Deshacer enlace</button> : null}</div>;
    }
    if (!editable) return <small>{linea.estadoConciliacion === "descartada" ? "Descartada sin enlace contable" : "Sin movimiento enlazado"}</small>;
    if (pendienteDeTasa(linea)) return <small>Registre la tasa de cambio de esta fecha en Configuración → Tasas de cambio para poder enlazarla.</small>;
    return <div className="matchCell">
      <select value={enlaces[linea.id] ?? ""} onChange={event => setEnlaces(current => ({ ...current, [linea.id]: event.target.value }))} disabled={!disponiblesMovimientos.length}>
        <option value="">{disponiblesMovimientos.length ? "Seleccione un movimiento" : "Sin minutas disponibles en el período"}</option>
        {disponiblesMovimientos.map(movimiento => <option key={movimiento.id} value={movimiento.id}>{movimiento.fecha} · {formatearMoneda(movimiento.montoOriginal, movimiento.moneda)} · {movimiento.concepto}{Math.abs(movimiento.montoOriginal - Math.abs(netoLinea(linea))) < 0.01 ? " · monto coincide" : ""}</option>)}
      </select>
      <div className="matchActions">
        <button className="linkButton" type="button" onClick={() => accionLinea("conciliar", linea)} disabled={saving || !enlaces[linea.id]}>Enlazar</button>
        {linea.estadoConciliacion === "pendiente"
          ? <button className="linkButton" type="button" onClick={() => accionLinea("descartar", linea)} disabled={saving}>Descartar</button>
          : <button className="linkButton" type="button" onClick={() => accionLinea("reabrir", linea)} disabled={saving}>Reabrir</button>}
      </div>
    </div>;
  }

  return <><div className="pageHead"><div><span className="eyebrow">CONCILIACIÓN</span><h1>Conciliación bancaria</h1><p>Enlace cada movimiento del estado de cuenta con las minutas registradas y cierre el período con aprobación.</p></div></div>
    {canReconcile && canApprove ? <div className="segregationWarning" role="alert"><b>Segregación de funciones</b><span>Advertencia: Usted tiene permisos de conciliación Y aprobación. Para control interno, se recomienda separar estas funciones entre usuarios distintos. Si concilia y aprueba una misma conciliación, la excepción quedará registrada en auditoría.</span></div> : null}
    {error ? <div className="authError adminError">{error}</div> : null}
    {canReconcile ? <section className="panel uploadPanel">
      <div><h2>Generar conciliación</h2><p>Al generarla, el sistema enlaza automáticamente las líneas con una única minuta coincidente por monto y fecha.</p></div>
      <label className="uploadField">Estado de cuenta procesado<select value={reporteNuevo} onChange={event => setReporteNuevo(event.target.value)} disabled={!disponibles.length}><option value="" disabled>{disponibles.length ? "Seleccione un estado de cuenta" : "No hay estados de cuenta pendientes de conciliar"}</option>{disponibles.map(reporte => <option key={reporte.id} value={reporte.id}>{reporte.nombre} · {reporte.cuentaBancariaNumero} · {reporte.totalLineas} líneas</option>)}</select></label>
      <button className="primary" type="button" onClick={generar} disabled={saving || !reporteNuevo}>{saving ? "Generando…" : "Generar conciliación"}</button>
    </section> : <div className="readOnlyBanner">Acceso de solo lectura: puede consultar conciliaciones, pero no modificarlas.</div>}
    <section className="panel tablePanel">
      <div className="panelHead"><div><h2>Conciliaciones registradas</h2><p>{loading ? "Cargando desde PostgreSQL" : `${conciliaciones.length} conciliaciones`}</p></div><button onClick={cargarLista}>Actualizar</button></div>
      <div className="tableWrap"><table><thead><tr><th>PERÍODO</th><th>CUENTA</th><th>ESTADO DE CUENTA</th><th>NETO BANCO</th><th>CONCILIADO</th><th>PENDIENTE</th><th>LÍNEAS</th><th>ESTADO</th><th/></tr></thead><tbody>{conciliaciones.map(item => <tr key={item.id}>
        <td><b>{item.periodo}</b><small>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</small></td>
        <td>{item.cuentaBancariaNombre ?? item.cuentaBancariaNumero} <small>{item.cuentaBancariaMoneda ?? "NIO"}</small></td>
        <td>{item.reporteNombre ?? "-"}</td>
        <td className="amount">{formatearMoneda(Number(item.totalBanco), item.cuentaBancariaMoneda ?? "NIO")}</td>
        <td className="amount">{formatearMoneda(Number(item.totalConciliado), item.cuentaBancariaMoneda ?? "NIO")}</td>
        <td className={Math.abs(Number(item.totalPendiente)) < 0.01 ? "amount positive" : "amount negative"}>{formatearMoneda(Number(item.totalPendiente), item.cuentaBancariaMoneda ?? "NIO")}</td>
        <td>{item.lineasConciliadas} de {item.lineasConciliadas + item.lineasPendientes}</td>
        <td><span className={estadoConciliacionClass(item.estado)}>{item.estado}</span></td>
        <td><button className="linkButton" type="button" onClick={() => cargarDetalle(item.id)}>{seleccionada === item.id ? "Actualizar" : "Abrir"}</button></td>
      </tr>)}</tbody></table></div>
      {!loading && !conciliaciones.length ? <div className="emptyReport">Todavía no hay conciliaciones. Procese un estado de cuenta y genere la primera conciliación.</div> : null}
    </section>
    {conciliacion ? <>
      {(() => {
        const moneda = conciliacion.cuentaBancariaMoneda ?? "NIO";
        return <section className="metrics compactMetrics">
          <article className="metric featured"><p>Neto del banco ({moneda})</p><strong>{formatearMoneda(Number(conciliacion.totalBanco), moneda)}</strong><span className={estadoConciliacionClass(conciliacion.estado)}>{conciliacion.estado}</span></article>
          <article className="metric"><p>Conciliado con libros ({moneda})</p><strong>{formatearMoneda(Number(conciliacion.totalConciliado), moneda)}</strong><small>{conciliacion.lineasConciliadas} líneas enlazadas</small></article>
          <article className="metric"><p>Diferencia pendiente ({moneda})</p><strong className={Math.abs(Number(conciliacion.totalPendiente)) < 0.01 ? "positive" : "negative"}>{formatearMoneda(Number(conciliacion.totalPendiente), moneda)}</strong><small>{conciliacion.lineasPendientes} líneas sin resolver</small></article>
          <article className="metric"><p>Minutas sin respaldo bancario</p><strong>{conciliacion.movimientosSinConciliar}</strong><small>Registradas en libros y ausentes del estado de cuenta</small></article>
        </section>;
      })()}
      <section className="panel tablePanel">
        <div className="panelHead">
          <div><h2>Detalle de la conciliación</h2><p>{conciliacion.reporteNombre} · cuenta {conciliacion.cuentaBancariaNombre ?? conciliacion.cuentaBancariaNumero} ({conciliacion.cuentaBancariaMoneda ?? "NIO"}) · período {conciliacion.periodo}</p></div>
          {canApprove && conciliacion.estado === "borrador" ? <div className="reviewActions"><label>Observaciones<textarea value={observaciones} onChange={event => setObservaciones(event.target.value)} rows={2} placeholder="Obligatorias para rechazar"/></label><div className="reportActions"><button className="secondary" type="button" onClick={() => revisar("rechazar")}>Rechazar</button><button className="primary" type="button" onClick={() => revisar("aprobar")} disabled={conciliacion.lineasPendientes > 0}>Aprobar conciliación</button></div></div> : null}
        </div>
        {conciliacion.estado !== "borrador" ? <div className="readOnlyBanner">Conciliación {conciliacion.estado} por {conciliacion.revisadoPorNombre ?? "revisor no registrado"}{conciliacion.revisadoEn ? ` el ${new Date(conciliacion.revisadoEn).toLocaleString("es-NI")}` : ""}.{conciliacion.observaciones ? ` Observaciones: ${conciliacion.observaciones}` : ""}</div> : null}
        {conciliacion.estado === "borrador" && conciliacion.lineasPendientes > 0 && canApprove ? <div className="readOnlyBanner">Para aprobar debe enlazar o descartar las {conciliacion.lineasPendientes} líneas pendientes.</div> : null}
        <div className="tableToolbar">
          <label>Buscar<input value={filtroLineas} onChange={event => setFiltroLineas(event.target.value)} placeholder="Descripción, referencia o minuta"/></label>
          <label>Estado<select value={estadoLineas} onChange={event => setEstadoLineas(event.target.value as LineaBanco["estadoConciliacion"] | "todas")}><option value="todas">Todas</option><option value="pendiente">Pendientes</option><option value="conciliada">Conciliadas</option><option value="descartada">Descartadas</option></select></label>
          <span>{lineasDetalle.length} de {detalle?.lineas.length ?? 0} líneas</span>
        </div>
        <div className="tableWrap reconciliationTable"><table><thead><tr><th>#</th><th>FECHA</th><th>DESCRIPCIÓN</th><th>MONTO</th><th>ESTADO</th><th>MOVIMIENTO CONTABLE</th></tr></thead><tbody>{lineasDetalle.map(linea => <tr key={linea.id}>
          <td>{linea.numeroLinea}</td>
          <td>{linea.fecha ?? "Sin fecha"}</td>
          <td><b>{linea.descripcion}</b>{linea.referencia ? <small>Ref. {linea.referencia}</small> : null}</td>
          <td className={netoLinea(linea) < 0 ? "amount negative" : "amount positive"}>{formatearMoneda(netoLinea(linea), linea.moneda)}</td>
          <td><span className={estadoLineaClass(linea.estadoConciliacion)}>{linea.estadoConciliacion}</span>{pendienteDeTasa(linea) ? <small className="status pending">Pendiente de completar tasa USD</small> : null}</td>
          <td>{movimientoCell(linea)}</td>
        </tr>)}</tbody></table></div>
        <div className="mobileRecordList" aria-label="Líneas de conciliación">
          {lineasDetalle.map(linea => <article className="mobileRecordCard" key={linea.id}>
            <header>
              <div><b>#{linea.numeroLinea} · {linea.fecha ?? "Sin fecha"}</b><span>{linea.referencia ? `Ref. ${linea.referencia}` : "Sin referencia"}</span></div>
              <strong className={netoLinea(linea) < 0 ? "negative" : "positive"}>{formatearMoneda(netoLinea(linea), linea.moneda)}</strong>
            </header>
            <p>{linea.descripcion}</p>
            <div className="recordMeta"><span className={estadoLineaClass(linea.estadoConciliacion)}>{linea.estadoConciliacion}</span>{pendienteDeTasa(linea) ? <span className="status pending">Pendiente de tasa USD</span> : null}</div>
            <div className="recordActionBlock">{movimientoCell(linea)}</div>
          </article>)}
        </div>
        {!lineasDetalle.length ? <div className="emptySmall">No hay líneas que coincidan con los filtros seleccionados.</div> : null}
      </section>
      {disponiblesMovimientos.length ? <section className="panel tablePanel">
        <div className="panelHead"><div><h2>Minutas sin respaldo bancario</h2><p>Movimientos registrados en libros sobre esta cuenta que no aparecen enlazados</p></div></div>
        <div className="tableWrap"><table><thead><tr><th>FECHA</th><th>CONCEPTO</th><th>REFERENCIA</th><th>MONTO</th></tr></thead><tbody>{disponiblesMovimientos.map(movimiento => <tr key={movimiento.id}>
          <td>{movimiento.fecha}</td>
          <td>{movimiento.concepto}{!movimiento.completo ? <small> · histórica sin línea bancaria marcada</small> : null}</td>
          <td>{movimiento.referencia ?? "Sin referencia"}</td>
          <td className="amount">{formatearMoneda(movimiento.montoOriginal, movimiento.moneda)}</td>
        </tr>)}</tbody></table></div>
      </section> : null}
    </> : null}
  </>;
}
