# SIC — Sistema de Información Contable

Primer esqueleto funcional basado en la oferta técnica del 26 de junio de 2026 para la Asociación Iglesia Universal del Reino de Dios.

## Alcance representado

- Panel financiero con ingresos, conciliación y avance del período.
- Registro y consulta de minutas de depósito.
- Acceso a conciliación bancaria.
- Importación de catálogo, balanza y auxiliares contables.
- Centro de reportes para flujo de efectivo, balanza anual, cambios en patrimonio, situación comparativa y resultados comparativos.
- Accesos de seguridad, roles y respaldo de datos.

Los datos actuales son demostrativos. La persistencia SQL Server, autenticación, importadores y generación documental corresponden a la siguiente fase de implementación.

## Catálogo contable

El prototipo incorpora el modelo `cuentas_contables` con código, descripción,
nivel, cuenta padre, indicador de cuenta de movimiento, naturaleza, estado y
clasificación de flujo. La interfaz incluye búsqueda jerárquica y el formulario
de movimientos solo ofrece cuentas auxiliares activas.

El catálogo fuente de 761 filas debe copiarse al proyecto para ejecutar la
carga definitiva. Mientras tanto, la pantalla usa una muestra representativa
de las seis clases principales y deja visible el estado pendiente de la fuente.

## Ejecución

Requiere Node.js 22.13 o superior.

```bash
pnpm install
pnpm dev
```
