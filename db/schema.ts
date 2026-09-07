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

export const configuracionSistema = pgTable("configuracion_sistema", {
  clave: varchar("clave", { length: 80 }).primaryKey().notNull(),
  valor: text("valor").notNull(),
  descripcion: text("descripcion"),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_configuracion_sistema_clave").on(table.clave),
]);

export const reportesCatalogo = pgTable("reportes_catalogo", {
  tipo: varchar("tipo", { length: 40 }).primaryKey().notNull(),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion").notNull(),
  icono: varchar("icono", { length: 30 }).notNull().default("reports"),
  orden: integer("orden").notNull().default(1),
  estado: varchar("estado", { length: 8, enum: ["activo", "inactivo"] }).notNull().default("activo"),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_reportes_catalogo_orden").on(table.orden),
  index("idx_reportes_catalogo_estado").on(table.estado),
  check("ck_reportes_catalogo_estado", sql`${table.estado} in ('activo', 'inactivo')`),
]);

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

export const iglesias = pgTable("iglesias", {
  codigo: varchar("codigo", { length: 8 }).primaryKey().notNull(),
  nombre: text("nombre").notNull(),
  estado: varchar("estado", { length: 8, enum: ["activa", "inactiva"] }).notNull().default("activa"),
}, (table) => [
  index("idx_iglesias_nombre").on(table.nombre),
  index("idx_iglesias_estado").on(table.estado),
  check("ck_iglesias_codigo_8", sql`length(${table.codigo}) = 8`),
  check("ck_iglesias_estado", sql`${table.estado} in ('activa', 'inactiva')`),
]);

export const cuentasBancarias = pgTable("cuentas_bancarias", {
  numeroCuenta: varchar("numero_cuenta", { length: 32 }).primaryKey().notNull(),
  nombre: text("nombre").notNull(),
  moneda: varchar("moneda", { length: 3, enum: ["USD", "NIO"] }).notNull(),
  estado: varchar("estado", { length: 8, enum: ["activa", "inactiva"] }).notNull().default("activa"),
}, (table) => [
  index("idx_cuentas_bancarias_nombre").on(table.nombre),
  index("idx_cuentas_bancarias_estado").on(table.estado),
  check("ck_cuentas_bancarias_numero", sql`length(trim(${table.numeroCuenta})) > 0`),
  check("ck_cuentas_bancarias_moneda", sql`${table.moneda} in ('USD', 'NIO')`),
  check("ck_cuentas_bancarias_estado", sql`${table.estado} in ('activa', 'inactiva')`),
]);

export const movimientosCuentas = pgTable("movimientos_cuentas", {
  id: uuid("id").primaryKey().defaultRandom(),
  fecha: date("fecha").notNull(),
  iglesiaCodigo: varchar("iglesia_codigo", { length: 8 }).references(() => iglesias.codigo),
  cuentaBancariaNumero: varchar("cuenta_bancaria_numero", { length: 32 }).references(() => cuentasBancarias.numeroCuenta),
  referencia: varchar("referencia", { length: 120 }),
  concepto: text("concepto").notNull(),
  estado: varchar("estado", { length: 12, enum: ["registrado", "anulado"] }).notNull().default("registrado"),
  creadoPor: varchar("creado_por", { length: 40 }).notNull().references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_movimientos_cuentas_fecha").on(table.fecha),
  index("idx_movimientos_cuentas_iglesia").on(table.iglesiaCodigo),
  index("idx_movimientos_cuentas_cuenta_bancaria").on(table.cuentaBancariaNumero),
  index("idx_movimientos_cuentas_referencia").on(table.referencia),
  index("idx_movimientos_cuentas_estado").on(table.estado),
  uniqueIndex("ux_movimientos_unico").on(table.fecha, table.iglesiaCodigo, table.cuentaBancariaNumero, table.referencia).where(sql`${table.estado} = 'registrado'`),
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
  /** Marca la(s) línea(s) cuyo monto es el importe que realmente afecta la cuenta bancaria de la
   *  minuta; nunca se asume que es la suma de todos los débitos (una minuta puede tener líneas de
   *  detalle que no tocan el banco, p. ej. desgloses de gasto o impuesto). */
  afectaCuentaBancaria: boolean("afecta_cuenta_bancaria").notNull().default(false),
  /** Moneda del importe bancario original de esta línea. La contabilidad siempre se lleva en NIO
   *  (columna `monto`); estas columnas conservan el origen en USD cuando corresponde. */
  moneda: varchar("moneda", { length: 3, enum: ["USD", "NIO"] }).notNull().default("NIO"),
  montoOriginal: numeric("monto_original", { precision: 18, scale: 2 }).notNull(),
  /** Tasa NIO por unidad aplicada en el momento del registro. NIO usa tasa 1. Se conserva tal cual
   *  quedó registrada: cambios posteriores del catálogo de tasas nunca recalculan este valor. */
  tasaCambio: numeric("tasa_cambio", { precision: 14, scale: 6 }).notNull().default("1"),
}, (table) => [
  index("idx_detalles_movimientos_movimiento").on(table.movimientoId),
  index("idx_detalles_movimientos_cuenta").on(table.cuentaCodigo),
  index("idx_detalles_movimientos_tipo").on(table.tipo),
  index("idx_detalles_movimientos_afecta_banco").on(table.movimientoId, table.afectaCuentaBancaria),
  check("ck_detalles_movimientos_tipo", sql`${table.tipo} in ('credito', 'debito')`),
  check("ck_detalles_movimientos_monto", sql`${table.monto} > 0`),
  check("ck_detalles_movimientos_orden", sql`${table.orden} > 0`),
  check("ck_detalles_movimientos_moneda", sql`${table.moneda} in ('USD', 'NIO')`),
  check("ck_detalles_movimientos_monto_original", sql`${table.montoOriginal} > 0`),
  check("ck_detalles_movimientos_tasa_cambio", sql`${table.tasaCambio} > 0`),
  check("ck_detalles_movimientos_nio_tasa_unitaria", sql`${table.moneda} <> 'NIO' or ${table.tasaCambio} = 1`),
  check("ck_detalles_movimientos_conversion", sql`${table.monto} = round(${table.montoOriginal} * ${table.tasaCambio}, 2)`),
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
  estado: varchar("estado", { length: 16, enum: ["procesado", "con_diferencias", "error"] }).notNull().default("procesado"),
  totalLineas: integer("total_lineas").notNull().default(0),
  totalDebe: numeric("total_debe", { precision: 18, scale: 2 }).notNull().default("0"),
  totalHaber: numeric("total_haber", { precision: 18, scale: 2 }).notNull().default("0"),
  importadoPor: varchar("importado_por", { length: 40 }).notNull().references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_importaciones_balanza_periodo").on(table.periodo),
  index("idx_importaciones_balanza_usuario").on(table.importadoPor),
  check("ck_importaciones_balanza_periodo", sql`${table.periodo} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  check("ck_importaciones_balanza_estado", sql`${table.estado} in ('procesado', 'con_diferencias', 'error')`),
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

export const auditoriaEventos = pgTable("auditoria_eventos", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: varchar("usuario_id", { length: 40 }).references(() => usuarios.id),
  usuarioNombre: text("usuario_nombre").notNull(),
  modulo: varchar("modulo", { length: 40 }).notNull(),
  accion: varchar("accion", { length: 80 }).notNull(),
  entidad: varchar("entidad", { length: 80 }),
  entidadId: text("entidad_id"),
  resultado: varchar("resultado", { length: 12, enum: ["correcto", "error"] }).notNull(),
  detalle: text("detalle"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_auditoria_eventos_fecha").on(table.creadoEn),
  index("idx_auditoria_eventos_usuario").on(table.usuarioId),
  index("idx_auditoria_eventos_modulo").on(table.modulo),
  check("ck_auditoria_eventos_resultado", sql`${table.resultado} in ('correcto', 'error')`),
]);

export const reportesBancarios = pgTable("reportes_bancarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  fecha: date("fecha").notNull().defaultNow(),
  estado: varchar("estado", { length: 12, enum: ["recibido", "procesado", "error"] }).notNull().default("recibido"),
  archivoTamano: integer("archivo_tamano").notNull(),
  cargadoPor: varchar("cargado_por", { length: 40 }).notNull().references(() => usuarios.id),
  cargadoPorNombre: text("cargado_por_nombre").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  cuentaBancariaNumero: varchar("cuenta_bancaria_numero", { length: 32 }).references(() => cuentasBancarias.numeroCuenta),
  periodoInicio: date("periodo_inicio"),
  periodoFin: date("periodo_fin"),
  totalLineas: integer("total_lineas").notNull().default(0),
  totalDebitos: numeric("total_debitos", { precision: 18, scale: 2 }).notNull().default("0"),
  totalCreditos: numeric("total_creditos", { precision: 18, scale: 2 }).notNull().default("0"),
  mensajeError: text("mensaje_error"),
}, (table) => [
  index("idx_reportes_bancarios_fecha").on(table.fecha),
  index("idx_reportes_bancarios_usuario").on(table.cargadoPor),
  index("idx_reportes_bancarios_cuenta").on(table.cuentaBancariaNumero),
  check("ck_reportes_bancarios_estado", sql`${table.estado} in ('recibido', 'procesado', 'error')`),
  check("ck_reportes_bancarios_totales", sql`${table.totalLineas} >= 0 and ${table.totalDebitos} >= 0 and ${table.totalCreditos} >= 0`),
]);

export const lineasReporteBancario = pgTable("lineas_reporte_bancario", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporteId: uuid("reporte_id").notNull().references(() => reportesBancarios.id, { onDelete: "cascade" }),
  numeroLinea: integer("numero_linea").notNull(),
  fecha: date("fecha"),
  referencia: varchar("referencia", { length: 120 }),
  descripcion: text("descripcion").notNull(),
  /** Importes en la moneda original de la cuenta bancaria (columna `moneda`), tal como los trae el
   *  estado de cuenta. Nunca se convierte todo un estado bancario con una tasa única. */
  debito: numeric("debito", { precision: 18, scale: 2 }).notNull().default("0"),
  credito: numeric("credito", { precision: 18, scale: 2 }).notNull().default("0"),
  saldo: numeric("saldo", { precision: 18, scale: 2 }),
  moneda: varchar("moneda", { length: 3, enum: ["USD", "NIO"] }).notNull().default("NIO"),
  /** Tasa NIO por unidad vigente para la fecha de la línea. Nula cuando la línea es de una cuenta
   *  USD y no hay tasa registrada en el catálogo para esa fecha: queda pendiente de completar y
   *  bloqueada para enlace o aprobación; nunca se infiere. */
  tasaCambio: numeric("tasa_cambio", { precision: 14, scale: 6 }),
  debitoNio: numeric("debito_nio", { precision: 18, scale: 2 }),
  creditoNio: numeric("credito_nio", { precision: 18, scale: 2 }),
  estadoConciliacion: varchar("estado_conciliacion", { length: 12, enum: ["pendiente", "conciliada", "descartada"] }).notNull().default("pendiente"),
  movimientoId: uuid("movimiento_id").references(() => movimientosCuentas.id, { onDelete: "set null" }),
  conciliadoPor: varchar("conciliado_por", { length: 40 }).references(() => usuarios.id),
  conciliadoEn: timestamp("conciliado_en", { withTimezone: true }),
}, (table) => [
  index("idx_lineas_reporte_bancario_reporte").on(table.reporteId),
  index("idx_lineas_reporte_bancario_estado").on(table.estadoConciliacion),
  uniqueIndex("ux_lineas_reporte_bancario_movimiento").on(table.movimientoId),
  check("ck_lineas_reporte_bancario_numero", sql`${table.numeroLinea} > 0`),
  check("ck_lineas_reporte_bancario_montos", sql`${table.debito} >= 0 and ${table.credito} >= 0`),
  check("ck_lineas_reporte_bancario_estado", sql`${table.estadoConciliacion} in ('pendiente', 'conciliada', 'descartada')`),
  check("ck_lineas_reporte_bancario_conciliada", sql`${table.estadoConciliacion} <> 'conciliada' or ${table.movimientoId} is not null`),
  check("ck_lineas_reporte_bancario_moneda", sql`${table.moneda} in ('USD', 'NIO')`),
  check("ck_lineas_reporte_bancario_tasa_cambio", sql`${table.tasaCambio} is null or ${table.tasaCambio} > 0`),
  check("ck_lineas_reporte_bancario_nio_tasa_unitaria", sql`${table.moneda} <> 'NIO' or ${table.tasaCambio} = 1`),
  check(
    "ck_lineas_reporte_bancario_conversion",
    sql`${table.tasaCambio} is null or (${table.debitoNio} = round(${table.debito} * ${table.tasaCambio}, 2) and ${table.creditoNio} = round(${table.credito} * ${table.tasaCambio}, 2))`,
  ),
]);

export const tasasCambio = pgTable("tasas_cambio", {
  id: uuid("id").primaryKey().defaultRandom(),
  fecha: date("fecha").notNull(),
  /** Único destino soportado hoy: USD hacia NIO. NIO usa tasa 1 de forma implícita y no se cataloga. */
  moneda: varchar("moneda", { length: 3, enum: ["USD"] }).notNull().default("USD"),
  tasa: numeric("tasa", { precision: 14, scale: 6 }).notNull(),
  fuente: text("fuente").notNull(),
  creadoPor: varchar("creado_por", { length: 40 }).notNull().references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoPor: varchar("actualizado_por", { length: 40 }).references(() => usuarios.id),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }),
}, (table) => [
  uniqueIndex("ux_tasas_cambio_fecha_moneda").on(table.fecha, table.moneda),
  index("idx_tasas_cambio_moneda").on(table.moneda),
  check("ck_tasas_cambio_moneda", sql`${table.moneda} = 'USD'`),
  check("ck_tasas_cambio_positiva", sql`${table.tasa} > 0`),
  check("ck_tasas_cambio_fuente", sql`length(trim(${table.fuente})) > 0`),
]);

export const conciliacionesBancarias = pgTable("conciliaciones_bancarias", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporteId: uuid("reporte_id").notNull().references(() => reportesBancarios.id, { onDelete: "cascade" }),
  cuentaBancariaNumero: varchar("cuenta_bancaria_numero", { length: 32 }).notNull().references(() => cuentasBancarias.numeroCuenta),
  periodo: varchar("periodo", { length: 7 }).notNull(),
  estado: varchar("estado", { length: 10, enum: ["borrador", "aprobada", "rechazada"] }).notNull().default("borrador"),
  totalBanco: numeric("total_banco", { precision: 18, scale: 2 }).notNull().default("0"),
  totalConciliado: numeric("total_conciliado", { precision: 18, scale: 2 }).notNull().default("0"),
  totalPendiente: numeric("total_pendiente", { precision: 18, scale: 2 }).notNull().default("0"),
  lineasConciliadas: integer("lineas_conciliadas").notNull().default(0),
  lineasPendientes: integer("lineas_pendientes").notNull().default(0),
  movimientosSinConciliar: integer("movimientos_sin_conciliar").notNull().default(0),
  observaciones: text("observaciones"),
  creadoPor: varchar("creado_por", { length: 40 }).notNull().references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  revisadoPor: varchar("revisado_por", { length: 40 }).references(() => usuarios.id),
  revisadoPorNombre: text("revisado_por_nombre"),
  revisadoEn: timestamp("revisado_en", { withTimezone: true }),
}, (table) => [
  uniqueIndex("ux_conciliaciones_bancarias_reporte").on(table.reporteId),
  index("idx_conciliaciones_bancarias_cuenta").on(table.cuentaBancariaNumero),
  index("idx_conciliaciones_bancarias_estado").on(table.estado),
  index("idx_conciliaciones_bancarias_periodo").on(table.periodo),
  check("ck_conciliaciones_bancarias_estado", sql`${table.estado} in ('borrador', 'aprobada', 'rechazada')`),
  check("ck_conciliaciones_bancarias_periodo", sql`${table.periodo} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
]);
