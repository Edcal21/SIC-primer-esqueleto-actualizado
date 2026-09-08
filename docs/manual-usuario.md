# Manual de usuario
## SIC — Sistema de Información Contable

---

| | |
|---|---|
| **Institución** | Universal Nicaragua |
| **Sistema** | SIC — Sistema de Información Contable |
| **Versión del sistema** | _(completar: etiqueta o commit entregado)_ |
| **Versión del manual** | 1.0 — borrador |
| **Fecha** | _(completar)_ |
| **Elaborado por** | _(completar)_ |
| **Dirigido a** | Personal operativo, contable y administrativo de la institución |

### Control de versiones del manual

| Versión | Fecha | Autor | Cambios |
|---|---|---|---|
| 1.0 | _(completar)_ | _(completar)_ | Versión inicial de entrega |

> **Cómo usar este manual.** La **Parte I** la debe leer todo el personal. La **Parte II** está organizada por rol: cada persona lee únicamente el capítulo de su rol. La **Parte III** contiene los procedimientos que involucran a varias personas. La **Parte IV** es para consulta cuando algo falla.

---

# ÍNDICE

**PARTE I — GENERAL**
1. Introducción
2. Alcance del sistema
3. Ingreso y cierre de sesión
4. Roles y permisos
5. Cómo leer la interfaz

**PARTE II — GUÍA POR ROL**
6. Operador bancario
7. Contador general
8. Administrador
9. Auditor general

**PARTE III — PROCEDIMIENTOS COMPLETOS**
10. Cierre mensual paso a paso
11. Conciliar una cuenta en dólares
12. Corregir un registro ya ingresado
13. Reabrir un período cerrado

**PARTE IV — OPERACIÓN Y SOPORTE**
14. Solución de problemas
15. Respaldos
16. Contactos y alcance del soporte

**ANEXOS**
- A. Matriz completa de permisos
- B. Formatos de archivo aceptados
- C. Glosario

---
---

# PARTE I — GENERAL

## 1. Introducción

El **SIC (Sistema de Información Contable)** es la herramienta institucional para registrar los ingresos y egresos de las iglesias, conciliar cada cuenta bancaria contra su estado de cuenta y generar los estados financieros del período.

El sistema se opera desde un navegador web. No requiere instalación en la computadora del usuario.

### 1.1 Los cuatro procesos que cubre

| Proceso | Qué hace | Quién lo ejecuta |
|---|---|---|
| **Registro de minutas** | Captura de asientos contables por partida doble | Operador bancario |
| **Conciliación bancaria** | Cruce del estado de cuenta del banco contra las minutas registradas | Operador bancario genera; Administrador aprueba |
| **Importación de balanza** | Carga de la balanza de comprobación mensual | Contador general |
| **Cierre de período** | Bloqueo de un mes para impedir cambios posteriores | Administrador |

### 1.2 Principios de operación

Tres reglas gobiernan todo el sistema. Conviene entenderlas antes de usarlo:

1. **Nada se borra.** Una minuta incorrecta no se elimina: se **anula**, dejando registro del motivo y del usuario. El detalle contable original permanece consultable.
2. **Todo queda auditado.** Cada operación relevante (registro, anulación, carga, aprobación, cierre, reapertura) queda en la bitácora de auditoría con usuario, fecha y resultado.
3. **La contabilidad es en córdobas (NIO).** Las cuentas en dólares se concilian en su moneda original, pero el registro contable siempre queda en córdobas, usando la tasa de cambio registrada para la fecha del movimiento.

---

## 2. Alcance del sistema

> Esta sección define **qué se entregó**. Cualquier necesidad que no aparezca en 2.1 no forma parte del sistema entregado.

### 2.1 Qué SÍ hace el sistema

- Registro de asientos contables (minutas) con validación automática de partida doble.
- Anulación de minutas con motivo obligatorio, sin pérdida del detalle contable.
- Administración del catálogo de cuentas contables.
- Administración del catálogo de iglesias.
- Administración de cuentas bancarias en córdobas (NIO) y dólares (USD).
- Registro de tasas de cambio USD → NIO por fecha, con fuente documentada.
- Carga y procesamiento de estados de cuenta bancarios en formato CSV o Excel.
- Generación de conciliaciones bancarias con enlace automático y manual de líneas.
- Aprobación o rechazo de conciliaciones, con observaciones.
- Importación de la balanza de comprobación mensual desde Excel.
- Generación y descarga de reportes financieros.
- Cierre y reapertura de períodos contables, con bloqueo de escrituras.
- Administración de usuarios, roles y permisos.
- Bitácora de auditoría consultable.

### 2.2 Qué NO hace el sistema

Se documenta explícitamente para evitar expectativas incorrectas:

- **No calcula ni contabiliza la revaluación cambiaria al cierre.** El sistema conserva la tasa aplicada a cada movimiento y permite separar la diferencia bancaria de la diferencia cambiaria, pero **no genera asientos automáticos de ajuste por tipo de cambio**. Esa política contable debe definirla la institución y registrarse de forma manual.
- **No es un sistema de nómina.**
- **No emite facturas ni comprobantes fiscales.**
- **No lleva control de inventarios ni de activos fijos.**
- **No presupuesta ni controla ejecución presupuestaria.**
- **No se conecta automáticamente con el banco.** Los estados de cuenta se descargan del portal bancario y se cargan manualmente al sistema.
- **No convierte un estado de cuenta completo con una sola tasa.** Cada línea resuelve su propia tasa según su fecha.
- **No infiere datos faltantes.** Si falta la tasa de cambio de una fecha, el sistema bloquea la operación en lugar de estimarla.

### 2.3 Supuestos de operación

El sistema asume que la institución cumple lo siguiente:

- Existe una persona responsable por rol, con usuario propio y contraseña no compartida.
- Los estados de cuenta se cargan al menos una vez al mes, por cuenta bancaria.
- Las tasas de cambio se registran **antes** de capturar minutas en dólares de esa fecha.
- El período contable se cierra una vez conciliadas y aprobadas todas las cuentas del mes.

---

## 3. Ingreso y cierre de sesión

### 3.1 Ingresar

1. Abra el navegador y digite la dirección del sistema proporcionada por la institución.
2. Escriba su **usuario** y su **contraseña**.
3. Presione **Ingresar**.

El sistema lo lleva a la pantalla **Resumen** y muestra en el menú lateral únicamente los módulos que su rol tiene autorizados.

### 3.2 Duración de la sesión

La sesión dura **8 horas**. Pasado ese tiempo el sistema pide credenciales nuevamente. Si deja la pantalla abierta y vuelve al día siguiente, deberá ingresar de nuevo: es un comportamiento esperado, no una falla.

### 3.3 Cerrar sesión

Use la opción **Cerrar sesión** del menú. Es obligatorio al terminar la jornada, especialmente en computadoras compartidas.

### 3.4 Reglas de contraseña

- La contraseña es personal e intransferible.
- No se comparte, no se anota junto al equipo, no se envía por chat ni correo.
- Si olvidó su contraseña, solicite al **Administrador** que la restablezca. No existe recuperación automática por correo.

> **Importante:** toda operación queda registrada con el usuario que la ejecutó. Prestar el usuario significa asumir la responsabilidad de lo que otra persona haga con él.

---

## 4. Roles y permisos

El sistema tiene cuatro roles. Cada uno ve solamente los módulos que necesita.

### 4.1 Los cuatro roles

| Rol | Responsabilidad principal |
|---|---|
| **Administrador** | Configura el sistema, administra usuarios y catálogos, aprueba conciliaciones y cierra períodos |
| **Contador general** | Importa la balanza de comprobación y genera los reportes financieros |
| **Operador bancario** | Registra minutas, carga estados de cuenta y prepara las conciliaciones |
| **Auditor general** | Consulta reportes y bitácora de auditoría. No modifica nada |

### 4.2 Qué módulo ve cada rol

| Módulo del menú | Administrador | Contador general | Operador bancario | Auditor general |
|---|:--:|:--:|:--:|:--:|
| Resumen | ✅ | ✅ | ✅ | ✅ |
| Registrar movimiento | — | — | ✅ | — |
| Minutas | — | — | ✅ | — |
| Bancos | ✅ | — | ✅ | ✅ |
| Conciliación | ✅ | — | ✅ | ✅ |
| Importaciones | — | ✅ | — | — |
| Reportes | ✅ | ✅ | ✅ | ✅ |
| Usuarios | ✅ | — | — | — |
| Catálogo contable | ✅ | — | — | — |
| Iglesias | ✅ | — | — | — |
| Cierre contable | ✅ | — | — | — |
| Configuración | ✅ | — | — | — |
| Auditoría | ✅ | — | — | ✅ |

La matriz detallada por permiso individual está en el **Anexo A**.

### 4.3 Separación de funciones

El diseño separa deliberadamente **quien prepara** de **quien aprueba**:

- El **operador bancario** carga el estado de cuenta y enlaza las líneas, pero **no puede aprobar** la conciliación.
- El **administrador** aprueba conciliaciones y cierra períodos, pero **no registra minutas ni importa balanza**.
- El **auditor general** ve todo lo relevante y **no puede modificar nada**.

> **Nota para la institución:** si una misma persona debe cubrir dos funciones, el Administrador puede ajustar los permisos del rol desde **Usuarios → Roles**. Hacerlo reduce el control interno; debe quedar autorizado por escrito.

### 4.4 "No veo un módulo en el menú"

No es una falla del sistema. El menú se arma según los permisos del rol. Si necesita un módulo que no aparece, solicite al Administrador la revisión de su rol. Si intenta llegar por otra vía, el sistema responde **"Permiso insuficiente"**.

---

## 5. Cómo leer la interfaz

### 5.1 Estructura de la pantalla

- **Menú lateral izquierdo:** módulos disponibles, agrupados en tres bloques:
  - **Operativa** — Resumen, Registrar movimiento, Minutas, Bancos, Conciliación
  - **Reportes** — Importaciones, Reportes
  - **Gestión** — Usuarios, Catálogo contable, Iglesias, Cierre contable, Auditoría, Configuración
- **Encabezado de página:** nombre del módulo y una línea que describe para qué sirve.
- **Paneles:** cada bloque de trabajo (un formulario, una tabla) está dentro de un panel con su propio título.

### 5.2 Estados y colores

Las tablas usan etiquetas de color con un significado constante en todo el sistema:

| Color | Significado | Dónde aparece |
|---|---|---|
| **Verde** | Completado, correcto, aprobado | Procesado, Conciliada, Aprobada, Cerrado |
| **Amarillo / ámbar** | Requiere atención o acción pendiente | Pendiente, Con diferencias, En revisión, Borrador |
| **Rojo** | Error o rechazo | Error, Rechazada, Anulado |

### 5.3 Botones y su comportamiento

| Botón | Qué hace |
|---|---|
| **Actualizar** | Vuelve a consultar los datos de la base. Úselo si sospecha que la pantalla está desactualizada |
| **Ver detalle / Abrir** | Despliega el contenido del registro seleccionado |
| **Botón azul principal** | Ejecuta la acción del panel (Registrar, Procesar, Generar) |

### 5.4 Ventanas de confirmación

Las operaciones que no se pueden deshacer solas piden confirmación en una ventana que explica **qué va a pasar**. Léala. Aplica a:

- Registrar una minuta
- Anular una minuta
- Aprobar o rechazar una conciliación
- Cerrar un período
- Reabrir un período

### 5.5 Mensajes de error

Aparecen en un recuadro rojo en la parte superior del panel. **Siempre indican qué falta o qué regla se incumplió.** Antes de escalar el problema, lea el mensaje completo: en la mayoría de los casos contiene la instrucción para resolverlo.

Ejemplo real:

> *"Falta registrar la tasa de cambio USD → NIO para el 2026-03-15. Regístrela en Configuración → Tasas de cambio antes de continuar."*

El listado completo de mensajes, causas y acciones está en el **capítulo 14**.

---
---

# PARTE II — GUÍA POR ROL

> _Sección en elaboración. Cada capítulo desarrolla, con capturas de pantalla, las tareas del rol siguiendo el mismo formato: **Para qué sirve → Cómo se hace (pasos) → Qué valida el sistema → Errores frecuentes**._

## 6. Operador bancario
- 6.1 Registrar una minuta
- 6.2 Consultar y anular minutas
- 6.3 Cargar el estado de cuenta del banco
- 6.4 Generar y trabajar una conciliación

## 7. Contador general
- 7.1 Importar la balanza de comprobación
- 7.2 Generar y descargar reportes financieros

## 8. Administrador
- 8.1 Usuarios y roles
- 8.2 Catálogo contable
- 8.3 Iglesias
- 8.4 Cuentas bancarias
- 8.5 Tasas de cambio
- 8.6 Aprobar o rechazar conciliaciones
- 8.7 Cierre contable
- 8.8 Configuración institucional

## 9. Auditor general
- 9.1 Consultar la bitácora de auditoría
- 9.2 Consultar y descargar reportes

---
---

# PARTE III — PROCEDIMIENTOS COMPLETOS

Los capítulos de esta parte describen procesos que **involucran a más de una persona**. Cada uno indica el responsable de cada paso.

---

## 10. Cierre mensual paso a paso

**Objetivo:** dejar el mes cerrado, conciliado y bloqueado a cambios.
**Frecuencia:** una vez al mes, dentro de los primeros días del mes siguiente.
**Participan:** Operador bancario, Contador general, Administrador.

### 10.1 Lista de verificación

| # | Paso | Responsable | Módulo | ✔ |
|---|---|---|---|:--:|
| 1 | Registrar todas las tasas de cambio del mes | Administrador | Configuración → Tasas de cambio | ☐ |
| 2 | Verificar que todas las minutas del mes estén registradas | Operador bancario | Minutas | ☐ |
| 3 | Descargar del banco el estado de cuenta de cada cuenta | Operador bancario | (portal del banco) | ☐ |
| 4 | Cargar cada estado de cuenta al sistema | Operador bancario | Bancos | ☐ |
| 5 | Generar la conciliación de cada cuenta | Operador bancario | Conciliación | ☐ |
| 6 | Enlazar manualmente las líneas que quedaron pendientes | Operador bancario | Conciliación | ☐ |
| 7 | Revisar y aprobar cada conciliación | Administrador | Conciliación | ☐ |
| 8 | Importar la balanza de comprobación del mes | Contador general | Importaciones | ☐ |
| 9 | Verificar que la balanza no quede "Con diferencias" | Contador general | Importaciones | ☐ |
| 10 | Generar y archivar los reportes financieros | Contador general | Reportes | ☐ |
| 11 | Marcar el período **En revisión** | Administrador | Cierre contable | ☐ |
| 12 | **Cerrar el período** | Administrador | Cierre contable | ☐ |

### 10.2 Desarrollo de los pasos

#### Paso 1 — Tasas de cambio (Administrador)

Antes de cualquier otra cosa, verifique que existen tasas registradas para **todas las fechas del mes en que hubo movimientos en dólares**.

El sistema **no estima** tasas. Si falta la tasa de un día, ninguna minuta en dólares con esa fecha se puede registrar y ninguna línea bancaria en dólares de ese día se puede enlazar.

#### Pasos 2 a 6 — Registro y conciliación (Operador bancario)

1. En **Minutas**, filtre por **Vigentes** y verifique contra los soportes físicos que no falte ningún asiento del mes.
2. Descargue del portal del banco el estado de cuenta del mes, en **CSV o Excel** (formatos aceptados: `.csv`, `.xlsx`, `.xls`; máximo **10 MB**).
3. En **Bancos → Subir estado de cuenta**, seleccione la **cuenta bancaria** correspondiente y el archivo. Presione **Procesar reporte**.
   - El sistema confirma con: *"Estado bancario procesado: N movimientos guardados"*.
   - Si el archivo no se reconoce, revise el **Anexo B**.
4. En **Conciliación → Generar conciliación**, elija el estado de cuenta recién procesado y presione **Generar conciliación**.
   - El sistema enlaza automáticamente las líneas que coinciden con **una única** minuta por monto, fecha, moneda y dirección.
   - Informa: *"Conciliación generada: N líneas enlazadas automáticamente"*.
5. Trabaje las líneas que quedaron **Pendiente**:
   - **Enlazar** — seleccione la minuta correspondiente en la lista y presione *Enlazar*.
   - **Descartar** — para líneas que no corresponden a un asiento propio (por ejemplo, un cargo del banco aún no registrado). Requiere registrar después la minuta correspondiente.
   - **Reabrir** — devuelve una línea descartada al estado pendiente.
6. Revise el panel **Minutas sin respaldo bancario**: son asientos registrados en libros que no aparecen en el estado de cuenta. Cada uno debe tener explicación (cheque en tránsito, depósito no acreditado, o un error de registro).

> **Criterio de cierre:** la conciliación queda lista cuando **Pendiente** es cero, o cuando cada partida pendiente tiene justificación documentada en las observaciones.

#### Paso 7 — Aprobación (Administrador)

1. Abra la conciliación en **Conciliación → Abrir**.
2. Revise: **Neto banco**, **Conciliado**, **Pendiente**, líneas conciliadas y líneas pendientes.
3. Escriba **Observaciones** si corresponde.
4. Presione **Aprobar** o **Rechazar**.

> Las observaciones son **obligatorias para rechazar**. Si intenta rechazar sin escribirlas, el sistema responde: *"Indique el motivo del rechazo en las observaciones"*.

Una conciliación **Rechazada** vuelve al operador bancario para corrección.

#### Pasos 8 a 10 — Balanza y reportes (Contador general)

1. En **Importaciones**, cargue el Excel de la balanza de comprobación del mes, indicando el **período (AAAA-MM)**.
   - Columnas esperadas: **Cuenta, Descripción, Saldo Inicial, Débitos, Créditos, Saldo Final**.
2. Verifique el estado del resultado:
   - **Procesado** — la balanza cuadra.
   - **Con diferencias** — débitos y créditos no cuadran. **No continúe.** Corrija en el origen y vuelva a importar.
   - **Error** — el archivo no se pudo leer. Revise el **Anexo B**.
3. En **Reportes**, genere y descargue los estados financieros del período. Archívelos según la política documental de la institución.

#### Pasos 11 y 12 — Cierre (Administrador)

1. En **Cierre contable**, ubique el período. Si no está en la lista, ábralo con **Abrir período** (formato AAAA-MM).
2. Presione **Marcar en revisión**. Esto señala que el mes está en proceso de cierre; todavía admite cambios.
3. Revise la columna **Estado**: si aparece *"N pendiente(s) para cerrar"*, el sistema encontró impedimentos. El botón **Cerrar período** queda deshabilitado hasta resolverlos.
4. Presione **Cerrar período** y confirme.

**El sistema impide cerrar un período cuando existen:**
- conciliaciones en estado **borrador** o **rechazada** con fechas dentro del período;
- balanzas importadas del período con estado **con diferencias**.

**Al cerrar, el período queda bloqueado para:**
- registrar o anular minutas con fecha dentro del período;
- importar balanza del período;
- cargar estados de cuenta con fechas del período;
- generar o aprobar conciliaciones del período;
- registrar tasas de cambio con fechas del período.

---

## 11. Conciliar una cuenta en dólares

**Objetivo:** conciliar una cuenta USD contra su estado de cuenta, manteniendo la contabilidad en córdobas.
**Participan:** Administrador (tasas), Operador bancario (conciliación).

### 11.1 El principio

La institución **contabiliza en córdobas** pero el banco **reporta en dólares**. El sistema resuelve esto guardando, para cada movimiento:

- el **importe original** en dólares — que es el que se compara contra el banco;
- la **tasa de cambio** vigente a la fecha del movimiento;
- el **equivalente en córdobas** — que es el que va a la contabilidad.

**La tasa aplicada queda congelada.** Si más adelante se corrige la tasa en el catálogo, los movimientos ya registrados **no se recalculan**. Esto es intencional: la historia contable no cambia retroactivamente.

### 11.2 Procedimiento

1. **Verificar la tasa (Administrador).** En **Configuración → Tasas de cambio**, confirme que existe tasa USD para cada fecha con movimientos. Cada tasa registra su **fuente** (por ejemplo, tabla oficial del BCN).
2. **Registrar las minutas (Operador bancario).** En **Registrar movimiento**:
   - Seleccione la **cuenta bancaria** en USD. El sistema detecta la moneda automáticamente.
   - En la línea que mueve el banco, marque la casilla **Línea bancaria** y digite el **importe en USD**.
   - El sistema muestra el equivalente en córdobas y lo recalcula en el servidor al guardar.
3. **Cargar el estado de cuenta (Operador bancario).** Igual que una cuenta en córdobas: **Bancos → Subir estado de cuenta**, seleccionando la cuenta USD.
4. **Generar y trabajar la conciliación.** El sistema compara **dólares contra dólares**, nunca córdobas contra dólares. Una línea de USD 1,200.00 solo se enlaza con una minuta cuyo importe original sea USD 1,200.00.

### 11.3 Líneas "pendientes de tasa"

Las líneas de estados de cuenta en dólares cargados **antes** de que existiera el control de monedas quedan marcadas como **pendientes de completar**: se conoce su moneda pero no la tasa de esa fecha.

- **No se pueden enlazar** hasta que se registre la tasa de esa fecha en el catálogo.
- El sistema **no las estima ni las infiere**. Es una decisión de diseño: es preferible una línea bloqueada a un dato inventado.

**Para resolverlas:** el Administrador registra la tasa de la fecha faltante en **Configuración → Tasas de cambio**. Las líneas quedan disponibles para enlazar.

### 11.4 Lo que el sistema no hace

No calcula ni contabiliza la **revaluación cambiaria** al cierre del período. La diferencia entre el saldo en córdobas de la cuenta y su equivalente a la tasa de cierre debe ser determinada y registrada manualmente por el contador, según la política que defina la institución. Ver sección 2.2.

---

## 12. Corregir un registro ya ingresado

**Principio:** en el SIC **no se edita ni se borra** un asiento registrado. Se **anula** y se registra uno nuevo y correcto. Así queda la traza completa de lo ocurrido.

### 12.1 Anular una minuta (Operador bancario)

1. Vaya a **Minutas**.
2. Ubique el asiento. Puede filtrar por **Todas / Vigentes / Anuladas**.
3. Presione **Anular**.
4. Revise el detalle contable que muestra el sistema y verifique que es el asiento correcto.
5. Escriba el **motivo de la anulación**. Mínimo **10 caracteres**. Debe explicar la causa real, no "error".
   - ❌ *"error"* — insuficiente
   - ✅ *"Monto capturado 4,500 en lugar de 5,400 según minuta 0341"*
6. Presione **Confirmar anulación**.

El sistema confirma: *"Minuta anulada y registrada en auditoría"*. El asiento queda con estado **Anulado** y su detalle contable sigue siendo consultable.

7. Registre nuevamente la minuta con los datos correctos, desde **Registrar movimiento**.

### 12.2 Restricciones

| Situación | Comportamiento |
|---|---|
| La minuta está **enlazada a una conciliación** | Debe deshacerse el enlace antes de anular. En **Conciliación**, use *Deshacer enlace* en la línea correspondiente |
| La minuta pertenece a un **período cerrado** | No se puede anular. Debe reabrirse el período primero (capítulo 13) |
| La minuta ya está **anulada** | No se puede anular dos veces |

### 12.3 Corregir otros elementos

| Elemento | Cómo se corrige | Quién |
|---|---|---|
| **Estado de cuenta mal cargado** | Cargue nuevamente el archivo correcto. El anterior queda en el historial | Operador bancario |
| **Tasa de cambio equivocada** | **Configuración → Tasas de cambio**, editar. **No recalcula** movimientos ya registrados | Administrador |
| **Conciliación mal armada** | El Administrador la **rechaza** con observaciones; el operador la corrige | Administrador / Operador |
| **Balanza mal importada** | Vuelva a importar el período. La importación anterior queda en el historial | Contador general |
| **Cuenta contable incorrecta** | **Catálogo contable**. Las cuentas no se borran: se marcan **inactivas** | Administrador |

---

## 13. Reabrir un período cerrado

> **Reabrir un período es una operación excepcional.** Debe estar autorizada por la jefatura contable y quedar documentada fuera del sistema, además del registro que deja el propio sistema.

### 13.1 Cuándo se justifica

- Se detectó un error material después del cierre.
- Un requerimiento de auditoría externa obliga a reprocesar el mes.
- Se recibió documentación soporte con posterioridad al cierre.

**No se justifica** para correcciones cosméticas ni para ajustes que pueden registrarse en el período corriente.

### 13.2 Procedimiento (Administrador)

1. Vaya a **Cierre contable**.
2. Ubique el período con estado **Cerrado**.
3. En la columna **Acciones**, escriba el **Motivo de reapertura** en el cuadro de texto. Mínimo **15 caracteres**.
4. Presione **Reabrir período**.
5. Lea la ventana de confirmación y confirme.

El sistema informa: *"Período AAAA-MM reabierto; el motivo quedó registrado"*.

### 13.3 Qué ocurre al reabrir

**Sí ocurre:**
- Se levanta el bloqueo: el período vuelve a admitir minutas, cargas, conciliaciones e importaciones.
- Quedan registrados de forma permanente el usuario, la fecha/hora y el motivo, visibles en la columna **Reapertura**.
- Queda registrado en la bitácora de auditoría.

**No ocurre:**
- **No se borra nada** de lo ya registrado.
- **No se recalcula nada** automáticamente.
- **No se revierten** las conciliaciones aprobadas.
- **No se anulan** las minutas del período.

### 13.4 Después de reabrir

1. Ejecute la corrección que motivó la reapertura.
2. Si afectó cuentas bancarias, regenere y vuelva a aprobar la conciliación correspondiente.
3. Si afectó saldos, vuelva a importar la balanza del período.
4. Regenere los reportes financieros del período: **los emitidos antes de la reapertura quedan desactualizados** y deben sustituirse.
5. Cierre nuevamente el período (capítulo 10, pasos 11 y 12).

> **Control interno recomendado:** que cada reapertura genere un memorando interno firmado por la jefatura contable, archivado junto con los reportes sustituidos.

---
---

# PARTE IV — OPERACIÓN Y SOPORTE

## 14. Solución de problemas

> _Sección en elaboración. Se completará durante la capacitación con las consultas reales de los usuarios._

Formato de cada entrada: **Mensaje del sistema → Causa → Qué hacer → A quién escalar**.

## 15. Respaldos

> _Sección en elaboración. Debe definirse con el responsable técnico: qué se respalda, con qué frecuencia, dónde se guarda, quién lo verifica y cómo se restaura._

## 16. Contactos y alcance del soporte

> _Sección en elaboración. Debe definirse con la institución: responsable funcional interno, responsable técnico, canal y horario de atención, tiempos de respuesta comprometidos._

---
---

# ANEXOS

## Anexo A — Matriz completa de permisos

| Permiso | Qué autoriza | Administrador | Contador general | Operador bancario | Auditor general |
|---|---|:--:|:--:|:--:|:--:|
| `panel:ver` | Ver el panel de resumen | ✅ | ✅ | ✅ | ✅ |
| `usuarios:administrar` | Crear y editar usuarios | ✅ | — | — | — |
| `roles:administrar` | Modificar roles y sus permisos | ✅ | — | — | — |
| `movimientos:escribir` | Registrar y anular minutas | — | — | ✅ | — |
| `catalogo:administrar` | Administrar el catálogo contable | ✅ | — | — | — |
| `iglesias:administrar` | Administrar el catálogo de iglesias | ✅ | — | — | — |
| `banco:ver` | Consultar bancos y conciliaciones | ✅ | — | ✅ | ✅ |
| `banco:cargar` | Cargar estados de cuenta y generar conciliaciones | — | — | ✅ | — |
| `conciliacion:aprobar` | Aprobar o rechazar conciliaciones | ✅ | — | — | — |
| `importaciones:administrar` | Importar balanza de comprobación | — | ✅ | — | — |
| `reportes:ver` | Consultar reportes financieros | ✅ | ✅ | ✅ | ✅ |
| `reportes:descargar` | Descargar reportes financieros | — | ✅ | — | ✅ |
| `auditoria:ver` | Consultar la bitácora de auditoría | ✅ | — | — | ✅ |
| `configuracion:administrar` | Configuración, cuentas bancarias, tasas y períodos | ✅ | — | — | — |

---

## Anexo B — Formatos de archivo aceptados

### B.1 Estado de cuenta bancario

| Aspecto | Requisito |
|---|---|
| **Formatos** | `.csv`, `.xlsx`, `.xls` |
| **Tamaño máximo** | 10 MB |
| **Encabezados** | Debe existir una columna de descripción/concepto **y** al menos una de débito, crédito o monto |

El sistema **reconoce automáticamente** los encabezados más usados por la banca nicaragüense. No es necesario renombrar columnas si el archivo usa alguno de estos nombres:

| Dato | Nombres reconocidos |
|---|---|
| **Fecha** | fecha, fecha operación, fecha de operación, fecha movimiento, fecha contable, fecha valor, date |
| **Descripción** | descripción, concepto, detalle, transacción, movimiento, description, narrativa |
| **Referencia** | referencia, número, no, num, documento, número documento, comprobante, reference |
| **Débito** | débito, débitos, debe, cargo, cargos, retiro, retiros, salida, salidas, withdrawal |
| **Crédito** | crédito, créditos, haber, abono, abonos, depósito, depósitos, entrada, entradas, deposit |
| **Saldo** | saldo, balance, saldo disponible, saldo contable, saldo final |

**Si el archivo no se reconoce**, el sistema responde: *"No se reconoció el encabezado del estado bancario. Se necesita una columna de descripción o concepto y otra de débito, crédito o monto."*
**Solución:** abra el archivo, renombre las columnas usando alguno de los nombres de la tabla anterior y vuelva a cargarlo.

### B.2 Balanza de comprobación

| Aspecto | Requisito |
|---|---|
| **Formatos** | `.csv`, `.xlsx`, `.xls` |
| **Tamaño máximo** | 10 MB |
| **Período** | Formato AAAA-MM |
| **Columnas** | Cuenta, Descripción, Saldo Inicial, Débitos, Créditos, Saldo Final |

---

## Anexo C — Glosario

| Término | Significado en el SIC |
|---|---|
| **Minuta** | Asiento contable registrado en el sistema. Se compone de líneas de débito y crédito que deben cuadrar |
| **Partida doble** | Regla contable que el sistema valida: el total de débitos debe ser igual al total de créditos |
| **Línea bancaria** | La línea de la minuta que representa el movimiento real de dinero en la cuenta bancaria. **No** es necesariamente la suma de todos los débitos |
| **Balanza de comprobación** | Reporte mensual con saldos iniciales, movimientos y saldos finales por cuenta |
| **Conciliación bancaria** | Cruce entre el estado de cuenta del banco y las minutas registradas en libros |
| **Línea pendiente** | Movimiento del estado de cuenta que aún no se ha enlazado con una minuta |
| **Pendiente de tasa** | Línea en dólares cuya tasa de cambio no está registrada en el catálogo. No se puede enlazar hasta registrarla |
| **Período contable** | Un mes calendario (AAAA-MM). Puede estar abierto, en revisión o cerrado |
| **Anular** | Dejar sin efecto una minuta conservando su detalle y registrando el motivo. No es borrar |
| **Tasa aplicada** | La tasa de cambio con la que se convirtió un movimiento. Queda congelada y no se recalcula |
| **Bitácora de auditoría** | Registro permanente de quién hizo qué, cuándo y con qué resultado |

---

_Fin del documento._
