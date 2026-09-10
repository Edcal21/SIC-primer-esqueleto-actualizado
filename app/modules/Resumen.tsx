"use client";
import { useEffect, useState } from "react";
import MenuIcon from "../components/MenuIcon";
import { etiquetasPermiso, menu, nombresRol, type ResumenSistema, type User } from "../shared";

const tareasPorRol = {
  contador_general: [
    { titulo: "Revisar conciliaciones", modulo: "Conciliación", detalle: "Generar, conciliar, aprobar o reabrir según corresponda" },
    { titulo: "Preparar cierre", modulo: "Cierre contable", detalle: "Validar impedimentos antes de cerrar el período" },
    { titulo: "Emitir reportes", modulo: "Reportes", detalle: "Descargar estados financieros autorizados" },
  ],
  operador_bancario: [
    { titulo: "Registrar minuta", modulo: "Registrar movimiento", detalle: "Capturar ingresos con su cuenta bancaria" },
    { titulo: "Subir banco", modulo: "Bancos", detalle: "Cargar estados de cuenta para conciliación" },
    { titulo: "Ver minutas", modulo: "Minutas", detalle: "Confirmar movimientos registrados o anulados" },
  ],
  auditor_general: [
    { titulo: "Revisar auditoría", modulo: "Auditoría", detalle: "Consultar acciones recientes y excepciones" },
    { titulo: "Consultar reportes", modulo: "Reportes", detalle: "Ver estados disponibles sin modificar datos" },
    { titulo: "Ver conciliaciones", modulo: "Conciliación", detalle: "Comprobar estado y observaciones de revisión" },
  ],
  administrador: [
    { titulo: "Administrar accesos", modulo: "Usuarios", detalle: "Mantener roles y usuarios del sistema" },
    { titulo: "Revisar auditoría", modulo: "Auditoría", detalle: "Controlar eventos administrativos" },
    { titulo: "Configurar sistema", modulo: "Configuración", detalle: "Actualizar datos institucionales" },
  ],
};

export default function Resumen({ user, setActive }: { user: User; setActive: (value: string) => void }) {
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

  const tareas = tareasPorRol[user.rol].filter(item => accesos.some(acceso => acceso.nombre === item.modulo) || item.modulo === "Usuarios");

  return <><div className="pageHead"><div><span className="eyebrow">{nombresRol[user.rol].toUpperCase()}</span><h1>Resumen operativo</h1><p>Estado actual de catálogos, cargas, movimientos y trazabilidad.</p></div></div>{error?<div className="authError">{error}</div>:null}<section className="metrics workflowMetrics"><article className="metric featured"><p>Rol activo</p><strong>{nombresRol[user.rol]}</strong><span className="pill ready">Sesión válida</span></article><article className="metric"><p>Cuentas contables</p><strong>{resumen?.cuentas ?? "..."}</strong><small>{resumen?.cuentasMovimiento ?? 0} disponibles para minutas</small></article><article className="metric"><p>Iglesias activas</p><strong>{resumen?.iglesiasActivas ?? "..."}</strong><small>Catálogo institucional</small></article><article className="metric"><p>Minutas registradas</p><strong>{resumen?.movimientos ?? "..."}</strong><small>{resumen?.ultimoMovimiento ? `Última: ${new Date(resumen.ultimoMovimiento.creadoEn).toLocaleDateString("es-NI")}` : "Sin registros"}</small></article></section><section className="grid"><article className="panel activityPanel"><div className="panelHead"><div><h2>Trabajo recomendado</h2><p>Acciones principales para este rol</p></div></div><div className="statusList taskList">{tareas.map(item=><button key={item.titulo} onClick={()=>setActive(item.modulo)}><span><b>{item.titulo}</b><small>{item.detalle}</small></span><em>{item.modulo}</em></button>)}</div></article><article className="panel activityPanel"><div className="panelHead"><div><h2>Actividad reciente</h2><p>Últimos eventos del sistema</p></div></div>{resumen?.eventos.length ? <div className="auditMini">{resumen.eventos.map(evento=><div key={`${evento.fecha}-${evento.accion}`}><b>{evento.modulo}</b><span>{evento.accion}</span><small>{evento.usuario} · {new Date(evento.fecha).toLocaleString("es-NI")}</small></div>)}</div> : <div className="emptySmall">Sin actividad registrada.</div>}</article></section><section className="panel shortcutPanel"><div className="panelHead"><div><h2>Accesos de trabajo</h2><p>Módulos habilitados para este usuario</p></div></div><div className="shortcutGrid">{accesos.map(item=><button key={item.nombre} onClick={()=>setActive(item.nombre)}><MenuIcon name={item.icono}/><b>{item.nombre}</b><small>{etiquetasPermiso[item.permiso]}</small></button>)}</div></section></>;
}
