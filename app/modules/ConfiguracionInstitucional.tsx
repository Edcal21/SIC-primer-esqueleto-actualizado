"use client";
import { type FormEvent, useEffect, useState } from "react";
import type { ConfiguracionSistema, TasaCambio } from "../shared";

export default function ConfiguracionInstitucional({ config, onSaved, notify }: { config: ConfiguracionSistema; onSaved: (config: ConfiguracionSistema) => void; notify: (message: string) => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tasas, setTasas] = useState<TasaCambio[]>([]);
  const [tasaError, setTasaError] = useState("");
  const [savingTasa, setSavingTasa] = useState(false);

  async function cargarTasas() {
    try {
      const response = await fetch("/api/tasas-cambio");
      const data = await response.json().catch(() => ({})) as { tasas?: TasaCambio[]; error?: string };
      if (response.ok) setTasas(data.tasas ?? []);
      else setTasaError(data.error ?? "No se pudo cargar el catálogo de tasas");
    } catch { setTasaError("No se pudo conectar con el servicio de tasas de cambio"); }
  }

  useEffect(() => { void Promise.resolve().then(cargarTasas); }, []);

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
  </>;
}
