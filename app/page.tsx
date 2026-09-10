"use client";

import { type FormEvent, lazy, Suspense, useEffect, useRef, useState } from "react";
import ConfirmModal from "./components/ConfirmModal";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import { defaultConfig, menu, nombresRol, type ConfiguracionSistema, type ModalState, type Permiso, type RequestConfirmation, type User } from "./shared";

const Resumen = lazy(() => import("./modules/Resumen"));
const UsuariosAdmin = lazy(() => import("./modules/UsuariosAdmin"));
const Movimiento = lazy(() => import("./modules/Movimiento"));
const Minutas = lazy(() => import("./modules/Minutas"));
const CatalogoContable = lazy(() => import("./modules/CatalogoContable"));
const IglesiasAdmin = lazy(() => import("./modules/IglesiasAdmin"));
const Bancos = lazy(() => import("./modules/Bancos"));
const ConciliacionBancaria = lazy(() => import("./modules/ConciliacionBancaria"));
const Importaciones = lazy(() => import("./modules/Importaciones"));
const Reportes = lazy(() => import("./modules/Reportes"));
const Auditoria = lazy(() => import("./modules/Auditoria"));
const ConfiguracionInstitucional = lazy(() => import("./modules/ConfiguracionInstitucional"));
const CierreContable = lazy(() => import("./modules/CierreContable"));
const ModuleFallback = lazy(() => import("./modules/ModuleFallback"));

function ModuleLoading() {
  return <div className="reportLoadingOverlay moduleLoading" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/><span className="loadingText">CARGANDO MÓDULO</span></div>;
}

function PasswordChangeRequired({ user, config, onChanged, logout }: { user: User; config: ConfiguracionSistema; onChanged: () => Promise<void>; logout: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const nueva = String(form.get("nueva") ?? "");
    const confirmar = String(form.get("confirmar") ?? "");
    if (nueva !== confirmar) {
      setSaving(false);
      return setError("La confirmación no coincide con la nueva contraseña");
    }
    const response = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual: form.get("actual"), nueva }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error ?? "No se pudo cambiar la contraseña");
    await onChanged();
  }

  return <main className="authScreen"><section className="authCard"><div className="authBrand institutional"><span className="authLogo" style={{ backgroundImage: `url(${config.logoLogin})` }} role="img" aria-label={config.institucionNombre}/><div><b>{config.sistemaNombre}</b><small>{config.institucionNombre}</small></div></div><span className="eyebrow">ACCESO SEGURO</span><h1>Cambiar contraseña</h1><p>{user.nombre}, debe establecer una contraseña nueva antes de continuar.</p><form onSubmit={submit}><label>Contraseña actual<input name="actual" type="password" autoComplete="current-password" required placeholder="Contraseña actual"/></label><label>Nueva contraseña<input name="nueva" type="password" autoComplete="new-password" required minLength={12} placeholder="Mínimo 12 caracteres"/></label><label>Confirmar nueva contraseña<input name="confirmar" type="password" autoComplete="new-password" required minLength={12} placeholder="Repita la nueva contraseña"/></label>{error ? <div className="authError" role="alert">{error}</div> : null}<button className="primary" type="submit" disabled={saving}>{saving ? "Guardando..." : "Cambiar contraseña"}</button><button className="linkButton" type="button" onClick={logout}>Cerrar sesión</button></form></section></main>;
}

const moduleSlug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const moduleFromHash = (allowedNames: string[]) => {
  if (typeof window === "undefined") return null;
  const currentSlug = window.location.hash.replace(/^#/, "");
  return allowedNames.find(name => moduleSlug(name) === currentSlug) ?? null;
};
const allowedNamesForUser = (currentUser: User) => menu.filter(item => currentUser.permisos.includes(item.permiso)).map(item => item.nombre);
const defaultModuleForUser = (currentUser: User) => currentUser.rol === "administrador" ? "Usuarios" : currentUser.rol === "operador_bancario" ? "Bancos" : currentUser.rol === "auditor_general" ? "Auditoría" : "Resumen";

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

  const can = (permission: Permiso) => Boolean(user?.permisos.includes(permission));
  const setActiveModule = (value: string) => {
    setActive(value);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${moduleSlug(value)}`);
  };

  useEffect(() => { fetch("/api/auth/me").then(async response => { if (response.ok) { const currentUser = (await response.json()).user as User; setUser(currentUser); setActive(moduleFromHash(allowedNamesForUser(currentUser)) ?? defaultModuleForUser(currentUser)); } }).finally(() => setChecking(false)); }, []);
  useEffect(() => { fetch("/api/configuracion").then(async response => { if (response.ok) setConfig((await response.json()).configuracion ?? defaultConfig); }).catch(() => setConfig(defaultConfig)); }, []);
  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);
  const notify = (message: string) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3600);
  };
  const requestConfirmation: RequestConfirmation = nextModal => setModal(nextModal);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: form.get("usuario"), password: form.get("password") }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error);
    setUser(result.user);
    setActiveModule(moduleFromHash(allowedNamesForUser(result.user)) ?? defaultModuleForUser(result.user));
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); setActiveModule("Resumen"); }
  async function refreshSession() {
    const response = await fetch("/api/auth/me");
    if (!response.ok) { setUser(null); return; }
    const currentUser = (await response.json()).user as User;
    setUser(currentUser);
    setActiveModule(moduleFromHash(allowedNamesForUser(currentUser)) ?? defaultModuleForUser(currentUser));
  }
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

  function renderModule(currentUser: User) {
    switch (active) {
      case "Resumen": return <Resumen user={currentUser} setActive={setActiveModule}/>;
      case "Usuarios": return <UsuariosAdmin notify={notify}/>;
      case "Registrar movimiento": return <Movimiento notify={notify} requestConfirmation={requestConfirmation}/>;
      case "Minutas": return <Minutas notify={notify}/>;
      case "Catálogo contable": return <CatalogoContable notify={notify} requestConfirmation={requestConfirmation}/>;
      case "Iglesias": return <IglesiasAdmin notify={notify} requestConfirmation={requestConfirmation}/>;
      case "Bancos": return <Bancos canUpload={can("banco:cargar")} canManageAccounts={can("catalogo:administrar")} notify={notify} requestConfirmation={requestConfirmation}/>;
      case "Conciliación": return <ConciliacionBancaria canReconcile={can("conciliacion:gestionar")} canApprove={can("conciliacion:aprobar")} notify={notify} requestConfirmation={requestConfirmation}/>;
      case "Importaciones": return <Importaciones notify={notify}/>;
      case "Reportes": return <Reportes canDownload={can("reportes:descargar")}/>;
      case "Auditoría": return <Auditoria/>;
      case "Cierre contable": return <CierreContable notify={notify} requestConfirmation={requestConfirmation}/>;
      case "Configuración": return <ConfiguracionInstitucional config={config} onSaved={setConfig} notify={notify}/>;
      default: return <ModuleFallback nombre={active} user={currentUser}/>;
    }
  }

  if (checking) return <main className="authScreen"><div className="authCard"><b>Validando sesión…</b></div></main>;
  if (!user) return <Login onSubmit={login} error={error} config={config}/>;
  if (user.debeCambiarPassword) return <PasswordChangeRequired user={user} config={config} onChanged={refreshSession} logout={logout}/>;
  const allowedMenu = menu.filter(item => can(item.permiso));

  return <main className="shell">
    <Sidebar user={user} active={active} allowedMenu={allowedMenu} setActive={setActiveModule} logout={() => requestConfirmation({ title: "Cerrar sesión segura", message: "Se cerrará la sesión actual y deberá autenticarse nuevamente para continuar.", confirmLabel: "Cerrar sesión", onConfirm: logout })} config={config}/>
    <section className="workspace"><header className="topbar"><div><p>{config.sistemaDescripcion}</p><span>Sesión protegida · {nombresRol[user.rol]} · {config.institucionNombre}</span></div>{can("movimientos:escribir") ? <button className="primary" onClick={() => setActiveModule("Registrar movimiento")}>Nuevo movimiento</button> : null}</header><div className="content"><Suspense key={active} fallback={<ModuleLoading/>}>{renderModule(user)}</Suspense></div></section>
    {notice ? <div className="toast" role="status" aria-live="polite"><span className="toastIcon" aria-hidden="true">✓</span><span>{notice}</span></div> : null}
    {modal ? <ConfirmModal modal={modal} busy={modalBusy} onCancel={() => { if (!modalBusy) setModal(null); }} onConfirm={confirmModal}/> : null}
  </main>;
}
