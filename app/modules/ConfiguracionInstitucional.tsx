"use client";
import { type FormEvent, useState } from "react";
import type { ConfiguracionSistema } from "../shared";

export default function ConfiguracionInstitucional({ config, onSaved, notify }: { config: ConfiguracionSistema; onSaved: (config: ConfiguracionSistema) => void; notify: (message: string) => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
  </>;
}
