"use client";

import { type FormEvent, useEffect, useState } from "react";
import { type Iglesia, type RequestConfirmation } from "../shared";

export default function IglesiasAdmin({ notify, requestConfirmation }: { notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [iglesias, setIglesias] = useState<Iglesia[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function cargarIglesias() {
    const response = await fetch("/api/iglesias?estado=todas");
    const data = await response.json().catch(() => ({})) as { iglesias?: Iglesia[]; error?: string };
    if (response.ok) setIglesias(data.iglesias ?? []);
    else setError(data.error ?? "No se pudo cargar el catálogo de iglesias");
  }

  useEffect(() => { void Promise.resolve().then(cargarIglesias); }, []);

  async function crearIglesia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/iglesias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: form.get("codigo"), nombre: form.get("nombre") }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setError(result.error ?? "No se pudo crear la iglesia");
      formElement.reset();
      await cargarIglesias();
      notify("Iglesia creada");
    } finally { setSaving(false); }
  }

  async function actualizarIglesia(codigo: string, changes: Partial<Iglesia>) {
    setError("");
    const response = await fetch(`/api/iglesias/${encodeURIComponent(codigo)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const result = await response.json().catch(() => ({})) as { iglesia?: Iglesia; error?: string };
    if (!response.ok || !result.iglesia) return setError(result.error ?? "No se pudo actualizar la iglesia");
    setIglesias(current => current.map(iglesia => iglesia.codigo === codigo ? result.iglesia as Iglesia : iglesia));
    notify("Iglesia actualizada");
  }

  const activas = iglesias.filter(iglesia => (iglesia.estado ?? "activa") === "activa");

  return <><div className="pageHead"><div><span className="eyebrow">INSTITUCIÓN</span><h1>Iglesias</h1><p>Administre el catálogo institucional que se usa al registrar minutas contables.</p></div></div>
    <section className="adminLayout">
      <form className="panel formPanel" onSubmit={crearIglesia}>
        <div className="panelHead compact"><div><h2>Nueva iglesia</h2><p>El código debe coincidir con la codificación institucional de 8 dígitos.</p></div></div>
        <div className="formGrid">
          <label>Código<input name="codigo" required minLength={8} maxLength={8} inputMode="numeric" placeholder="00000001"/></label>
          <label className="wide">Nombre<input name="nombre" required placeholder="Nombre oficial de la iglesia"/></label>
        </div>
        {error ? <div className="authError adminError">{error}</div> : null}
        <div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving ? "Creando..." : "Crear iglesia"}</button></div>
      </form>
      <section className="panel rolesPanel">
        <div className="panelHead compact"><div><h2>Resumen</h2><p>{iglesias.length} iglesias registradas</p></div></div>
        <article className="metric inlineMetric"><p>Activas</p><strong>{activas.length}</strong></article>
        <article className="metric inlineMetric"><p>Inactivas</p><strong>{iglesias.length - activas.length}</strong></article>
      </section>
    </section>
    <section className="panel tablePanel">
      <div className="panelHead"><div><h2>Iglesias registradas</h2><p>Fuente: PostgreSQL</p></div></div>
      <div className="tableWrap"><table><thead><tr><th>CÓDIGO</th><th>NOMBRE</th><th>ESTADO</th></tr></thead><tbody>{iglesias.map(iglesia => <tr key={iglesia.codigo}>
        <td><b>{iglesia.codigo}</b></td>
        <td><input className="inlineInput" defaultValue={iglesia.nombre} onBlur={event => { const nombre = event.target.value.trim(); if (nombre && nombre !== iglesia.nombre) void actualizarIglesia(iglesia.codigo, { nombre }); }}/></td>
        <td><button type="button" className={(iglesia.estado ?? "activa") === "activa" ? "status done" : "status pending"} onClick={() => requestConfirmation({
          title: "Confirmar cambio de iglesia",
          message: `${(iglesia.estado ?? "activa") === "activa" ? "Se desactivará" : "Se activará"} ${iglesia.codigo} · ${iglesia.nombre}. Las iglesias inactivas no quedan disponibles para nuevas minutas.`,
          confirmLabel: "Aplicar cambio",
          isDanger: (iglesia.estado ?? "activa") === "activa",
          onConfirm: () => actualizarIglesia(iglesia.codigo, { estado: (iglesia.estado ?? "activa") === "activa" ? "inactiva" : "activa" }),
        })}>{iglesia.estado ?? "activa"}</button></td>
      </tr>)}</tbody></table></div>
      {!iglesias.length ? <div className="emptyReport">Todavía no hay iglesias registradas.</div> : null}
    </section>
  </>;
}
