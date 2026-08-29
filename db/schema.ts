import { boolean, check, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roles = pgTable("roles", {
  id: varchar("id", { length: 40 }).primaryKey().notNull(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion").notNull(),
});

export const permisos = pgTable("permisos", {
  id: varchar("id", { length: 80 }).primaryKey().notNull(),
  descripcion: text("descripcion").notNull(),
});

export const rolesPermisos = pgTable("roles_permisos", {
  rolId: varchar("rol_id", { length: 40 }).notNull().references(() => roles.id),
  permisoId: varchar("permiso_id", { length: 80 }).notNull().references(() => permisos.id),
}, (table) => [
  primaryKey({ columns: [table.rolId, table.permisoId], name: "pk_roles_permisos" }),
  index("idx_roles_permisos_permiso").on(table.permisoId),
]);

export const usuarios = pgTable("usuarios", {
  id: varchar("id", { length: 40 }).primaryKey().notNull(),
  usuario: varchar("usuario", { length: 80 }).notNull(),
  nombre: text("nombre").notNull(),
  rolId: varchar("rol_id", { length: 40 }).notNull().references(() => roles.id),
  salt: varchar("salt", { length: 32 }).notNull(),
  passwordHash: varchar("password_hash", { length: 64 }).notNull(),
  estado: varchar("estado", { length: 8, enum: ["activo", "inactivo"] }).notNull().default("activo"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ux_usuarios_usuario").on(table.usuario),
  index("idx_usuarios_rol_estado").on(table.rolId, table.estado),
  check("ck_usuarios_estado", sql`${table.estado} in ('activo', 'inactivo')`),
]);

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
