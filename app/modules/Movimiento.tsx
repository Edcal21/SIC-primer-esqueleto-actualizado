"use client";
import { type FormEvent, useEffect, useRef, useState } from "react";
import MenuIcon from "../components/MenuIcon";
import { dinero, type CuentaBancaria, type CuentaMovimiento, type DetalleMinuta, type Iglesia, type RequestConfirmation, type TasaCambio } from "../shared";

const detallesIniciales = (): DetalleMinuta[] => [
  { tipo: "debito", cuentaCodigo: "", monto: "", afectaCuentaBancaria: true, montoOriginal: "" },
  { tipo: "credito", cuentaCodigo: "", monto: "" },
];

/** Redondeo a 2 decimales solo para la vista previa en el navegador; el servidor recalcula con
 *  aritmética decimal exacta (lib/moneda.ts) y es la única fuente de verdad del importe guardado. */
function montoNioDeLinea(detalle: DetalleMinuta, esUsd: boolean, tasa: number | null) {
  if (esUsd && detalle.afectaCuentaBancaria) {
    const original = Number(detalle.montoOriginal || 0);
    if (!tasa || !Number.isFinite(original)) return 0;
    return Math.round(original * tasa * 100) / 100;
  }
  return Number(detalle.monto || 0);
}

export default function Movimiento({ notify, requestConfirmation }: { notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [cuentas, setCuentas] = useState<CuentaMovimiento[]>([]);
  const [detalles, setDetalles] = useState<DetalleMinuta[]>(detallesIniciales);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iglesias, setIglesias] = useState<Iglesia[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [tasas, setTasas] = useState<TasaCambio[]>([]);
  const [fecha, setFecha] = useState(new Date().toLocaleDateString("en-CA"));
  const [cuentaBancariaNumero, setCuentaBancariaNumero] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const buscarCuenta = (codigo: string) => cuentas.find(cuenta => cuenta.codigo === codigo.trim());

  useEffect(() => {
    fetch("/api/iglesias")
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "No se pudo cargar el catálogo de iglesias");
        setIglesias(result.iglesias ?? []);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "No se pudo cargar el catálogo de iglesias"));
  }, []);

  useEffect(() => {
    fetch("/api/catalogo/cuentas")
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el catálogo contable");
        setCuentas(data.cuentas ?? []);
      })
      .catch(error => setError(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/cuentas-bancarias")
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el catálogo de cuentas bancarias");
        setCuentasBancarias(data.cuentasBancarias ?? []);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "No se pudo cargar el catálogo de cuentas bancarias"));
  }, []);

  useEffect(() => {
    fetch("/api/tasas-cambio")
      .then(async response => {
        const data = await response.json();
        if (response.ok) setTasas(data.tasas ?? []);
      })
      .catch(() => {});
  }, []);

  const cuentaBancaria = cuentasBancarias.find(cuenta => cuenta.numeroCuenta === cuentaBancariaNumero);
  const esUsd = cuentaBancaria?.moneda === "USD";
  const tasaVigente = esUsd ? tasas.find(tasa => tasa.fecha === fecha) : undefined;

  function limpiarFormulario() {
    formRef.current?.reset();
    setDetalles(detallesIniciales());
    setFecha(new Date().toLocaleDateString("en-CA"));
    setCuentaBancariaNumero("");
    setError("");
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    if (!detalles.some(detalle => detalle.afectaCuentaBancaria)) {
      return setError("Marque al menos una línea como la que afecta la cuenta bancaria de la minuta");
    }
    if (esUsd && !tasaVigente) {
      return setError(`Falta registrar la tasa de cambio USD → NIO para el ${fecha}. Regístrela en Configuración → Tasas de cambio antes de continuar.`);
    }
    const detallesPayload = detalles.map((detalle, index) => {
      const cuenta = buscarCuenta(detalle.cuentaCodigo);
      const esLineaUsd = esUsd && detalle.afectaCuentaBancaria;
      return {
        tipo: detalle.tipo,
        cuentaCodigo: cuenta?.codigo,
        cuentaNombre: cuenta?.descripcion,
        monto: esLineaUsd ? undefined : detalle.monto,
        montoOriginal: esLineaUsd ? detalle.montoOriginal : undefined,
        afectaCuentaBancaria: Boolean(detalle.afectaCuentaBancaria),
        orden: index + 1,
      };
    });
    if (detalles.some(detalle => detalle.cuentaCodigo.trim() && !buscarCuenta(detalle.cuentaCodigo))) {
      return setError("Hay líneas con un código que no pertenece al catálogo de cuentas de movimiento");
    }
    if (detallesPayload.some(detalle => !detalle.cuentaCodigo || (detalle.monto === undefined && detalle.montoOriginal === undefined))) {
      return setError("Complete cuenta y monto en todas las líneas");
    }
    const totalDebitos = detalles.filter(detalle => detalle.tipo === "debito").reduce((total, detalle) => total + montoNioDeLinea(detalle, esUsd, tasaVigente ? Number(tasaVigente.tasa) : null), 0);
    const totalCreditos = detalles.filter(detalle => detalle.tipo === "credito").reduce((total, detalle) => total + montoNioDeLinea(detalle, esUsd, tasaVigente ? Number(tasaVigente.tasa) : null), 0);
    if (Math.abs(totalDebitos - totalCreditos) >= 0.01) {
      return setError("La minuta debe cuadrar: débitos y créditos tienen que ser iguales");
    }
    const iglesia = iglesias.find(item=>item.codigo===String(form.get("iglesiaCodigo")??""));
    requestConfirmation({
      title: "Confirmar asiento contable",
      message: `Se registrará una minuta por ${dinero.format(totalDebitos)} para ${iglesia?.nombre ?? "la iglesia seleccionada"} en ${cuentaBancaria?.nombre ?? "la cuenta bancaria seleccionada"}. Esta operación quedará registrada en la auditoría del sistema.`,
      confirmLabel: "Registrar movimiento",
      onConfirm: async () => {
        setSaving(true);
        try {
          const response = await fetch("/api/movimientos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fecha,
              iglesiaCodigo: form.get("iglesiaCodigo"),
              cuentaBancariaNumero,
              referencia: form.get("referencia"),
              concepto: form.get("concepto"),
              detalles: detallesPayload,
            }),
          });
          const result = await response.json();
          if (!response.ok) return setError(result.error ?? "No se pudo guardar el movimiento");
          limpiarFormulario();
          notify("Movimiento registrado y auditado correctamente");
        } finally { setSaving(false); }
      },
    });
  }

  const tasaNumero = tasaVigente ? Number(tasaVigente.tasa) : null;
  const totalDebitos = detalles.filter(detalle => detalle.tipo === "debito").reduce((total, detalle) => total + montoNioDeLinea(detalle, esUsd, tasaNumero), 0);
  const totalCreditos = detalles.filter(detalle => detalle.tipo === "credito").reduce((total, detalle) => total + montoNioDeLinea(detalle, esUsd, tasaNumero), 0);
  const diferencia = totalDebitos - totalCreditos;
  const updateDetalle = (index: number, changes: Partial<DetalleMinuta>) => setDetalles(current => current.map((detalle, itemIndex) => itemIndex === index ? { ...detalle, ...changes } : detalle));
  const removeDetalle = (index: number) => setDetalles(current => current.length > 2 ? current.filter((_, itemIndex) => itemIndex !== index) : current);
  const agregarDetalle = () => setDetalles(current => [...current, { tipo: "debito", cuentaCodigo: "", monto: "" }]);
  const codigosInvalidos = detalles.some(detalle => detalle.cuentaCodigo.trim() && !buscarCuenta(detalle.cuentaCodigo));
  const hayLineaBanco = detalles.some(detalle => detalle.afectaCuentaBancaria);
  const tasaFaltante = esUsd && !tasaVigente;

  const isBalanced = Math.abs(diferencia) < 0.01 && totalDebitos > 0 && totalCreditos > 0;
  return <>
    <div className="pageHead movementHead">
      <div><span className="eyebrow">CONTABILIDAD</span><h1>Registrar movimiento</h1><p>Registre una minuta cuadrada usando iglesias, cuentas bancarias y cuentas contables activas.</p></div>
      <div className={isBalanced?"balanceSummary balanced":"balanceSummary pending"}>
        <div className="balanceFigures">
          <span>Débitos<b>{dinero.format(totalDebitos)}</b></span>
          <span>Créditos<b>{dinero.format(totalCreditos)}</b></span>
        </div>
        <div className="balanceStatus">
          <span className={isBalanced?"status done":"status pending"}><MenuIcon name={isBalanced?"check":"info"} className="glyphIcon"/>{isBalanced?"Cuadrado":"Sin cuadrar"}</span>
          <small>Diferencia {dinero.format(diferencia)}</small>
        </div>
      </div>
    </div>
    {!loading && !cuentas.length ? <div className="readOnlyBanner">No hay cuentas de movimiento activas. Cargue o habilite cuentas en el catálogo contable antes de registrar minutas.</div> : null}
    {tasaFaltante ? <div className="readOnlyBanner">La cuenta bancaria seleccionada es USD y no hay tasa de cambio registrada para el {fecha}. Un administrador debe registrarla en Configuración → Tasas de cambio antes de guardar esta minuta.</div> : null}
    <form className="panel formPanel movementPanel" ref={formRef} onSubmit={guardar}>
      <section className="movementMeta">
        <div className="sectionHead"><b>Información general</b><small>Identificación de la minuta contable</small></div>
        <div className="formGrid">
          <label>Fecha<input name="fecha" type="date" required value={fecha} onChange={event => setFecha(event.target.value)}/></label>
          <label>Cuenta bancaria<select name="cuentaBancariaNumero" required value={cuentaBancariaNumero} onChange={event => setCuentaBancariaNumero(event.target.value)} disabled={!cuentasBancarias.length}><option value="" disabled>{cuentasBancarias.length ? "Seleccione una cuenta bancaria" : "Cargando cuentas bancarias..."}</option>{cuentasBancarias.map(cuenta=><option key={cuenta.numeroCuenta} value={cuenta.numeroCuenta}>{cuenta.nombre} · {cuenta.numeroCuenta} · {cuenta.moneda}</option>)}</select></label>
          <label className="wide">Iglesia<select name="iglesiaCodigo" required defaultValue="" disabled={!iglesias.length}><option value="" disabled>{iglesias.length ? "Seleccione una iglesia" : "Cargando iglesias..."}</option>{iglesias.map(iglesia=><option key={iglesia.codigo} value={iglesia.codigo}>{iglesia.codigo} · {iglesia.nombre}</option>)}</select></label>
          <label>Referencia<input name="referencia" maxLength={120} placeholder="Número de minuta o referencia bancaria"/></label>
          <label className="wide">Concepto<textarea name="concepto" required/></label>
        </div>
      </section>
      <div className="detailEditor">
        <div className="detailHeader">
          <div><b>Líneas de detalle</b><small>{detalles.length} líneas registradas · {esUsd ? "banco en USD, contabilidad en NIO" : "montos en córdobas"}</small></div>
          <button className="secondary" type="button" onClick={agregarDetalle}><MenuIcon name="entry" className="glyphIcon"/>Agregar línea</button>
        </div>
        <div className="detailTableHead"><span>Tipo</span><span>Cuenta contable</span><span>Afecta banco</span><span>{esUsd ? "Monto" : "Monto NIO"}</span><span/></div>
        {detalles.map((detalle,index)=>{
          const cuenta = buscarCuenta(detalle.cuentaCodigo);
          const codigoEscrito = Boolean(detalle.cuentaCodigo.trim());
          const esLineaUsd = esUsd && detalle.afectaCuentaBancaria;
          return <div className="detailRow" key={index}>
            <select className={detalle.tipo} value={detalle.tipo} onChange={event=>updateDetalle(index,{tipo:event.target.value as DetalleMinuta["tipo"]})} aria-label={`Tipo de la línea ${index+1}`}><option value="debito">Débito</option><option value="credito">Crédito</option></select>
            <div className="accountCell">
              <span className="accountSearchIcon"><MenuIcon name="search" className="glyphIcon"/></span>
              <input list="cuentasMovimiento" value={detalle.cuentaCodigo} onChange={event=>updateDetalle(index,{cuentaCodigo:event.target.value})} required disabled={loading || !cuentas.length} placeholder={loading?"Cargando catálogo...":"Buscar cuenta por código"} aria-label={`Cuenta contable de la línea ${index+1}`}/>
              <small className={codigoEscrito && !cuenta ? "accountName invalid" : "accountName"}>{cuenta ? cuenta.descripcion : codigoEscrito ? "Código fuera del catálogo de cuentas de movimiento" : "Escriba el código o elíjalo del catálogo"}</small>
            </div>
            <label className="bankLineToggle"><input type="checkbox" checked={Boolean(detalle.afectaCuentaBancaria)} onChange={event=>updateDetalle(index,{afectaCuentaBancaria:event.target.checked})} aria-label={`La línea ${index+1} afecta la cuenta bancaria`}/><small>Línea bancaria</small></label>
            {esLineaUsd
              ? <div className="usdLineCell">
                  <input value={detalle.montoOriginal ?? ""} onChange={event=>updateDetalle(index,{montoOriginal:event.target.value})} type="number" required min="0.01" step="0.01" placeholder="0.00 USD" aria-label={`Importe en USD de la línea ${index+1}`}/>
                  <small>{tasaVigente ? `≈ ${dinero.format(montoNioDeLinea(detalle, esUsd, tasaNumero))} a tasa ${tasaVigente.tasa}` : "Sin tasa registrada para esta fecha"}</small>
                </div>
              : <input value={detalle.monto} onChange={event=>updateDetalle(index,{monto:event.target.value})} type="number" required min="0.01" step="0.01" placeholder="0.00" aria-label={`Monto de la línea ${index+1}`}/>}
            <button className="secondary iconButton" type="button" onClick={()=>removeDetalle(index)} disabled={detalles.length<=2} aria-label={`Eliminar la línea ${index+1}`}><MenuIcon name="trash" className="glyphIcon"/></button>
          </div>;
        })}
        <datalist id="cuentasMovimiento">{cuentas.map(cuenta=><option key={cuenta.codigo} value={cuenta.codigo}>{cuenta.descripcion}</option>)}</datalist>
      </div>
      {error?<div className="authError">{error}</div>:null}
      <div className="movementFoot">
        {cuentas.length ? <div className="accountHint"><MenuIcon name="info" className="glyphIcon"/><span>{cuentas.length} cuentas de movimiento, {iglesias.length} iglesias y {cuentasBancarias.length} cuentas bancarias disponibles desde PostgreSQL.</span></div> : <span/>}
        <div className="formActions">
          <button className="secondary" type="button" onClick={limpiarFormulario} disabled={saving}>Limpiar formulario</button>
          <button className="primary" type="submit" disabled={saving || loading || codigosInvalidos || !hayLineaBanco || tasaFaltante || !cuentas.length || !iglesias.length || !cuentasBancarias.length || !isBalanced}>{saving?"Guardando…":"Guardar movimiento"}</button>
        </div>
      </div>
    </form>
  </>;
}
