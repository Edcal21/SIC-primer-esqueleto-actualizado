"use client";
import { type FormEvent, useEffect, useState } from "react";
import { etiquetasPermiso, type Permiso, type PermisoAdmin, type RolAdmin, type UsuarioAdmin } from "../shared";

export default function UsuariosAdmin({ notify }: { notify: (message: string) => void }) {
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

  return <><div className="pageHead"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Usuarios y roles</h1><p>Gestión inicial de accesos del sistema.</p></div></div><section className="adminLayout"><form className="panel formPanel" onSubmit={crearUsuario}><div className="panelHead compact"><div><h2>Crear usuario</h2><p>El usuario podrá iniciar sesión con el rol asignado.</p></div></div><div className="formGrid"><label>Usuario<input name="usuario" required placeholder="usuario.nuevo"/></label><label>Nombre<input name="nombre" required placeholder="Nombre completo"/></label><label>Rol<select name="rolId" required defaultValue=""><option value="" disabled>Seleccione rol</option>{roles.map(rol=><option key={rol.id} value={rol.id}>{rol.nombre}</option>)}</select></label><label>Contraseña inicial<input name="password" type="password" required minLength={12} placeholder="Mínimo 12 caracteres"/></label></div>{error?<div className="authError adminError">{error}</div>:null}<div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Creando…":"Crear usuario"}</button></div></form><form className="panel formPanel" onSubmit={crearRol}><div className="panelHead compact"><div><h2>Crear rol</h2><p>Defina un perfil reutilizable para usuarios nuevos.</p></div></div><div className="formGrid"><label>Identificador<input name="id" required placeholder="nuevo_rol"/></label><label>Nombre<input name="nombre" required placeholder="Nuevo rol"/></label><label className="wide">Descripción<input name="descripcion" required placeholder="Responsabilidad principal del rol"/></label></div><div className="permissionGrid">{permisos.map(permiso=><label key={permiso.id}><input type="checkbox" name="permisos" value={permiso.id}/><span>{etiquetasPermiso[permiso.id]}</span><small>{permiso.descripcion}</small></label>)}</div><div className="formActions"><button className="primary" type="submit" disabled={saving}>{saving?"Creando…":"Crear rol"}</button></div></form></section><section className="panel rolesPanel roleMatrix"><div className="panelHead compact"><div><h2>Roles disponibles</h2><p>{roles.length} perfiles configurados</p></div></div>{roles.map(rol=><article key={rol.id} className="roleItem"><b>{rol.nombre}</b><span>{rol.descripcion}</span><div className="permissionGrid compact">{permisos.map(permiso=><label key={`${rol.id}-${permiso.id}`}><input type="checkbox" checked={rol.permisos.includes(permiso.id)} onChange={event=>cambiarPermisoRol(rol,permiso.id,event.target.checked)}/><span>{etiquetasPermiso[permiso.id]}</span></label>)}</div></article>)}</section><section className="panel tablePanel"><div className="panelHead"><div><h2>Usuarios registrados</h2><p>{usuarios.length} cuentas disponibles</p></div></div><div className="tableWrap"><table><thead><tr><th>USUARIO</th><th>NOMBRE</th><th>ROL</th><th>ESTADO</th><th>CREADO</th><th>CONTRASEÑA</th></tr></thead><tbody>{usuarios.map(item=><tr key={item.id}><td><b>{item.usuario}</b></td><td><input className="inlineInput" value={item.nombre} onChange={event=>setUsuarios(current=>current.map(user=>user.id===item.id?{...user,nombre:event.target.value}:user))} onBlur={event=>actualizarUsuario(item.id,{nombre:event.target.value})}/></td><td><select className="inlineInput" value={item.rolId} onChange={event=>actualizarUsuario(item.id,{rolId:event.target.value})}>{roles.map(rol=><option key={rol.id} value={rol.id}>{rol.nombre}</option>)}</select></td><td><button className={item.estado==="activo"?"status done":"status pending"} onClick={()=>actualizarUsuario(item.id,{estado:item.estado==="activo"?"inactivo":"activo"})}>{item.estado}</button></td><td>{new Date(item.creadoEn).toLocaleDateString("es-NI")}</td><td><div className="passwordCell"><input className="inlineInput" type="password" autoComplete="new-password" placeholder="Nueva contraseña" value={passwords[item.id] ?? ""} onChange={event=>setPasswords(current=>({...current,[item.id]:event.target.value}))}/><button className="linkButton" type="button" onClick={()=>restablecerPassword(item)} disabled={(passwords[item.id]??"").length<12}>Restablecer</button></div></td></tr>)}</tbody></table></div><div className="accountHint">Las contraseñas sembradas por migración son públicas: cámbielas antes de operar en producción. Mínimo 12 caracteres.</div></section></>;
}
