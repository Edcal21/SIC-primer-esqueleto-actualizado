"use client";
import { type FormEvent, useState } from "react";
import { type CuentaBancaria, type RequestConfirmation } from "../shared";

export default function CuentasBancariasPanel({ cuentas, onChanged, notify, requestConfirmation }: { cuentas: CuentaBancaria[]; onChanged: () => Promise<void>; notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function crear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/cuentas-bancarias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroCuenta: form.get("numeroCuenta"), nombre: form.get("nombre"), moneda: form.get("moneda") }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setError(result.error ?? "No se pudo crear la cuenta bancaria");
      formElement.reset();
      await onChanged();
      notify("Cuenta bancaria creada");
    } finally { setSaving(false); }
  }

  async function actualizar(numeroCuenta: string, changes: Partial<CuentaBancaria>) {
    setError("");
    const response = await fetch(`/api/cuentas-bancarias/${encodeURIComponent(numeroCuenta)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) return setError(result.error ?? "No se pudo actualizar la cuenta bancaria");
    await onChanged();
    notify("Cuenta bancaria actualizada");
  }

  return <section className="adminLayout bankAccountsLayout">
    <form className="panel formPanel" onSubmit={crear}>
      <div className="panelHead compact"><div><h2>Nueva cuenta bancaria</h2><p>Las cuentas activas quedan disponibles para minutas y estados de cuenta.</p></div></div>
      <div className="formGrid">
        <label>Número de cuenta<input name="numeroCuenta" required maxLength={32} placeholder="Número asignado por el banco"/></label>
        <label>Nombre<input name="nombre" required placeholder="Banco y tipo de cuenta"/></label>
        <label>Moneda<select name="moneda" defaultValue="NIO"><option value="NIO">Córdobas (NIO)</option><option value="USD">Dólares (USD)</option></select></label>
      </div>
      {error ? <div className="authError adminError">{error}</div> : null}
      <div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving ? "Creando…" : "Crear cuenta bancaria"}</button></div>
    </form>
    <section className="panel tablePanel bankAccountsTable">
      <div className="panelHead"><div><h2>Cuentas bancarias</h2><p>{cuentas.length} registradas</p></div></div>
      <div className="tableWrap"><table><thead><tr><th>NÚMERO</th><th>NOMBRE</th><th>MONEDA</th><th>ESTADO</th></tr></thead><tbody>{cuentas.map(cuenta => <tr key={cuenta.numeroCuenta}>
        <td><b>{cuenta.numeroCuenta}</b></td>
        <td><input className="inlineInput" defaultValue={cuenta.nombre} onBlur={event => { if (event.target.value.trim() && event.target.value !== cuenta.nombre) void actualizar(cuenta.numeroCuenta, { nombre: event.target.value.trim() }); }}/></td>
        <td>{cuenta.moneda}</td>
        <td><button type="button" className={(cuenta.estado ?? "activa") === "activa" ? "status done" : "status pending"} onClick={() => requestConfirmation({
          title: "Confirmar cambio de cuenta bancaria",
          message: `${(cuenta.estado ?? "activa") === "activa" ? "Se desactivará" : "Se activará"} la cuenta ${cuenta.nombre} · ${cuenta.numeroCuenta}. Las cuentas inactivas no se pueden usar en minutas ni estados de cuenta.`,
          confirmLabel: "Aplicar cambio",
          isDanger: (cuenta.estado ?? "activa") === "activa",
          onConfirm: () => actualizar(cuenta.numeroCuenta, { estado: (cuenta.estado ?? "activa") === "activa" ? "inactiva" : "activa" }),
        })}>{cuenta.estado ?? "activa"}</button></td>
      </tr>)}</tbody></table></div>
      {!cuentas.length ? <div className="emptyReport">Todavía no hay cuentas bancarias registradas.</div> : null}
    </section>
  </section>;
}
