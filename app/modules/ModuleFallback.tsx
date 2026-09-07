"use client";
import { etiquetasPermiso, menu, nombresRol, type User } from "../shared";

export default function Modulo({ nombre, user }: { nombre: string; user: User }) {
  const textos: Record<string, [string,string]> = { Resumen:["Panel de trabajo",`Accesos habilitados para ${nombresRol[user.rol]}.`], Usuarios:["Administración de usuarios","Control de usuarios, roles y perfiles del sistema."], "Catálogo contable":["Catálogo contable","Administración de cuentas y estructura jerárquica."], Importaciones:["Importaciones contables","Carga de catálogo, balanza y auxiliares."], Reportes:["Centro de reportes","Consulta de estados financieros autorizados."] };
  const [title, description] = textos[nombre] ?? [nombre,"Módulo autorizado para su perfil."];
  const accesos = menu.filter(item=>user.permisos.includes(item.permiso) && item.nombre !== "Resumen");
  return <><div className="pageHead"><div><span className="eyebrow">{nombresRol[user.rol].toUpperCase()}</span><h1>{title}</h1><p>{description}</p></div></div><section className="metrics workflowMetrics"><article className="metric featured"><p>Rol activo</p><strong>{nombresRol[user.rol]}</strong><span className="pill ready">Sesión válida</span></article><article className="metric"><p>Módulos disponibles</p><strong>{accesos.length}</strong><small>Según permisos actuales</small></article>{accesos.slice(0,2).map(item=><article className="metric" key={item.nombre}><p>Acceso directo</p><strong>{item.nombre}</strong><small>{etiquetasPermiso[item.permiso]}</small></article>)}</section></>;
}
