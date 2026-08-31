# Auditoria frontend vs backend

Estado revisado: 2026-08-31.

## Conectado a PostgreSQL

- Autenticacion, sesion, usuarios, roles y permisos.
- Catalogo contable y actualizacion de cuentas.
- Iglesias activas usadas en registro de movimientos.
- Movimientos contables y detalle debito/credito.
- Importaciones de balanza de comprobacion.
- Reportes financieros generados desde balanzas importadas.
- Reportes bancarios cargados por el usuario banco.
- Auditoria de acciones relevantes.
- Resumen operativo del dashboard.
- Configuracion institucional basica.
- Catalogo visible de reportes.

## Estatico por regla de negocio

- Permisos conocidos por el sistema.
- Tipos de linea contable: debito y credito.
- Naturaleza de cuentas: deudora y acreedora.
- Clasificacion de flujo: operacion, inversion, financiamiento y no aplica.
- Estados tecnicos de registros: activo, inactivo, procesado, error, registrado y anulado.

Estas listas siguen fijas porque afectan validaciones, reportes y permisos. Convertirlas en libres desde UI podria romper reglas contables si no se hace con una capa adicional de administracion.

## Siguiente conversion recomendada

- CRUD completo de iglesias para administradores.
- Configuracion editable desde pantalla de administracion.
- Activar/desactivar reportes desde administracion.
- Historial de cambios sobre configuracion institucional.
- Parametros contables por periodo, como moneda funcional y cierre mensual.
