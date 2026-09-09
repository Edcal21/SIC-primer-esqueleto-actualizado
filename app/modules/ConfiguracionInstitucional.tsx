"use client";
import { type FormEvent, useEffect, useState } from "react";
import MenuIcon from "../components/MenuIcon";
import type { ConfiguracionSistema, EstadoRespaldos, TasaCambio } from "../shared";

const ETIQUETA_SALUD: Record<EstadoRespaldos["salud"], string> = {
  al_dia: "Al día",
  atrasado: "Atrasado",
  critico: "Crítico",
  sin_datos: "Sin respaldos",
};
const CLASE_SALUD: Record<EstadoRespaldos["salud"], string> = {
  al_dia: "status done",
  atrasado: "status pending",
  critico: "status danger",
  sin_datos: "status danger",
};

export default function ConfiguracionInstitucional({ config, onSaved, notify }: { config: ConfiguracionSistema; onSaved: (config: ConfiguracionSistema) => void; notify: (message: string) => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tasas, setTasas] = useState<TasaCambio[]>([]);
  const [tasaError, setTasaError] = useState("");
  const [savingTasa, setSavingTasa] = useState(false);
  const [respaldos, setRespaldos] = useState<EstadoRespaldos | null>(null);
  const [respaldosError, setRespaldosError] = useState("");
  const [solicitandoRespaldo, setSolicitandoRespaldo] = useState(false);

  async function cargarRespaldos() {
    try {
      const response = await fetch("/api/respaldos");
      const data = await response.json().catch(() => ({})) as EstadoRespaldos & { error?: string };
      if (response.ok) setRespaldos(data);
      else setRespaldosError(data.error ?? "No se pudo consultar el estado de los respaldos");
    } catch { setRespaldosError("No se pudo conectar con el servicio de respaldos"); }
  }

  /** No ejecuta el respaldo: solo deja la solicitud pedida. El servidor la atiende en su
   *  próxima corrida programada (cada pocos minutos) — ver capítulo 15 del manual. */
  async function solicitarRespaldo() {
    setSolicitandoRespaldo(true); setRespaldosError("");
    try {
      const response = await fetch("/api/respaldos", { method: "POST" });
      const data = await response.json().catch(() => ({})) as { creada?: boolean; error?: string };
      if (!response.ok) return setRespaldosError(data.error ?? "No se pudo solicitar el respaldo");
      await cargarRespaldos();
      notify(data.creada ? "Respaldo solicitado. El servidor lo generará en los próximos minutos." : "Ya había una solicitud de respaldo pendiente.");
    } catch {
      setRespaldosError("No se pudo conectar con el servicio de respaldos");
    } finally { setSolicitandoRespaldo(false); }
  }

  async function cargarTasas() {
    try {
      const response = await fetch("/api/tasas-cambio");
      const data = await response.json().catch(() => ({})) as { tasas?: TasaCambio[]; error?: string };
      if (response.ok) setTasas(data.tasas ?? []);
      else setTasaError(data.error ?? "No se pudo cargar el catálogo de tasas");
    } catch { setTasaError("No se pudo conectar con el servicio de tasas de cambio"); }
  }

  useEffect(() => { void Promise.resolve().then(cargarTasas); void Promise.resolve().then(cargarRespaldos); }, []);

  async function guardarTasa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingTasa(true); setTasaError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/tasas-cambio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: form.get("fecha"), tasa: form.get("tasa"), fuente: form.get("fuente") }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setTasaError(result.error ?? "No se pudo registrar la tasa de cambio");
      formElement.reset();
      await cargarTasas();
      notify("Tasa de cambio registrada y auditada correctamente");
    } finally { setSavingTasa(false); }
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institucionNombre: form.get("institucionNombre"),
          sistemaNombre: form.get("sistemaNombre"),
          sistemaDescripcion: form.get("sistemaDescripcion"),
          logoLogin: form.get("logoLogin"),
        }),
      });
      const result = await response.json().catch(() => ({})) as { configuracion?: ConfiguracionSistema; error?: string };
      if (!response.ok || !result.configuracion) return setError(result.error ?? "No se pudo guardar la configuración institucional");
      onSaved(result.configuracion);
      notify("Configuración institucional actualizada");
    } catch {
      setError("No se pudo conectar con el servicio de configuración");
    } finally { setSaving(false); }
  }

  return <><div className="pageHead"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Configuración institucional</h1><p>Datos que identifican a la institución en el acceso, la barra lateral y los reportes.</p></div></div>
    <form className="panel formPanel" onSubmit={guardar}>
      <div className="panelHead compact"><div><h2>Identidad del sistema</h2><p>Los cambios se guardan en PostgreSQL y quedan registrados en auditoría.</p></div></div>
      <div className="formGrid">
        <label>Nombre institucional<input name="institucionNombre" required maxLength={120} defaultValue={config.institucionNombre}/></label>
        <label>Nombre del sistema<input name="sistemaNombre" required maxLength={40} defaultValue={config.sistemaNombre}/></label>
        <label className="wide">Descripción del sistema<input name="sistemaDescripcion" required maxLength={160} defaultValue={config.sistemaDescripcion}/></label>
        <label className="wide">Ruta del logo institucional<input name="logoLogin" required maxLength={200} defaultValue={config.logoLogin}/><small>Ruta interna dentro de public/, por ejemplo /universal-nicaragua-login.png</small></label>
        <label>Moneda funcional<input value={config.moneda} readOnly/><small>Regla contable del sistema; no se edita desde la interfaz.</small></label>
      </div>
      <div className="configPreview"><span className="brandMark logoMark" style={{ backgroundImage: `url(${config.logoLogin})` }} role="img" aria-label={config.institucionNombre}/><div><b>{config.sistemaNombre}</b><small>{config.institucionNombre} · {config.sistemaDescripcion}</small></div></div>
      {error ? <div className="authError adminError">{error}</div> : null}
      <div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</button></div>
    </form>
    <section className="panel formPanel">
      <div className="panelHead compact"><div><h2>Tasas de cambio USD → NIO</h2><p>La contabilidad se mantiene en NIO. Registre aquí la tasa del día para capturar movimientos en cuentas bancarias en USD; cada minuta conserva la tasa vigente al momento de registrarse, y corregir una tasa aquí nunca recalcula minutas ya guardadas.</p></div></div>
      <form className="formGrid" onSubmit={guardarTasa}>
        <label>Fecha<input name="fecha" type="date" required/></label>
        <label>Tasa (NIO por USD)<input name="tasa" type="number" required min="0.000001" step="0.000001" placeholder="36.500000"/></label>
        <label className="wide">Fuente<input name="fuente" required maxLength={120} placeholder="Banco Central de Nicaragua, banco comercial, etc."/></label>
        <div className="formActions"><button className="primary" type="submit" disabled={savingTasa}>{savingTasa ? "Guardando…" : "Registrar tasa"}</button></div>
      </form>
      {tasaError ? <div className="authError adminError">{tasaError}</div> : null}
      <div className="tableWrap"><table><thead><tr><th>FECHA</th><th>TASA</th><th>FUENTE</th><th>REGISTRADA</th></tr></thead><tbody>{tasas.map(tasa => <tr key={tasa.id}>
        <td><b>{tasa.fecha}</b></td>
        <td className="amount">{tasa.tasa}</td>
        <td>{tasa.fuente}</td>
        <td><small>{new Date(tasa.creadoEn).toLocaleString("es-NI")}{tasa.actualizadoEn ? ` · corregida ${new Date(tasa.actualizadoEn).toLocaleString("es-NI")}` : ""}</small></td>
      </tr>)}</tbody></table></div>
      {!tasas.length ? <div className="emptyReport">Todavía no hay tasas de cambio registradas.</div> : null}
    </section>

    <section className="panel formPanel">
      <div className="panelHead compact">
        <div><h2>Respaldo de la base de datos</h2><p>El respaldo corre automáticamente todas las noches en el servidor. Esta pantalla no lo genera directamente: el botón deja pedido un respaldo, y el servidor lo produce en su próxima corrida.</p></div>
        <button className="secondary" type="button" onClick={solicitarRespaldo} disabled={solicitandoRespaldo || Boolean(respaldos?.solicitudPendiente)}>
          {solicitandoRespaldo ? "Solicitando…" : respaldos?.solicitudPendiente ? "Solicitud en curso…" : "Generar respaldo ahora"}
        </button>
      </div>
      {respaldosError ? <div className="authError adminError">{respaldosError}</div> : null}
      {respaldos ? <>
        <div className="accountHint"><MenuIcon name={respaldos.salud === "al_dia" ? "check" : "info"} className="glyphIcon"/><span>
          <span className={CLASE_SALUD[respaldos.salud]} style={{ marginRight: 8 }}>{ETIQUETA_SALUD[respaldos.salud]}</span>
          {respaldos.mensaje}
        </span></div>
        {respaldos.solicitudPendiente ? <div className={respaldos.solicitudPendiente.demorada ? "authError adminError" : "readOnlyBanner"}>
          {respaldos.solicitudPendiente.demorada
            ? `Hay una solicitud de respaldo pendiente desde hace ${respaldos.solicitudPendiente.minutosPendiente} minutos sin atenderse. Verifique que "respaldo-postgresql.sh --atender-solicitudes" esté programado en el servidor.`
            : `Solicitud de respaldo enviada por ${respaldos.solicitudPendiente.solicitadoPorNombre}, en espera de que el servidor la genere.`}
        </div> : null}
        {respaldos.recientes.length ? <div className="tableWrap"><table><thead><tr><th>FECHA</th><th>MODO</th><th>ESTADO</th><th>TAMAÑO</th><th>COPIA EXTERNA</th></tr></thead><tbody>{respaldos.recientes.map(evento => <tr key={evento.id}>
          <td><b>{new Date(evento.iniciadoEn).toLocaleString("es-NI")}</b></td>
          <td>{evento.modo === "programado" ? "Programado" : "Manual"}</td>
          <td><span className={evento.estado === "correcto" ? "status done" : "status danger"}>{evento.estado === "correcto" ? "Correcto" : "Error"}</span>{evento.mensaje && evento.estado === "error" ? <small style={{ display: "block" }}>{evento.mensaje}</small> : null}</td>
          <td>{evento.tamanoBytes ? `${(Number(evento.tamanoBytes) / (1024 * 1024)).toFixed(1)} MB` : "—"}</td>
          <td>{evento.copiaSecundariaOk === null ? "—" : evento.copiaSecundariaOk ? "Sí" : "No se pudo copiar"}</td>
        </tr>)}</tbody></table></div> : null}
      </> : !respaldosError ? <div className="emptyReport">Cargando estado de los respaldos…</div> : null}
    </section>
  </>;
}
