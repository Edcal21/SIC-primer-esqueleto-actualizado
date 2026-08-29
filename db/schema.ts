import { boolean, check, foreignKey, index, integer, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const cuentasContables = pgTable("cuentas_contables", {
  codigo: varchar("codigo", { length: 8 }).primaryKey().notNull(),
  descripcion: text("descripcion").notNull(),
  nivel: integer("nivel").notNull(),
  cuentaPadre: varchar("cuenta_padre", { length: 8 }),
  esCuentaMovimiento: boolean("es_cuenta_movimiento").notNull().default(false),
  naturaleza: varchar("naturaleza", { length: 9, enum: ["deudora", "acreedora"] }).notNull(),
  estado: varchar("estado", { length: 8, enum: ["activa", "inactiva"] }).notNull().default("activa"),
  clasificacionFlujo: varchar("clasificacion_flujo", { length: 14, enum: ["operación", "inversión", "financiamiento", "no aplica"] }).notNull().default("no aplica"),
}, (table) => [
  uniqueIndex("ux_cuentas_contables_codigo").on(table.codigo),
  index("idx_cuentas_contables_padre").on(table.cuentaPadre),
  index("idx_cuentas_contables_movimiento_estado").on(table.esCuentaMovimiento, table.estado),
  foreignKey({
    columns: [table.cuentaPadre],
    foreignColumns: [table.codigo],
    name: "fk_cuentas_contables_padre",
  }),
  check("ck_cuentas_contables_codigo_8", sql`length(${table.codigo}) = 8`),
  check("ck_cuentas_contables_nivel", sql`${table.nivel} between 1 and 5`),
  check("ck_cuentas_contables_naturaleza", sql`${table.naturaleza} in ('deudora', 'acreedora')`),
  check("ck_cuentas_contables_estado", sql`${table.estado} in ('activa', 'inactiva')`),
  check("ck_cuentas_contables_flujo", sql`${table.clasificacionFlujo} in ('operación', 'inversión', 'financiamiento', 'no aplica')`),
]);
