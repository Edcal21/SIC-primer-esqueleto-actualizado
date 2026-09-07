"use client";
import type { FormEvent } from "react";
import type { ConfiguracionSistema } from "../shared";

export default function Login({ onSubmit, error, config }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string; config: ConfiguracionSistema }) {
  return <main className="authScreen"><section className="authCard"><div className="authBrand institutional"><span className="authLogo" style={{ backgroundImage: `url(${config.logoLogin})` }} role="img" aria-label={config.institucionNombre}/><div><b>{config.sistemaNombre}</b><small>{config.sistemaDescripcion}</small></div></div><span className="eyebrow">ACCESO SEGURO</span><h1>Iniciar sesión</h1><p>Ingrese con el usuario asignado a su función.</p><form onSubmit={onSubmit}><label>Usuario<input name="usuario" autoComplete="username" required placeholder="Usuario asignado"/></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required placeholder="Contraseña"/></label>{error ? <div className="authError" role="alert">{error}</div> : null}<button className="primary" type="submit">Ingresar al {config.sistemaNombre}</button></form></section></main>;
}
