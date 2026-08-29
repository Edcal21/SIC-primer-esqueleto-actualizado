import { boolean, check, date, foreignKey, index, integer, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
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

export const movimientosCuentas = pgTable("movimientos_cuentas", {
  id: uuid("id").primaryKey().defaultRandom(),
  fecha: date("fecha").notNull(),
  referencia: varchar("referencia", { length: 120 }),
  concepto: text("concepto").notNull(),
  estado: varchar("estado", { length: 12, enum: ["registrado", "anulado"] }).notNull().default("registrado"),
  creadoPor: varchar("creado_por", { length: 40 }).notNull().references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_movimientos_cuentas_fecha").on(table.fecha),
  index("idx_movimientos_cuentas_referencia").on(table.referencia),
  index("idx_movimientos_cuentas_estado").on(table.estado),
  check("ck_movimientos_cuentas_estado", sql`${table.estado} in ('registrado', 'anulado')`),
]);

export const detallesMovimientos = pgTable("detalles_movimientos", {
  id: uuid("id").primaryKey().defaultRandom(),
  movimientoId: uuid("movimiento_id").notNull().references(() => movimientosCuentas.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 7, enum: ["credito", "debito"] }).notNull(),
  cuentaCodigo: varchar("cuenta_codigo", { length: 40 }).notNull(),
  cuentaNombre: text("cuenta_nombre").notNull(),
  monto: numeric("monto", { precision: 18, scale: 2 }).notNull(),
  orden: integer("orden").notNull().default(1),
}, (table) => [
  index("idx_detalles_movimientos_movimiento").on(table.movimientoId),
  index("idx_detalles_movimientos_cuenta").on(table.cuentaCodigo),
  index("idx_detalles_movimientos_tipo").on(table.tipo),
  check("ck_detalles_movimientos_tipo", sql`${table.tipo} in ('credito', 'debito')`),
  check("ck_detalles_movimientos_monto", sql`${table.monto} > 0`),
  check("ck_detalles_movimientos_orden", sql`${table.orden} > 0`),
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

export const importacionesBalanza = pgTable("importaciones_balanza", {
  id: uuid("id").primaryKey().defaultRandom(),
  archivoNombre: text("archivo_nombre").notNull(),
  archivoTamano: integer("archivo_tamano").notNull(),
  periodo: varchar("periodo", { length: 7 }).notNull(),
  estado: varchar("estado", { length: 12, enum: ["procesado", "error"] }).notNull().default("procesado"),
  totalLineas: integer("total_lineas").notNull().default(0),
  totalDebe: numeric("total_debe", { precision: 18, scale: 2 }).notNull().default("0"),
  totalHaber: numeric("total_haber", { precision: 18, scale: 2 }).notNull().default("0"),
  importadoPor: varchar("importado_por", { length: 40 }).notNull().references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_importaciones_balanza_periodo").on(table.periodo),
  index("idx_importaciones_balanza_usuario").on(table.importadoPor),
  check("ck_importaciones_balanza_periodo", sql`${table.periodo} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  check("ck_importaciones_balanza_estado", sql`${table.estado} in ('procesado', 'error')`),
  check("ck_importaciones_balanza_totales", sql`${table.totalLineas} >= 0 and ${table.totalDebe} >= 0 and ${table.totalHaber} >= 0`),
]);

export const lineasBalanza = pgTable("lineas_balanza", {
  id: uuid("id").primaryKey().defaultRandom(),
  importacionId: uuid("importacion_id").notNull().references(() => importacionesBalanza.id, { onDelete: "cascade" }),
  numeroLinea: integer("numero_linea").notNull(),
  cuentaCodigo: varchar("cuenta_codigo", { length: 40 }).notNull(),
  cuentaNombre: text("cuenta_nombre").notNull(),
  debe: numeric("debe", { precision: 18, scale: 2 }).notNull().default("0"),
  haber: numeric("haber", { precision: 18, scale: 2 }).notNull().default("0"),
  saldo: numeric("saldo", { precision: 18, scale: 2 }).notNull().default("0"),
}, (table) => [
  index("idx_lineas_balanza_importacion").on(table.importacionId),
  index("idx_lineas_balanza_cuenta").on(table.cuentaCodigo),
  check("ck_lineas_balanza_numero", sql`${table.numeroLinea} > 0`),
  check("ck_lineas_balanza_montos", sql`${table.debe} >= 0 and ${table.haber} >= 0`),
]);
