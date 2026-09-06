import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { configuracionSistema } from "../../../db/schema";
import { registrarAuditoria } from "../../../lib/auditoria";
import { jsonError, puede, usuarioDesdeRequest } from "../../../lib/auth";

const defaults = {
  institucionNombre: "Universal Nicaragua",
  sistemaNombre: "SIC",
  sistemaDescripcion: "Sistema de Información Contable",
  moneda: "NIO",
  logoLogin: "/universal-nicaragua-login.png",
};

/** La moneda funcional es una regla contable del sistema y no se edita desde la interfaz. */
const camposEditables = {
  institucionNombre: { clave: "institucion_nombre", etiqueta: "Nombre institucional", maximo: 120 },
  sistemaNombre: { clave: "sistema_nombre", etiqueta: "Nombre del sistema", maximo: 40 },
  sistemaDescripcion: { clave: "sistema_descripcion", etiqueta: "Descripción del sistema", maximo: 160 },
  logoLogin: { clave: "logo_login", etiqueta: "Logo institucional", maximo: 200 },
} as const;

type CampoEditable = keyof typeof camposEditables;
type ConfiguracionPayload = Partial<Record<CampoEditable, string>>;

export async function GET() {
  try {
    const rows = await getDb().select().from(configuracionSistema);
    const values = Object.fromEntries(rows.map(row => [row.clave, row.valor]));
    return Response.json({
      configuracion: {
        institucionNombre: values.institucion_nombre ?? defaults.institucionNombre,
        sistemaNombre: values.sistema_nombre ?? defaults.sistemaNombre,
        sistemaDescripcion: values.sistema_descripcion ?? defaults.sistemaDescripcion,
        moneda: values.moneda ?? defaults.moneda,
        logoLogin: values.logo_login ?? defaults.logoLogin,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ configuracion: defaults }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function PUT(request: Request) {
  const user = await usuarioDesdeRequest(request);
  if (!user) return jsonError("No autenticado", 401);
  if (!puede(user, "configuracion:administrar")) return jsonError("No tiene permiso para editar la configuración institucional", 403);

  let body: ConfiguracionPayload;
  try { body = await request.json(); } catch { return jsonError("Solicitud inválida", 400); }

  const cambios: { clave: string; valor: string; campo: CampoEditable }[] = [];
  for (const [campo, definicion] of Object.entries(camposEditables) as [CampoEditable, typeof camposEditables[CampoEditable]][]) {
    const valor = body[campo];
    if (valor === undefined) continue;
    const limpio = valor.trim();
    if (!limpio) return jsonError(`${definicion.etiqueta} no puede quedar vacío`, 400);
    if (limpio.length > definicion.maximo) return jsonError(`${definicion.etiqueta} admite hasta ${definicion.maximo} caracteres`, 400);
    if (campo === "logoLogin" && !limpio.startsWith("/")) return jsonError("El logo institucional debe ser una ruta interna que comience con /", 400);
    cambios.push({ clave: definicion.clave, valor: limpio, campo });
  }

  if (!cambios.length) return jsonError("No hay cambios para guardar", 400);

  const db = getDb();
  try {
    for (const cambio of cambios) {
      await db.insert(configuracionSistema)
        .values({ clave: cambio.clave, valor: cambio.valor })
        .onConflictDoUpdate({ target: configuracionSistema.clave, set: { valor: cambio.valor, actualizadoEn: sql`now()` } });
    }
    await registrarAuditoria(db, {
      user,
      modulo: "Configuración",
      accion: "Actualizó la configuración institucional",
      entidad: "configuracion_sistema",
      entidadId: cambios.map(cambio => cambio.clave).join(","),
      detalle: cambios.map(cambio => `${camposEditables[cambio.campo].etiqueta}: ${cambio.valor}`).join(" · "),
    });

    const rows = await db.select().from(configuracionSistema);
    const values = Object.fromEntries(rows.map(row => [row.clave, row.valor]));
    return Response.json({
      configuracion: {
        institucionNombre: values.institucion_nombre ?? defaults.institucionNombre,
        sistemaNombre: values.sistema_nombre ?? defaults.sistemaNombre,
        sistemaDescripcion: values.sistema_descripcion ?? defaults.sistemaDescripcion,
        moneda: values.moneda ?? defaults.moneda,
        logoLogin: values.logo_login ?? defaults.logoLogin,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Institutional configuration update failed", error);
    return jsonError("No se pudo guardar la configuración institucional", 500);
  }
}
