import { getDb } from "../../../db";
import { configuracionSistema } from "../../../db/schema";

const defaults = {
  institucionNombre: "Universal Nicaragua",
  sistemaNombre: "SIC",
  sistemaDescripcion: "Sistema de Información Contable",
  moneda: "NIO",
  logoLogin: "/universal-nicaragua-login.png",
};

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
