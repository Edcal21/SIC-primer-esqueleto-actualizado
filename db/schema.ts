import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const cuentasContables = sqliteTable("cuentas_contables", {
  codigo: text("codigo", { length: 8 }).primaryKey().notNull(),
  descripcion: text("descripcion").notNull(),
  nivel: integer("nivel").notNull(),
  cuentaPadre: text("cuenta_padre", { length: 8 }),
  esCuentaMovimiento: integer("es_cuenta_movimiento", { mode: "boolean" }).notNull().default(false),
  naturaleza: text("naturaleza", { enum: ["deudora", "acreedora"] }).notNull(),
  estado: text("estado", { enum: ["activa", "inactiva"] }).notNull().default("activa"),
  clasificacionFlujo: text("clasificacion_flujo", { enum: ["operación", "inversión", "financiamiento", "no aplica"] }).notNull().default("no aplica"),
}, (table) => [
  uniqueIndex("ux_cuentas_contables_codigo").on(table.codigo),
  index("idx_cuentas_contables_padre").on(table.cuentaPadre),
  index("idx_cuentas_contables_movimiento_estado").on(table.esCuentaMovimiento, table.estado),
  check("ck_cuentas_contables_codigo_8", sql`length(${table.codigo}) = 8`),
  check("ck_cuentas_contables_nivel", sql`${table.nivel} between 1 and 5`),
]);
