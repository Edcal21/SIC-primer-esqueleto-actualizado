"use client";

import { FormEvent, useEffect, useState } from "react";

type Permiso = "panel:ver" | "usuarios:administrar" | "roles:administrar" | "movimientos:escribir" | "catalogo:administrar" | "banco:ver" | "banco:cargar" | "conciliacion:aprobar" | "importaciones:administrar" | "reportes:ver" | "reportes:descargar" | "auditoria:ver";
type User = { id: string; usuario: string; nombre: string; rol: "administrador" | "contador_general" | "operador_bancario" | "auditor_general"; permisos: Permiso[] };
type Reporte = { id: string; nombre: string; fecha: string; estado: string; cargadoPor: string };
type Evento = { fecha: string; usuario: string; accion: string; resultado: string };
type TipoReporte = "flujo-efectivo" | "balanza-anual" | "cambio-patrimonio" | "situacion-comparativa" | "resultado-comparativo";
type Granularidad = "dia" | "mes" | "trimestre" | "anio";
type ReporteFinanciero = { tipo:TipoReporte; titulo:string; descripcion:string; periodo:number; periodoComparativo?:number; periodoEtiqueta?:string; comparativoEtiqueta?:string; granularidad?:Granularidad; moneda:"NIO"; fuente:string; columnas:string[]; filas:{concepto:string;codigo?:string;actual:number;anterior?:number;variacion?:number;esTotal?:boolean}[]; generadoEn:string };

const nombresRol = { administrador: "Administrador", contador_general: "Contador general", operador_bancario: "Operador bancario", auditor_general: "Auditor general" };
const menu = [
  { nombre: "Resumen", permiso: "panel:ver" as Permiso, icono: "⌂" },
  { nombre: "Usuarios", permiso: "usuarios:administrar" as Permiso, icono: "◉" },
  { nombre: "Registrar movimiento", permiso: "movimientos:escribir" as Permiso, icono: "＋" },
  { nombre: "Catálogo contable", permiso: "catalogo:administrar" as Permiso, icono: "☷" },
  { nombre: "Bancos", permiso: "banco:ver" as Permiso, icono: "⇄" },
  { nombre: "Importaciones", permiso: "importaciones:administrar" as Permiso, icono: "⇧" },
  { nombre: "Reportes", permiso: "reportes:ver" as Permiso, icono: "▤" },
  { nombre: "Auditoría", permiso: "auditoria:ver" as Permiso, icono: "◎" },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [active, setActive] = useState("Resumen");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { fetch("/api/auth/me").then(async response => { if (response.ok) setUser((await response.json()).user); }).finally(() => setChecking(false)); }, []);
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
  if (!user) return <Login onSubmit={login} error={error} />;
  const allowedMenu = menu.filter(item => can(item.permiso));

  return <main className="shell">
    <aside className="sidebar"><div className="brand"><span className="brandMark">S</span><div><b>SIC</b><small>Sistema contable</small></div></div><nav aria-label="Navegación principal"><p className="navLabel">MÓDULOS AUTORIZADOS</p>{allowedMenu.map(item=><button key={item.nombre} className={active===item.nombre?"navItem active":"navItem"} onClick={()=>setActive(item.nombre)}><span>{item.icono}</span>{item.nombre}</button>)}</nav><div className="sidebarFoot"><span className="avatar">{user.nombre.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><div><b>{user.nombre}</b><small>{nombresRol[user.rol]}</small></div><button aria-label="Cerrar sesión" onClick={logout}>↪</button></div></aside>
    <section className="workspace"><header className="topbar"><div><p>Sistema de Información Contable</p><span>Sesión protegida · {nombresRol[user.rol]}</span></div>{can("movimientos:escribir") ? <button className="primary" onClick={()=>setActive("Registrar movimiento")}>＋ Nuevo movimiento</button> : null}</header><div className="content">{active === "Bancos" ? <Bancos canUpload={can("banco:cargar")} notify={notify}/> : active === "Auditoría" ? <Auditoria/> : active === "Reportes" ? <Reportes canDownload={can("reportes:descargar")}/> : active === "Registrar movimiento" ? <Movimiento notify={notify}/> : <Modulo nombre={active} user={user}/>}</div></section>
    {notice ? <div className="toast">✓ {notice}</div> : null}
  </main>;
}

function Login({ onSubmit, error }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string }) {
  return <main className="authScreen"><section className="authCard"><div className="authBrand"><span className="brandMark">S</span><div><b>SIC</b><small>Sistema de Información Contable</small></div></div><span className="eyebrow">ACCESO SEGURO</span><h1>Iniciar sesión</h1><p>Ingrese con el usuario asignado a su función.</p><form onSubmit={onSubmit}><label>Usuario<input name="usuario" autoComplete="username" required placeholder="administrador, contador, banco o auditor"/></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required placeholder="••••••••••"/></label>{error ? <div className="authError" role="alert">{error}</div> : null}<button className="primary" type="submit">Ingresar al SIC</button></form><div className="demoUsers"><b>Usuarios iniciales</b><span>administrador / Admin2026!</span><span>contador / Conta2026!</span><span>banco / Banco2026!</span><span>auditor / Audit2026!</span></div></section></main>;
}

function Modulo({ nombre, user }: { nombre: string; user: User }) {
  const textos: Record<string, [string,string]> = { Resumen:["Panel general",`Vista operativa para ${nombresRol[user.rol]}.`], Usuarios:["Administración de usuarios","Control de usuarios, roles y perfiles del sistema."], "Catálogo contable":["Catálogo contable","Administración de cuentas y estructura jerárquica."], Importaciones:["Importaciones contables","Carga de catálogo, balanza y auxiliares."], Reportes:["Centro de reportes","Consulta de estados financieros autorizados."] };
  const [title, description] = textos[nombre] ?? [nombre,"Módulo autorizado para su perfil."];
  return <><div className="pageHead"><div><span className="eyebrow">{nombresRol[user.rol].toUpperCase()}</span><h1>{title}</h1><p>{description}</p></div></div><section className="metrics"><article className="metric featured"><p>Rol activo</p><strong>{nombresRol[user.rol]}</strong><span className="pill ready">Sesión válida</span></article><article className="metric"><p>Módulos disponibles</p><strong>{menu.filter(item=>user.permisos.includes(item.permiso)).length}</strong><small>Según permisos</small></article><article className="metric"><p>Conciliación bancaria</p><strong>94.7%</strong><div className="progress"><i style={{width:"94.7%"}}/></div></article><article className="metric"><p>Período</p><strong>Junio 2026</strong><span className="pill ready">Abierto</span></article></section></>;
}

function Movimiento({ notify }: { notify: (message: string) => void }) { return <><div className="pageHead"><div><span className="eyebrow">CONTABILIDAD</span><h1>Registrar movimiento</h1><p>Esta vista solo existe para el Contador general.</p></div></div><section className="panel formPanel"><div className="formGrid"><label>Fecha<input type="date" defaultValue="2026-06-26"/></label><label>Tipo<select><option>Ingreso</option><option>Egreso</option></select></label><label className="wide">Cuenta<select><option>11010201 · BAC Credomatic</option><option>41010101 · Ofrendas recibidas</option></select></label><label>Referencia<input placeholder="Número de minuta"/></label><label>Monto C$<input type="number" min="0" step="0.01"/></label><label className="wide">Concepto<textarea/></label></div><div className="formActions"><button className="primary" onClick={()=>notify("Movimiento validado")}>Guardar movimiento</button></div></section></> }

function Bancos({ canUpload, notify }: { canUpload: boolean; notify: (message: string) => void }) {
  const [reportes, setReportes] = useState<Reporte[]>([]); const [file, setFile] = useState<File | null>(null); const [error,setError]=useState("");
  useEffect(()=>{ fetch("/api/banco/reportes").then(r=>r.json()).then(data=>setReportes(data.reportes??[])); },[]);
  async function upload(){ if(!file) return setError("Seleccione un archivo CSV o Excel"); const form=new FormData(); form.append("archivo",file); const response=await fetch("/api/banco/reportes",{method:"POST",body:form}); const result=await response.json(); if(!response.ok)return setError(result.error); setReportes(current=>[result.reporte,...current]); setFile(null); setError(""); notify("Reporte bancario recibido"); }
  return <><div className="pageHead"><div><span className="eyebrow">BANCOS</span><h1>Reportes bancarios</h1><p>Consulta de archivos recibidos y su estado de procesamiento.</p></div></div>{canUpload?<section className="panel uploadPanel"><div><h2>Subir reporte del banco</h2><p>Formatos permitidos: CSV, XLS o XLSX · máximo 10 MB.</p></div><input type="file" accept=".csv,.xls,.xlsx" onChange={event=>setFile(event.target.files?.[0]??null)}/><button className="primary" onClick={upload}>Subir reporte</button>{error?<span className="uploadError">{error}</span>:null}</section>:<div className="readOnlyBanner">Acceso de solo lectura: puede consultar reportes, pero no cargarlos.</div>}<section className="panel tablePanel"><div className="panelHead"><div><h2>Historial bancario</h2><p>{reportes.length} archivos disponibles</p></div></div><div className="tableWrap"><table><thead><tr><th>ARCHIVO</th><th>FECHA</th><th>CARGADO POR</th><th>ESTADO</th></tr></thead><tbody>{reportes.map(item=><tr key={item.id}><td><b>{item.nombre}</b></td><td>{item.fecha}</td><td>{item.cargadoPor}</td><td><span className="status done">{item.estado}</span></td></tr>)}</tbody></table></div></section></>;
}

function Auditoria(){ const [eventos,setEventos]=useState<Evento[]>([]); useEffect(()=>{fetch("/api/auditoria").then(r=>r.json()).then(data=>setEventos(data.eventos??[]));},[]); return <><div className="pageHead"><div><span className="eyebrow">TRAZABILIDAD</span><h1>Auditoría general</h1><p>Vista exclusiva y de solo lectura para revisar actividad del sistema.</p></div></div><div className="readOnlyBanner">Modo auditor: ninguna acción puede modificar la información.</div><section className="panel tablePanel"><div className="panelHead"><div><h2>Bitácora de actividad</h2><p>Eventos registrados por el sistema</p></div></div><table><thead><tr><th>FECHA</th><th>USUARIO</th><th>ACCIÓN</th><th>RESULTADO</th></tr></thead><tbody>{eventos.map(item=><tr key={`${item.fecha}-${item.accion}`}><td>{item.fecha}</td><td>{item.usuario}</td><td>{item.accion}</td><td><span className="status done">{item.resultado}</span></td></tr>)}</tbody></table></section></> }

const opcionesReportes:{tipo:TipoReporte;titulo:string;descripcion:string;icono:string}[]=[
  {tipo:"flujo-efectivo",titulo:"Estado de flujo de efectivo",descripcion:"Operación, inversión y financiamiento.",icono:"⇅"},
  {tipo:"balanza-anual",titulo:"Balanza de comprobación anual",descripcion:"Saldos deudores y acreedores.",icono:"⚖"},
  {tipo:"cambio-patrimonio",titulo:"Estado de cambio en el patrimonio",descripcion:"Variaciones del patrimonio institucional.",icono:"◈"},
  {tipo:"situacion-comparativa",titulo:"Estado de situación comparativo",descripcion:"Activos, pasivos y patrimonio.",icono:"▦"},
  {tipo:"resultado-comparativo",titulo:"Estado de resultado comparativo",descripcion:"Ingresos, gastos y resultado neto.",icono:"▤"},
];
const dinero=new Intl.NumberFormat("es-NI",{style:"currency",currency:"NIO",minimumFractionDigits:2});

function Reportes({canDownload}:{canDownload:boolean}){
  const [tipo,setTipo]=useState<TipoReporte>("flujo-efectivo"),[granularidad,setGranularidad]=useState<Granularidad>("anio"),[periodo,setPeriodo]=useState("2026"),[comparar,setComparar]=useState("2025"),[reporte,setReporte]=useState<ReporteFinanciero|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const url=(selected=tipo,format?:string)=>`/api/reportes/${selected}?granularidad=${granularidad}&periodo=${encodeURIComponent(periodo)}&comparar=${encodeURIComponent(comparar)}${format?`&formato=${format}`:""}`;
  async function generar(selected=tipo){setLoading(true);setError("");setTipo(selected);const response=await fetch(url(selected));const data=await response.json();if(response.ok)setReporte(data.reporte);else setError(data.error);setLoading(false);}
  useEffect(()=>{fetch("/api/reportes/flujo-efectivo?granularidad=anio&periodo=2026&comparar=2025").then(response=>response.json().then(data=>({ok:response.ok,data}))).then(({ok,data})=>{if(ok)setReporte(data.reporte);else setError(data.error);});},[]);
  function cambiarGranularidad(value:Granularidad){const defaults={dia:["2026-06-30","2025-06-30"],mes:["2026-06","2025-06"],trimestre:["2026-T2","2025-T2"],anio:["2026","2025"]}[value];setGranularidad(value);setPeriodo(defaults[0]);setComparar(defaults[1]);}
  const descargar=()=>{window.location.href=url(tipo,"csv");};
  return <><div className="pageHead reportPageHead"><div><span className="eyebrow">ESTADOS FINANCIEROS</span><h1>Centro de reportes</h1><p>Compare períodos con una experiencia temporal clara y flexible.</p></div></div><section className="timelineSlicer panel"><div className="slicerTop"><div><span className="slicerIcon">⌁</span><div><b>Comparación temporal</b><small>Elija el nivel de detalle y los períodos a analizar</small></div></div><div className="granularity" role="group" aria-label="Nivel de detalle temporal">{(["dia","mes","trimestre","anio"] as Granularidad[]).map(item=><button key={item} className={granularidad===item?"active":""} onClick={()=>cambiarGranularidad(item)}>{item==="dia"?"Día":item==="mes"?"Mes":item==="trimestre"?"Trimestre":"Año"}</button>)}</div></div><div className="periodCompare"><PeriodoControl label="Período principal" value={periodo} onChange={setPeriodo} granularidad={granularidad}/><div className="compareArrow"><span>VS</span><i>→</i></div><PeriodoControl label="Comparar contra" value={comparar} onChange={setComparar} granularidad={granularidad}/><button className="primary compareButton" onClick={()=>generar()} disabled={loading}>{loading?"Actualizando…":"Aplicar comparación"}</button></div><div className="timelineTrack"><span/><i/><i/><i/><b/></div></section><div className="demoBanner"><b>Datos demostrativos</b><span>La distribución por día, mes y trimestre se estima proporcionalmente desde el libro mayor semilla 2025–2026.</span></div><section className="reportLayout"><aside className="reportCatalog">{opcionesReportes.map(item=><button key={item.tipo} className={tipo===item.tipo?"selected":""} onClick={()=>generar(item.tipo)}><span>{item.icono}</span><div><b>{item.titulo}</b><small>{item.descripcion}</small></div></button>)}</aside><section className="panel reportViewer">{error?<div className="authError">{error}</div>:reporte?<><div className="reportTitle"><div><span className="status done">{reporte.fuente}</span><h2>{reporte.titulo}</h2><p>{reporte.periodoEtiqueta??reporte.periodo}{reporte.periodoComparativo?` frente a ${reporte.comparativoEtiqueta??reporte.periodoComparativo}`:""} · Córdobas NIO</p></div>{canDownload?<button className="secondary" onClick={descargar}>↓ Descargar CSV</button>:null}</div><div className="tableWrap"><table className="financialTable"><thead><tr>{reporte.columnas.map(col=><th key={col}>{col}</th>)}</tr></thead><tbody>{reporte.filas.map((fila,index)=><tr key={`${fila.concepto}-${index}`} className={fila.esTotal?"totalRow":""}><td>{fila.codigo?<small>{fila.codigo}</small>:null}<b>{fila.concepto}</b></td><td>{dinero.format(fila.actual)}</td>{reporte.columnas.length>2?<td>{dinero.format(fila.anterior??0)}</td>:null}{reporte.columnas.length>3?<td className={(fila.variacion??0)<0?"negative":"positive"}>{dinero.format(fila.variacion??0)}</td>:null}</tr>)}</tbody></table></div><footer><span>Generado: {new Date(reporte.generadoEn).toLocaleString("es-NI")}</span><span>{reporte.filas.length} líneas</span></footer></>:<div className="emptyReport">Seleccione un reporte para generarlo.</div>}</section></section></>;
}

function PeriodoControl({label,value,onChange,granularidad}:{label:string;value:string;onChange:(value:string)=>void;granularidad:Granularidad}){
  const common={value,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>onChange(event.target.value)};
  return <label className="periodControl"><span>{label}</span>{granularidad==="dia"?<input type="date" min="2025-01-01" max="2026-12-31" {...common}/>:granularidad==="mes"?<input type="month" min="2025-01" max="2026-12" {...common}/>:granularidad==="trimestre"?<select {...common}>{[2026,2025].flatMap(year=>[1,2,3,4].map(q=><option key={`${year}-T${q}`} value={`${year}-T${q}`}>Trimestre {q} · {year}</option>))}</select>:<select {...common}><option value="2026">Año 2026</option><option value="2025">Año 2025</option></select>}<small>{value}</small></label>;
}
