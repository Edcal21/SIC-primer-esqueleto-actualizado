"use client";

import { FormEvent, useEffect, useState } from "react";

type Permiso = "panel:ver" | "usuarios:administrar" | "roles:administrar" | "movimientos:escribir" | "catalogo:administrar" | "banco:ver" | "banco:cargar" | "conciliacion:aprobar" | "importaciones:administrar" | "reportes:ver" | "reportes:descargar" | "auditoria:ver";
type User = { id: string; usuario: string; nombre: string; rol: "administrador" | "contador_general" | "operador_bancario" | "auditor_general"; permisos: Permiso[] };
type Reporte = { id: string; nombre: string; fecha: string; estado: string; cargadoPor: string };
type Evento = { fecha: string; usuario: string; accion: string; resultado: string; detalle?: string | null };
type ImportacionBalanza = { id: string; archivoNombre: string; archivoTamano: number; periodo: string; estado: "procesado" | "con_diferencias" | "error"; totalLineas: number; totalDebe: string; totalHaber: string; creadoEn: string };
type PermisoAdmin = { id: Permiso; descripcion: string };
type RolAdmin = { id: string; nombre: string; descripcion: string; permisos: Permiso[] };
type UsuarioAdmin = { id: string; usuario: string; nombre: string; rolId: string; estado: "activo" | "inactivo"; creadoEn: string; rolNombre?: string | null };
type Iglesia = { codigo: string; nombre: string };
type TipoReporte = "flujo-efectivo" | "balanza-anual" | "cambio-patrimonio" | "situacion-comparativa" | "resultado-comparativo";
type Granularidad = "dia" | "mes" | "trimestre" | "anio";
type ReporteFinanciero = { tipo:TipoReporte; titulo:string; descripcion:string; periodo:number; periodoComparativo?:number; periodoEtiqueta?:string; comparativoEtiqueta?:string; granularidad?:Granularidad; moneda:"NIO"; fuente:string; columnas:string[]; filas:{concepto:string;codigo?:string;actual:number;anterior?:number;variacion?:number;esTotal?:boolean}[]; generadoEn:string };
type CuentaMovimiento = { codigo: string; descripcion: string; naturaleza: "deudora" | "acreedora"; clasificacionFlujo: "operación" | "inversión" | "financiamiento" | "no aplica"; esCuentaMovimiento: boolean; estado: "activa" | "inactiva" };
type DetalleMinuta = { tipo: "debito" | "credito"; cuentaCodigo: string; monto: string };
type ResumenSistema = { cuentas: number; cuentasMovimiento: number; iglesiasActivas: number; importaciones: number; movimientos: number; reportesBanco: number; eventosAuditoria: number; ultimaImportacion?: ImportacionBalanza; ultimoMovimiento?: { fecha: string; concepto: string; referencia?: string | null; creadoEn: string }; eventos: { fecha: string; usuario: string; modulo: string; accion: string; resultado: string }[] };
type ConfiguracionSistema = { institucionNombre: string; sistemaNombre: string; sistemaDescripcion: string; moneda: "NIO"; logoLogin: string };
type OpcionReporte = { tipo: TipoReporte; titulo: string; descripcion: string; icono: string };

const nombresRol = { administrador: "Administrador", contador_general: "Contador general", operador_bancario: "Operador bancario", auditor_general: "Auditor general" };
const etiquetasPermiso: Record<Permiso, string> = {
  "panel:ver": "Ver panel",
  "usuarios:administrar": "Administrar usuarios",
  "roles:administrar": "Administrar roles",
  "movimientos:escribir": "Registrar minutas",
  "catalogo:administrar": "Administrar catálogo",
  "banco:ver": "Ver bancos",
  "banco:cargar": "Cargar reportes bancarios",
  "conciliacion:aprobar": "Aprobar conciliación",
  "importaciones:administrar": "Importar balanza",
  "reportes:ver": "Ver reportes",
  "reportes:descargar": "Descargar reportes",
  "auditoria:ver": "Ver auditoría",
};
const menu = [
  { nombre: "Resumen", permiso: "panel:ver" as Permiso, icono: "dashboard" },
  { nombre: "Usuarios", permiso: "usuarios:administrar" as Permiso, icono: "users" },
  { nombre: "Registrar movimiento", permiso: "movimientos:escribir" as Permiso, icono: "entry" },
  { nombre: "Catálogo contable", permiso: "catalogo:administrar" as Permiso, icono: "catalog" },
  { nombre: "Bancos", permiso: "banco:ver" as Permiso, icono: "bank" },
  { nombre: "Importaciones", permiso: "importaciones:administrar" as Permiso, icono: "upload" },
  { nombre: "Reportes", permiso: "reportes:ver" as Permiso, icono: "reports" },
  { nombre: "Auditoría", permiso: "auditoria:ver" as Permiso, icono: "audit" },
];
const menuGroups = [
  { label: "Operativa", items: ["Resumen", "Registrar movimiento", "Bancos"] },
  { label: "Reportes", items: ["Importaciones", "Reportes"] },
  { label: "Gestión", items: ["Usuarios", "Catálogo contable", "Auditoría"] },
];
const defaultConfig: ConfiguracionSistema = { institucionNombre: "Universal Nicaragua", sistemaNombre: "SIC", sistemaDescripcion: "Sistema de Información Contable", moneda: "NIO", logoLogin: "/universal-nicaragua-login.png" };

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [active, setActive] = useState("Resumen");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [config, setConfig] = useState<ConfiguracionSistema>(defaultConfig);

  useEffect(() => { fetch("/api/auth/me").then(async response => { if (response.ok) setUser((await response.json()).user); }).finally(() => setChecking(false)); }, []);
  useEffect(() => { fetch("/api/configuracion").then(async response => { if (response.ok) setConfig((await response.json()).configuracion ?? defaultConfig); }).catch(() => setConfig(defaultConfig)); }, []);
  const can = (permission: Permiso) => Boolean(user?.permisos.includes(permission));
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: form.get("usuario"), password: form.get("password") }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error);
    setUser(result.user); setActive(result.user.rol === "administrador" ? "Usuarios" : result.user.rol === "operador_bancario" ? "Bancos" : result.user.rol === "auditor_general" ? "Auditoría" : "Resumen");
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); setActive("Resumen"); }
  if (checking) return <main className="authScreen"><div className="authCard"><b>Validando sesión…</b></div></main>;
  if (!user) return <Login onSubmit={login} error={error} config={config} />;
  const allowedMenu = menu.filter(item => can(item.permiso));

  return <main className="shell">
    <Sidebar user={user} active={active} allowedMenu={allowedMenu} setActive={setActive} logout={logout} config={config}/>
    <section className="workspace"><header className="topbar"><div><p>{config.sistemaDescripcion}</p><span>Sesión protegida · {nombresRol[user.rol]} · {config.institucionNombre}</span></div>{can("movimientos:escribir") ? <button className="primary" onClick={()=>setActive("Registrar movimiento")}>Nuevo movimiento</button> : null}</header><div className="content">{active === "Resumen" ? <Resumen user={user} setActive={setActive}/> : active === "Usuarios" ? <UsuariosAdmin notify={notify}/> : active === "Bancos" ? <Bancos canUpload={can("banco:cargar")} notify={notify}/> : active === "Importaciones" ? <Importaciones notify={notify}/> : active === "Auditoría" ? <Auditoria/> : active === "Reportes" ? <Reportes canDownload={can("reportes:descargar")}/> : active === "Registrar movimiento" ? <Movimiento notify={notify}/> : active === "Catálogo contable" ? <CatalogoContable notify={notify}/> : <Modulo nombre={active} user={user}/>}</div></section>
    {notice ? <div className="toast">✓ {notice}</div> : null}
  </main>;
}

function Sidebar({ user, active, allowedMenu, setActive, logout, config }: { user: User; active: string; allowedMenu: typeof menu; setActive: (value: string) => void; logout: () => void; config: ConfiguracionSistema }) {
  return <aside className="sidebar"><div className="brand"><span className="brandMark">{config.sistemaNombre}</span><div><b>{config.sistemaNombre}</b><small>{config.institucionNombre}</small></div></div><nav aria-label="Navegación principal">{menuGroups.map(group=>{const items=allowedMenu.filter(item=>group.items.includes(item.nombre));return items.length?<section className="navSection" key={group.label}><p className="navLabel">{group.label}</p>{items.map(item=><button key={item.nombre} className={active===item.nombre?"navItem active":"navItem"} onClick={()=>setActive(item.nombre)}><MenuIcon name={item.icono}/><span>{item.nombre}</span></button>)}</section>:null;})}</nav><div className="sidebarFoot"><span className="avatar">{user.nombre.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><div><b>{user.nombre}</b><small>{nombresRol[user.rol]}</small></div><button aria-label="Cerrar sesión" onClick={logout}>Salir</button></div></aside>;
}

function MenuIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: "M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-4H4v4Zm10 0h6v-4h-6v4Z",
    users: "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5C23 14.17 18.33 13 16 13Z",
    entry: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z",
    catalog: "M5 4h14v3H5V4Zm0 6h14v3H5v-3Zm0 6h14v3H5v-3Z",
    bank: "M12 3 3 8v2h18V8l-9-5ZM5 12v7H3v2h18v-2h-2v-7h-2v7h-3v-7h-2v7H9v-7H7v7H5v-7Z",
    upload: "M11 16h2V8l3.5 3.5 1.42-1.42L12 4.16 6.08 10.08 7.5 11.5 11 8v8Zm-5 2h12v2H6v-2Z",
    reports: "M5 3h14v18H5V3Zm3 4v2h8V7H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z",
    audit: "M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9l-7 7Z",
  };
  return <svg className="navIcon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name] ?? paths.dashboard}/></svg>;
}

function Login({ onSubmit, error, config }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string; config: ConfiguracionSistema }) {
  return <main className="authScreen"><section className="authCard"><div className="authBrand institutional"><span className="authLogo" style={{ backgroundImage: `url(${config.logoLogin})` }} role="img" aria-label={config.institucionNombre}/><div><b>{config.sistemaNombre}</b><small>{config.sistemaDescripcion}</small></div></div><span className="eyebrow">ACCESO SEGURO</span><h1>Iniciar sesión</h1><p>Ingrese con el usuario asignado a su función.</p><form onSubmit={onSubmit}><label>Usuario<input name="usuario" autoComplete="username" required placeholder="Usuario asignado"/></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required placeholder="Contraseña"/></label>{error ? <div className="authError" role="alert">{error}</div> : null}<button className="primary" type="submit">Ingresar al {config.sistemaNombre}</button></form></section></main>;
}

function Modulo({ nombre, user }: { nombre: string; user: User }) {
  const textos: Record<string, [string,string]> = { Resumen:["Panel de trabajo",`Accesos habilitados para ${nombresRol[user.rol]}.`], Usuarios:["Administración de usuarios","Control de usuarios, roles y perfiles del sistema."], "Catálogo contable":["Catálogo contable","Administración de cuentas y estructura jerárquica."], Importaciones:["Importaciones contables","Carga de catálogo, balanza y auxiliares."], Reportes:["Centro de reportes","Consulta de estados financieros autorizados."] };
  const [title, description] = textos[nombre] ?? [nombre,"Módulo autorizado para su perfil."];
  const accesos = menu.filter(item=>user.permisos.includes(item.permiso) && item.nombre !== "Resumen");
  return <><div className="pageHead"><div><span className="eyebrow">{nombresRol[user.rol].toUpperCase()}</span><h1>{title}</h1><p>{description}</p></div></div><section className="metrics workflowMetrics"><article className="metric featured"><p>Rol activo</p><strong>{nombresRol[user.rol]}</strong><span className="pill ready">Sesión válida</span></article><article className="metric"><p>Módulos disponibles</p><strong>{accesos.length}</strong><small>Según permisos actuales</small></article>{accesos.slice(0,2).map(item=><article className="metric" key={item.nombre}><p>Acceso directo</p><strong>{item.nombre}</strong><small>{etiquetasPermiso[item.permiso]}</small></article>)}</section></>;
}

function Resumen({ user, setActive }: { user: User; setActive: (value: string) => void }) {
  const [resumen, setResumen] = useState<ResumenSistema | null>(null);
  const [error, setError] = useState("");
  const accesos = menu.filter(item=>user.permisos.includes(item.permiso) && item.nombre !== "Resumen");

  useEffect(() => {
    fetch("/api/resumen")
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el resumen");
        setResumen(data.resumen);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "No se pudo cargar el resumen"));
  }, []);

  return <><div className="pageHead"><div><span className="eyebrow">{nombresRol[user.rol].toUpperCase()}</span><h1>Resumen operativo</h1><p>Estado actual de catálogos, cargas, movimientos y trazabilidad.</p></div></div>{error?<div className="authError">{error}</div>:null}<section className="metrics workflowMetrics"><article className="metric featured"><p>Rol activo</p><strong>{nombresRol[user.rol]}</strong><span className="pill ready">Sesión válida</span></article><article className="metric"><p>Cuentas contables</p><strong>{resumen?.cuentas ?? "..."}</strong><small>{resumen?.cuentasMovimiento ?? 0} disponibles para minutas</small></article><article className="metric"><p>Iglesias activas</p><strong>{resumen?.iglesiasActivas ?? "..."}</strong><small>Catálogo institucional</small></article><article className="metric"><p>Minutas registradas</p><strong>{resumen?.movimientos ?? "..."}</strong><small>{resumen?.ultimoMovimiento ? `Última: ${new Date(resumen.ultimoMovimiento.creadoEn).toLocaleDateString("es-NI")}` : "Sin registros"}</small></article></section><section className="grid"><article className="panel activityPanel"><div className="panelHead"><div><h2>Flujo contable</h2><p>Datos conectados a PostgreSQL</p></div></div><div className="statusList"><button onClick={()=>setActive("Importaciones")}><b>Balanzas importadas</b><span>{resumen?.importaciones ?? 0}</span></button><button onClick={()=>setActive("Bancos")}><b>Reportes bancarios</b><span>{resumen?.reportesBanco ?? 0}</span></button><button onClick={()=>setActive("Auditoría")}><b>Eventos auditados</b><span>{resumen?.eventosAuditoria ?? 0}</span></button></div></article><article className="panel activityPanel"><div className="panelHead"><div><h2>Actividad reciente</h2><p>Últimos eventos del sistema</p></div></div>{resumen?.eventos.length ? <div className="auditMini">{resumen.eventos.map(evento=><div key={`${evento.fecha}-${evento.accion}`}><b>{evento.modulo}</b><span>{evento.accion}</span><small>{evento.usuario} · {new Date(evento.fecha).toLocaleString("es-NI")}</small></div>)}</div> : <div className="emptySmall">Sin actividad registrada.</div>}</article></section><section className="panel shortcutPanel"><div className="panelHead"><div><h2>Accesos de trabajo</h2><p>Módulos habilitados para este usuario</p></div></div><div className="shortcutGrid">{accesos.map(item=><button key={item.nombre} onClick={()=>setActive(item.nombre)}><MenuIcon name={item.icono}/><b>{item.nombre}</b><small>{etiquetasPermiso[item.permiso]}</small></button>)}</div></section></>;
}

function Movimiento({ notify }: { notify: (message: string) => void }) {
  const [cuentas, setCuentas] = useState<CuentaMovimiento[]>([]);
  const [detalles, setDetalles] = useState<DetalleMinuta[]>([{ tipo: "debito", cuentaCodigo: "", monto: "" }, { tipo: "credito", cuentaCodigo: "", monto: "" }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iglesias, setIglesias] = useState<Iglesia[]>([]);

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

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const detallesPayload = detalles.map((detalle, index) => {
      const cuenta = cuentas.find(item => item.codigo === detalle.cuentaCodigo);
      return { tipo: detalle.tipo, cuentaCodigo: cuenta?.codigo, cuentaNombre: cuenta?.descripcion, monto: detalle.monto, orden: index + 1 };
    });
    if (detallesPayload.some(detalle => !detalle.cuentaCodigo || !detalle.monto)) {
      setSaving(false);
      return setError("Complete cuenta y monto en todas las líneas");
    }
    const totalDebitos = detalles.filter(detalle => detalle.tipo === "debito").reduce((total, detalle) => total + Number(detalle.monto || 0), 0);
    const totalCreditos = detalles.filter(detalle => detalle.tipo === "credito").reduce((total, detalle) => total + Number(detalle.monto || 0), 0);
    if (Math.abs(totalDebitos - totalCreditos) >= 0.01) {
      setSaving(false);
      return setError("La minuta debe cuadrar: débitos y créditos tienen que ser iguales");
    }
    const response = await fetch("/api/movimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: form.get("fecha"),
        iglesiaCodigo: form.get("iglesiaCodigo"),
        referencia: form.get("referencia"),
        concepto: form.get("concepto"),
        detalles: detallesPayload,
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error ?? "No se pudo guardar el movimiento");
    formElement.reset();
    setDetalles([{ tipo: "debito", cuentaCodigo: "", monto: "" }, { tipo: "credito", cuentaCodigo: "", monto: "" }]);
    notify("Movimiento guardado en PostgreSQL");
  }

  const totalDebitos = detalles.filter(detalle => detalle.tipo === "debito").reduce((total, detalle) => total + Number(detalle.monto || 0), 0);
  const totalCreditos = detalles.filter(detalle => detalle.tipo === "credito").reduce((total, detalle) => total + Number(detalle.monto || 0), 0);
  const diferencia = totalDebitos - totalCreditos;
  const updateDetalle = (index: number, changes: Partial<DetalleMinuta>) => setDetalles(current => current.map((detalle, itemIndex) => itemIndex === index ? { ...detalle, ...changes } : detalle));
  const removeDetalle = (index: number) => setDetalles(current => current.length > 2 ? current.filter((_, itemIndex) => itemIndex !== index) : current);

  const isBalanced = Math.abs(diferencia) < 0.01 && totalDebitos > 0 && totalCreditos > 0;
  return <><div className="pageHead movementHead"><div><span className="eyebrow">CONTABILIDAD</span><h1>Registrar movimiento</h1><p>Registre una minuta cuadrada usando iglesias y cuentas activas de los catálogos.</p></div><div className={isBalanced?"balanceSummary balanced":"balanceSummary pending"}><span>Débitos <b>{dinero.format(totalDebitos)}</b></span><span>Créditos <b>{dinero.format(totalCreditos)}</b></span><span className={isBalanced?"positive":"negative"}>Diferencia <b>{isBalanced?"Cuadrado":dinero.format(diferencia)}</b></span></div></div>{!loading && !cuentas.length ? <div className="readOnlyBanner">No hay cuentas de movimiento activas. Cargue o habilite cuentas en el catálogo contable antes de registrar minutas.</div> : null}<form className="panel formPanel movementPanel" onSubmit={guardar}><div className="formGrid movementMeta"><label>Fecha<input name="fecha" type="date" required defaultValue={new Date().toLocaleDateString("en-CA")}/></label><label className="wide">Iglesia<select name="iglesiaCodigo" required defaultValue="" disabled={!iglesias.length}><option value="" disabled>{iglesias.length ? "Seleccione una iglesia" : "Cargando iglesias..."}</option>{iglesias.map(iglesia=><option key={iglesia.codigo} value={iglesia.codigo}>{iglesia.codigo} · {iglesia.nombre}</option>)}</select></label><label>Referencia<input name="referencia" maxLength={120} placeholder="Número de minuta o referencia bancaria"/></label><label className="wide">Concepto<textarea name="concepto" required/></label></div><div className="detailEditor"><div className="detailHeader"><b>Detalle contable</b><button className="secondary" type="button" onClick={()=>setDetalles(current=>[...current,{tipo:"debito",cuentaCodigo:"",monto:""}])}>Agregar línea</button></div><div className="detailTableHead"><span>Tipo</span><span>Cuenta contable</span><span>Monto NIO</span><span/></div>{detalles.map((detalle,index)=><div className="detailRow" key={index}><select className={detalle.tipo} value={detalle.tipo} onChange={event=>updateDetalle(index,{tipo:event.target.value as DetalleMinuta["tipo"]})}><option value="debito">Débito</option><option value="credito">Crédito</option></select><select value={detalle.cuentaCodigo} onChange={event=>updateDetalle(index,{cuentaCodigo:event.target.value})} required disabled={loading || !cuentas.length}><option value="">{loading ? "Cargando catálogo..." : "Seleccione cuenta"}</option>{cuentas.map(cuenta=><option key={cuenta.codigo} value={cuenta.codigo}>{cuenta.codigo} · {cuenta.descripcion}</option>)}</select><input value={detalle.monto} onChange={event=>updateDetalle(index,{monto:event.target.value})} type="number" required min="0.01" step="0.01" placeholder="0.00"/><button className="secondary iconButton" type="button" onClick={()=>removeDetalle(index)} disabled={detalles.length<=2} aria-label="Eliminar línea">×</button></div>)}</div>{cuentas.length ? <div className="accountHint">{cuentas.length} cuentas de movimiento y {iglesias.length} iglesias disponibles desde PostgreSQL.</div> : null}{error?<div className="authError">{error}</div>:null}<div className="formActions"><button className="primary" type="submit" disabled={saving || loading || !cuentas.length || !iglesias.length || !isBalanced}>{saving?"Guardando…":"Guardar movimiento"}</button></div></form></>;
}

function CatalogoContable({ notify }: { notify: (message: string) => void }) {
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

  return <><div className="pageHead"><div><span className="eyebrow">CATÁLOGO</span><h1>Catálogo contable</h1><p>Administre cuentas reales disponibles para importaciones, reportes y minutas.</p></div></div><section className="adminLayout"><form className="panel formPanel" onSubmit={crearCuenta}><div className="panelHead compact"><div><h2>Nueva cuenta</h2><p>Use códigos contables de 8 dígitos.</p></div></div><div className="formGrid"><label>Código<input name="codigo" required minLength={8} maxLength={8} inputMode="numeric" placeholder="11010201"/></label><label>Descripción<input name="descripcion" required placeholder="Nombre de la cuenta"/></label><label>Naturaleza<select name="naturaleza" defaultValue="deudora"><option value="deudora">Deudora</option><option value="acreedora">Acreedora</option></select></label><label>Flujo<select name="clasificacionFlujo" defaultValue="no aplica"><option value="operación">Operación</option><option value="inversión">Inversión</option><option value="financiamiento">Financiamiento</option><option value="no aplica">No aplica</option></select></label><label className="checkLine"><input name="esCuentaMovimiento" type="checkbox" defaultChecked/>Cuenta de movimiento</label></div>{error?<div className="authError adminError">{error}</div>:null}<div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Creando…":"Crear cuenta"}</button></div></form><section className="panel rolesPanel"><div className="panelHead compact"><div><h2>Resumen</h2><p>{cuentas.length} cuentas activas</p></div></div><article className="metric inlineMetric"><p>Cuentas de movimiento</p><strong>{cuentas.filter(cuenta=>cuenta.esCuentaMovimiento).length}</strong></article><article className="metric inlineMetric"><p>Operación</p><strong>{cuentas.filter(cuenta=>cuenta.clasificacionFlujo==="operación").length}</strong></article></section></section><section className="panel tablePanel"><div className="panelHead"><div><h2>Cuentas registradas</h2><p>Fuente: PostgreSQL</p></div></div><div className="tableWrap"><table><thead><tr><th>CÓDIGO</th><th>DESCRIPCIÓN</th><th>NATURALEZA</th><th>FLUJO</th><th>MOVIMIENTO</th><th>ESTADO</th></tr></thead><tbody>{cuentas.map(cuenta=><tr key={cuenta.codigo}><td><b>{cuenta.codigo}</b></td><td>{cuenta.descripcion}</td><td>{cuenta.naturaleza}</td><td>{cuenta.clasificacionFlujo}</td><td><button className={cuenta.esCuentaMovimiento?"status done":"status pending"} onClick={()=>actualizarCuenta(cuenta.codigo,{esCuentaMovimiento:!cuenta.esCuentaMovimiento})}>{cuenta.esCuentaMovimiento?"sí":"no"}</button></td><td><button className={cuenta.estado==="activa"?"status done":"status pending"} onClick={()=>actualizarCuenta(cuenta.codigo,{estado:cuenta.estado==="activa"?"inactiva":"activa"})}>{cuenta.estado}</button></td></tr>)}</tbody></table></div>{!cuentas.length?<div className="emptyReport">Todavía no hay cuentas activas. Puede crearlas aquí o importarlas desde una balanza.</div>:null}</section></>;
}

function UsuariosAdmin({ notify }: { notify: (message: string) => void }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [roles, setRoles] = useState<RolAdmin[]>([]);
  const [permisos, setPermisos] = useState<PermisoAdmin[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function cargarDatos() {
    setError("");
    const [usuariosResponse, rolesResponse] = await Promise.all([fetch("/api/admin/usuarios"), fetch("/api/admin/roles")]);
    const usuariosData = await usuariosResponse.json();
    const rolesData = await rolesResponse.json();
    if (!usuariosResponse.ok) return setError(usuariosData.error ?? "No se pudieron cargar los usuarios");
    if (!rolesResponse.ok) return setError(rolesData.error ?? "No se pudieron cargar los roles");
    setUsuarios(usuariosData.usuarios ?? []);
    setRoles(rolesData.roles ?? []);
    setPermisos(rolesData.permisos ?? []);
  }

  useEffect(() => { void Promise.resolve().then(cargarDatos); }, []);

  async function crearUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: form.get("usuario"),
        nombre: form.get("nombre"),
        rolId: form.get("rolId"),
        password: form.get("password"),
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error);
    event.currentTarget.reset();
    await cargarDatos();
    notify("Usuario creado");
  }

  async function actualizarUsuario(id: string, changes: Partial<Pick<UsuarioAdmin, "nombre" | "rolId" | "estado">>) {
    setError("");
    const response = await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const result = await response.json();
    if (!response.ok) return setError(result.error);
    setUsuarios(current => current.map(item => item.id === id ? { ...item, ...result.usuario } : item));
    notify("Usuario actualizado");
  }

  async function crearRol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const selected = form.getAll("permisos").map(String);
    const response = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.get("id"),
        nombre: form.get("nombre"),
        descripcion: form.get("descripcion"),
        permisos: selected,
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error);
    event.currentTarget.reset();
    await cargarDatos();
    notify("Rol creado");
  }

  async function cambiarPermisoRol(rol: RolAdmin, permiso: Permiso, checked: boolean) {
    const nuevosPermisos = checked ? [...rol.permisos, permiso] : rol.permisos.filter(item => item !== permiso);
    setError("");
    const response = await fetch(`/api/admin/roles/${rol.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permisos: nuevosPermisos }),
    });
    const result = await response.json();
    if (!response.ok) return setError(result.error);
    setRoles(current => current.map(item => item.id === rol.id ? result.rol : item));
    notify("Permisos actualizados");
  }

  return <><div className="pageHead"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Usuarios y roles</h1><p>Gestión inicial de accesos del sistema.</p></div></div><section className="adminLayout"><form className="panel formPanel" onSubmit={crearUsuario}><div className="panelHead compact"><div><h2>Crear usuario</h2><p>El usuario podrá iniciar sesión con el rol asignado.</p></div></div><div className="formGrid"><label>Usuario<input name="usuario" required placeholder="usuario.nuevo"/></label><label>Nombre<input name="nombre" required placeholder="Nombre completo"/></label><label>Rol<select name="rolId" required defaultValue=""><option value="" disabled>Seleccione rol</option>{roles.map(rol=><option key={rol.id} value={rol.id}>{rol.nombre}</option>)}</select></label><label>Contraseña inicial<input name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres"/></label></div>{error?<div className="authError adminError">{error}</div>:null}<div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Creando…":"Crear usuario"}</button></div></form><form className="panel formPanel" onSubmit={crearRol}><div className="panelHead compact"><div><h2>Crear rol</h2><p>Defina un perfil reutilizable para usuarios nuevos.</p></div></div><div className="formGrid"><label>Identificador<input name="id" required placeholder="nuevo_rol"/></label><label>Nombre<input name="nombre" required placeholder="Nuevo rol"/></label><label className="wide">Descripción<input name="descripcion" required placeholder="Responsabilidad principal del rol"/></label></div><div className="permissionGrid">{permisos.map(permiso=><label key={permiso.id}><input type="checkbox" name="permisos" value={permiso.id}/><span>{etiquetasPermiso[permiso.id]}</span><small>{permiso.descripcion}</small></label>)}</div><div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Creando…":"Crear rol"}</button></div></form></section><section className="panel rolesPanel roleMatrix"><div className="panelHead compact"><div><h2>Roles disponibles</h2><p>{roles.length} perfiles configurados</p></div></div>{roles.map(rol=><article key={rol.id} className="roleItem"><b>{rol.nombre}</b><span>{rol.descripcion}</span><div className="permissionGrid compact">{permisos.map(permiso=><label key={`${rol.id}-${permiso.id}`}><input type="checkbox" checked={rol.permisos.includes(permiso.id)} onChange={event=>cambiarPermisoRol(rol,permiso.id,event.target.checked)}/><span>{etiquetasPermiso[permiso.id]}</span></label>)}</div></article>)}</section><section className="panel tablePanel"><div className="panelHead"><div><h2>Usuarios registrados</h2><p>{usuarios.length} cuentas disponibles</p></div></div><div className="tableWrap"><table><thead><tr><th>USUARIO</th><th>NOMBRE</th><th>ROL</th><th>ESTADO</th><th>CREADO</th></tr></thead><tbody>{usuarios.map(item=><tr key={item.id}><td><b>{item.usuario}</b></td><td><input className="inlineInput" value={item.nombre} onChange={event=>setUsuarios(current=>current.map(user=>user.id===item.id?{...user,nombre:event.target.value}:user))} onBlur={event=>actualizarUsuario(item.id,{nombre:event.target.value})}/></td><td><select className="inlineInput" value={item.rolId} onChange={event=>actualizarUsuario(item.id,{rolId:event.target.value})}>{roles.map(rol=><option key={rol.id} value={rol.id}>{rol.nombre}</option>)}</select></td><td><button className={item.estado==="activo"?"status done":"status pending"} onClick={()=>actualizarUsuario(item.id,{estado:item.estado==="activo"?"inactivo":"activo"})}>{item.estado}</button></td><td>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</td></tr>)}</tbody></table></div></section></>;
}

function Bancos({ canUpload, notify }: { canUpload: boolean; notify: (message: string) => void }) {
  const [reportes, setReportes] = useState<Reporte[]>([]); const [file, setFile] = useState<File | null>(null); const [error,setError]=useState("");
  useEffect(()=>{ fetch("/api/banco/reportes").then(r=>r.json()).then(data=>setReportes(data.reportes??[])); },[]);
  async function upload(){ if(!file) return setError("Seleccione un archivo CSV o Excel"); const form=new FormData(); form.append("archivo",file); const response=await fetch("/api/banco/reportes",{method:"POST",body:form}); const result=await response.json(); if(!response.ok)return setError(result.error); setReportes(current=>[result.reporte,...current]); setFile(null); setError(""); notify("Reporte bancario recibido"); }
  return <><div className="pageHead"><div><span className="eyebrow">BANCOS</span><h1>Reportes bancarios</h1><p>Consulta de archivos recibidos y su estado de procesamiento.</p></div></div>{canUpload?<section className="panel uploadPanel"><div><h2>Subir reporte del banco</h2><p>Formatos permitidos: CSV, XLS o XLSX · máximo 10 MB.</p></div><input type="file" accept=".csv,.xls,.xlsx" onChange={event=>setFile(event.target.files?.[0]??null)}/><button className="primary" onClick={upload}>Subir reporte</button>{error?<span className="uploadError">{error}</span>:null}</section>:<div className="readOnlyBanner">Acceso de solo lectura: puede consultar reportes, pero no cargarlos.</div>}<section className="panel tablePanel"><div className="panelHead"><div><h2>Historial bancario</h2><p>{reportes.length} archivos disponibles</p></div></div><div className="tableWrap"><table><thead><tr><th>ARCHIVO</th><th>FECHA</th><th>CARGADO POR</th><th>ESTADO</th></tr></thead><tbody>{reportes.map(item=><tr key={item.id}><td><b>{item.nombre}</b></td><td>{item.fecha}</td><td>{item.cargadoPor}</td><td><span className="status done">{item.estado}</span></td></tr>)}</tbody></table></div></section></>;
}

function Importaciones({ notify }: { notify: (message: string) => void }) {
  const [importaciones, setImportaciones] = useState<ImportacionBalanza[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [periodo, setPeriodo] = useState(currentMonth());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function cargarHistorial() {
    const response = await fetch("/api/importaciones/balanza");
    const data = await response.json();
    if (response.ok) setImportaciones(data.importaciones ?? []);
    else setError(data.error ?? "No se pudo cargar el historial");
  }

  useEffect(() => { void Promise.resolve().then(cargarHistorial); }, []);

  async function importar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Seleccione el archivo de balanza");
    setSaving(true); setError("");
    const form = new FormData();
    form.append("periodo", periodo);
    form.append("archivo", file);
    const response = await fetch("/api/importaciones/balanza", { method: "POST", body: form });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error ?? "No se pudo importar la balanza");
    setImportaciones(current => [result.importacion, ...current]);
    setFile(null);
    notify(`${estadoImportacion(result.importacion.estado)}: ${result.importacion.totalLineas} líneas`);
  }

  const ultimo = importaciones[0];
  const diferencia = ultimo ? Number(ultimo.totalDebe) - Number(ultimo.totalHaber) : 0;
  return <><div className="pageHead"><div><span className="eyebrow">IMPORTACIONES</span><h1>Balanza de comprobación</h1><p>Importe el Excel mensual del contador con Cuenta, Descripción, Saldo Inicial, Débitos, Créditos y Saldo Final.</p></div></div>{ultimo?<section className="metrics compactMetrics"><article className="metric featured"><p>Última importación</p><strong>{ultimo.periodo}</strong><span className={statusClass(ultimo.estado)}>{estadoImportacion(ultimo.estado)}</span></article><article className="metric"><p>Líneas leídas</p><strong>{ultimo.totalLineas}</strong><small>{ultimo.archivoNombre}</small></article><article className="metric"><p>Total débitos</p><strong>{dinero.format(Number(ultimo.totalDebe))}</strong></article><article className="metric"><p>Diferencia</p><strong className={Math.abs(diferencia)<0.01?"positive":"negative"}>{dinero.format(diferencia)}</strong></article></section>:null}<form className="panel formPanel importPanel" onSubmit={importar}><div className="panelHead compact"><div><h2>Importar archivo</h2><p>Formato esperado: balance de comprobación en CSV, XLS o XLSX.</p></div></div><div className="formGrid"><label>Período<input type="month" value={periodo} onChange={event=>setPeriodo(event.target.value)} required/></label><label>Archivo<input type="file" accept=".csv,.xls,.xlsx" onChange={event=>setFile(event.target.files?.[0]??null)} required/></label><label className="wide">Campos detectados<input readOnly value="Cuenta, Descripción, Saldo Inicial, Débitos, Créditos, Saldo Final"/></label></div>{file?<div className="readOnlyBanner">Archivo seleccionado: {file.name} · {Math.round(file.size/1024)} KB</div>:null}{error?<div className="authError adminError">{error}</div>:null}<div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Importando…":"Importar balanza"}</button></div></form><section className="panel tablePanel"><div className="panelHead"><div><h2>Historial de importaciones</h2><p>{importaciones.length} archivos procesados</p></div></div><div className="tableWrap"><table><thead><tr><th>ARCHIVO</th><th>PERÍODO</th><th>LÍNEAS</th><th>TOTAL DÉBITOS</th><th>TOTAL CRÉDITOS</th><th>DIFERENCIA</th><th>FECHA</th><th>ESTADO</th></tr></thead><tbody>{importaciones.map(item=>{const diff=Number(item.totalDebe)-Number(item.totalHaber);return <tr key={item.id}><td><b>{item.archivoNombre}</b><small>{Math.round(item.archivoTamano/1024)} KB</small></td><td>{item.periodo}</td><td>{item.totalLineas}</td><td className="amount">{dinero.format(Number(item.totalDebe))}</td><td className="amount">{dinero.format(Number(item.totalHaber))}</td><td className={Math.abs(diff)<0.01?"amount positive":"amount negative"}>{dinero.format(diff)}</td><td>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</td><td><span className={statusClass(item.estado)}>{estadoImportacion(item.estado)}</span></td></tr>})}</tbody></table></div></section></>;
}

function Auditoria(){ const [eventos,setEventos]=useState<Evento[]>([]); useEffect(()=>{fetch("/api/auditoria").then(r=>r.json()).then(data=>setEventos(data.eventos??[]));},[]); return <><div className="pageHead"><div><span className="eyebrow">TRAZABILIDAD</span><h1>Auditoría general</h1><p>Vista exclusiva y de solo lectura para revisar actividad del sistema.</p></div></div><div className="readOnlyBanner">Modo auditor: ninguna acción puede modificar la información.</div><section className="panel tablePanel"><div className="panelHead"><div><h2>Bitácora de actividad</h2><p>{eventos.length} eventos recientes registrados por el sistema</p></div></div><div className="tableWrap"><table><thead><tr><th>FECHA</th><th>USUARIO</th><th>ACCIÓN</th><th>DETALLE</th><th>RESULTADO</th></tr></thead><tbody>{eventos.map(item=><tr key={`${item.fecha}-${item.accion}-${item.detalle??""}`}><td>{new Date(item.fecha).toLocaleString("es-NI")}</td><td>{item.usuario}</td><td>{item.accion}</td><td>{item.detalle??"Sin detalle adicional"}</td><td><span className={item.resultado==="error"?"status danger":"status done"}>{item.resultado}</span></td></tr>)}</tbody></table></div>{!eventos.length?<div className="emptyReport">Todavía no hay eventos de auditoría registrados.</div>:null}</section></> }

const opcionesReportesIniciales:OpcionReporte[]=[
  {tipo:"flujo-efectivo",titulo:"Estado de flujo de efectivo",descripcion:"Operación, inversión y financiamiento.",icono:"bank"},
  {tipo:"balanza-anual",titulo:"Balanza de comprobación anual",descripcion:"Saldos deudores y acreedores.",icono:"catalog"},
  {tipo:"cambio-patrimonio",titulo:"Estado de cambio en el patrimonio",descripcion:"Variaciones del patrimonio institucional.",icono:"dashboard"},
  {tipo:"situacion-comparativa",titulo:"Estado de situación comparativo",descripcion:"Activos, pasivos y patrimonio.",icono:"reports"},
  {tipo:"resultado-comparativo",titulo:"Estado de resultado comparativo",descripcion:"Ingresos, gastos y resultado neto.",icono:"entry"},
];
const dinero=new Intl.NumberFormat("es-NI",{style:"currency",currency:"NIO",minimumFractionDigits:2});
const currentYear = () => new Date().getFullYear();
const currentMonth = () => new Date().toLocaleDateString("en-CA").slice(0, 7);
const estadoImportacion = (estado: ImportacionBalanza["estado"]) => estado === "procesado" ? "Procesado" : estado === "con_diferencias" ? "Con diferencias" : "Error";
const statusClass = (estado: string) => estado === "con_diferencias" || estado === "pendiente" ? "status pending" : estado === "error" ? "status danger" : "status done";

function Reportes({canDownload}:{canDownload:boolean}){
  const initialYear = currentYear();
  const [opcionesReportes,setOpcionesReportes]=useState<OpcionReporte[]>(opcionesReportesIniciales);
  const [tipo,setTipo]=useState<TipoReporte>("flujo-efectivo"),[granularidad,setGranularidad]=useState<Granularidad>("anio"),[periodo,setPeriodo]=useState(String(initialYear)),[comparar,setComparar]=useState(String(initialYear-1)),[reporte,setReporte]=useState<ReporteFinanciero|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const url=(selected=tipo,format?:string)=>`/api/reportes/${selected}?granularidad=${granularidad}&periodo=${encodeURIComponent(periodo)}&comparar=${encodeURIComponent(comparar)}${format?`&formato=${format}`:""}`;
  async function generar(selected=tipo){setLoading(true);setError("");setTipo(selected);const response=await fetch(url(selected));const data=await response.json();if(response.ok)setReporte(data.reporte);else setError(data.error);setLoading(false);}
  useEffect(()=>{fetch("/api/reportes").then(response=>response.json()).then(data=>{if(data.reportes?.length)setOpcionesReportes(data.reportes);}).catch(()=>setOpcionesReportes(opcionesReportesIniciales));const year=currentYear();fetch(`/api/reportes/flujo-efectivo?granularidad=anio&periodo=${year}&comparar=${year-1}`).then(response=>response.json().then(data=>({ok:response.ok,data}))).then(({ok,data})=>{if(ok)setReporte(data.reporte);else setError(data.error);});},[]);
  function cambiarGranularidad(value:Granularidad){const now=new Date(),year=now.getFullYear(),month=String(now.getMonth()+1).padStart(2,"0"),day=String(now.getDate()).padStart(2,"0"),quarter=Math.floor(now.getMonth()/3)+1;const defaults={dia:[`${year}-${month}-${day}`,`${year-1}-${month}-${day}`],mes:[`${year}-${month}`,`${year-1}-${month}`],trimestre:[`${year}-T${quarter}`,`${year-1}-T${quarter}`],anio:[String(year),String(year-1)]}[value];setGranularidad(value);setPeriodo(defaults[0]);setComparar(defaults[1]);}
  const descargar=()=>{window.location.href=url(tipo,"csv");};
  return <><div className="pageHead reportPageHead"><div><span className="eyebrow">ESTADOS FINANCIEROS</span><h1>Centro de reportes</h1><p>Compare períodos con una experiencia temporal clara y flexible.</p></div></div><section className="timelineSlicer panel"><div className="slicerTop"><div><span className="slicerIcon"><MenuIcon name="reports"/></span><div><b>Comparación temporal</b><small>Elija el nivel de detalle y los períodos a analizar</small></div></div><div className="granularity" role="group" aria-label="Nivel de detalle temporal">{(["dia","mes","trimestre","anio"] as Granularidad[]).map(item=><button key={item} className={granularidad===item?"active":""} onClick={()=>cambiarGranularidad(item)}>{item==="dia"?"Día":item==="mes"?"Mes":item==="trimestre"?"Trimestre":"Año"}</button>)}</div></div><div className="periodCompare"><PeriodoControl label="Período principal" value={periodo} onChange={setPeriodo} granularidad={granularidad}/><div className="compareArrow"><span>VS</span><i>→</i></div><PeriodoControl label="Comparar contra" value={comparar} onChange={setComparar} granularidad={granularidad}/><button className="primary compareButton" onClick={()=>generar()} disabled={loading}>{loading?"Actualizando…":"Aplicar comparación"}</button></div><div className="timelineTrack"><span/><i/><i/><i/><b/></div></section>{reporte?<div className="sourceBanner"><b>Fuente real</b><span>{reporte.fuente}</span></div>:null}<section className="reportLayout"><aside className="reportCatalog">{opcionesReportes.map(item=><button key={item.tipo} className={tipo===item.tipo?"selected":""} onClick={()=>generar(item.tipo)}><span><MenuIcon name={item.icono}/></span><div><b>{item.titulo}</b><small>{item.descripcion}</small></div></button>)}</aside><section className="panel reportViewer">{error?<div className="emptyReport">{error}. Importe la balanza del período para generar este reporte.</div>:reporte?<><div className="reportTitle"><div><span className="status done">{reporte.fuente}</span><h2>{reporte.titulo}</h2><p>{reporte.periodoEtiqueta??reporte.periodo}{reporte.periodoComparativo?` frente a ${reporte.comparativoEtiqueta??reporte.periodoComparativo}`:""} · Córdobas NIO</p></div>{canDownload?<button className="secondary" onClick={descargar}>Descargar CSV</button>:null}</div><div className="tableWrap"><table className="financialTable"><thead><tr>{reporte.columnas.map(col=><th key={col}>{col}</th>)}</tr></thead><tbody>{reporte.filas.map((fila,index)=><tr key={`${fila.concepto}-${index}`} className={fila.esTotal?"totalRow":""}><td>{fila.codigo?<small>{fila.codigo}</small>:null}<b>{fila.concepto}</b></td><td className="amount">{dinero.format(fila.actual)}</td>{reporte.columnas.length>2?<td className="amount">{dinero.format(fila.anterior??0)}</td>:null}{reporte.columnas.length>3?<td className={(fila.variacion??0)<0?"amount negative":"amount positive"}>{dinero.format(fila.variacion??0)}</td>:null}</tr>)}</tbody></table></div><footer><span>Generado: {new Date(reporte.generadoEn).toLocaleString("es-NI")}</span><span>{reporte.filas.length} líneas</span></footer></>:<div className="emptyReport">Seleccione un reporte para generarlo.</div>}</section></section></>;
}

function PeriodoControl({label,value,onChange,granularidad}:{label:string;value:string;onChange:(value:string)=>void;granularidad:Granularidad}){
  const common={value,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>onChange(event.target.value)};
  const years = Array.from({ length: 7 }, (_, index) => currentYear() - index);
  return <label className="periodControl"><span>{label}</span>{granularidad==="dia"?<input type="date" min="2000-01-01" max="2100-12-31" {...common}/>:granularidad==="mes"?<input type="month" min="2000-01" max="2100-12" {...common}/>:granularidad==="trimestre"?<select {...common}>{years.flatMap(year=>[1,2,3,4].map(q=><option key={`${year}-T${q}`} value={`${year}-T${q}`}>Trimestre {q} · {year}</option>))}</select>:<select {...common}>{years.map(year=><option key={year} value={String(year)}>Año {year}</option>)}</select>}<small>{value}</small></label>;
}
