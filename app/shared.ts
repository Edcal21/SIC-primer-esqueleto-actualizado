export type Permiso = "panel:ver" | "usuarios:administrar" | "roles:administrar" | "movimientos:escribir" | "catalogo:administrar" | "iglesias:administrar" | "banco:ver" | "banco:cargar" | "conciliacion:ver" | "conciliacion:gestionar" | "conciliacion:aprobar" | "importaciones:administrar" | "reportes:ver" | "reportes:descargar" | "auditoria:ver" | "configuracion:administrar";
export type User = { id: string; usuario: string; nombre: string; rol: "administrador" | "contador_general" | "operador_bancario" | "auditor_general"; permisos: Permiso[] };
export type Reporte = { id: string; nombre: string; fecha: string; estado: string; cargadoPor: string; archivoTamano?: number; creadoEn?: string; cuentaBancariaNumero?: string | null; periodoInicio?: string | null; periodoFin?: string | null; totalLineas?: number; totalDebitos?: string; totalCreditos?: string; mensajeError?: string | null; conciliacionId?: string | null; conciliacionEstado?: string | null };
export type LineaBanco = { id: string; numeroLinea: number; fecha: string | null; referencia: string | null; descripcion: string; debito: string; credito: string; saldo: string | null; moneda: "USD" | "NIO"; tasaCambio: string | null; debitoNio: string | null; creditoNio: string | null; estadoConciliacion: "pendiente" | "conciliada" | "descartada"; movimientoId: string | null };
export type MovimientoConciliable = { id: string; fecha: string; referencia: string | null; concepto: string; monto: number; montoOriginal: number; moneda: "USD" | "NIO"; sentido: "entrada" | "salida" | null; completo: boolean; lineaId: string | null };
export type LineaConciliacion = LineaBanco & { movimiento: MovimientoConciliable | null };
export type Conciliacion = { id: string; reporteId: string; cuentaBancariaNumero: string; cuentaBancariaNombre?: string | null; cuentaBancariaMoneda?: "USD" | "NIO" | null; periodo: string; estado: "borrador" | "aprobada" | "rechazada"; totalBanco: string; totalConciliado: string; totalPendiente: string; lineasConciliadas: number; lineasPendientes: number; movimientosSinConciliar: number; observaciones?: string | null; creadoEn: string; revisadoPorNombre?: string | null; revisadoEn?: string | null; reporteNombre?: string | null };
export type EstadoPeriodo = "abierto" | "revision" | "cerrado";
export type PeriodoContable = { periodo: string; estado: EstadoPeriodo; fechaApertura: string; fechaCierre: string | null; cerradoPor: string | null; cerradoPorNombre: string | null; reabiertoPor: string | null; reabiertoPorNombre: string | null; reabiertoEn: string | null; motivoReapertura: string | null; creadoEn: string; actualizadoEn: string };
export type ImpedimentoCierre = { motivo: string; detalle: string };
/** Un período solo bloquea cuando está explícitamente cerrado; si no está en la lista, está abierto. */
export const periodoCerrado = (periodos: PeriodoContable[], periodo: string) =>
  periodos.some(item => item.periodo === periodo && item.estado === "cerrado");
export const periodoDeFechaUi = (fecha: string) => fecha.slice(0, 7);
export type TasaCambio = { id: string; fecha: string; moneda: "USD"; tasa: string; fuente: string; creadoPor: string; creadoEn: string; actualizadoPor?: string | null; actualizadoEn?: string | null };
/** Formatea un importe en su propia moneda (USD o NIO); usar en vez de `dinero` cuando el valor no está garantizado en córdobas. */
export const formatoMonedaPorTipo: Record<"USD" | "NIO", Intl.NumberFormat> = {
  NIO: new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO", minimumFractionDigits: 2 }),
  USD: new Intl.NumberFormat("es-NI", { style: "currency", currency: "USD", minimumFractionDigits: 2 }),
};
export const formatearMoneda = (valor: number, moneda: "USD" | "NIO") => formatoMonedaPorTipo[moneda].format(valor);
export type ReporteDisponible = { id: string; nombre: string; cuentaBancariaNumero: string | null; periodoInicio: string | null; periodoFin: string | null; totalLineas: number };
export type Evento = { fecha: string; usuario: string; accion: string; resultado: string; detalle?: string | null };
export type ImportacionBalanza = { id: string; archivoNombre: string; archivoTamano: number; periodo: string; estado: "procesado" | "con_diferencias" | "error"; totalLineas: number; totalDebe: string; totalHaber: string; creadoEn: string };
export type ImportacionSituacionFinanciera = { id: string; archivoNombre: string; archivoTamano: number; periodo: string; estado: "procesado" | "error"; totalLineas: number; creadoEn: string };
export type PermisoAdmin = { id: Permiso; descripcion: string };
export type RolAdmin = { id: string; nombre: string; descripcion: string; permisos: Permiso[] };
export type UsuarioAdmin = { id: string; usuario: string; nombre: string; rolId: string; estado: "activo" | "inactivo"; creadoEn: string; rolNombre?: string | null };
export type Iglesia = { codigo: string; nombre: string; estado?: "activa" | "inactiva" };
export type CuentaBancaria = { numeroCuenta: string; nombre: string; moneda: "USD" | "NIO"; estado?: "activa" | "inactiva" };
export type TipoReporte = "flujo-efectivo" | "balanza-anual" | "cambio-patrimonio" | "situacion-comparativa" | "resultado-comparativo" | "minutas";
export type Granularidad = "dia" | "mes" | "trimestre" | "anio";
export type ReporteFinanciero = { tipo:TipoReporte; titulo:string; descripcion:string; periodo:number; periodoComparativo?:number; periodoFuente?:string; periodoComparativoFuente?:string; periodoEtiqueta?:string; comparativoEtiqueta?:string; granularidad?:Granularidad; moneda:"NIO"; fuente:string; columnas:string[]; filas:{concepto:string;codigo?:string;actual:number;anterior?:number;variacion?:number;valores?:number[];esTotal?:boolean;esEncabezado?:boolean}[]; validacion?:{conciliado:boolean;diferencias:{concepto:string;calculado:number;estadoFinanciero:number;diferencia:number}[]}; generadoEn:string };
export type FilaReporteMinuta = { id:string; fecha:string; iglesiaCodigo:string|null; iglesiaNombre:string|null; cuentaBancariaNumero:string|null; referencia:string|null; concepto:string; monto:number; lineas:number; estado:"registrado"|"anulado" };
export type ReporteMinutasData = { titulo:string; desde:string; hasta:string; iglesiaCodigo:string|null; filas:FilaReporteMinuta[]; resumen:{ total:number; vigentes:number; anuladas:number; montoVigente:number }; iglesias:Iglesia[]; truncado:boolean; generadoEn:string };
export type CuentaMovimiento = { codigo: string; descripcion: string; naturaleza: "deudora" | "acreedora"; clasificacionFlujo: "operación" | "inversión" | "financiamiento" | "no aplica"; esCuentaMovimiento: boolean; estado: "activa" | "inactiva" };
export type DetalleMinuta = { tipo: "debito" | "credito"; cuentaCodigo: string; monto: string; afectaCuentaBancaria?: boolean; montoOriginal?: string };
export type MovimientoRegistrado = { id: string; fecha: string; iglesiaCodigo: string | null; cuentaBancariaNumero: string | null; referencia: string | null; concepto: string; estado: "registrado" | "anulado"; creadoEn: string; enlazadoAConciliacion?: boolean };
export type DetalleRegistrado = { id: string; movimientoId: string; tipo: "debito" | "credito"; cuentaCodigo: string; cuentaNombre: string; monto: string; orden: number; afectaCuentaBancaria?: boolean; moneda?: "USD" | "NIO"; montoOriginal?: string; tasaCambio?: string };
export type ResumenSistema = { cuentas: number; cuentasMovimiento: number; iglesiasActivas: number; importaciones: number; movimientos: number; reportesBanco: number; eventosAuditoria: number; ultimaImportacion?: ImportacionBalanza; ultimoMovimiento?: { fecha: string; concepto: string; referencia?: string | null; creadoEn: string }; eventos: { fecha: string; usuario: string; modulo: string; accion: string; resultado: string }[] };
export type ConfiguracionSistema = { institucionNombre: string; sistemaNombre: string; sistemaDescripcion: string; moneda: "NIO"; logoLogin: string };
export type OpcionReporte = { tipo: TipoReporte; titulo: string; descripcion: string; icono: string };
export type ModalState = { title: string; message: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; isDanger?: boolean };
export type RequestConfirmation = (modal: ModalState) => void;

export const nombresRol = { administrador: "Administrador", contador_general: "Contador", operador_bancario: "Finanzas", auditor_general: "Auditor general" };
export const etiquetasPermiso: Record<Permiso, string> = {
  "panel:ver": "Ver panel",
  "usuarios:administrar": "Administrar usuarios",
  "roles:administrar": "Administrar roles",
  "movimientos:escribir": "Registrar minutas",
  "catalogo:administrar": "Administrar catálogo",
  "iglesias:administrar": "Administrar iglesias",
  "banco:ver": "Ver bancos",
  "banco:cargar": "Cargar reportes bancarios",
  "conciliacion:ver": "Ver conciliación",
  "conciliacion:gestionar": "Gestionar conciliación",
  "conciliacion:aprobar": "Aprobar conciliación",
  "importaciones:administrar": "Importar estados financieros",
  "reportes:ver": "Ver reportes",
  "reportes:descargar": "Descargar reportes",
  "auditoria:ver": "Ver auditoría",
  "configuracion:administrar": "Editar configuración",
};
export const menu = [
  { nombre: "Resumen", permiso: "panel:ver" as Permiso, icono: "dashboard" },
  { nombre: "Usuarios", permiso: "usuarios:administrar" as Permiso, icono: "users" },
  { nombre: "Registrar movimiento", permiso: "movimientos:escribir" as Permiso, icono: "entry" },
  { nombre: "Minutas", permiso: "movimientos:escribir" as Permiso, icono: "reports" },
  { nombre: "Catálogo contable", permiso: "catalogo:administrar" as Permiso, icono: "catalog" },
  { nombre: "Iglesias", permiso: "iglesias:administrar" as Permiso, icono: "church" },
  { nombre: "Bancos", permiso: "banco:ver" as Permiso, icono: "bank" },
  { nombre: "Conciliación", permiso: "conciliacion:ver" as Permiso, icono: "reconcile" },
  { nombre: "Importaciones", permiso: "importaciones:administrar" as Permiso, icono: "upload" },
  { nombre: "Reportes", permiso: "reportes:ver" as Permiso, icono: "reports" },
  { nombre: "Auditoría", permiso: "auditoria:ver" as Permiso, icono: "audit" },
  { nombre: "Cierre contable", permiso: "configuracion:administrar" as Permiso, icono: "audit" },
  { nombre: "Configuración", permiso: "configuracion:administrar" as Permiso, icono: "settings" },
];
export const menuGroups = [
  { label: "Operativa", items: ["Resumen", "Registrar movimiento", "Minutas", "Bancos", "Conciliación"] },
  { label: "Reportes", items: ["Importaciones", "Reportes"] },
  { label: "Gestión", items: ["Usuarios", "Catálogo contable", "Iglesias", "Cierre contable", "Auditoría", "Configuración"] },
];
export const defaultConfig: ConfiguracionSistema = { institucionNombre: "Universal Nicaragua", sistemaNombre: "SIC", sistemaDescripcion: "Sistema de Información Contable", moneda: "NIO", logoLogin: "/universal-nicaragua-login.png" };

export const opcionesReportesIniciales:OpcionReporte[]=[
  {tipo:"flujo-efectivo",titulo:"Estado de flujo de efectivo",descripcion:"Compara saldos finales del Estado de Situación Financiera.",icono:"bank"},
  {tipo:"balanza-anual",titulo:"Balanza de comprobación anual",descripcion:"Saldos deudores y acreedores.",icono:"catalog"},
  {tipo:"cambio-patrimonio",titulo:"Estado de cambio en el patrimonio",descripcion:"Variaciones del patrimonio institucional.",icono:"dashboard"},
  {tipo:"situacion-comparativa",titulo:"Estado de situación comparativo",descripcion:"Todos los saldos finales de ambos períodos y su variación.",icono:"reports"},
  {tipo:"resultado-comparativo",titulo:"Estado de resultado comparativo",descripcion:"Ingresos, gastos y resultado neto.",icono:"entry"},
  {tipo:"minutas",titulo:"Reporte de minutas",descripcion:"Filtre las minutas ingresadas por iglesia y período.",icono:"reports"},
];
export const dinero=new Intl.NumberFormat("es-NI",{style:"currency",currency:"NIO",minimumFractionDigits:2});
export const currentYear = () => new Date().getFullYear();
export const currentMonth = () => new Date().toLocaleDateString("en-CA").slice(0, 7);
export function periodoAnterior(value: string, granularidad: Granularidad) {
  if (granularidad === "anio") return String(Number(value) - 1);
  if (granularidad === "trimestre") {
    const [yearText, quarterText] = value.split("-T"), year = Number(yearText), quarter = Number(quarterText);
    return quarter === 1 ? `${year - 1}-T4` : `${year}-T${quarter - 1}`;
  }
  const date = granularidad === "mes" ? new Date(`${value}-01T00:00:00Z`) : new Date(`${value}T00:00:00Z`);
  if (granularidad === "mes") date.setUTCMonth(date.getUTCMonth() - 1); else date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, granularidad === "mes" ? 7 : 10);
}
export const estadoImportacion = (estado: ImportacionBalanza["estado"]) => estado === "procesado" ? "Procesado" : estado === "con_diferencias" ? "Con diferencias" : "Error";
export const statusClass = (estado: string) => estado === "con_diferencias" || estado === "pendiente" ? "status pending" : estado === "error" ? "status danger" : "status done";
