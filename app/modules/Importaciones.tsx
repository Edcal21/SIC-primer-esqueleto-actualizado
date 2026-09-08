"use client";
import { type FormEvent, useEffect, useState } from "react";
import { currentMonth, dinero, estadoImportacion, statusClass, type ImportacionBalanza, type ImportacionSituacionFinanciera } from "../shared";

type CatalogoResultado = {
  archivoNombre: string;
  totalLineas: number;
  cuentasMovimiento: number;
  cuentasActivas: number;
  creadas: number;
  actualizadas: number;
};

type AuxiliarResultado = {
  archivoNombre: string;
  totalMovimientos: number;
  totalLineas: number;
  totalDebitos: string;
  totalCreditos: string;
};

export default function Importaciones({ notify }: { notify: (message: string) => void }) {
  const [importaciones, setImportaciones] = useState<ImportacionBalanza[]>([]);
  const [situaciones, setSituaciones] = useState<ImportacionSituacionFinanciera[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [situacionFile, setSituacionFile] = useState<File | null>(null);
  const [catalogoFile, setCatalogoFile] = useState<File | null>(null);
  const [catalogoResultado, setCatalogoResultado] = useState<CatalogoResultado | null>(null);
  const [auxiliarFile, setAuxiliarFile] = useState<File | null>(null);
  const [auxiliarResultado, setAuxiliarResultado] = useState<AuxiliarResultado | null>(null);
  const [periodo, setPeriodo] = useState(currentMonth());
  const [situacionPeriodo, setSituacionPeriodo] = useState(currentMonth());
  const [error, setError] = useState("");
  const [catalogoError, setCatalogoError] = useState("");
  const [auxiliarError, setAuxiliarError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSituacion, setSavingSituacion] = useState(false);
  const [savingCatalogo, setSavingCatalogo] = useState(false);
  const [savingAuxiliar, setSavingAuxiliar] = useState(false);

  async function cargarHistorial() {
    try {
      const [balanzaResponse, situacionResponse] = await Promise.all([
        fetch("/api/importaciones/balanza"),
        fetch("/api/importaciones/situacion-financiera"),
      ]);
      const [balanzaData, situacionData] = await Promise.all([balanzaResponse.json(), situacionResponse.json()]);
      if (!balanzaResponse.ok) throw new Error(balanzaData.error ?? "No se pudo cargar el historial de balanzas");
      if (!situacionResponse.ok) throw new Error(situacionData.error ?? "No se pudo cargar el historial de estados financieros");
      setImportaciones(balanzaData.importaciones ?? []);
      setSituaciones(situacionData.importaciones ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial");
    }
  }

  useEffect(() => {
    void Promise.resolve().then(cargarHistorial);
  }, []);

  async function enviarArchivo(endpoint: string, archivo: File, periodoArchivo: string) {
    const form = new FormData();
    form.append("periodo", periodoArchivo);
    form.append("archivo", archivo);
    const response = await fetch(endpoint, { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "No se pudo importar el archivo");
    return result.importacion;
  }

  async function importar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Seleccione el archivo de balanza");
    setSaving(true);
    setError("");
    try {
      const importacion = await enviarArchivo("/api/importaciones/balanza", file, periodo);
      setImportaciones(current => [importacion, ...current]);
      setFile(null);
      notify(`${estadoImportacion(importacion.estado)}: ${importacion.totalLineas} lineas`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo importar la balanza");
    } finally {
      setSaving(false);
    }
  }

  async function importarSituacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!situacionFile) return setError("Seleccione el Estado de Situación Financiera");
    setSavingSituacion(true);
    setError("");
    try {
      const importacion = await enviarArchivo("/api/importaciones/situacion-financiera", situacionFile, situacionPeriodo);
      setSituaciones(current => [importacion, ...current]);
      setSituacionFile(null);
      notify(`Estado de Situación Financiera procesado: ${importacion.totalLineas} saldos finales`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo importar el Estado de Situación Financiera");
    } finally {
      setSavingSituacion(false);
    }
  }

  async function importarCatalogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalogoFile) return setCatalogoError("Seleccione el archivo de catalogo");
    setSavingCatalogo(true);
    setCatalogoError("");
    try {
      const form = new FormData();
      form.append("archivo", catalogoFile);
      const response = await fetch("/api/importaciones/catalogo", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo importar el catalogo contable");
      setCatalogoResultado(result.importacion);
      setCatalogoFile(null);
      notify(`Catalogo importado: ${result.importacion.totalLineas} cuentas`);
    } catch (cause) {
      setCatalogoError(cause instanceof Error ? cause.message : "No se pudo importar el catalogo contable");
    } finally {
      setSavingCatalogo(false);
    }
  }

  async function importarAuxiliar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auxiliarFile) return setAuxiliarError("Seleccione el archivo de auxiliar contable");
    setSavingAuxiliar(true);
    setAuxiliarError("");
    try {
      const form = new FormData();
      form.append("archivo", auxiliarFile);
      const response = await fetch("/api/importaciones/auxiliar", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo importar el auxiliar contable");
      setAuxiliarResultado(result.importacion);
      setAuxiliarFile(null);
      notify(`Auxiliar importado: ${result.importacion.totalMovimientos} movimientos`);
    } catch (cause) {
      setAuxiliarError(cause instanceof Error ? cause.message : "No se pudo importar el auxiliar contable");
    } finally {
      setSavingAuxiliar(false);
    }
  }

  const ultimo = importaciones[0];
  const diferencia = ultimo ? Number(ultimo.totalDebe) - Number(ultimo.totalHaber) : 0;

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="eyebrow">IMPORTACIONES</span>
          <h1>Importaciones contables</h1>
          <p>Cargue catalogos, auxiliares, balanzas y estados financieros desde archivos CSV o Excel.</p>
        </div>
      </div>

      {ultimo ? (
        <section className="metrics compactMetrics">
          <article className="metric featured">
            <p>Ultima balanza</p>
            <strong>{ultimo.periodo}</strong>
            <span className={statusClass(ultimo.estado)}>{estadoImportacion(ultimo.estado)}</span>
          </article>
          <article className="metric">
            <p>Lineas leidas</p>
            <strong>{ultimo.totalLineas}</strong>
            <small>{ultimo.archivoNombre}</small>
          </article>
          <article className="metric">
            <p>Total debitos</p>
            <strong>{dinero.format(Number(ultimo.totalDebe))}</strong>
          </article>
          <article className="metric">
            <p>Diferencia</p>
            <strong className={Math.abs(diferencia) < 0.01 ? "positive" : "negative"}>{dinero.format(diferencia)}</strong>
          </article>
        </section>
      ) : null}

      <section className="grid">
        <form className="panel formPanel importPanel" onSubmit={importarCatalogo}>
          <div className="panelHead compact">
            <div>
              <h2>Importar catalogo contable</h2>
              <p>Formato esperado: Codigo/Cuenta y Descripcion/Nombre. Opcionales: Nivel, Padre, Naturaleza, Flujo, Movimiento y Estado.</p>
            </div>
          </div>
          <div className="formGrid">
            <label className="wide">Archivo<input type="file" accept=".csv,.xls,.xlsx" onChange={event => setCatalogoFile(event.target.files?.[0] ?? null)} required /></label>
            <label className="wide">Campos reconocidos<input readOnly value="Codigo, Descripcion, Nivel, Cuenta padre, Naturaleza, Flujo, Movimiento, Estado" /></label>
          </div>
          {catalogoFile ? <div className="readOnlyBanner">Archivo seleccionado: {catalogoFile.name} - {Math.round(catalogoFile.size / 1024)} KB</div> : null}
          {catalogoResultado ? <div className="readOnlyBanner">Ultimo catalogo: {catalogoResultado.archivoNombre} - {catalogoResultado.totalLineas} cuentas - {catalogoResultado.cuentasMovimiento} de movimiento - {catalogoResultado.cuentasActivas} activas</div> : null}
          {catalogoError ? <div className="authError adminError">{catalogoError}</div> : null}
          <div className="formActions"><button className="primary" type="submit" disabled={savingCatalogo}>{savingCatalogo ? "Importando..." : "Importar catalogo"}</button></div>
        </form>

        <form className="panel formPanel importPanel" onSubmit={importarAuxiliar}>
          <div className="panelHead compact">
            <div>
              <h2>Importar auxiliar contable</h2>
              <p>Importa egresos o movimientos del sistema actual como minutas cuadradas.</p>
            </div>
          </div>
          <div className="formGrid">
            <label className="wide">Archivo<input type="file" accept=".csv,.xls,.xlsx" onChange={event => setAuxiliarFile(event.target.files?.[0] ?? null)} required /></label>
            <label className="wide">Campos reconocidos<input readOnly value="Fecha, Iglesia, Cuenta bancaria, Referencia, Concepto, Cuenta, Debito, Credito" /></label>
          </div>
          {auxiliarFile ? <div className="readOnlyBanner">Archivo seleccionado: {auxiliarFile.name} - {Math.round(auxiliarFile.size / 1024)} KB</div> : null}
          {auxiliarResultado ? <div className="readOnlyBanner">Ultimo auxiliar: {auxiliarResultado.archivoNombre} - {auxiliarResultado.totalMovimientos} movimientos - {auxiliarResultado.totalLineas} lineas - debitos {dinero.format(Number(auxiliarResultado.totalDebitos))}</div> : null}
          {auxiliarError ? <div className="authError adminError">{auxiliarError}</div> : null}
          <div className="formActions"><button className="primary" type="submit" disabled={savingAuxiliar}>{savingAuxiliar ? "Importando..." : "Importar auxiliar"}</button></div>
        </form>

        <form className="panel formPanel importPanel" onSubmit={importarSituacion}>
          <div className="panelHead compact">
            <div>
              <h2>Estado de Situacion Financiera</h2>
              <p>Fuente exclusiva del flujo de efectivo. Se comparara el campo Saldo Final entre periodos.</p>
            </div>
          </div>
          <div className="formGrid">
            <label>Periodo<input type="month" value={situacionPeriodo} onChange={event => setSituacionPeriodo(event.target.value)} required /></label>
            <label>Archivo<input type="file" accept=".csv,.xls,.xlsx" onChange={event => setSituacionFile(event.target.files?.[0] ?? null)} required /></label>
            <label className="wide">Campos detectados<input readOnly value="Descripcion, Saldo Final" /></label>
          </div>
          {situacionFile ? <div className="readOnlyBanner">Archivo seleccionado: {situacionFile.name} - {Math.round(situacionFile.size / 1024)} KB</div> : null}
          {error ? <div className="authError adminError">{error}</div> : null}
          <div className="formActions"><button className="primary" type="submit" disabled={savingSituacion}>{savingSituacion ? "Importando..." : "Importar estado financiero"}</button></div>
        </form>

        <form className="panel formPanel importPanel" onSubmit={importar}>
          <div className="panelHead compact">
            <div>
              <h2>Importar balanza de comprobacion</h2>
              <p>Formato esperado: Cuenta, Descripcion, Saldo Inicial, Debitos, Creditos y Saldo Final.</p>
            </div>
          </div>
          <div className="formGrid">
            <label>Periodo<input type="month" value={periodo} onChange={event => setPeriodo(event.target.value)} required /></label>
            <label>Archivo<input type="file" accept=".csv,.xls,.xlsx" onChange={event => setFile(event.target.files?.[0] ?? null)} required /></label>
            <label className="wide">Campos detectados<input readOnly value="Cuenta, Descripcion, Saldo Inicial, Debitos, Creditos, Saldo Final" /></label>
          </div>
          {file ? <div className="readOnlyBanner">Archivo seleccionado: {file.name} - {Math.round(file.size / 1024)} KB</div> : null}
          {error ? <div className="authError adminError">{error}</div> : null}
          <div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving ? "Importando..." : "Importar balanza"}</button></div>
        </form>
      </section>

      <section className="panel tablePanel">
        <div className="panelHead">
          <div>
            <h2>Estados de Situacion Financiera</h2>
            <p>{situaciones.length} archivos procesados</p>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>ARCHIVO</th><th>PERIODO</th><th>SALDOS FINALES</th><th>FECHA</th><th>ESTADO</th></tr>
            </thead>
            <tbody>
              {situaciones.map(item => (
                <tr key={item.id}>
                  <td><b>{item.archivoNombre}</b><small>{Math.round(item.archivoTamano / 1024)} KB</small></td>
                  <td>{item.periodo}</td>
                  <td>{item.totalLineas}</td>
                  <td>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</td>
                  <td><span className={statusClass(item.estado)}>{item.estado === "procesado" ? "Procesado" : "Error"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!situaciones.length ? <div className="emptyReport">Todavia no hay Estados de Situacion Financiera importados.</div> : null}
      </section>

      <section className="panel tablePanel">
        <div className="panelHead">
          <div>
            <h2>Historial de balanzas</h2>
            <p>{importaciones.length} archivos procesados</p>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>ARCHIVO</th><th>PERIODO</th><th>LINEAS</th><th>TOTAL DEBITOS</th><th>TOTAL CREDITOS</th><th>DIFERENCIA</th><th>FECHA</th><th>ESTADO</th></tr>
            </thead>
            <tbody>
              {importaciones.map(item => {
                const diff = Number(item.totalDebe) - Number(item.totalHaber);
                return (
                  <tr key={item.id}>
                    <td><b>{item.archivoNombre}</b><small>{Math.round(item.archivoTamano / 1024)} KB</small></td>
                    <td>{item.periodo}</td>
                    <td>{item.totalLineas}</td>
                    <td className="amount">{dinero.format(Number(item.totalDebe))}</td>
                    <td className="amount">{dinero.format(Number(item.totalHaber))}</td>
                    <td className={Math.abs(diff) < 0.01 ? "amount positive" : "amount negative"}>{dinero.format(diff)}</td>
                    <td>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</td>
                    <td><span className={statusClass(item.estado)}>{estadoImportacion(item.estado)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
