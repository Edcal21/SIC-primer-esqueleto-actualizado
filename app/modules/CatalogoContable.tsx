"use client";
import { type FormEvent, useEffect, useState } from "react";
import { type CuentaMovimiento, type RequestConfirmation } from "../shared";

export default function CatalogoContable({ notify, requestConfirmation }: { notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [cuentas, setCuentas] = useState<CuentaMovimiento[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function cargarCatalogo() {
    const response = await fetch("/api/catalogo/cuentas?movimiento=false");
    const data = await response.json();
    if (response.ok) setCuentas(data.cuentas ?? []);
    else setError(data.error ?? "No se pudo cargar el catálogo");
  }

  useEffect(() => { void Promise.resolve().then(cargarCatalogo); }, []);

  async function crearCuenta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/catalogo/cuentas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: form.get("codigo"),
        descripcion: form.get("descripcion"),
        naturaleza: form.get("naturaleza"),
        clasificacionFlujo: form.get("clasificacionFlujo"),
        esCuentaMovimiento: form.get("esCuentaMovimiento") === "on",
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error ?? "No se pudo crear la cuenta");
    event.currentTarget.reset();
    await cargarCatalogo();
    notify("Cuenta contable creada");
  }

  async function actualizarCuenta(codigo: string, changes: Partial<CuentaMovimiento>) {
    setError("");
    const response = await fetch(`/api/catalogo/cuentas/${codigo}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? "No se pudo actualizar la cuenta");
    setCuentas(current => current.map(cuenta => cuenta.codigo === codigo ? result.cuenta : cuenta));
    notify("Cuenta contable actualizada");
  }

  function confirmarActualizacionCuenta(cuenta: CuentaMovimiento, changes: Partial<CuentaMovimiento>, message: string, isDanger = false) {
    requestConfirmation({
      title: "Confirmar cambio de catálogo",
      message,
      confirmLabel: "Aplicar cambio",
      isDanger,
      onConfirm: () => actualizarCuenta(cuenta.codigo, changes),
    });
  }

  return <><div className="pageHead"><div><span className="eyebrow">CATÁLOGO</span><h1>Catálogo contable</h1><p>Administre cuentas reales disponibles para importaciones, reportes y minutas.</p></div></div><section className="adminLayout"><form className="panel formPanel" onSubmit={crearCuenta}><div className="panelHead compact"><div><h2>Nueva cuenta</h2><p>Use códigos contables de 8 dígitos.</p></div></div><div className="formGrid"><label>Código<input name="codigo" required minLength={8} maxLength={8} inputMode="numeric" placeholder="11010201"/></label><label>Descripción<input name="descripcion" required placeholder="Nombre de la cuenta"/></label><label>Naturaleza<select name="naturaleza" defaultValue="deudora"><option value="deudora">Deudora</option><option value="acreedora">Acreedora</option></select></label><label>Flujo<select name="clasificacionFlujo" defaultValue="no aplica"><option value="operación">Operación</option><option value="inversión">Inversión</option><option value="financiamiento">Financiamiento</option><option value="no aplica">No aplica</option></select></label><label className="checkLine"><input name="esCuentaMovimiento" type="checkbox" defaultChecked/>Cuenta de movimiento</label></div>{error?<div className="authError adminError">{error}</div>:null}<div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Creando…":"Crear cuenta"}</button></div></form><section className="panel rolesPanel"><div className="panelHead compact"><div><h2>Resumen</h2><p>{cuentas.length} cuentas activas</p></div></div><article className="metric inlineMetric"><p>Cuentas de movimiento</p><strong>{cuentas.filter(cuenta=>cuenta.esCuentaMovimiento).length}</strong></article><article className="metric inlineMetric"><p>Operación</p><strong>{cuentas.filter(cuenta=>cuenta.clasificacionFlujo==="operación").length}</strong></article></section></section><section className="panel tablePanel"><div className="panelHead"><div><h2>Cuentas registradas</h2><p>Fuente: PostgreSQL</p></div></div><div className="tableWrap"><table><thead><tr><th>CÓDIGO</th><th>DESCRIPCIÓN</th><th>NATURALEZA</th><th>FLUJO</th><th>MOVIMIENTO</th><th>ESTADO</th></tr></thead><tbody>{cuentas.map(cuenta=><tr key={cuenta.codigo}><td><b>{cuenta.codigo}</b></td><td>{cuenta.descripcion}</td><td>{cuenta.naturaleza}</td><td>{cuenta.clasificacionFlujo}</td><td><button type="button" className={cuenta.esCuentaMovimiento?"status done":"status pending"} onClick={()=>confirmarActualizacionCuenta(cuenta,{esCuentaMovimiento:!cuenta.esCuentaMovimiento},`${cuenta.esCuentaMovimiento?"Se retirará":"Se habilitará"} la cuenta ${cuenta.codigo} · ${cuenta.descripcion} para registrar movimientos.`,cuenta.esCuentaMovimiento)}>{cuenta.esCuentaMovimiento?"sí":"no"}</button></td><td><button type="button" className={cuenta.estado==="activa"?"status done":"status pending"} onClick={()=>confirmarActualizacionCuenta(cuenta,{estado:cuenta.estado==="activa"?"inactiva":"activa"},`${cuenta.estado==="activa"?"Se desactivará":"Se activará"} la cuenta ${cuenta.codigo} · ${cuenta.descripcion}.`,cuenta.estado==="activa")}>{cuenta.estado}</button></td></tr>)}</tbody></table></div>{!cuentas.length?<div className="emptyReport">Todavía no hay cuentas activas. Puede crearlas aquí o importarlas desde una balanza.</div>:null}</section></>;
}
