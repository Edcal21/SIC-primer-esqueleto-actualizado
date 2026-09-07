"use client";
import { type FormEvent, useEffect, useState } from "react";
import MenuIcon from "../components/MenuIcon";
import { currentMonth, type ImpedimentoCierre, type PeriodoContable, type RequestConfirmation } from "../shared";

const MOTIVO_MINIMO = 15;

const estadoClase = (estado: PeriodoContable["estado"]) =>
  estado === "cerrado" ? "status done" : estado === "revision" ? "status pending" : "status";

const etiquetaEstado: Record<PeriodoContable["estado"], string> = {
  abierto: "Abierto",
  revision: "En revisión",
  cerrado: "Cerrado",
};

const fechaLegible = (valor: string | null) => valor ? new Date(valor).toLocaleString("es-NI") : "—";

export default function CierreContable({ notify, requestConfirmation }: { notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [periodos, setPeriodos] = useState<PeriodoContable[]>([]);
  const [impedimentos, setImpedimentos] = useState<Record<string, ImpedimentoCierre[]>>({});
  const [sugeridos, setSugeridos] = useState<string[]>([]);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const response = await fetch("/api/periodos");
      const data = await response.json().catch(() => ({})) as { periodos?: PeriodoContable[]; impedimentos?: Record<string, ImpedimentoCierre[]>; periodosConActividad?: string[]; error?: string };
      if (!response.ok) return setError(data.error ?? "No se pudo cargar el control de períodos");
      setPeriodos(data.periodos ?? []);
      setImpedimentos(data.impedimentos ?? {});
      setSugeridos(data.periodosConActividad ?? []);
      setError("");
    } catch {
      setError("No se pudo conectar con el servicio de períodos contables");
    } finally { setLoading(false); }
  }

  useEffect(() => { void Promise.resolve().then(cargar); }, []);

  async function abrir(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/periodos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: form.get("periodo") }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setError(result.error ?? "No se pudo abrir el período");
      formElement.reset();
      await cargar();
      notify("Período contable abierto");
    } finally { setSaving(false); }
  }

  async function accion(periodo: string, accion: "revision" | "cerrar" | "reabrir", motivo?: string) {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/periodos/${encodeURIComponent(periodo)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, motivo }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; impedimentos?: ImpedimentoCierre[] };
      if (!response.ok) {
        const detalle = result.impedimentos?.length ? ` ${result.impedimentos.map(item => item.detalle).join(" ")}` : "";
        return setError(`${result.error ?? "No se pudo actualizar el período"}.${detalle}`);
      }
      setMotivos(current => ({ ...current, [periodo]: "" }));
      await cargar();
      notify(accion === "cerrar" ? `Período ${periodo} cerrado y auditado` : accion === "reabrir" ? `Período ${periodo} reabierto; el motivo quedó registrado` : `Período ${periodo} en revisión`);
    } finally { setSaving(false); }
  }

  function confirmarCierre(periodo: string) {
    const bloqueos = impedimentos[periodo] ?? [];
    if (bloqueos.length) {
      return setError(`No se puede cerrar ${periodo}: ${bloqueos.map(item => `${item.motivo} — ${item.detalle}`).join(" ")}`);
    }
    requestConfirmation({
      title: `Cerrar el período ${periodo}`,
      message: `Al cerrar ${periodo} nadie podrá registrar ni anular minutas, importar balanza, cargar estados de cuenta, conciliar ni registrar tasas con fechas de ese mes. Reabrirlo exigirá un motivo escrito y quedará registrado en auditoría.`,
      confirmLabel: "Cerrar período",
      onConfirm: () => accion(periodo, "cerrar"),
    });
  }

  function confirmarReapertura(periodo: string) {
    const motivo = (motivos[periodo] ?? "").trim();
    if (motivo.length < MOTIVO_MINIMO) {
      return setError(`Escriba el motivo de la reapertura de ${periodo} con al menos ${MOTIVO_MINIMO} caracteres antes de continuar`);
    }
    requestConfirmation({
      title: `Reabrir el período ${periodo}`,
      message: `Se levantará el bloqueo de ${periodo} y volverá a admitir cambios contables. No se borra ni se recalcula nada de lo ya registrado. Su usuario, la fecha y el motivo quedarán en auditoría de forma permanente.`,
      confirmLabel: "Reabrir período",
      isDanger: true,
      onConfirm: () => accion(periodo, "reabrir", motivo),
    });
  }

  const registrados = new Set(periodos.map(item => item.periodo));
  const pendientesDeAbrir = sugeridos.filter(periodo => !registrados.has(periodo));

  return <>
    <div className="pageHead"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Cierre contable</h1><p>Controle qué períodos admiten cambios. Un período cerrado bloquea captura, anulación, importación, carga bancaria y conciliación en sus fechas.</p></div></div>
    {error ? <div className="authError adminError">{error}</div> : null}

    <section className="panel formPanel">
      <div className="panelHead compact"><div><h2>Abrir período</h2><p>Los períodos que nunca se abrieron aquí se consideran abiertos: registrarlos permite marcarlos en revisión y cerrarlos.</p></div></div>
      <form className="formGrid" onSubmit={abrir}>
        <label>Período<input name="periodo" required pattern="\d{4}-(0[1-9]|1[0-2])" placeholder={currentMonth()} defaultValue={currentMonth()}/><small>Formato AAAA-MM</small></label>
        <div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Abrir período"}</button></div>
      </form>
      {pendientesDeAbrir.length ? <div className="readOnlyBanner">Períodos con actividad registrada que aún no se administran: {pendientesDeAbrir.join(", ")}.</div> : null}
    </section>

    <section className="panel tablePanel">
      <div className="panelHead"><div><h2>Períodos</h2><p>{loading ? "Cargando desde PostgreSQL" : `${periodos.length} períodos administrados`}</p></div><button onClick={cargar}>Actualizar</button></div>
      <div className="tableWrap"><table>
        <thead><tr><th>PERÍODO</th><th>ESTADO</th><th>APERTURA</th><th>CIERRE</th><th>REAPERTURA</th><th>ACCIONES</th></tr></thead>
        <tbody>{periodos.map(item => {
          const bloqueos = impedimentos[item.periodo] ?? [];
          return <tr key={item.periodo}>
            <td><b>{item.periodo}</b></td>
            <td>
              <span className={estadoClase(item.estado)}>{etiquetaEstado[item.estado]}</span>
              {bloqueos.length && item.estado !== "cerrado" ? <small className="status pending">{bloqueos.length} pendiente(s) para cerrar</small> : null}
            </td>
            <td><small>{fechaLegible(item.fechaApertura)}</small></td>
            <td>{item.estado === "cerrado"
              ? <small>{fechaLegible(item.fechaCierre)}<br/>{item.cerradoPorNombre ?? "—"}</small>
              : <small>—</small>}</td>
            <td>{item.reabiertoEn
              ? <small>{fechaLegible(item.reabiertoEn)}<br/>{item.reabiertoPorNombre ?? "—"}<br/><i>{item.motivoReapertura}</i></small>
              : <small>—</small>}</td>
            <td>
              {item.estado === "cerrado"
                ? <div className="matchCell">
                    <label>Motivo de reapertura
                      <textarea rows={2} value={motivos[item.periodo] ?? ""} onChange={event => setMotivos(current => ({ ...current, [item.periodo]: event.target.value }))} placeholder={`Mínimo ${MOTIVO_MINIMO} caracteres`}/>
                    </label>
                    <button className="linkButton" type="button" onClick={() => confirmarReapertura(item.periodo)} disabled={saving}>Reabrir período</button>
                  </div>
                : <div className="matchActions">
                    {item.estado === "abierto"
                      ? <button className="linkButton" type="button" onClick={() => accion(item.periodo, "revision")} disabled={saving}>Marcar en revisión</button>
                      : null}
                    <button className="linkButton" type="button" onClick={() => confirmarCierre(item.periodo)} disabled={saving || bloqueos.length > 0} title={bloqueos.length ? bloqueos.map(b => b.motivo).join("; ") : undefined}>Cerrar período</button>
                  </div>}
            </td>
          </tr>;
        })}</tbody>
      </table></div>
      {!loading && !periodos.length ? <div className="emptyReport">Todavía no se administra ningún período. Todos se comportan como abiertos hasta que se cierre alguno aquí.</div> : null}
    </section>

    <section className="panel">
      <div className="panelHead compact"><div><h2>Qué bloquea un período cerrado</h2></div></div>
      <div className="accountHint"><MenuIcon name="info" className="glyphIcon"/><span>
        Registro y anulación de minutas, importación de balanza, carga de estados de cuenta, generación y aprobación de conciliaciones, y registro de tasas de cambio, siempre que la fecha caiga dentro del período. La reapertura levanta el bloqueo sin borrar ni recalcular nada de lo ya registrado.
      </span></div>
    </section>
  </>;
}
