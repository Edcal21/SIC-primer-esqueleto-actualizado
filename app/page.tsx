"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Permiso = "panel:ver" | "usuarios:administrar" | "roles:administrar" | "movimientos:escribir" | "catalogo:administrar" | "banco:ver" | "banco:cargar" | "conciliacion:aprobar" | "importaciones:administrar" | "reportes:ver" | "reportes:descargar" | "auditoria:ver" | "configuracion:administrar";
type User = { id: string; usuario: string; nombre: string; rol: "administrador" | "contador_general" | "operador_bancario" | "auditor_general"; permisos: Permiso[] };
type Reporte = { id: string; nombre: string; fecha: string; estado: string; cargadoPor: string; archivoTamano?: number; creadoEn?: string; cuentaBancariaNumero?: string | null; periodoInicio?: string | null; periodoFin?: string | null; totalLineas?: number; totalDebitos?: string; totalCreditos?: string; mensajeError?: string | null; conciliacionId?: string | null; conciliacionEstado?: string | null };
type LineaBanco = { id: string; numeroLinea: number; fecha: string | null; referencia: string | null; descripcion: string; debito: string; credito: string; saldo: string | null; estadoConciliacion: "pendiente" | "conciliada" | "descartada"; movimientoId: string | null };
type MovimientoConciliable = { id: string; fecha: string; referencia: string | null; concepto: string; monto: number; lineaId: string | null };
type LineaConciliacion = LineaBanco & { movimiento: MovimientoConciliable | null };
type Conciliacion = { id: string; reporteId: string; cuentaBancariaNumero: string; cuentaBancariaNombre?: string | null; periodo: string; estado: "borrador" | "aprobada" | "rechazada"; totalBanco: string; totalConciliado: string; totalPendiente: string; lineasConciliadas: number; lineasPendientes: number; movimientosSinConciliar: number; observaciones?: string | null; creadoEn: string; revisadoPorNombre?: string | null; revisadoEn?: string | null; reporteNombre?: string | null };
type ReporteDisponible = { id: string; nombre: string; cuentaBancariaNumero: string | null; periodoInicio: string | null; periodoFin: string | null; totalLineas: number };
type Evento = { fecha: string; usuario: string; accion: string; resultado: string; detalle?: string | null };
type ImportacionBalanza = { id: string; archivoNombre: string; archivoTamano: number; periodo: string; estado: "procesado" | "con_diferencias" | "error"; totalLineas: number; totalDebe: string; totalHaber: string; creadoEn: string };
type PermisoAdmin = { id: Permiso; descripcion: string };
type RolAdmin = { id: string; nombre: string; descripcion: string; permisos: Permiso[] };
type UsuarioAdmin = { id: string; usuario: string; nombre: string; rolId: string; estado: "activo" | "inactivo"; creadoEn: string; rolNombre?: string | null };
type Iglesia = { codigo: string; nombre: string };
type CuentaBancaria = { numeroCuenta: string; nombre: string; moneda: "USD" | "NIO"; estado?: "activa" | "inactiva" };
type TipoReporte = "flujo-efectivo" | "balanza-anual" | "cambio-patrimonio" | "situacion-comparativa" | "resultado-comparativo";
type Granularidad = "dia" | "mes" | "trimestre" | "anio";
type ReporteFinanciero = { tipo:TipoReporte; titulo:string; descripcion:string; periodo:number; periodoComparativo?:number; periodoEtiqueta?:string; comparativoEtiqueta?:string; granularidad?:Granularidad; moneda:"NIO"; fuente:string; columnas:string[]; filas:{concepto:string;codigo?:string;actual:number;anterior?:number;variacion?:number;esTotal?:boolean}[]; generadoEn:string };
type CuentaMovimiento = { codigo: string; descripcion: string; naturaleza: "deudora" | "acreedora"; clasificacionFlujo: "operación" | "inversión" | "financiamiento" | "no aplica"; esCuentaMovimiento: boolean; estado: "activa" | "inactiva" };
type DetalleMinuta = { tipo: "debito" | "credito"; cuentaCodigo: string; monto: string };
type MovimientoRegistrado = { id: string; fecha: string; iglesiaCodigo: string | null; cuentaBancariaNumero: string | null; referencia: string | null; concepto: string; estado: "registrado" | "anulado"; creadoEn: string; enlazadoAConciliacion?: boolean };
type DetalleRegistrado = { id: string; movimientoId: string; tipo: "debito" | "credito"; cuentaCodigo: string; cuentaNombre: string; monto: string; orden: number };
type ResumenSistema = { cuentas: number; cuentasMovimiento: number; iglesiasActivas: number; importaciones: number; movimientos: number; reportesBanco: number; eventosAuditoria: number; ultimaImportacion?: ImportacionBalanza; ultimoMovimiento?: { fecha: string; concepto: string; referencia?: string | null; creadoEn: string }; eventos: { fecha: string; usuario: string; modulo: string; accion: string; resultado: string }[] };
type ConfiguracionSistema = { institucionNombre: string; sistemaNombre: string; sistemaDescripcion: string; moneda: "NIO"; logoLogin: string };
type OpcionReporte = { tipo: TipoReporte; titulo: string; descripcion: string; icono: string };
type ModalState = { title: string; message: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; isDanger?: boolean };
type RequestConfirmation = (modal: ModalState) => void;

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
  "configuracion:administrar": "Editar configuración",
};
const menu = [
  { nombre: "Resumen", permiso: "panel:ver" as Permiso, icono: "dashboard" },
  { nombre: "Usuarios", permiso: "usuarios:administrar" as Permiso, icono: "users" },
  { nombre: "Registrar movimiento", permiso: "movimientos:escribir" as Permiso, icono: "entry" },
  { nombre: "Minutas", permiso: "movimientos:escribir" as Permiso, icono: "reports" },
  { nombre: "Catálogo contable", permiso: "catalogo:administrar" as Permiso, icono: "catalog" },
  { nombre: "Bancos", permiso: "banco:ver" as Permiso, icono: "bank" },
  { nombre: "Conciliación", permiso: "banco:ver" as Permiso, icono: "reconcile" },
  { nombre: "Importaciones", permiso: "importaciones:administrar" as Permiso, icono: "upload" },
  { nombre: "Reportes", permiso: "reportes:ver" as Permiso, icono: "reports" },
  { nombre: "Auditoría", permiso: "auditoria:ver" as Permiso, icono: "audit" },
  { nombre: "Configuración", permiso: "configuracion:administrar" as Permiso, icono: "settings" },
];
const menuGroups = [
  { label: "Operativa", items: ["Resumen", "Registrar movimiento", "Minutas", "Bancos", "Conciliación"] },
  { label: "Reportes", items: ["Importaciones", "Reportes"] },
  { label: "Gestión", items: ["Usuarios", "Catálogo contable", "Auditoría", "Configuración"] },
];
const defaultConfig: ConfiguracionSistema = { institucionNombre: "Universal Nicaragua", sistemaNombre: "SIC", sistemaDescripcion: "Sistema de Información Contable", moneda: "NIO", logoLogin: "/universal-nicaragua-login.png" };

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [active, setActive] = useState("Resumen");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [config, setConfig] = useState<ConfiguracionSistema>(defaultConfig);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => { fetch("/api/auth/me").then(async response => { if (response.ok) setUser((await response.json()).user); }).finally(() => setChecking(false)); }, []);
  useEffect(() => { fetch("/api/configuracion").then(async response => { if (response.ok) setConfig((await response.json()).configuracion ?? defaultConfig); }).catch(() => setConfig(defaultConfig)); }, []);
  const can = (permission: Permiso) => Boolean(user?.permisos.includes(permission));
  const notify = (message: string) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3600);
  };
  const requestConfirmation: RequestConfirmation = nextModal => setModal(nextModal);

  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: form.get("usuario"), password: form.get("password") }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error);
    setUser(result.user); setActive(result.user.rol === "administrador" ? "Usuarios" : result.user.rol === "operador_bancario" ? "Bancos" : result.user.rol === "auditor_general" ? "Auditoría" : "Resumen");
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); setActive("Resumen"); }
  async function confirmModal() {
    if (!modal || modalBusy) return;
    setModalBusy(true);
    try {
      await modal.onConfirm();
      setModal(null);
    } catch {
      setModal(current => current ? { ...current, message: "No se pudo completar la operación. Revise la conexión e inténtelo nuevamente." } : current);
    } finally { setModalBusy(false); }
  }
  if (checking) return <main className="authScreen"><div className="authCard"><b>Validando sesión…</b></div></main>;
  if (!user) return <Login onSubmit={login} error={error} config={config} />;
  const allowedMenu = menu.filter(item => can(item.permiso));

  return <main className="shell">
    <Sidebar user={user} active={active} allowedMenu={allowedMenu} setActive={setActive} logout={()=>requestConfirmation({ title: "Cerrar sesión segura", message: "Se cerrará la sesión actual y deberá autenticarse nuevamente para continuar.", confirmLabel: "Cerrar sesión", onConfirm: logout })} config={config}/>
    <section className="workspace"><header className="topbar"><div><p>{config.sistemaDescripcion}</p><span>Sesión protegida · {nombresRol[user.rol]} · {config.institucionNombre}</span></div>{can("movimientos:escribir") ? <button className="primary" onClick={()=>setActive("Registrar movimiento")}>Nuevo movimiento</button> : null}</header><div className="content">{active === "Resumen" ? <Resumen user={user} setActive={setActive}/> : active === "Usuarios" ? <UsuariosAdmin notify={notify}/> : active === "Bancos" ? <Bancos canUpload={can("banco:cargar")} canManageAccounts={can("catalogo:administrar")} notify={notify} requestConfirmation={requestConfirmation}/> : active === "Conciliación" ? <ConciliacionBancaria canReconcile={can("banco:cargar")} canApprove={can("conciliacion:aprobar")} notify={notify} requestConfirmation={requestConfirmation}/> : active === "Importaciones" ? <Importaciones notify={notify}/> : active === "Auditoría" ? <Auditoria/> : active === "Reportes" ? <Reportes canDownload={can("reportes:descargar")}/> : active === "Registrar movimiento" ? <Movimiento notify={notify} requestConfirmation={requestConfirmation}/> : active === "Minutas" ? <Minutas notify={notify}/> : active === "Catálogo contable" ? <CatalogoContable notify={notify} requestConfirmation={requestConfirmation}/> : active === "Configuración" ? <ConfiguracionInstitucional config={config} onSaved={setConfig} notify={notify}/> : <Modulo nombre={active} user={user}/>}</div></section>
    {notice ? <div className="toast" role="status" aria-live="polite"><span className="toastIcon" aria-hidden="true">✓</span><span>{notice}</span></div> : null}
    {modal ? <ConfirmModal modal={modal} busy={modalBusy} onCancel={()=>{ if (!modalBusy) setModal(null); }} onConfirm={confirmModal}/> : null}
  </main>;
}

function ConfirmModal({ modal, busy, onCancel, onConfirm }: { modal: ModalState; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [busy, onCancel]);

  return <div className="modalOverlay"><section className={`modalCard ${modal.isDanger ? "danger" : ""}`} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title"><div className="modalHead"><span className="modalShield" aria-hidden="true">{modal.isDanger ? "!" : "✓"}</span><b id="confirm-modal-title">{modal.title}</b></div><div className="modalBody">{modal.message}</div><div className="modalFoot"><button className="secondary" type="button" onClick={onCancel} disabled={busy}>Cancelar</button><button className="primary" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Procesando..." : modal.confirmLabel ?? "Confirmar"}</button></div></section></div>;
}

function Sidebar({ user, active, allowedMenu, setActive, logout, config }: { user: User; active: string; allowedMenu: typeof menu; setActive: (value: string) => void; logout: () => void; config: ConfiguracionSistema }) {
  return <aside className="sidebar"><div className="brand"><span className="brandMark logoMark" style={{ backgroundImage: `url(${config.logoLogin})` }} role="img" aria-label={config.institucionNombre}/><div><b>{config.sistemaNombre}</b><small>{config.institucionNombre}</small></div></div><nav aria-label="Navegación principal">{menuGroups.map(group=>{const items=allowedMenu.filter(item=>group.items.includes(item.nombre));return items.length?<section className="navSection" key={group.label}><p className="navLabel">{group.label}</p>{items.map(item=><button key={item.nombre} className={active===item.nombre?"navItem active":"navItem"} onClick={()=>setActive(item.nombre)}><MenuIcon name={item.icono}/><span>{item.nombre}</span></button>)}</section>:null;})}</nav><div className="sidebarFoot"><span className="avatar">{user.nombre.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><div><b>{user.nombre}</b><small>{nombresRol[user.rol]}</small></div><button aria-label="Cerrar sesión" onClick={logout}>Salir</button></div></aside>;
}

function MenuIcon({ name, className = "navIcon" }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    dashboard: "M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-4H4v4Zm10 0h6v-4h-6v4Z",
    users: "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5C23 14.17 18.33 13 16 13Z",
    entry: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z",
    catalog: "M5 4h14v3H5V4Zm0 6h14v3H5v-3Zm0 6h14v3H5v-3Z",
    bank: "M12 3 3 8v2h18V8l-9-5ZM5 12v7H3v2h18v-2h-2v-7h-2v7h-3v-7h-2v7H9v-7H7v7H5v-7Z",
    upload: "M11 16h2V8l3.5 3.5 1.42-1.42L12 4.16 6.08 10.08 7.5 11.5 11 8v8Zm-5 2h12v2H6v-2Z",
    reports: "M5 3h14v18H5V3Zm3 4v2h8V7H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z",
    audit: "M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9l-7 7Z",
    search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z",
    trash: "M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1.1 11.2A2 2 0 0 1 14.9 22H9.1a2 2 0 0 1-2-1.8L6 9Zm4 2v8h1.5v-8H10Zm2.5 0v8H14v-8h-1.5Z",
    info: "M11 7h2v2h-2V7Zm0 4h2v6h-2v-6Zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z",
    check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z",
    reconcile: "M9.01 14H2v2h7.01v3L13 15l-3.99-4v3Zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4Z",
    settings: "M3 17v2h6v-2H3ZM3 5v2h10V5H3Zm10 16v-2h8v-2h-8v-2h-2v6h2ZM7 9v2H3v2h4v2h2V9H7Zm14 4v-2H11v2h10Zm-6-4h2V7h4V5h-4V3h-2v6Z",
  };
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name] ?? paths.dashboard}/></svg>;
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

const detallesIniciales = (): DetalleMinuta[] => [{ tipo: "debito", cuentaCodigo: "", monto: "" }, { tipo: "credito", cuentaCodigo: "", monto: "" }];

function Movimiento({ notify, requestConfirmation }: { notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [cuentas, setCuentas] = useState<CuentaMovimiento[]>([]);
  const [detalles, setDetalles] = useState<DetalleMinuta[]>(detallesIniciales);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iglesias, setIglesias] = useState<Iglesia[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
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

  function limpiarFormulario() {
    formRef.current?.reset();
    setDetalles(detallesIniciales());
    setError("");
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const detallesPayload = detalles.map((detalle, index) => {
      const cuenta = buscarCuenta(detalle.cuentaCodigo);
      return { tipo: detalle.tipo, cuentaCodigo: cuenta?.codigo, cuentaNombre: cuenta?.descripcion, monto: detalle.monto, orden: index + 1 };
    });
    if (detalles.some(detalle => detalle.cuentaCodigo.trim() && !buscarCuenta(detalle.cuentaCodigo))) {
      return setError("Hay líneas con un código que no pertenece al catálogo de cuentas de movimiento");
    }
    if (detallesPayload.some(detalle => !detalle.cuentaCodigo || !detalle.monto)) {
      return setError("Complete cuenta y monto en todas las líneas");
    }
    const totalDebitos = detalles.filter(detalle => detalle.tipo === "debito").reduce((total, detalle) => total + Number(detalle.monto || 0), 0);
    const totalCreditos = detalles.filter(detalle => detalle.tipo === "credito").reduce((total, detalle) => total + Number(detalle.monto || 0), 0);
    if (Math.abs(totalDebitos - totalCreditos) >= 0.01) {
      return setError("La minuta debe cuadrar: débitos y créditos tienen que ser iguales");
    }
    const iglesia = iglesias.find(item=>item.codigo===String(form.get("iglesiaCodigo")??""));
    const cuentaBancaria = cuentasBancarias.find(item=>item.numeroCuenta===String(form.get("cuentaBancariaNumero")??""));
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
              fecha: form.get("fecha"),
              iglesiaCodigo: form.get("iglesiaCodigo"),
              cuentaBancariaNumero: form.get("cuentaBancariaNumero"),
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

  const totalDebitos = detalles.filter(detalle => detalle.tipo === "debito").reduce((total, detalle) => total + Number(detalle.monto || 0), 0);
  const totalCreditos = detalles.filter(detalle => detalle.tipo === "credito").reduce((total, detalle) => total + Number(detalle.monto || 0), 0);
  const diferencia = totalDebitos - totalCreditos;
  const updateDetalle = (index: number, changes: Partial<DetalleMinuta>) => setDetalles(current => current.map((detalle, itemIndex) => itemIndex === index ? { ...detalle, ...changes } : detalle));
  const removeDetalle = (index: number) => setDetalles(current => current.length > 2 ? current.filter((_, itemIndex) => itemIndex !== index) : current);
  const agregarDetalle = () => setDetalles(current => [...current, { tipo: "debito", cuentaCodigo: "", monto: "" }]);
  const codigosInvalidos = detalles.some(detalle => detalle.cuentaCodigo.trim() && !buscarCuenta(detalle.cuentaCodigo));

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
    <form className="panel formPanel movementPanel" ref={formRef} onSubmit={guardar}>
      <section className="movementMeta">
        <div className="sectionHead"><b>Información general</b><small>Identificación de la minuta contable</small></div>
        <div className="formGrid">
          <label>Fecha<input name="fecha" type="date" required defaultValue={new Date().toLocaleDateString("en-CA")}/></label>
          <label>Cuenta bancaria<select name="cuentaBancariaNumero" required defaultValue="" disabled={!cuentasBancarias.length}><option value="" disabled>{cuentasBancarias.length ? "Seleccione una cuenta bancaria" : "Cargando cuentas bancarias..."}</option>{cuentasBancarias.map(cuenta=><option key={cuenta.numeroCuenta} value={cuenta.numeroCuenta}>{cuenta.nombre} · {cuenta.numeroCuenta} · {cuenta.moneda}</option>)}</select></label>
          <label className="wide">Iglesia<select name="iglesiaCodigo" required defaultValue="" disabled={!iglesias.length}><option value="" disabled>{iglesias.length ? "Seleccione una iglesia" : "Cargando iglesias..."}</option>{iglesias.map(iglesia=><option key={iglesia.codigo} value={iglesia.codigo}>{iglesia.codigo} · {iglesia.nombre}</option>)}</select></label>
          <label>Referencia<input name="referencia" maxLength={120} placeholder="Número de minuta o referencia bancaria"/></label>
          <label className="wide">Concepto<textarea name="concepto" required/></label>
        </div>
      </section>
      <div className="detailEditor">
        <div className="detailHeader">
          <div><b>Líneas de detalle</b><small>{detalles.length} líneas registradas · montos en córdobas</small></div>
          <button className="secondary" type="button" onClick={agregarDetalle}><MenuIcon name="entry" className="glyphIcon"/>Agregar línea</button>
        </div>
        <div className="detailTableHead"><span>Tipo</span><span>Cuenta contable</span><span>Monto NIO</span><span/></div>
        {detalles.map((detalle,index)=>{
          const cuenta = buscarCuenta(detalle.cuentaCodigo);
          const codigoEscrito = Boolean(detalle.cuentaCodigo.trim());
          return <div className="detailRow" key={index}>
            <select className={detalle.tipo} value={detalle.tipo} onChange={event=>updateDetalle(index,{tipo:event.target.value as DetalleMinuta["tipo"]})} aria-label={`Tipo de la línea ${index+1}`}><option value="debito">Débito</option><option value="credito">Crédito</option></select>
            <div className="accountCell">
              <span className="accountSearchIcon"><MenuIcon name="search" className="glyphIcon"/></span>
              <input list="cuentasMovimiento" value={detalle.cuentaCodigo} onChange={event=>updateDetalle(index,{cuentaCodigo:event.target.value})} required disabled={loading || !cuentas.length} placeholder={loading?"Cargando catálogo...":"Buscar cuenta por código"} aria-label={`Cuenta contable de la línea ${index+1}`}/>
              <small className={codigoEscrito && !cuenta ? "accountName invalid" : "accountName"}>{cuenta ? cuenta.descripcion : codigoEscrito ? "Código fuera del catálogo de cuentas de movimiento" : "Escriba el código o elíjalo del catálogo"}</small>
            </div>
            <input value={detalle.monto} onChange={event=>updateDetalle(index,{monto:event.target.value})} type="number" required min="0.01" step="0.01" placeholder="0.00" aria-label={`Monto de la línea ${index+1}`}/>
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
          <button className="primary" type="submit" disabled={saving || loading || codigosInvalidos || !cuentas.length || !iglesias.length || !cuentasBancarias.length || !isBalanced}>{saving?"Guardando…":"Guardar movimiento"}</button>
        </div>
      </div>
    </form>
  </>;
}

function CatalogoContable({ notify, requestConfirmation }: { notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
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

function UsuariosAdmin({ notify }: { notify: (message: string) => void }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
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

  async function restablecerPassword(item: UsuarioAdmin) {
    const password = passwords[item.id] ?? "";
    if (password.length < 12) return setError("La contraseña debe tener al menos 12 caracteres");
    setError("");
    const response = await fetch(`/api/admin/usuarios/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = await response.json();
    if (!response.ok) return setError(result.error);
    setPasswords(current => ({ ...current, [item.id]: "" }));
    notify(`Contraseña restablecida para ${item.usuario}`);
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

  return <><div className="pageHead"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Usuarios y roles</h1><p>Gestión inicial de accesos del sistema.</p></div></div><section className="adminLayout"><form className="panel formPanel" onSubmit={crearUsuario}><div className="panelHead compact"><div><h2>Crear usuario</h2><p>El usuario podrá iniciar sesión con el rol asignado.</p></div></div><div className="formGrid"><label>Usuario<input name="usuario" required placeholder="usuario.nuevo"/></label><label>Nombre<input name="nombre" required placeholder="Nombre completo"/></label><label>Rol<select name="rolId" required defaultValue=""><option value="" disabled>Seleccione rol</option>{roles.map(rol=><option key={rol.id} value={rol.id}>{rol.nombre}</option>)}</select></label><label>Contraseña inicial<input name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres"/></label></div>{error?<div className="authError adminError">{error}</div>:null}<div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Creando…":"Crear usuario"}</button></div></form><form className="panel formPanel" onSubmit={crearRol}><div className="panelHead compact"><div><h2>Crear rol</h2><p>Defina un perfil reutilizable para usuarios nuevos.</p></div></div><div className="formGrid"><label>Identificador<input name="id" required placeholder="nuevo_rol"/></label><label>Nombre<input name="nombre" required placeholder="Nuevo rol"/></label><label className="wide">Descripción<input name="descripcion" required placeholder="Responsabilidad principal del rol"/></label></div><div className="permissionGrid">{permisos.map(permiso=><label key={permiso.id}><input type="checkbox" name="permisos" value={permiso.id}/><span>{etiquetasPermiso[permiso.id]}</span><small>{permiso.descripcion}</small></label>)}</div><div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Creando…":"Crear rol"}</button></div></form></section><section className="panel rolesPanel roleMatrix"><div className="panelHead compact"><div><h2>Roles disponibles</h2><p>{roles.length} perfiles configurados</p></div></div>{roles.map(rol=><article key={rol.id} className="roleItem"><b>{rol.nombre}</b><span>{rol.descripcion}</span><div className="permissionGrid compact">{permisos.map(permiso=><label key={`${rol.id}-${permiso.id}`}><input type="checkbox" checked={rol.permisos.includes(permiso.id)} onChange={event=>cambiarPermisoRol(rol,permiso.id,event.target.checked)}/><span>{etiquetasPermiso[permiso.id]}</span></label>)}</div></article>)}</section><section className="panel tablePanel"><div className="panelHead"><div><h2>Usuarios registrados</h2><p>{usuarios.length} cuentas disponibles</p></div></div><div className="tableWrap"><table><thead><tr><th>USUARIO</th><th>NOMBRE</th><th>ROL</th><th>ESTADO</th><th>CREADO</th><th>CONTRASEÑA</th></tr></thead><tbody>{usuarios.map(item=><tr key={item.id}><td><b>{item.usuario}</b></td><td><input className="inlineInput" value={item.nombre} onChange={event=>setUsuarios(current=>current.map(user=>user.id===item.id?{...user,nombre:event.target.value}:user))} onBlur={event=>actualizarUsuario(item.id,{nombre:event.target.value})}/></td><td><select className="inlineInput" value={item.rolId} onChange={event=>actualizarUsuario(item.id,{rolId:event.target.value})}>{roles.map(rol=><option key={rol.id} value={rol.id}>{rol.nombre}</option>)}</select></td><td><button className={item.estado==="activo"?"status done":"status pending"} onClick={()=>actualizarUsuario(item.id,{estado:item.estado==="activo"?"inactivo":"activo"})}>{item.estado}</button></td><td>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</td><td><div className="passwordCell"><input className="inlineInput" type="password" autoComplete="new-password" placeholder="Nueva contraseña" value={passwords[item.id] ?? ""} onChange={event=>setPasswords(current=>({...current,[item.id]:event.target.value}))}/><button className="linkButton" type="button" onClick={()=>restablecerPassword(item)} disabled={(passwords[item.id]??"").length<12}>Restablecer</button></div></td></tr>)}</tbody></table></div><div className="accountHint">Las contraseñas sembradas por migración son públicas: cámbielas antes de operar en producción. Mínimo 12 caracteres.</div></section></>;
}

function Bancos({ canUpload, canManageAccounts, notify, requestConfirmation }: { canUpload: boolean; canManageAccounts: boolean; notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState("");
  const [detalle, setDetalle] = useState<{ reporte: Reporte; lineas: LineaBanco[] } | null>(null);
  const [detalleId, setDetalleId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarReportes() {
    setLoading(true);
    try {
      const response = await fetch("/api/banco/reportes");
      const data = await response.json().catch(() => ({})) as { reportes?: Reporte[]; error?: string };
      if (response.ok) {
        setReportes(data.reportes ?? []);
        setError("");
      } else {
        setError(data.error ?? `No se pudo cargar el historial bancario (HTTP ${response.status})`);
      }
    } catch {
      setError("No se pudo conectar con el servicio de reportes bancarios");
    } finally { setLoading(false); }
  }

  async function cargarCuentas() {
    try {
      const response = await fetch("/api/cuentas-bancarias?estado=todas");
      const data = await response.json().catch(() => ({})) as { cuentasBancarias?: CuentaBancaria[]; error?: string };
      if (response.ok) setCuentas(data.cuentasBancarias ?? []);
    } catch { setError("No se pudo cargar el catálogo de cuentas bancarias"); }
  }

  useEffect(() => { void Promise.resolve().then(cargarReportes); void Promise.resolve().then(cargarCuentas); }, []);

  async function verDetalle(reporte: Reporte) {
    if (detalleId === reporte.id) { setDetalleId(""); setDetalle(null); return; }
    setDetalleId(reporte.id); setDetalle(null);
    try {
      const response = await fetch(`/api/banco/reportes/${reporte.id}`);
      const data = await response.json().catch(() => ({})) as { reporte?: Reporte; lineas?: LineaBanco[]; error?: string };
      if (!response.ok || !data.reporte) return setError(data.error ?? "No se pudo cargar el detalle del reporte");
      setDetalle({ reporte: data.reporte, lineas: data.lineas ?? [] });
    } catch { setError("No se pudo conectar con el servicio de reportes bancarios"); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Seleccione un archivo CSV o Excel");
    if (!cuentaSeleccionada) return setError("Seleccione la cuenta bancaria del estado de cuenta");
    const formElement = event.currentTarget;
    setSaving(true); setError("");
    const form = new FormData();
    form.append("archivo", file);
    form.append("cuentaBancariaNumero", cuentaSeleccionada);
    try {
      const response = await fetch("/api/banco/reportes", { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { reporte?: Reporte; error?: string };
      if (!response.ok || !result.reporte) return setError(result.error ?? `No se pudo procesar el reporte bancario (HTTP ${response.status})`);
      setReportes(current => [result.reporte!, ...current]);
      setFile(null);
      formElement.reset();
      notify(`Estado bancario procesado: ${result.reporte.totalLineas ?? 0} movimientos guardados`);
    } catch {
      setError("No se pudo conectar con el servicio de reportes bancarios");
    } finally { setSaving(false); }
  }

  const activas = cuentas.filter(cuenta => (cuenta.estado ?? "activa") === "activa");
  const ultimo = reportes[0];
  const lineasGuardadas = reportes.reduce((total, reporte) => total + (reporte.totalLineas ?? 0), 0);
  return <><div className="pageHead"><div><span className="eyebrow">BANCOS</span><h1>Reportes bancarios</h1><p>Carga, procesamiento y consulta de estados de cuenta almacenados en PostgreSQL.</p></div></div>
    <section className="metrics compactMetrics">
      <article className="metric featured"><p>Archivos recibidos</p><strong>{loading ? "..." : reportes.length}</strong><small>{reportes.filter(item => item.estado === "procesado").length} procesados correctamente</small></article>
      <article className="metric"><p>Movimientos guardados</p><strong>{loading ? "..." : lineasGuardadas}</strong><small>Líneas persistidas en la base de datos</small></article>
      <article className="metric"><p>Última carga</p><strong>{ultimo ? new Date(ultimo.creadoEn ?? ultimo.fecha).toLocaleDateString("es-NI") : "Sin cargas"}</strong><small>{ultimo?.nombre ?? "No hay reportes bancarios"}</small></article>
      <article className="metric"><p>Estado reciente</p><strong>{ultimo?.estado ?? "Pendiente"}</strong><span className={statusClass(ultimo?.estado ?? "pendiente")}>{ultimo?.estado ?? "sin archivo"}</span></article>
    </section>
    {canUpload ? <form className="panel uploadPanel bankUploadPanel" onSubmit={upload}>
      <div><h2>Subir estado de cuenta</h2><p>El archivo se procesa al recibirlo: cada movimiento queda guardado y disponible para conciliación.</p></div>
      <label className="uploadField">Cuenta bancaria<select value={cuentaSeleccionada} onChange={event => setCuentaSeleccionada(event.target.value)} required disabled={!activas.length}><option value="" disabled>{activas.length ? "Seleccione una cuenta bancaria" : "Sin cuentas bancarias activas"}</option>{activas.map(cuenta => <option key={cuenta.numeroCuenta} value={cuenta.numeroCuenta}>{cuenta.nombre} · {cuenta.numeroCuenta} · {cuenta.moneda}</option>)}</select></label>
      <label className="fileDrop"><input type="file" accept=".csv,.xls,.xlsx" onChange={event => setFile(event.target.files?.[0] ?? null)}/><span>{file ? file.name : "Seleccionar CSV o Excel"}</span>{file ? <small>{Math.round(file.size / 1024)} KB · listo para procesar</small> : <small>Se requieren columnas de descripción y de débito, crédito o monto</small>}</label>
      <button className="primary" type="submit" disabled={saving || !activas.length}>{saving ? "Procesando..." : "Procesar reporte"}</button>
      {error ? <span className="uploadError">{error}</span> : null}
    </form> : <div className="readOnlyBanner">Acceso de solo lectura: puede consultar reportes bancarios, pero no cargarlos.</div>}
    {!canUpload && error ? <div className="authError adminError">{error}</div> : null}
    <section className="panel tablePanel">
      <div className="panelHead"><div><h2>Historial bancario</h2><p>{loading ? "Cargando desde PostgreSQL" : `${reportes.length} archivos disponibles`}</p></div><button onClick={cargarReportes}>Actualizar</button></div>
      <div className="tableWrap"><table><thead><tr><th>ARCHIVO</th><th>CUENTA</th><th>PERÍODO</th><th>LÍNEAS</th><th>DÉBITOS</th><th>CRÉDITOS</th><th>ESTADO</th><th>CONCILIACIÓN</th><th/></tr></thead><tbody>{reportes.map(item => <tr key={item.id}>
        <td><b>{item.nombre}</b><small>{item.cargadoPor} · {new Date(item.fecha).toLocaleDateString("es-NI")}</small></td>
        <td>{item.cuentaBancariaNumero ?? "No asignada"}</td>
        <td>{item.periodoInicio && item.periodoFin ? `${item.periodoInicio} a ${item.periodoFin}` : "Sin fechas en el archivo"}</td>
        <td>{item.totalLineas ?? 0}</td>
        <td className="amount">{dinero.format(Number(item.totalDebitos ?? 0))}</td>
        <td className="amount">{dinero.format(Number(item.totalCreditos ?? 0))}</td>
        <td><span className={statusClass(item.estado)}>{item.estado}</span>{item.mensajeError ? <small>{item.mensajeError}</small> : null}</td>
        <td>{item.conciliacionEstado ? <span className={item.conciliacionEstado === "aprobada" ? "status done" : item.conciliacionEstado === "rechazada" ? "status danger" : "status pending"}>{item.conciliacionEstado}</span> : <small>Sin conciliar</small>}</td>
        <td>{item.estado === "procesado" ? <button className="linkButton" type="button" onClick={() => verDetalle(item)}>{detalleId === item.id ? "Ocultar" : "Ver detalle"}</button> : null}</td>
      </tr>)}</tbody></table></div>
      {!loading && !reportes.length ? <div className="emptyReport">Todavía no hay reportes bancarios guardados. Use el formulario superior para procesar el primer estado de cuenta.</div> : null}
    </section>
    {detalleId ? <section className="panel tablePanel">
      <div className="panelHead"><div><h2>Movimientos del estado de cuenta</h2><p>{detalle ? `${detalle.lineas.length} líneas guardadas de ${detalle.reporte.nombre}` : "Cargando líneas desde PostgreSQL"}</p></div></div>
      {detalle ? <div className="tableWrap"><table><thead><tr><th>#</th><th>FECHA</th><th>REFERENCIA</th><th>DESCRIPCIÓN</th><th>DÉBITO</th><th>CRÉDITO</th><th>SALDO</th><th>CONCILIACIÓN</th></tr></thead><tbody>{detalle.lineas.map(linea => <tr key={linea.id}>
        <td>{linea.numeroLinea}</td>
        <td>{linea.fecha ?? "Sin fecha"}</td>
        <td>{linea.referencia ?? "Sin referencia"}</td>
        <td>{linea.descripcion}</td>
        <td className="amount">{Number(linea.debito) ? dinero.format(Number(linea.debito)) : "-"}</td>
        <td className="amount">{Number(linea.credito) ? dinero.format(Number(linea.credito)) : "-"}</td>
        <td className="amount">{linea.saldo === null ? "-" : dinero.format(Number(linea.saldo))}</td>
        <td><span className={estadoLineaClass(linea.estadoConciliacion)}>{linea.estadoConciliacion}</span></td>
      </tr>)}</tbody></table></div> : null}
    </section> : null}
    {canManageAccounts ? <CuentasBancariasPanel cuentas={cuentas} onChanged={cargarCuentas} notify={notify} requestConfirmation={requestConfirmation}/> : null}
  </>;
}

function CuentasBancariasPanel({ cuentas, onChanged, notify, requestConfirmation }: { cuentas: CuentaBancaria[]; onChanged: () => Promise<void>; notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
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
  const [tipo,setTipo]=useState<TipoReporte>("flujo-efectivo");
  const [granularidad,setGranularidad]=useState<Granularidad>("anio");
  const [periodo,setPeriodo]=useState(String(initialYear));
  const [comparar,setComparar]=useState(String(initialYear-1));
  const [reporte,setReporte]=useState<ReporteFinanciero|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const url=(selected=tipo,format?:string)=>`/api/reportes/${selected}?granularidad=${granularidad}&periodo=${encodeURIComponent(periodo)}&comparar=${encodeURIComponent(comparar)}${format?`&formato=${format}`:""}`;

  async function generar(selected=tipo){
    setLoading(true); setError(""); setTipo(selected);
    try {
      const response=await fetch(url(selected));
      const data=await response.json();
      if(response.ok)setReporte(data.reporte);else setError(data.error);
    } catch {
      setError("No se pudo conectar con el generador de reportes");
    } finally { setLoading(false); }
  }

  useEffect(()=>{
    fetch("/api/reportes").then(response=>response.json()).then(data=>{if(data.reportes?.length)setOpcionesReportes(data.reportes);}).catch(()=>setOpcionesReportes(opcionesReportesIniciales));
    const year=currentYear();
    fetch(`/api/reportes/flujo-efectivo?granularidad=anio&periodo=${year}&comparar=${year-1}`)
      .then(response=>response.json().then(data=>({ok:response.ok,data})))
      .then(({ok,data})=>{if(ok)setReporte(data.reporte);else setError(data.error);})
      .catch(()=>setError("No se pudo conectar con el generador de reportes"))
      .finally(()=>setLoading(false));
  },[]);

  function cambiarGranularidad(value:Granularidad){
    const now=new Date(),year=now.getFullYear(),month=String(now.getMonth()+1).padStart(2,"0"),day=String(now.getDate()).padStart(2,"0"),quarter=Math.floor(now.getMonth()/3)+1;
    const defaults={dia:[`${year}-${month}-${day}`,`${year-1}-${month}-${day}`],mes:[`${year}-${month}`,`${year-1}-${month}`],trimestre:[`${year}-T${quarter}`,`${year-1}-T${quarter}`],anio:[String(year),String(year-1)]}[value];
    setGranularidad(value);setPeriodo(defaults[0]);setComparar(defaults[1]);
  }
  const descargar=()=>{window.location.href=url(tipo,"csv");};

  return <><div className="pageHead reportPageHead"><div><span className="eyebrow">ESTADOS FINANCIEROS</span><h1>Centro de reportes</h1><p>Compare períodos con una experiencia temporal clara y flexible.</p></div></div><section className="timelineSlicer panel"><div className="slicerTop"><div><span className="slicerIcon"><MenuIcon name="reports"/></span><div><b>Comparación temporal</b><small>Elija el nivel de detalle y los períodos a analizar</small></div></div><div className="granularity" role="group" aria-label="Nivel de detalle temporal">{(["dia","mes","trimestre","anio"] as Granularidad[]).map(item=><button key={item} className={granularidad===item?"active":""} onClick={()=>cambiarGranularidad(item)}>{item==="dia"?"Día":item==="mes"?"Mes":item==="trimestre"?"Trimestre":"Año"}</button>)}</div></div><div className="periodCompare"><PeriodoControl label="Período principal" value={periodo} onChange={setPeriodo} granularidad={granularidad}/><div className="compareArrow"><span>VS</span><i>→</i></div><PeriodoControl label="Comparar contra" value={comparar} onChange={setComparar} granularidad={granularidad}/><button className="primary compareButton" onClick={()=>generar()} disabled={loading}>{loading?"Actualizando…":"Aplicar comparación"}</button></div><div className="timelineTrack"><span/><i/><i/><i/><b/></div></section>{reporte?<div className="sourceBanner"><b>Fuente real</b><span>{reporte.fuente}</span></div>:null}<section className="reportLayout"><aside className="reportCatalog">{opcionesReportes.map(item=><button key={item.tipo} className={tipo===item.tipo?"selected":""} onClick={()=>generar(item.tipo)} disabled={loading}><span><MenuIcon name={item.icono}/></span><div><b>{item.titulo}</b><small>{item.descripcion}</small></div></button>)}</aside><section className="panel reportViewer">{loading?<div className="reportLoadingOverlay" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/><span className="loadingText">GENERANDO REPORTE</span><small>Consultando y consolidando datos contables...</small></div>:error?<div className="emptyReport">{error}. Importe la balanza del período para generar este reporte.</div>:reporte?<><div className="reportTitle"><div><span className="status done">{reporte.fuente}</span><h2>{reporte.titulo}</h2><p>{reporte.periodoEtiqueta??reporte.periodo}{reporte.periodoComparativo?` frente a ${reporte.comparativoEtiqueta??reporte.periodoComparativo}`:""} · Córdobas NIO</p></div><div className="reportActions"><button className="secondary" onClick={()=>window.print()}>Imprimir</button>{canDownload?<button className="secondary" onClick={descargar}>Descargar CSV</button>:null}</div></div><div className="tableWrap"><table className="financialTable"><thead><tr>{reporte.columnas.map(col=><th key={col}>{col}</th>)}</tr></thead><tbody>{reporte.filas.map((fila,index)=><tr key={`${fila.concepto}-${index}`} className={fila.esTotal?"totalRow":""}><td>{fila.codigo?<small>{fila.codigo}</small>:null}<b>{fila.concepto}</b></td><td className="amount">{dinero.format(fila.actual)}</td>{reporte.columnas.length>2?<td className="amount">{dinero.format(fila.anterior??0)}</td>:null}{reporte.columnas.length>3?<td className={(fila.variacion??0)<0?"amount negative":"amount positive"}>{dinero.format(fila.variacion??0)}</td>:null}</tr>)}</tbody></table></div><footer><span>Generado: {new Date(reporte.generadoEn).toLocaleString("es-NI")}</span><span>{reporte.filas.length} líneas</span></footer></>:<div className="emptyReport">Seleccione un reporte para generarlo.</div>}</section></section></>;
}

function PeriodoControl({label,value,onChange,granularidad}:{label:string;value:string;onChange:(value:string)=>void;granularidad:Granularidad}){
  const common={value,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>onChange(event.target.value)};
  const years = Array.from({ length: 7 }, (_, index) => currentYear() - index);
  return <label className="periodControl"><span>{label}</span>{granularidad==="dia"?<input type="date" min="2000-01-01" max="2100-12-31" {...common}/>:granularidad==="mes"?<input type="month" min="2000-01" max="2100-12" {...common}/>:granularidad==="trimestre"?<select {...common}>{years.flatMap(year=>[1,2,3,4].map(q=><option key={`${year}-T${q}`} value={`${year}-T${q}`}>Trimestre {q} · {year}</option>))}</select>:<select {...common}>{years.map(year=><option key={year} value={String(year)}>Año {year}</option>)}</select>}<small>{value}</small></label>;
}

const estadoLineaClass = (estado: LineaBanco["estadoConciliacion"]) => estado === "conciliada" ? "status done" : estado === "descartada" ? "status danger" : "status pending";
const estadoConciliacionClass = (estado: Conciliacion["estado"]) => estado === "aprobada" ? "status done" : estado === "rechazada" ? "status danger" : "status pending";
const netoLinea = (linea: LineaBanco) => Number(linea.credito) - Number(linea.debito);

function ConciliacionBancaria({ canReconcile, canApprove, notify, requestConfirmation }: { canReconcile: boolean; canApprove: boolean; notify: (message: string) => void; requestConfirmation: RequestConfirmation }) {
  const [conciliaciones, setConciliaciones] = useState<Conciliacion[]>([]);
  const [disponibles, setDisponibles] = useState<ReporteDisponible[]>([]);
  const [seleccionada, setSeleccionada] = useState("");
  const [detalle, setDetalle] = useState<{ conciliacion: Conciliacion; lineas: LineaConciliacion[]; movimientos: MovimientoConciliable[] } | null>(null);
  const [reporteNuevo, setReporteNuevo] = useState("");
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarLista() {
    setLoading(true);
    try {
      const response = await fetch("/api/conciliaciones");
      const data = await response.json().catch(() => ({})) as { conciliaciones?: Conciliacion[]; reportesDisponibles?: ReporteDisponible[]; error?: string };
      if (!response.ok) return setError(data.error ?? "No se pudo cargar el historial de conciliaciones");
      setConciliaciones(data.conciliaciones ?? []);
      setDisponibles(data.reportesDisponibles ?? []);
      setError("");
    } catch {
      setError("No se pudo conectar con el servicio de conciliaciones");
    } finally { setLoading(false); }
  }

  async function cargarDetalle(id: string) {
    setSeleccionada(id); setDetalle(null); setEnlaces({}); setObservaciones("");
    try {
      const response = await fetch(`/api/conciliaciones/${id}`);
      const data = await response.json().catch(() => ({})) as { conciliacion?: Conciliacion; lineas?: LineaConciliacion[]; movimientos?: MovimientoConciliable[]; error?: string };
      if (!response.ok || !data.conciliacion) return setError(data.error ?? "No se pudo cargar la conciliación");
      setDetalle({ conciliacion: data.conciliacion, lineas: data.lineas ?? [], movimientos: data.movimientos ?? [] });
      setError("");
    } catch { setError("No se pudo conectar con el servicio de conciliaciones"); }
  }

  useEffect(() => { void Promise.resolve().then(cargarLista); }, []);

  async function generar() {
    if (!reporteNuevo) return setError("Seleccione un estado de cuenta procesado");
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/conciliaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporteId: reporteNuevo }),
      });
      const result = await response.json().catch(() => ({})) as { conciliacion?: Conciliacion; enlazadasAutomaticamente?: number; error?: string };
      if (!response.ok || !result.conciliacion) return setError(result.error ?? "No se pudo generar la conciliación");
      setReporteNuevo("");
      await cargarLista();
      await cargarDetalle(result.conciliacion.id);
      notify(`Conciliación generada: ${result.enlazadasAutomaticamente ?? 0} líneas enlazadas automáticamente`);
    } finally { setSaving(false); }
  }

  async function accionLinea(accion: "conciliar" | "descartar" | "reabrir", linea: LineaConciliacion) {
    if (!detalle) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/conciliaciones/${detalle.conciliacion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, lineaId: linea.id, movimientoId: accion === "conciliar" ? enlaces[linea.id] : undefined }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setError(result.error ?? "No se pudo actualizar la línea");
      await cargarDetalle(detalle.conciliacion.id);
      await cargarLista();
      notify(accion === "conciliar" ? "Línea enlazada con el movimiento contable" : accion === "descartar" ? "Línea descartada de la conciliación" : "Línea devuelta a pendiente");
    } finally { setSaving(false); }
  }

  function revisar(accion: "aprobar" | "rechazar") {
    if (!detalle) return;
    if (accion === "rechazar" && !observaciones.trim()) return setError("Indique el motivo del rechazo en las observaciones");
    requestConfirmation({
      title: accion === "aprobar" ? "Aprobar conciliación bancaria" : "Rechazar conciliación bancaria",
      message: accion === "aprobar"
        ? `Se aprobará la conciliación del período ${detalle.conciliacion.periodo} para la cuenta ${detalle.conciliacion.cuentaBancariaNombre ?? detalle.conciliacion.cuentaBancariaNumero}. La conciliación quedará cerrada y auditada.`
        : `Se rechazará la conciliación del período ${detalle.conciliacion.periodo}. El motivo quedará registrado en la auditoría del sistema.`,
      confirmLabel: accion === "aprobar" ? "Aprobar" : "Rechazar",
      isDanger: accion === "rechazar",
      onConfirm: async () => {
        const response = await fetch(`/api/conciliaciones/${detalle.conciliacion.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion, observaciones: observaciones.trim() || undefined }),
        });
        const result = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) return setError(result.error ?? "No se pudo revisar la conciliación");
        await cargarDetalle(detalle.conciliacion.id);
        await cargarLista();
        notify(accion === "aprobar" ? "Conciliación aprobada" : "Conciliación rechazada");
      },
    });
  }

  const conciliacion = detalle?.conciliacion;
  const editable = Boolean(conciliacion && conciliacion.estado === "borrador" && canReconcile);
  const disponiblesMovimientos = (detalle?.movimientos ?? []).filter(movimiento => !movimiento.lineaId);

  return <><div className="pageHead"><div><span className="eyebrow">CONCILIACIÓN</span><h1>Conciliación bancaria</h1><p>Enlace cada movimiento del estado de cuenta con las minutas registradas y cierre el período con aprobación.</p></div></div>
    {error ? <div className="authError adminError">{error}</div> : null}
    {canReconcile ? <section className="panel uploadPanel">
      <div><h2>Generar conciliación</h2><p>Al generarla, el sistema enlaza automáticamente las líneas con una única minuta coincidente por monto y fecha.</p></div>
      <label className="uploadField">Estado de cuenta procesado<select value={reporteNuevo} onChange={event => setReporteNuevo(event.target.value)} disabled={!disponibles.length}><option value="" disabled>{disponibles.length ? "Seleccione un estado de cuenta" : "No hay estados de cuenta pendientes de conciliar"}</option>{disponibles.map(reporte => <option key={reporte.id} value={reporte.id}>{reporte.nombre} · {reporte.cuentaBancariaNumero} · {reporte.totalLineas} líneas</option>)}</select></label>
      <button className="primary" type="button" onClick={generar} disabled={saving || !reporteNuevo}>{saving ? "Generando…" : "Generar conciliación"}</button>
    </section> : <div className="readOnlyBanner">Acceso de solo lectura: puede consultar conciliaciones, pero no modificarlas.</div>}
    <section className="panel tablePanel">
      <div className="panelHead"><div><h2>Conciliaciones registradas</h2><p>{loading ? "Cargando desde PostgreSQL" : `${conciliaciones.length} conciliaciones`}</p></div><button onClick={cargarLista}>Actualizar</button></div>
      <div className="tableWrap"><table><thead><tr><th>PERÍODO</th><th>CUENTA</th><th>ESTADO DE CUENTA</th><th>NETO BANCO</th><th>CONCILIADO</th><th>PENDIENTE</th><th>LÍNEAS</th><th>ESTADO</th><th/></tr></thead><tbody>{conciliaciones.map(item => <tr key={item.id}>
        <td><b>{item.periodo}</b><small>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</small></td>
        <td>{item.cuentaBancariaNombre ?? item.cuentaBancariaNumero}</td>
        <td>{item.reporteNombre ?? "-"}</td>
        <td className="amount">{dinero.format(Number(item.totalBanco))}</td>
        <td className="amount">{dinero.format(Number(item.totalConciliado))}</td>
        <td className={Math.abs(Number(item.totalPendiente)) < 0.01 ? "amount positive" : "amount negative"}>{dinero.format(Number(item.totalPendiente))}</td>
        <td>{item.lineasConciliadas} de {item.lineasConciliadas + item.lineasPendientes}</td>
        <td><span className={estadoConciliacionClass(item.estado)}>{item.estado}</span></td>
        <td><button className="linkButton" type="button" onClick={() => cargarDetalle(item.id)}>{seleccionada === item.id ? "Actualizar" : "Abrir"}</button></td>
      </tr>)}</tbody></table></div>
      {!loading && !conciliaciones.length ? <div className="emptyReport">Todavía no hay conciliaciones. Procese un estado de cuenta y genere la primera conciliación.</div> : null}
    </section>
    {conciliacion ? <>
      <section className="metrics compactMetrics">
        <article className="metric featured"><p>Neto del banco</p><strong>{dinero.format(Number(conciliacion.totalBanco))}</strong><span className={estadoConciliacionClass(conciliacion.estado)}>{conciliacion.estado}</span></article>
        <article className="metric"><p>Conciliado con libros</p><strong>{dinero.format(Number(conciliacion.totalConciliado))}</strong><small>{conciliacion.lineasConciliadas} líneas enlazadas</small></article>
        <article className="metric"><p>Diferencia pendiente</p><strong className={Math.abs(Number(conciliacion.totalPendiente)) < 0.01 ? "positive" : "negative"}>{dinero.format(Number(conciliacion.totalPendiente))}</strong><small>{conciliacion.lineasPendientes} líneas sin resolver</small></article>
        <article className="metric"><p>Minutas sin respaldo bancario</p><strong>{conciliacion.movimientosSinConciliar}</strong><small>Registradas en libros y ausentes del estado de cuenta</small></article>
      </section>
      <section className="panel tablePanel">
        <div className="panelHead">
          <div><h2>Detalle de la conciliación</h2><p>{conciliacion.reporteNombre} · cuenta {conciliacion.cuentaBancariaNombre ?? conciliacion.cuentaBancariaNumero} · período {conciliacion.periodo}</p></div>
          {canApprove && conciliacion.estado === "borrador" ? <div className="reviewActions"><label>Observaciones<textarea value={observaciones} onChange={event => setObservaciones(event.target.value)} rows={2} placeholder="Obligatorias para rechazar"/></label><div className="reportActions"><button className="secondary" type="button" onClick={() => revisar("rechazar")}>Rechazar</button><button className="primary" type="button" onClick={() => revisar("aprobar")} disabled={conciliacion.lineasPendientes > 0}>Aprobar conciliación</button></div></div> : null}
        </div>
        {conciliacion.estado !== "borrador" ? <div className="readOnlyBanner">Conciliación {conciliacion.estado} por {conciliacion.revisadoPorNombre ?? "revisor no registrado"}{conciliacion.revisadoEn ? ` el ${new Date(conciliacion.revisadoEn).toLocaleString("es-NI")}` : ""}.{conciliacion.observaciones ? ` Observaciones: ${conciliacion.observaciones}` : ""}</div> : null}
        {conciliacion.estado === "borrador" && conciliacion.lineasPendientes > 0 && canApprove ? <div className="readOnlyBanner">Para aprobar debe enlazar o descartar las {conciliacion.lineasPendientes} líneas pendientes.</div> : null}
        <div className="tableWrap"><table><thead><tr><th>#</th><th>FECHA</th><th>DESCRIPCIÓN</th><th>MONTO</th><th>ESTADO</th><th>MOVIMIENTO CONTABLE</th></tr></thead><tbody>{(detalle?.lineas ?? []).map(linea => <tr key={linea.id}>
          <td>{linea.numeroLinea}</td>
          <td>{linea.fecha ?? "Sin fecha"}</td>
          <td><b>{linea.descripcion}</b>{linea.referencia ? <small>Ref. {linea.referencia}</small> : null}</td>
          <td className={netoLinea(linea) < 0 ? "amount negative" : "amount positive"}>{dinero.format(netoLinea(linea))}</td>
          <td><span className={estadoLineaClass(linea.estadoConciliacion)}>{linea.estadoConciliacion}</span></td>
          <td>{linea.movimiento
            ? <div className="matchCell"><b>{linea.movimiento.concepto}</b><small>{linea.movimiento.fecha} · {dinero.format(linea.movimiento.monto)}</small>{editable ? <button className="linkButton" type="button" onClick={() => accionLinea("reabrir", linea)} disabled={saving}>Deshacer enlace</button> : null}</div>
            : editable
              ? <div className="matchCell">
                  <select value={enlaces[linea.id] ?? ""} onChange={event => setEnlaces(current => ({ ...current, [linea.id]: event.target.value }))} disabled={!disponiblesMovimientos.length}>
                    <option value="">{disponiblesMovimientos.length ? "Seleccione un movimiento" : "Sin minutas disponibles en el período"}</option>
                    {disponiblesMovimientos.map(movimiento => <option key={movimiento.id} value={movimiento.id}>{movimiento.fecha} · {dinero.format(movimiento.monto)} · {movimiento.concepto}{Math.abs(movimiento.monto - Math.abs(netoLinea(linea))) < 0.01 ? " · monto coincide" : ""}</option>)}
                  </select>
                  <div className="matchActions">
                    <button className="linkButton" type="button" onClick={() => accionLinea("conciliar", linea)} disabled={saving || !enlaces[linea.id]}>Enlazar</button>
                    {linea.estadoConciliacion === "pendiente"
                      ? <button className="linkButton" type="button" onClick={() => accionLinea("descartar", linea)} disabled={saving}>Descartar</button>
                      : <button className="linkButton" type="button" onClick={() => accionLinea("reabrir", linea)} disabled={saving}>Reabrir</button>}
                  </div>
                </div>
              : <small>{linea.estadoConciliacion === "descartada" ? "Descartada sin enlace contable" : "Sin movimiento enlazado"}</small>}</td>
        </tr>)}</tbody></table></div>
      </section>
      {disponiblesMovimientos.length ? <section className="panel tablePanel">
        <div className="panelHead"><div><h2>Minutas sin respaldo bancario</h2><p>Movimientos registrados en libros sobre esta cuenta que no aparecen enlazados</p></div></div>
        <div className="tableWrap"><table><thead><tr><th>FECHA</th><th>CONCEPTO</th><th>REFERENCIA</th><th>MONTO</th></tr></thead><tbody>{disponiblesMovimientos.map(movimiento => <tr key={movimiento.id}>
          <td>{movimiento.fecha}</td>
          <td>{movimiento.concepto}</td>
          <td>{movimiento.referencia ?? "Sin referencia"}</td>
          <td className="amount">{dinero.format(movimiento.monto)}</td>
        </tr>)}</tbody></table></div>
      </section> : null}
    </> : null}
  </>;
}

function ConfiguracionInstitucional({ config, onSaved, notify }: { config: ConfiguracionSistema; onSaved: (config: ConfiguracionSistema) => void; notify: (message: string) => void }) {
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

function Minutas({ notify }: { notify: (message: string) => void }) {
  const [movimientos, setMovimientos] = useState<MovimientoRegistrado[]>([]);
  const [detalles, setDetalles] = useState<DetalleRegistrado[]>([]);
  const [iglesias, setIglesias] = useState<Iglesia[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "registrado" | "anulado">("todos");
  const [anulando, setAnulando] = useState<MovimientoRegistrado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargarMinutas() {
    setLoading(true);
    try {
      const response = await fetch("/api/movimientos");
      const data = await response.json().catch(() => ({})) as { movimientos?: MovimientoRegistrado[]; detalles?: DetalleRegistrado[]; error?: string };
      if (!response.ok) return setError(data.error ?? `No se pudo cargar el historial de minutas (HTTP ${response.status})`);
      setMovimientos(data.movimientos ?? []);
      setDetalles(data.detalles ?? []);
      setError("");
    } catch {
      setError("No se pudo conectar con el servicio de movimientos");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void Promise.resolve().then(cargarMinutas);
    fetch("/api/iglesias").then(async response => { if (response.ok) setIglesias((await response.json()).iglesias ?? []); }).catch(() => undefined);
    fetch("/api/cuentas-bancarias").then(async response => { if (response.ok) setCuentasBancarias((await response.json()).cuentasBancarias ?? []); }).catch(() => undefined);
  }, []);

  async function anular() {
    if (!anulando) return;
    if (motivo.trim().length < 10) return setError("Indique el motivo de la anulación con al menos 10 caracteres");
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/movimientos/${anulando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "anulado", motivo: motivo.trim() }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return setError(result.error ?? "No se pudo anular la minuta");
      setAnulando(null); setMotivo("");
      await cargarMinutas();
      notify("Minuta anulada y registrada en auditoría");
    } catch {
      setError("No se pudo conectar con el servicio de movimientos");
    } finally { setSaving(false); }
  }

  const nombreIglesia = (codigo: string | null) => iglesias.find(iglesia => iglesia.codigo === codigo)?.nombre ?? codigo ?? "Sin iglesia";
  const nombreCuenta = (numero: string | null) => cuentasBancarias.find(cuenta => cuenta.numeroCuenta === numero)?.nombre ?? numero ?? "Sin cuenta";
  const lineasDe = (movimientoId: string) => detalles.filter(detalle => detalle.movimientoId === movimientoId);
  const totalDe = (movimientoId: string) => lineasDe(movimientoId).filter(detalle => detalle.tipo === "debito").reduce((total, detalle) => total + Number(detalle.monto), 0);
  const visibles = movimientos.filter(movimiento => filtro === "todos" || movimiento.estado === filtro);
  const registradas = movimientos.filter(movimiento => movimiento.estado === "registrado");

  return <><div className="pageHead"><div><span className="eyebrow">CONTABILIDAD</span><h1>Minutas registradas</h1><p>Consulte los asientos guardados y anule los que sean incorrectos sin borrar su detalle contable.</p></div></div>
    <section className="metrics compactMetrics">
      <article className="metric featured"><p>Minutas consultadas</p><strong>{loading ? "..." : movimientos.length}</strong><small>Últimos 100 asientos registrados</small></article>
      <article className="metric"><p>Vigentes</p><strong>{loading ? "..." : registradas.length}</strong><small>{movimientos.length - registradas.length} anuladas</small></article>
      <article className="metric"><p>Monto vigente</p><strong>{dinero.format(registradas.reduce((total, movimiento) => total + totalDe(movimiento.id), 0))}</strong><small>Suma de débitos de minutas vigentes</small></article>
      <article className="metric"><p>Enlazadas a conciliación</p><strong>{movimientos.filter(movimiento => movimiento.enlazadoAConciliacion).length}</strong><small>No se pueden anular sin deshacer el enlace</small></article>
    </section>
    {error ? <div className="authError adminError">{error}</div> : null}
    {anulando ? <section className="panel formPanel annulPanel">
      <div className="panelHead compact"><div><h2>Anular minuta del {anulando.fecha}</h2><p>{anulando.concepto} · {dinero.format(totalDe(anulando.id))} · {nombreIglesia(anulando.iglesiaCodigo)}</p></div></div>
      <div className="tableWrap"><table><thead><tr><th>TIPO</th><th>CUENTA</th><th>MONTO</th></tr></thead><tbody>{lineasDe(anulando.id).map(linea => <tr key={linea.id}>
        <td>{linea.tipo === "debito" ? "Débito" : "Crédito"}</td>
        <td><b>{linea.cuentaCodigo}</b> {linea.cuentaNombre}</td>
        <td className="amount">{dinero.format(Number(linea.monto))}</td>
      </tr>)}</tbody></table></div>
      <div className="readOnlyBanner">El asiento y sus líneas se conservan en la base de datos; solo cambia el estado a anulado y queda registrado en auditoría con su motivo.</div>
      <div className="formGrid"><label className="wide">Motivo de la anulación<textarea value={motivo} onChange={event => setMotivo(event.target.value)} rows={2} required minLength={10}/></label></div>
      <div className="formActions">
        <button className="secondary" type="button" onClick={() => { setAnulando(null); setMotivo(""); setError(""); }} disabled={saving}>Cancelar</button>
        <button className="primary" type="button" onClick={anular} disabled={saving || motivo.trim().length < 10}>{saving ? "Anulando…" : "Confirmar anulación"}</button>
      </div>
    </section> : null}
    <section className="panel tablePanel">
      <div className="panelHead">
        <div><h2>Historial de minutas</h2><p>{loading ? "Cargando desde PostgreSQL" : `${visibles.length} de ${movimientos.length} asientos`}</p></div>
        <div className="granularity" role="group" aria-label="Filtrar por estado">{(["todos", "registrado", "anulado"] as const).map(item => <button key={item} className={filtro === item ? "active" : ""} type="button" onClick={() => setFiltro(item)}>{item === "todos" ? "Todas" : item === "registrado" ? "Vigentes" : "Anuladas"}</button>)}</div>
      </div>
      <div className="tableWrap"><table><thead><tr><th>FECHA</th><th>CONCEPTO</th><th>IGLESIA</th><th>CUENTA BANCARIA</th><th>REFERENCIA</th><th>MONTO</th><th>ESTADO</th><th/></tr></thead><tbody>{visibles.map(movimiento => <tr key={movimiento.id}>
        <td>{movimiento.fecha}</td>
        <td><b>{movimiento.concepto}</b><small>{lineasDe(movimiento.id).length} líneas contables</small></td>
        <td>{nombreIglesia(movimiento.iglesiaCodigo)}</td>
        <td>{nombreCuenta(movimiento.cuentaBancariaNumero)}</td>
        <td>{movimiento.referencia ?? "Sin referencia"}</td>
        <td className="amount">{dinero.format(totalDe(movimiento.id))}</td>
        <td><span className={movimiento.estado === "registrado" ? "status done" : "status danger"}>{movimiento.estado}</span></td>
        <td>{movimiento.estado === "registrado"
          ? movimiento.enlazadoAConciliacion
            ? <small>Enlazada a conciliación</small>
            : <button className="linkButton" type="button" onClick={() => { setAnulando(movimiento); setMotivo(""); setError(""); }}>Anular</button>
          : null}</td>
      </tr>)}</tbody></table></div>
      {!loading && !visibles.length ? <div className="emptyReport">{movimientos.length ? "Ninguna minuta coincide con el filtro seleccionado." : "Todavía no hay minutas registradas."}</div> : null}
    </section>
  </>;
}
