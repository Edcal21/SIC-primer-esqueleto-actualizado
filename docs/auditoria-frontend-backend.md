# Auditoria frontend vs backend

Estado revisado: 2026-09-07.

## Conectado a PostgreSQL

- Autenticacion, sesion, usuarios, roles y permisos.
- Catalogo contable y actualizacion de cuentas.
- Iglesias activas usadas en registro de movimientos.
- Movimientos contables y detalle debito/credito, con consulta y anulacion desde la pantalla Minutas.
- Restablecimiento de contrasenas de usuarios desde la pantalla de administracion.
- Importaciones de balanza de comprobacion.
- Reportes financieros generados desde balanzas importadas.
- Estados de cuenta bancarios: el contenido del archivo se interpreta y cada movimiento se guarda en
  `lineas_reporte_bancario`, con cuenta bancaria, periodo y totales en `reportes_bancarios`.
- Conciliacion bancaria: enlace linea a linea contra minutas, descarte, aprobacion y rechazo en
  `conciliaciones_bancarias`.
- CRUD de cuentas bancarias.
- Configuracion institucional editable desde la pantalla de administracion.
- Auditoria de acciones relevantes, incluidas las de conciliacion y configuracion.
- Resumen operativo del dashboard.
- Catalogo visible de reportes.

## Estatico por regla de negocio

- Permisos conocidos por el sistema.
- Tipos de linea contable: debito y credito.
- Naturaleza de cuentas: deudora y acreedora.
- Clasificacion de flujo: operacion, inversion, financiamiento y no aplica.
- Estados tecnicos de registros: activo, inactivo, procesado, error, registrado y anulado.
- Moneda funcional del sistema: cordobas.

Estas listas siguen fijas porque afectan validaciones, reportes y permisos. Convertirlas en libres desde UI
podria romper reglas contables si no se hace con una capa adicional de administracion.

## Permisos y segregacion de funciones

| Permiso | Quien lo usa | Que habilita |
| --- | --- | --- |
| `banco:cargar` | Operador bancario | Procesar estados de cuenta, generar conciliaciones y enlazar o descartar lineas. |
| `conciliacion:aprobar` | Administrador | Aprobar o rechazar una conciliacion en borrador. |
| `catalogo:administrar` | Contador y administrador segun asignacion | CRUD de cuentas contables y de cuentas bancarias. |
| `configuracion:administrar` | Administrador | Editar la identidad institucional del sistema. |

Quien carga y enlaza no aprueba: `banco:cargar` y `conciliacion:aprobar` se otorgan a roles distintos.
La migracion `0017_conciliacion_bancaria` establece ese reparto inicial y los roles siguen siendo editables
desde la pantalla de usuarios.

## Endurecimiento de produccion aplicado

- `SIC_ENTORNO=produccion` (o `NODE_ENV=production`) activa tres controles en `lib/auth.ts`:
  exige `SIC_SESSION_SECRET` de 32 caracteres o mas y distinto del valor de desarrollo,
  inhabilita el fallback de usuarios locales aunque la bandera este activa, y emite la cookie
  de sesion con atributo `Secure`.
- El sistema falla cerrado: si el secreto no sirve, el login responde 503 y ninguna sesion se valida.
- Las contrasenas sembradas por migracion son publicas y ya pueden rotarse desde la interfaz.

## Pendiente de conversion

- CRUD completo de iglesias para administradores; hoy se mantienen por migracion.
- Activar o desactivar reportes desde administracion.
- Historial de cambios sobre configuracion institucional; hoy solo queda la traza en auditoria.
- Conversion de moneda para cuentas bancarias en dolares.
- Retencion del archivo bancario original ademas de sus lineas interpretadas.
- Parametros contables por periodo, como cierre mensual.
- Limite de intentos de acceso y encabezados de seguridad (CSP, X-Frame-Options, Referrer-Policy).
- Restriccion de partida doble como constraint de PostgreSQL, hoy validada en interfaz y API.
