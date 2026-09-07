"use client";

import { useEffect, useState } from "react";
import { dinero, type CuentaBancaria, type DetalleRegistrado, type Iglesia, type MovimientoRegistrado } from "../shared";

export default function Minutas({ notify }: { notify: (message: string) => void }) {
  const [movimientos, setMovimientos] = useState<MovimientoRegistrado[]>([]);
  const [detalles, setDetalles] = useState<DetalleRegistrado[]>([]);
  const [iglesias, setIglesias] = useState<Iglesia[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "registrado" | "anulado">("todos");
  const [anulando, setAnulando] = useState<MovimientoRegistrado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarMinutas() {
    setLoading(true);
    try {
      const response = await fetch("/api/movimientos");
      const data = await response.json().catch(() => ({})) as { movimientos?: MovimientoRegistrado[]; detalles?: DetalleRegistrado[]; error?: string };
      if (!response.ok) return setError(data.error ?? `No se pudo cargar el historial de minutas (HTTP ${response.status})`);
      setMovimientos(data.movimientos ?? []);
      setDetalles(data.detalles ?? []);
      setError("");
    } catch {
      setError("No se pudo conectar con el servicio de movimientos");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void Promise.resolve().then(cargarMinutas);
    fetch("/api/iglesias").then(async response => { if (response.ok) setIglesias((await response.json()).iglesias ?? []); }).catch(() => undefined);
    fetch("/api/cuentas-bancarias").then(async response => { if (response.ok) setCuentasBancarias((await response.json()).cuentasBancarias ?? []); }).catch(() => undefined);
  }, []);

  async function anular() {
    if (!anulando) return;
    if (motivo.trim().length < 10) return setError("Indique el motivo de la anulación con al menos 10 caracteres");
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/movimientos/${anulando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "anulado", motivo: motivo.trim() }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setError(result.error ?? "No se pudo anular la minuta");
      setAnulando(null); setMotivo("");
      await cargarMinutas();
      notify("Minuta anulada y registrada en auditoría");
    } catch {
      setError("No se pudo conectar con el servicio de movimientos");
    } finally { setSaving(false); }
  }

  const nombreIglesia = (codigo: string | null) => iglesias.find(iglesia => iglesia.codigo === codigo)?.nombre ?? codigo ?? "Sin iglesia";
  const nombreCuenta = (numero: string | null) => cuentasBancarias.find(cuenta => cuenta.numeroCuenta === numero)?.nombre ?? numero ?? "Sin cuenta";
  const lineasDe = (movimientoId: string) => detalles.filter(detalle => detalle.movimientoId === movimientoId);
  const totalDe = (movimientoId: string) => lineasDe(movimientoId).filter(detalle => detalle.tipo === "debito").reduce((total, detalle) => total + Number(detalle.monto), 0);
  const visibles = movimientos.filter(movimiento => filtro === "todos" || movimiento.estado === filtro);
  const registradas = movimientos.filter(movimiento => movimiento.estado === "registrado");

  return <><div className="pageHead"><div><span className="eyebrow">CONTABILIDAD</span><h1>Minutas registradas</h1><p>Consulte los asientos guardados y anule los que sean incorrectos sin borrar su detalle contable.</p></div></div>
    <section className="metrics compactMetrics">
      <article className="metric featured"><p>Minutas consultadas</p><strong>{loading ? "..." : movimientos.length}</strong><small>Últimos 100 asientos registrados</small></article>
      <article className="metric"><p>Vigentes</p><strong>{loading ? "..." : registradas.length}</strong><small>{movimientos.length - registradas.length} anuladas</small></article>
      <article className="metric"><p>Monto vigente</p><strong>{dinero.format(registradas.reduce((total, movimiento) => total + totalDe(movimiento.id), 0))}</strong><small>Suma de débitos de minutas vigentes</small></article>
      <article className="metric"><p>Enlazadas a conciliación</p><strong>{movimientos.filter(movimiento => movimiento.enlazadoAConciliacion).length}</strong><small>No se pueden anular sin deshacer el enlace</small></article>
    </section>
    {error ? <div className="authError adminError">{error}</div> : null}
    {anulando ? <section className="panel formPanel annulPanel">
      <div className="panelHead compact"><div><h2>Anular minuta del {anulando.fecha}</h2><p>{anulando.concepto} · {dinero.format(totalDe(anulando.id))} · {nombreIglesia(anulando.iglesiaCodigo)}</p></div></div>
      <div className="tableWrap"><table><thead><tr><th>TIPO</th><th>CUENTA</th><th>MONTO</th></tr></thead><tbody>{lineasDe(anulando.id).map(linea => <tr key={linea.id}>
        <td>{linea.tipo === "debito" ? "Débito" : "Crédito"}</td>
        <td><b>{linea.cuentaCodigo}</b> {linea.cuentaNombre}</td>
        <td className="amount">{dinero.format(Number(linea.monto))}</td>
      </tr>)}</tbody></table></div>
      <div className="readOnlyBanner">El asiento y sus líneas se conservan en la base de datos; solo cambia el estado a anulado y queda registrado en auditoría con su motivo.</div>
      <div className="formGrid"><label className="wide">Motivo de la anulación<textarea value={motivo} onChange={event => setMotivo(event.target.value)} rows={2} required minLength={10}/></label></div>
      <div className="formActions">
        <button className="secondary" type="button" onClick={() => { setAnulando(null); setMotivo(""); setError(""); }} disabled={saving}>Cancelar</button>
        <button className="primary" type="button" onClick={anular} disabled={saving || motivo.trim().length < 10}>{saving ? "Anulando…" : "Confirmar anulación"}</button>
      </div>
    </section> : null}
    <section className="panel tablePanel">
      <div className="panelHead">
        <div><h2>Historial de minutas</h2><p>{loading ? "Cargando desde PostgreSQL" : `${visibles.length} de ${movimientos.length} asientos`}</p></div>
        <div className="granularity" role="group" aria-label="Filtrar por estado">{(["todos", "registrado", "anulado"] as const).map(item => <button key={item} className={filtro === item ? "active" : ""} type="button" onClick={() => setFiltro(item)}>{item === "todos" ? "Todas" : item === "registrado" ? "Vigentes" : "Anuladas"}</button>)}</div>
      </div>
      <div className="tableWrap"><table><thead><tr><th>FECHA</th><th>CONCEPTO</th><th>IGLESIA</th><th>CUENTA BANCARIA</th><th>REFERENCIA</th><th>MONTO</th><th>ESTADO</th><th/></tr></thead><tbody>{visibles.map(movimiento => <tr key={movimiento.id}>
        <td>{movimiento.fecha}</td>
        <td><b>{movimiento.concepto}</b><small>{lineasDe(movimiento.id).length} líneas contables</small></td>
        <td>{nombreIglesia(movimiento.iglesiaCodigo)}</td>
        <td>{nombreCuenta(movimiento.cuentaBancariaNumero)}</td>
        <td>{movimiento.referencia ?? "Sin referencia"}</td>
        <td className="amount">{dinero.format(totalDe(movimiento.id))}</td>
        <td><span className={movimiento.estado === "registrado" ? "status done" : "status danger"}>{movimiento.estado}</span></td>
        <td>{movimiento.estado === "registrado"
          ? movimiento.enlazadoAConciliacion
            ? <small>Enlazada a conciliación</small>
            : <button className="linkButton" type="button" onClick={() => { setAnulando(movimiento); setMotivo(""); setError(""); }}>Anular</button>
          : null}</td>
      </tr>)}</tbody></table></div>
      {!loading && !visibles.length ? <div className="emptyReport">{movimientos.length ? "Ninguna minuta coincide con el filtro seleccionado." : "Todavía no hay minutas registradas."}</div> : null}
    </section>
  </>;
}
