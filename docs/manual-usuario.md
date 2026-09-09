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
6. Operador bancario — 6.1 Registrar una minuta · 6.2 Consultar y anular minutas · 6.3 Cargar el estado de cuenta · 6.4 Generar y trabajar una conciliación
7. Contador general — 7.1 Importaciones contables · 7.2 Reportes financieros
8. Administrador — 8.1 Usuarios y roles · 8.2 Catálogo contable · 8.3 Iglesias · 8.4 Cuentas bancarias · 8.5 Tasas de cambio · 8.6 Aprobar o rechazar conciliaciones · 8.7 Cierre contable · 8.8 Configuración institucional · 8.9 Auditoría
9. Auditor general — 9.1 Bitácora de auditoría · 9.2 Consulta y descarga de reportes

**PARTE III — PROCEDIMIENTOS COMPLETOS**
10. Cierre mensual paso a paso
11. Conciliar una cuenta en dólares
12. Corregir un registro ya ingresado
13. Reabrir un período cerrado — 13.1 Cuándo se justifica · 13.2 Procedimiento · 13.3 La advertencia de impacto · 13.4 Qué ocurre al reabrir · 13.5 Después de reabrir

**PARTE IV — OPERACIÓN Y SOPORTE**
14. Solución de problemas — 14.1 Antes de escalar · 14.2 Cómo leer un mensaje de error · 14.3 Acceso · 14.4 Minutas · 14.5 Estados de cuenta · 14.6 Conciliación · 14.7 Importaciones · 14.8 Períodos · 14.9 Tasas de cambio · 14.10 Administración · 14.11 Reportes · 14.12 Errores del sistema · 14.13 Escalamiento · 14.14 Qué incluir al reportar
15. Respaldos — 15.1 Cómo funciona · 15.2 Cómo leer la pantalla · 15.3 Instalación (técnico) · 15.4 Restauración (técnico) · 15.5 Prueba periódica · 15.6 Lo que no cubre
16. Contactos y alcance del soporte

**ANEXOS**
- A. Matriz completa de permisos
- B. Formatos de archivo aceptados — B.1 Estado de cuenta bancario · B.2 Balanza de comprobación · B.3 Catálogo contable · B.4 Auxiliar contable · B.5 Estado de Situación Financiera
- C. Glosario

---
---

# PARTE I — GENERAL

## 1. Introducción

El **SIC (Sistema de Información Contable)** es la herramienta institucional para registrar los ingresos y egresos de las iglesias, conciliar cada cuenta bancaria contra su estado de cuenta y generar los estados financieros del período.

El sistema se opera desde un navegador web. No requiere instalación en la computadora del usuario.

### 1.1 Los cinco procesos que cubre

| Proceso | Qué hace | Quién lo ejecuta |
|---|---|---|
| **Registro de minutas** | Captura de asientos contables por partida doble | Operador bancario |
| **Conciliación bancaria** | Cruce del estado de cuenta del banco contra las minutas registradas | Operador bancario genera; Administrador aprueba |
| **Importaciones contables** | Carga de catálogo, auxiliar, balanza y estado de situación financiera | Contador general (catálogo: Administrador) |
| **Reportes financieros** | Generación de los cinco estados financieros y exportación del flujo de efectivo con formato oficial | Contador general |
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
- Importación de la **balanza de comprobación** mensual desde CSV o Excel.
- Importación del **catálogo contable** desde CSV o Excel.
- Importación del **auxiliar contable**, que genera minutas cuadradas de forma masiva.
- Importación del **Estado de Situación Financiera** por período, que es la fuente del estado de flujo de efectivo.
- Generación y descarga de los cinco reportes financieros.
- Exportación del **estado de flujo de efectivo a Excel con el formato oficial** de la institución.
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
- **No calcula el estado de flujo de efectivo a partir de las minutas.** Lo deriva de los Estados de Situación Financiera importados, comparando el campo *Saldo Final* entre períodos. Si ese estado no se importa, el reporte no tiene fuente de datos.
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

![Pantalla de acceso al sistema](img/00-login.png)

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

> ### ⚠️ Excepción a la separación de funciones: el auxiliar contable
>
> El importador de **auxiliar contable** crea minutas reales en el sistema: inserta asientos con sus líneas de débito y crédito, exactamente igual que la captura manual.
>
> Pero exige el permiso `importaciones:administrar`, no `movimientos:escribir`. En la práctica: **el contador general puede crear minutas de forma masiva por importación, aunque no pueda registrar ni una sola a mano.**
>
> El importador sí respeta las demás reglas — valida partida doble, rechaza duplicados y no escribe en períodos cerrados — pero la separación entre *quien captura* y *quien reporta* no aplica por esta vía.
>
> **La institución debe decidir si esto es aceptable.** Si no lo es, la corrección es exigir también `movimientos:escribir` en ese importador. Queda documentado como comportamiento de la versión entregada.

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

Cada capítulo es autosuficiente: lea solamente el de su rol.

Todas las capturas se tomaron con datos de prueba. Los importes, iglesias y números de cuenta que aparecen no corresponden a información real de la institución.

---

## 6. Operador bancario

**Usuario de ejemplo:** `banco` · **Rol:** Operador bancario

Su menú tiene seis opciones:

![Menú del operador bancario](img/opbancario-resumen.png)

| Grupo | Opciones |
|---|---|
| Operativa | Resumen · Registrar movimiento · Minutas · Bancos · Conciliación |
| Reportes | Reportes |

Es el rol que **captura** información. No aprueba conciliaciones ni cierra períodos: eso corresponde al Administrador.

---

### 6.1 Registrar una minuta

**Para qué sirve.** Registrar un asiento contable por partida doble: de dónde salió el dinero y a dónde entró.

![Pantalla Registrar movimiento](img/opbancario-registrar-movimiento.png)

**Cómo se hace**

1. Menú → **Registrar movimiento**.
2. Complete la cabecera:

| Campo | Obligatorio | Notas |
|---|:--:|---|
| **Fecha** | Sí | Determina el período contable y la tasa de cambio que se aplica |
| **Tipo de minuta** | Sí | **Bancaria** (afecta un banco y se concilia) o **Asiento de diario** (ajuste que no toca ningún banco) |
| **Cuenta bancaria** | Solo si es bancaria | Muestra `nombre · número · moneda`. La moneda define si se pide importe en dólares |
| **Iglesia** | Sí | Se elige del catálogo de iglesias activas |
| **Referencia** | No | Número de minuta o referencia bancaria. Máximo 120 caracteres |
| **Concepto** | Sí | Descripción del movimiento |

3. Complete las líneas del asiento. Por defecto aparecen dos: una de débito y una de crédito.
   - **Tipo:** Débito o Crédito.
   - **Cuenta contable:** se busca por código. Solo admite cuentas marcadas como *cuenta de movimiento* en el catálogo.
   - **Monto.**
   - **Línea bancaria:** casilla que marca **cuál de las líneas mueve la cuenta bancaria**.
4. Use **Agregar línea** si el asiento necesita más de dos.
5. Presione el botón de registro y confirme en la ventana **"Confirmar asiento contable"**.

El sistema responde: *"Movimiento registrado y auditado correctamente"*.

> ### Los dos tipos de minuta
>
> **Bancaria.** El movimiento entra o sale de una cuenta bancaria. Exige elegir la cuenta y marcar la **línea bancaria**. Aparece en la conciliación.
>
> **Asiento de diario.** Ajustes, reclasificaciones, provisiones, depreciaciones: asientos que cuadran entre cuentas contables sin tocar ningún banco. No pide cuenta bancaria, no admite líneas marcadas como bancarias y **no aparece en la conciliación**.
>
> Al elegir *Asiento de diario* el sistema oculta el campo de cuenta bancaria y las casillas de línea bancaria. Todo lo demás —partida doble, catálogo, período, auditoría— se aplica igual.

> ### La casilla "Línea bancaria": el concepto que más se malinterpreta
>
> El sistema **no asume** que el monto que afecta al banco es la suma de los débitos. Usted se lo indica marcando la casilla.
>
> **Por qué importa:** si registra un depósito de C$ 10,000 que se reparte en diezmos (C$ 7,000) y ofrendas (C$ 3,000), el banco vio **una** transacción de C$ 10,000. La línea marcada es la del banco (C$ 10,000), no las dos de ingresos.
>
> De ese monto marcado depende que la conciliación encuentre la coincidencia. Si lo marca mal, la línea del estado de cuenta nunca va a enlazar.

**Qué valida el sistema**

| Validación | Mensaje |
|---|---|
| Al menos una línea marcada como bancaria (solo minutas bancarias) | *"Marque al menos una línea como la que afecta la cuenta bancaria de la minuta"* |
| Un asiento de diario no admite líneas bancarias | *"Un asiento de diario no tiene cuenta bancaria: ninguna línea puede marcarse como línea bancaria…"* |
| **La cuenta debe existir en el catálogo, estar activa y admitir movimientos** | *"La cuenta NNNNNNNN no existe en el catálogo, está inactiva o no admite movimientos directos"* |
| Todas las líneas bancarias en la misma dirección | *"Las líneas que afectan la cuenta bancaria deben ir todas en la misma dirección (todas débito o todas crédito). Si la minuta representa una entrada y una salida, regístrelas por separado."* |
| Mínimo dos líneas | *"Debe agregar al menos dos detalles para cumplir partida doble"* |
| Débitos = créditos | *"La minuta debe cuadrar: débitos y créditos tienen que ser iguales"* |
| Cuentas válidas | *"Hay líneas con un código que no pertenece al catálogo de cuentas de movimiento"* |
| Campos completos | *"Complete cuenta y monto en todas las líneas"* |
| Tasa registrada (solo cuentas USD) | *"Falta registrar la tasa de cambio USD → NIO para el AAAA-MM-DD. Regístrela en Configuración → Tasas de cambio antes de continuar."* |
| Período abierto | *"El período AAAA-MM está cerrado. Un administrador debe reabrirlo desde Cierre contable antes de registrar minutas con esa fecha."* |
| No duplicada | *"Ya existe una minuta registrada con la misma fecha, iglesia, cuenta bancaria y referencia"* |

**Errores frecuentes**

| Situación | Qué hacer |
|---|---|
| No aparece el campo de importe en dólares | La cuenta bancaria seleccionada es en córdobas. Verifique que eligió la cuenta correcta |
| Falta la tasa del día | Solicite al Administrador que la registre. Usted no tiene ese permiso |
| El asiento no cuadra por centavos | Revise el redondeo en el origen. El sistema exige igualdad exacta |
| El período está cerrado | Solicite la reapertura al Administrador, con justificación (ver capítulo 13) |

---

### 6.2 Consultar y anular minutas

**Para qué sirve.** Ver los asientos registrados y dejar sin efecto los que estén equivocados.

![Pantalla Minutas registradas](img/opbancario-minutas.png)

**Cómo se hace**

1. Menú → **Minutas**.
2. Filtre con los botones **Todas / Vigentes / Anuladas**.
3. Para anular, presione **Anular** en la fila.
4. Revise el detalle contable que muestra el sistema y confirme que es el asiento correcto.
5. Escriba el **motivo** (mínimo **10 caracteres**).
6. Presione **Confirmar anulación**.

El procedimiento completo, con las restricciones y qué hacer después, está en el **capítulo 12**.

> **En el SIC no se edita ni se borra un asiento.** Se anula y se registra uno nuevo. El detalle contable del asiento anulado sigue siendo consultable de forma permanente.

---

### 6.3 Cargar el estado de cuenta del banco

**Para qué sirve.** Subir al sistema el archivo que descarga del portal bancario, para poder conciliarlo.

![Pantalla Reportes bancarios](img/opbancario-bancos.png)

**Cómo se hace**

1. Descargue del portal del banco el estado de cuenta del mes.
2. Menú → **Bancos** → panel **Subir estado de cuenta**.
3. Seleccione la **cuenta bancaria** que corresponde al archivo.
4. Seleccione el archivo.
5. Presione **Procesar reporte**.

El sistema responde: *"Estado bancario procesado: N movimientos guardados"*.

6. Presione **Ver detalle** para revisar las líneas guardadas antes de conciliar.

**Requisitos del archivo**

| Aspecto | Requisito |
|---|---|
| Formatos | `.csv`, `.xlsx`, `.xls` |
| Tamaño máximo | 10 MB |
| Encabezados | Una columna de descripción/concepto **y** al menos una de débito, crédito o monto |

Los nombres de columna que el sistema reconoce automáticamente están en el **Anexo B**.

**Errores frecuentes**

| Mensaje | Qué hacer |
|---|---|
| *"Seleccione la cuenta bancaria del estado de cuenta"* | Elija la cuenta antes del archivo |
| *"Formato no permitido; use CSV o Excel"* | Convierta el archivo. Un PDF del banco no sirve |
| *"El archivo supera el límite de 10 MB"* | Divida el estado de cuenta por rangos de fecha |
| *"No se reconoció el encabezado del estado bancario…"* | Renombre las columnas según el Anexo B |
| *"El archivo tiene encabezados válidos pero ninguna fila de movimientos"* | El rango descargado está vacío. Verifique las fechas en el portal del banco |

> **Cargar dos veces el mismo archivo no borra el anterior.** Ambos quedan en el historial. Antes de conciliar, verifique que está trabajando sobre el estado de cuenta correcto.

---

### 6.4 Generar y trabajar una conciliación

**Para qué sirve.** Cruzar cada línea del estado de cuenta contra las minutas registradas, y dejar explicada toda diferencia.

![Pantalla Conciliación bancaria](img/opbancario-conciliacion.png)

**Cómo se hace**

1. Menú → **Conciliación** → panel **Generar conciliación**.
2. Elija el estado de cuenta ya procesado.
3. Presione **Generar conciliación**.

El sistema enlaza automáticamente las líneas que coinciden con **una única** minuta por monto, fecha, moneda y dirección, e informa: *"Conciliación generada: N líneas enlazadas automáticamente"*.

> **Por qué no enlaza todo automáticamente.** Si dos minutas coinciden con la misma línea, el sistema **no elige por usted**: deja la línea pendiente para que decida una persona. Es deliberado — una conciliación equivocada es peor que una pendiente.

4. Presione **Abrir** para ver el detalle y trabaje las líneas **Pendiente**:

| Acción | Cuándo se usa |
|---|---|
| **Enlazar** | La línea corresponde a una minuta registrada. Selecciónela y presione *Enlazar* |
| **Descartar** | La línea no corresponde a un asiento propio (comisión bancaria, cargo no registrado). Debe registrarse después la minuta correspondiente |
| **Reabrir** | Devuelve una línea descartada al estado pendiente |
| **Deshacer enlace** | Rompe un enlace incorrecto |

5. Revise el panel **Minutas sin respaldo bancario**: asientos registrados en libros que no aparecen en el estado de cuenta (cheques en tránsito, depósitos no acreditados, o errores de registro). Cada uno debe tener explicación.

6. Cuando **Pendiente** llegue a cero — o cada pendiente tenga justificación documentada — avise al Administrador para la aprobación.

> **Usted no puede aprobar la conciliación que preparó.** Es separación de funciones, no una limitación técnica.

**Columnas del listado**

| Columna | Qué muestra |
|---|---|
| **Neto banco** | Total del movimiento según el estado de cuenta |
| **Conciliado** | Suma de las líneas ya enlazadas |
| **Pendiente** | Lo que falta explicar. **Es la cifra que importa** |
| **Líneas** | Conciliadas / pendientes |
| **Estado** | Borrador · Aprobada · Rechazada |

Para cuentas en dólares, vea el **capítulo 11**.

---

## 7. Contador general

**Usuario de ejemplo:** `contador` · **Rol:** Contador general

Su menú tiene tres opciones: **Resumen**, **Importaciones** y **Reportes**.

> **El contador general no ve Bancos ni Conciliación.** Si necesita consultar una conciliación, debe solicitarla al Administrador o al Auditor. Está documentado como comportamiento actual del sistema; si la institución necesita otra cosa, el Administrador puede ajustar el rol (ver 4.3).

---

### 7.1 Importaciones contables

**Para qué sirve.** Cargar al sistema la información contable que se produce fuera de él.

![Pantalla Importaciones contables](img/contador-importaciones.png)

La pantalla reúne **cuatro importadores**:

| Importador | Qué carga | Campos esperados |
|---|---|---|
| **Catálogo contable** | Cuentas contables | Código/Cuenta y Descripción/Nombre. Opcionales: Nivel, Padre, Naturaleza, Flujo, Movimiento, Estado |
| **Auxiliar contable** | Egresos o movimientos, como minutas cuadradas | Fecha, Iglesia, Cuenta bancaria, Referencia, Concepto… |
| **Estado de situación financiera** | Saldos finales por período. Es la **fuente exclusiva del flujo de efectivo** | Descripción, Saldo Final |
| **Balanza de comprobación** | Balanza mensual | Cuenta, Descripción, Saldo Inicial, Débitos, Créditos, Saldo Final |

Cada panel muestra los **campos reconocidos** del archivo antes de importar. Revíselos: si un campo esperado no aparece ahí, el archivo tiene los encabezados mal.

**Cómo se hace**

1. Menú → **Importaciones**.
2. Ubique el panel del tipo de archivo que va a cargar.
3. Indique el **período** (los paneles que lo piden).
4. Seleccione el archivo y presione el botón de importación del panel.
5. Verifique el estado en el historial de la parte inferior.

**Estados posibles**

| Estado | Significado | Qué hacer |
|---|---|---|
| **Procesado** | El archivo cuadra | Continuar |
| **Con diferencias** | Débitos y créditos no cuadran | **No continúe.** Corrija en el origen y vuelva a importar |
| **Error** | El archivo no se pudo leer | Revise formato y encabezados (Anexo B) |

> ### ⚠️ Importar catálogo contable: limitación conocida
>
> El panel **Importar catálogo contable** aparece en su pantalla, pero **no funciona con su usuario**. Al intentarlo, el sistema responde:
>
> *"No tiene permiso para importar catálogo contable"* (HTTP 403)
>
> Ese importador exige el permiso `catalogo:administrar`, que corresponde al **Administrador**.
>
> **Solicite la importación del catálogo al Administrador.** No es una falla de su archivo ni de su sesión.
>
> _(Comportamiento verificado en la versión entregada. Ver nota técnica en el capítulo 14.)_

---

### 7.2 Reportes financieros

**Para qué sirve.** Generar y descargar los estados financieros del período.

![Centro de reportes](img/contador-reportes.png)

**Cómo se hace**

1. Menú → **Reportes**.
2. Elija el tipo de reporte:

| Reporte | Contenido |
|---|---|
| Estado de flujo de efectivo | Operación, inversión y financiamiento |
| Balanza de comprobación anual | Saldos deudores y acreedores |
| Estado de cambio en el patrimonio | Variaciones del patrimonio institucional |
| Estado de situación comparativo | Activos, pasivos y patrimonio |
| Estado de resultado comparativo | Ingresos, gastos y resultado neto |
| Reporte de minutas | Minutas registradas, filtradas por iglesia y rango de fechas |

3. Seleccione período y granularidad.

> **El reporte de minutas no usa período/comparar como los demás.** Se filtra por rango de fechas (Desde/Hasta) y, opcionalmente, por iglesia — pensado para auditorías puntuales o para revisar qué se registró en un rango específico, no para comparar dos períodos contables.
4. Genere y descargue.

El **flujo de efectivo** se exporta a Excel con el **formato oficial** de la institución, a partir de la plantilla incluida en el sistema.

> **El flujo de efectivo se alimenta del Estado de Situación Financiera importado**, comparando el campo *Saldo Final* entre períodos. Si no importó ese estado, el reporte no tiene fuente de datos.

**Advertencias del reporte**

Sobre la tabla puede aparecer un recuadro **«Revise antes de emitir»**. No bloquea la emisión; señala tres cosas:

| Advertencia | Qué significa |
|---|---|
| *"El flujo no reconstruye el efectivo declarado: diferencia de X"* | **La más importante.** El flujo debe llegar al mismo efectivo que declara el estado. Si no llega, algo no calza: revise que ambos estados sean de períodos consecutivos y que el archivo cuadre |
| *"No se encontraron en ninguno de los dos estados: …"* | Cuentas que el reporte busca por nombre y no aparecen. Salen en cero. Suele significar que la cuenta cambió de nombre en el archivo de origen |
| *"Líneas del formato oficial que el sistema no alimenta…"* | Posiciones que el formato contempla pero el Estado de Situación Financiera no provee. Salen siempre en cero: **no las lea como «no hubo movimiento»** |

> Las dos últimas líneas del reporte (**Efectivo declarado** y **Diferencia**) son el control de cuadre. **Si la diferencia no es cero, no emita el reporte.**

**Estado de cambio en el patrimonio**

A diferencia de los demás reportes, este se alimenta de la **balanza de comprobación** (no del Estado de Situación Financiera) y es **exclusivamente anual** — comparando el cierre del 31 de diciembre de dos años consecutivos. Si se selecciona con granularidad Mes, Trimestre o Día, el sistema lo rechaza con un mensaje pidiendo cambiar a la vista Año.

El reporte muestra los saldos de patrimonio al cierre del año anterior, los movimientos del ejercicio, los saldos al cierre del año actual, y un bloque de **control** al final: contrasta el resultado del ejercicio anterior (lo que debería trasladarse a Utilidades Acumuladas) contra la variación real de esa cuenta entre ambos años. Si no coinciden, el sistema no lo oculta ni lo fuerza a cuadrar — muestra la diferencia exacta y advierte en el recuadro **«Revise antes de emitir»** que puede haber un ajuste contable adicional registrado en Utilidades Acumuladas durante el ejercicio, a verificar con contabilidad antes de emitir el reporte.

> **El contador general es, junto con el auditor, uno de los dos roles con permiso de descarga** (`reportes:descargar`). El operador bancario puede ver los reportes pero no descargarlos.

---

## 8. Administrador

**Usuario de ejemplo:** `administrador` · **Rol:** Administrador

Su menú tiene nueve opciones:

| Grupo | Opciones |
|---|---|
| Operativa | Resumen · Bancos · Conciliación |
| Gestión | Usuarios · Catálogo contable · Iglesias · Auditoría · Cierre contable · Configuración |

> **El Administrador no registra minutas ni importa balanza.** No tiene `movimientos:escribir` ni `importaciones:administrar`. Es separación de funciones: administra, aprueba y cierra; no captura.

---

### 8.1 Usuarios y roles

![Pantalla Usuarios y roles](img/admin-usuarios.png)

Menú → **Usuarios**. Permite crear usuarios, asignarles rol, activarlos o desactivarlos, restablecer contraseñas y ajustar qué permisos tiene cada rol.

> **Antes del primer uso real, cambie las contraseñas de los cuatro usuarios sembrados** (`administrador`, `contador`, `banco`, `auditor`). Las contraseñas iniciales están documentadas públicamente en el repositorio del sistema.

> **Desactive en lugar de borrar.** Un usuario desactivado no puede ingresar, pero su historial en la bitácora de auditoría permanece atribuible.

---

### 8.2 Catálogo contable

![Pantalla Catálogo contable](img/admin-catalogo-contable.png)

Menú → **Catálogo contable**. Administra las cuentas contables.

| Atributo | Qué define |
|---|---|
| **Código** | Identificador de la cuenta. **Exactamente 8 caracteres** |
| **Descripción** | Nombre de la cuenta |
| **Nivel** | Del 1 al 5. Define la jerarquía |
| **Cuenta padre** | Cuenta de la que depende |
| **Naturaleza** | Deudora o acreedora |
| **Cuenta de movimiento** | Si admite asientos directos. **Solo estas aparecen al registrar una minuta** |
| **Clasificación de flujo** | Operación, inversión, financiamiento o no aplica. Alimenta el estado de flujo de efectivo |
| **Estado** | Activa o inactiva |

> **Las cuentas no se borran, se marcan inactivas.** Una cuenta con asientos históricos debe seguir existiendo para que esos asientos sigan siendo legibles.

> **"Cuenta de movimiento" es la distinción crítica.** Las cuentas de agrupación (ACTIVO, PASIVO) no deben marcarse como de movimiento: existen para totalizar, no para recibir asientos.

También puede cargar el catálogo masivamente desde **Importaciones → Importar catálogo contable** (ver la nota en 7.1: es el Administrador quien tiene ese permiso).

---

### 8.3 Iglesias

![Pantalla Iglesias](img/admin-iglesias.png)

Menú → **Iglesias**. Administra el catálogo de iglesias con su código y nombre. Solo las **activas** aparecen al registrar una minuta.

Al igual que las cuentas contables, se desactivan en lugar de borrarse.

---

### 8.4 Cuentas bancarias

![Panel de cuentas bancarias dentro de Bancos](img/admin-bancos.png)

Menú → **Bancos**. El panel de administración de cuentas bancarias aparece **dentro de la pantalla de Bancos**, y solo para su rol.

| Campo | Notas |
|---|---|
| **Número de cuenta** | Identificador de la cuenta |
| **Nombre** | Nombre descriptivo |
| **Moneda** | **NIO** o **USD** |
| **Estado** | Activa o inactiva |

> ### ⚠️ La moneda no se puede cambiar después
>
> Una vez que la cuenta tiene minutas o estados de cuenta cargados, el sistema **bloquea** el cambio de moneda. Cambiarla reinterpretaría todos los importes históricos.
>
> **Defina la moneda correctamente al crear la cuenta.** Si se equivocó, cree una cuenta nueva y desactive la incorrecta.

> **Usted administra las cuentas pero no carga estados de cuenta** (no tiene `banco:cargar`). Esa es tarea del operador bancario.

---

### 8.5 Tasas de cambio USD → NIO

![Panel de tasas de cambio en Configuración](img/admin-configuracion.png)

Menú → **Configuración** → panel **Tasas de cambio USD → NIO**.

**Cómo se hace**

1. **Fecha** de vigencia de la tasa.
2. **Tasa (NIO por USD)** — hasta 6 decimales.
3. **Fuente** — de dónde salió (Banco Central de Nicaragua, banco comercial, etc.).
4. Presione **Registrar tasa**.

> ### Dos reglas que debe conocer
>
> **1. Corregir una tasa aquí NUNCA recalcula minutas ya guardadas.** Cada minuta conserva la tasa vigente al momento de registrarse. Es intencional: la historia contable no cambia retroactivamente.
>
> **2. Sin tasa registrada, nadie puede capturar movimientos en dólares de esa fecha.** El sistema bloquea en lugar de estimar.

**Registre las tasas del mes por adelantado o el mismo día.** Es la causa más común de bloqueo del operador bancario.

La **moneda funcional** del sistema es NIO y no se edita desde la interfaz: es una regla contable, no una preferencia.

---

### 8.6 Aprobar o rechazar conciliaciones

![Pantalla Conciliación bancaria](img/admin-conciliacion.png)

Menú → **Conciliación** → **Abrir** la conciliación en estado *Borrador*.

**Qué revisar antes de aprobar**

1. **Pendiente** debe ser cero, o cada pendiente debe tener justificación.
2. **Minutas sin respaldo bancario**: cada una debe tener explicación razonable.
3. Que la conciliación corresponda al **estado de cuenta y período correctos**.

**Cómo se hace**

1. Escriba **Observaciones** si corresponde.
2. Presione **Aprobar** o **Rechazar**.
3. Confirme en la ventana.

> **Las observaciones son obligatorias para rechazar.** Sin ellas: *"Indique el motivo del rechazo en las observaciones"*. Escriba qué debe corregirse — el operador solo tiene ese texto para saber qué hacer.

Una conciliación **Rechazada** vuelve al operador bancario para corrección.

---

### 8.7 Cierre contable

![Pantalla Cierre contable](img/admin-cierre-contable.png)

Menú → **Cierre contable**. Controla qué períodos admiten cambios.

**Los tres estados**

| Estado | Qué significa | Admite cambios |
|---|---|:--:|
| **Abierto** | Operación normal | Sí |
| **En revisión** | En proceso de cierre | Sí |
| **Cerrado** | Bloqueado | **No** |

> **Un período que nunca se abrió aquí se comporta como abierto.** Solo el estado *cerrado* bloquea. Registrar un período le permite marcarlo en revisión y cerrarlo.

**Abrir un período:** panel **Abrir período**, formato **AAAA-MM**. El sistema sugiere los períodos con actividad registrada que aún no se administran.

**Cerrar:** presione **Cerrar período** y confirme. Si la columna Estado muestra *"N pendiente(s) para cerrar"*, el botón queda deshabilitado hasta resolver los impedimentos.

**El sistema impide cerrar cuando hay:**
- conciliaciones en **borrador** o **rechazada** con fechas del período;
- balanzas del período **con diferencias**.

**Qué bloquea un período cerrado:** registro y anulación de minutas, importación de balanza, carga de estados de cuenta, generación y aprobación de conciliaciones, y registro de tasas de cambio — siempre que la fecha caiga dentro del período.

**Reabrir:** exige un **motivo de al menos 15 caracteres**. Antes de confirmar, el sistema enumera qué balanzas, estados financieros, períodos posteriores y conciliaciones aprobadas quedarán desactualizados. Es una advertencia, no un bloqueo. El procedimiento completo está en el **capítulo 13**.

---

### 8.8 Configuración institucional

![Pantalla Configuración institucional](img/admin-configuracion.png)

Menú → **Configuración** → panel **Identidad del sistema**.

| Campo | Dónde se ve |
|---|---|
| **Nombre institucional** | Barra lateral, pantalla de acceso y reportes |
| **Nombre del sistema** | Barra lateral y título |
| **Descripción del sistema** | Encabezado |
| **Ruta del logo institucional** | Ruta interna dentro de `public/` |
| **Moneda funcional** | **NIO**, fija. No editable |

Los cambios se guardan en la base de datos y quedan registrados en auditoría. La vista previa muestra cómo queda antes de guardar.

---

### 8.9 Auditoría

Ver el capítulo 9.1: la pantalla es la misma que consulta el Auditor general.

---

## 9. Auditor general

**Usuario de ejemplo:** `auditor` · **Rol:** Auditor general

Su menú tiene cinco opciones: **Resumen**, **Bancos**, **Conciliación**, **Reportes** y **Auditoría**.

> **El auditor no modifica nada.** Puede ver bancos, conciliaciones y reportes, descargarlos, y consultar la bitácora completa. No registra, no aprueba, no cierra. Es acceso de solo lectura por diseño.

---

### 9.1 Bitácora de auditoría

**Para qué sirve.** Consultar el registro permanente de quién hizo qué, cuándo y con qué resultado.

![Pantalla Auditoría general](img/auditor-auditoria.png)

Menú → **Auditoría**.

| Columna | Qué muestra |
|---|---|
| **Fecha** | Fecha y hora del evento |
| **Usuario** | Quién lo ejecutó |
| **Acción** | Qué operación se intentó |
| **Resultado** | Si tuvo éxito o fue rechazada |
| **Detalle** | Información adicional del evento |

**Qué queda registrado**

- Ingresos y cierres de sesión
- Registro y anulación de minutas, con el motivo de la anulación
- Carga de estados de cuenta e importaciones
- Generación, aprobación y rechazo de conciliaciones, con observaciones
- Apertura, revisión, cierre y **reapertura** de períodos, con el motivo
- Registro y corrección de tasas de cambio
- Cambios de usuarios, roles, catálogo, iglesias y configuración

> **Los intentos rechazados también quedan registrados.** Un usuario que intenta una operación sin permiso deja rastro. Para una auditoría, los intentos fallidos suelen ser tan informativos como los exitosos.

**Qué revisar en una auditoría de rutina**

1. **Reaperturas de período** — deben ser excepcionales y tener motivo sustantivo.
2. **Anulaciones de minutas** — un volumen alto sugiere un problema de proceso, no de captura.
3. **Cambios de rol o permisos** — deben corresponder a autorizaciones escritas.
4. **Correcciones de tasas de cambio** — verificar contra la fuente declarada.
5. **Conciliaciones aprobadas con pendientes distintos de cero** — revisar las observaciones.

---

### 9.2 Consulta y descarga de reportes

![Centro de reportes](img/auditor-reportes.png)

Menú → **Reportes**. Mismos cinco reportes descritos en 7.2. El auditor tiene permiso de **descarga** (`reportes:descargar`).

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
| 10 | Importar el Estado de Situación Financiera del mes | Contador general | Importaciones | ☐ |
| 11 | Generar y archivar los reportes financieros | Contador general | Reportes | ☐ |
| 12 | Marcar el período **En revisión** | Administrador | Cierre contable | ☐ |
| 13 | **Cerrar el período** | Administrador | Cierre contable | ☐ |

> **Los importadores de catálogo y auxiliar no forman parte del cierre mensual.** Se usan cuando hay que cargar o actualizar estructura contable, o migrar asientos en bloque — no todos los meses. Si los usa, hágalo **antes** del paso 8.

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

#### Pasos 8 y 9 — Balanza de comprobación (Contador general)

1. Menú → **Importaciones** → panel **Importar balanza de comprobación**.
2. Indique el **período (AAAA-MM)** y seleccione el archivo.
3. Antes de importar, revise la línea **Campos detectados**: debe mostrar Cuenta, Descripción, Saldo Inicial, Débitos, Créditos y Saldo Final. Si falta alguno, el archivo tiene los encabezados mal (Anexo B).
4. Presione **Importar balanza** y verifique el estado en el **Historial de balanzas**:

| Estado | Significado | Qué hacer |
|---|---|---|
| **Procesado** | La balanza cuadra | Continuar al paso 10 |
| **Con diferencias** | Débitos y créditos no cuadran | **No continúe.** Corrija en el origen y vuelva a importar |
| **Error** | El archivo no se pudo leer | Revise formato y encabezados (Anexo B) |

> **Una balanza "con diferencias" impide cerrar el período.** El sistema lo bloquea en el paso 13 (ver 10.1). No lo deje para el final.

> **La importación de balanza puede crear cuentas contables** que no existan en el catálogo. Revise el catálogo después de importar si el archivo trae cuentas nuevas.

#### Paso 10 — Estado de Situación Financiera (Contador general)

1. Menú → **Importaciones** → panel **Estado de Situación Financiera**.
2. Indique el **período (AAAA-MM)** y seleccione el archivo.
3. Verifique que **Campos detectados** muestre *Descripción* y *Saldo Final*.
4. Presione **Importar estado financiero**.

> **Este paso no es opcional si la institución emite estado de flujo de efectivo.** Es su única fuente: el reporte compara el *Saldo Final* entre períodos. Sin el estado del mes importado, el flujo de efectivo sale vacío o incompleto.

#### Paso 11 — Reportes financieros (Contador general)

1. Menú → **Reportes**.
2. Genere los estados del período: flujo de efectivo, balanza anual, cambio en el patrimonio, situación comparativo y resultado comparativo.
3. Descargue y archive según la política documental de la institución.
4. El **flujo de efectivo** se exporta a Excel con el **formato oficial** de la institución, a partir de la plantilla incluida en el sistema.

#### Pasos 12 y 13 — Cierre (Administrador)

1. En **Cierre contable**, ubique el período. Si no está en la lista, ábralo con **Abrir período** (formato AAAA-MM).
2. Presione **Marcar en revisión**. Esto señala que el mes está en proceso de cierre; todavía admite cambios.
3. Revise la columna **Estado**: si aparece *"N pendiente(s) para cerrar"*, el sistema encontró impedimentos. El botón **Cerrar período** queda deshabilitado hasta resolverlos.
4. Presione **Cerrar período** y confirme.

**El sistema impide cerrar un período cuando existen:**
- el **período contable anterior** todavía no está cerrado — los meses se cierran en orden, sin excepción, para que nunca quede un hueco donde no se sabe si un mes intermedio quedó completo;
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
| **Estado de situación financiera mal importado** | Vuelva a importar el período. Regenere después el flujo de efectivo | Contador general |
| **Catálogo mal importado** | Corrija cuenta por cuenta en **Catálogo contable**, o vuelva a importar el archivo corregido | Administrador |
| **Auxiliar mal importado** | Cada movimiento creado es una minuta: se **anulan una por una** desde Minutas, con motivo. No hay deshacer masivo | Operador bancario |
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
5. **Lea la advertencia de la ventana de confirmación** antes de confirmar. Ver 13.3.

El sistema informa: *"Período AAAA-MM reabierto; el motivo quedó registrado"*.

### 13.3 La advertencia de impacto

Antes de confirmar, el sistema enumera **qué queda desactualizado** si usted reabre el período:

| Advertencia | Qué significa |
|---|---|
| **Balanzas de comprobación que quedarán desactualizadas** | Balanzas importadas de este período y posteriores. Son archivos importados: **no se recalculan solos** |
| **Estados de situación financiera que quedarán desactualizados** | Son la fuente del flujo de efectivo. Habrá que reimportarlos y regenerar los reportes |
| **Períodos posteriores ya cerrados** | Siguen bloqueados y arrastran las cifras anteriores al cambio. Si el ajuste los afecta, habrá que reabrirlos también |
| **Conciliaciones aprobadas del período** | Volverán a admitir cambios; si toca sus minutas, deberá revisarlas y aprobarlas de nuevo |

En la tabla, los períodos cerrados con impacto muestran **⚠ reabrir desactualiza N elemento(s)**.

> **La advertencia informa, no bloquea.** La reapertura sigue siendo posible: la decisión es suya. Lo que el sistema garantiza es que no la tome sin conocer las consecuencias.

> ### Por qué el sistema no recalcula solo
>
> La balanza de comprobación y el estado de situación financiera **no se derivan de las minutas**: son archivos que alguien importa. Alterar un período ya cerrado no los modifica, y los períodos posteriores siguen arrastrando las cifras viejas.
>
> Por eso el paso 4 de 13.4 no es opcional: **si no reimporta, el sistema queda internamente inconsistente y no vuelve a avisarlo.**

### 13.4 Qué ocurre al reabrir

**Sí ocurre:**
- Se levanta el bloqueo: el período vuelve a admitir minutas, cargas, conciliaciones e importaciones.
- Quedan registrados de forma permanente el usuario, la fecha/hora y el motivo, visibles en la columna **Reapertura**.
- Queda registrado en la bitácora de auditoría.

**No ocurre:**
- **No se borra nada** de lo ya registrado.
- **No se recalcula nada** automáticamente.
- **No se revierten** las conciliaciones aprobadas.
- **No se anulan** las minutas del período.

### 13.5 Después de reabrir

1. Ejecute la corrección que motivó la reapertura.
2. Si afectó cuentas bancarias, regenere y vuelva a aprobar la conciliación correspondiente.
3. Si afectó saldos, vuelva a importar la balanza del período.
4. Regenere los reportes financieros del período: **los emitidos antes de la reapertura quedan desactualizados** y deben sustituirse.
5. Cierre nuevamente el período (capítulo 10, pasos 12 y 13).

> **Control interno recomendado:** que cada reapertura genere un memorando interno firmado por la jefatura contable, archivado junto con los reportes sustituidos.

---
---

# PARTE IV — OPERACIÓN Y SOPORTE

## 14. Solución de problemas

Este capítulo lista los mensajes que el sistema puede mostrar, qué significan y qué hacer. Están agrupados **por la pantalla donde aparecen**, no por orden alfabético.

### 14.1 Antes de escalar: tres comprobaciones

La mayoría de las consultas de soporte se resuelven con una de estas tres. Hágalas siempre antes de reportar un problema:

| # | Comprobación | Cómo |
|---|---|---|
| **1** | **¿La pantalla está desactualizada?** | Presione **Actualizar** en el panel. Si otra persona trabajó sobre el mismo registro, usted puede estar viendo datos viejos |
| **2** | **¿La sesión sigue viva?** | La sesión dura 8 horas. Si dejó la pantalla abierta desde ayer, cierre sesión y vuelva a ingresar |
| **3** | **¿Es un problema de permisos?** | Si el mensaje empieza con *"No tiene permiso para…"*, no es una falla: su rol no incluye esa operación. Vea el capítulo 4 |

### 14.2 Cómo leer un mensaje de error

Los mensajes del SIC casi siempre **contienen la instrucción para resolverlos**. Compare:

> *"Falta registrar la tasa de cambio USD → NIO para el 2026-03-15. Regístrela en Configuración → Tasas de cambio antes de continuar."*

El mensaje dice qué falta, para qué fecha y dónde se arregla. Léalo completo antes de escalar.

Los mensajes se dividen en tres clases:

| Clase | Cómo se reconoce | Quién lo resuelve |
|---|---|---|
| **De datos** | Describe qué falta o qué no cuadra | El propio usuario |
| **De permisos** | Empieza con *"No tiene permiso para…"* | El Administrador |
| **Del sistema** | Empieza con *"No se pudo…"* | El responsable técnico |

---

### 14.3 Acceso al sistema

| Mensaje | Qué pasó | Qué hacer | Escalar a |
|---|---|---|---|
| *"Usuario y contraseña son obligatorios"* | Falta uno de los dos campos | Complete ambos | — |
| *"Credenciales incorrectas"* | Usuario o contraseña equivocados, o el usuario está inactivo | Verifique mayúsculas y el teclado. Si persiste, pida restablecimiento | Administrador |
| *"El sistema no está configurado para operar de forma segura. Avise al administrador."* | El servidor no tiene configurado el secreto de sesión. **El sistema no opera hasta corregirlo** | No reintente. Reporte de inmediato | **Responsable técnico** |
| Se cierra la sesión sola | Pasaron las 8 horas | Vuelva a ingresar. No es una falla | — |

---

### 14.4 Registro y anulación de minutas

**Al registrar**

| Mensaje | Qué pasó | Qué hacer | Escalar a |
|---|---|---|---|
| *"Marque al menos una línea como la que afecta la cuenta bancaria de la minuta"* | Ninguna línea tiene la casilla **Línea bancaria** | Marque la línea que representa el movimiento real del banco (ver 6.1) | — |
| *"Las líneas que afectan la cuenta bancaria deben ir todas en la misma dirección…"* | Marcó una línea de débito y una de crédito como bancarias | La minuta representa una entrada **y** una salida: regístrelas por separado | — |
| *"Debe agregar al menos dos detalles para cumplir partida doble"* | La minuta tiene una sola línea | Agregue la contrapartida | — |
| *"La minuta debe cuadrar: débitos y créditos tienen que ser iguales"* | Los totales no coinciden | Revise el redondeo en el origen. El sistema exige igualdad exacta | — |
| *"La minuta no cumple las reglas contables de partida doble"* | La base de datos rechazó el asiento al guardarlo | Revise las líneas. Si el asiento se ve correcto, reporte con captura | Responsable técnico |
| *"Complete cuenta y monto en todas las líneas"* | Hay líneas incompletas | Complete o elimine las líneas vacías | — |
| *"Hay líneas con un código que no pertenece al catálogo de cuentas de movimiento"* | Usó una cuenta de agrupación, no de movimiento | Elija una cuenta marcada como *cuenta de movimiento* | Administrador, si falta la cuenta |
| *"La cuenta NNNNNNNN no existe en el catálogo, está inactiva o no admite movimientos directos"* | La validación del servidor rechazó el código: no existe, está inactivo o es cuenta de agrupación | Elija una cuenta activa de movimiento | Administrador, si falta la cuenta |
| *"Un asiento de diario no tiene cuenta bancaria: ninguna línea puede marcarse como línea bancaria…"* | Marcó una línea bancaria en un asiento de diario | Desmarque la casilla, o cambie el tipo a *Bancaria* e indique la cuenta | — |
| *"Seleccione la cuenta bancaria, o cambie el tipo a Asiento de diario si la minuta no afecta ningún banco"* | Minuta bancaria sin cuenta elegida | Elija la cuenta o cambie el tipo | — |
| *"Tipo inválido; utilice crédito o débito"* | Valor inesperado en el tipo de línea | Vuelva a seleccionar el tipo | — |
| *"La iglesia seleccionada no existe o está inactiva"* | La iglesia se desactivó | Elija otra iglesia o pida la reactivación | Administrador |
| *"La cuenta bancaria seleccionada no existe o está inactiva"* | La cuenta se desactivó | Elija otra o pida la reactivación | Administrador |
| *"Falta registrar la tasa de cambio USD → NIO para el AAAA-MM-DD…"* | Cuenta en dólares sin tasa para esa fecha | Solicite el registro de la tasa. **Usted no tiene ese permiso** | Administrador |
| *"Ya existe una minuta registrada con la misma fecha, iglesia, cuenta bancaria y referencia"* | Duplicado exacto | Verifique en Minutas si ya la registró. Si es legítimamente distinta, cambie la referencia | — |
| *"El período AAAA-MM está cerrado…"* | La fecha cae en un mes cerrado | Solicite la reapertura con justificación (cap. 13), o registre en el período corriente si corresponde | Administrador |
| *"Concepto es obligatorio"* / *"La iglesia es obligatoria"* / *"La cuenta bancaria es obligatoria"* / *"Fecha inválida"* | Falta un campo de la cabecera | Complete el campo | — |

**Al anular**

| Mensaje | Qué pasó | Qué hacer | Escalar a |
|---|---|---|---|
| *"Indique el motivo de la anulación con al menos 10 caracteres"* | Motivo vacío o muy corto | Escriba la causa real, no "error" (ver 12.1) | — |
| *"El movimiento ya está anulado"* | Ya fue anulada | Actualice la pantalla | — |
| *"Solo se admite la anulación de movimientos registrados"* | La minuta no está vigente | Actualice la pantalla | — |
| *"El movimiento está enlazado a la línea N de una conciliación bancaria… Deshaga el enlace en la pantalla de conciliación"* | La minuta está conciliada | Vaya a Conciliación, deshaga el enlace y vuelva a intentar | — |
| *"Movimiento no encontrado"* | El registro ya no existe o cambió | Actualice la pantalla | — |

---

### 14.5 Carga de estados de cuenta

| Mensaje | Qué pasó | Qué hacer | Escalar a |
|---|---|---|---|
| *"Seleccione la cuenta bancaria del estado de cuenta"* | No eligió la cuenta | Elija la cuenta antes del archivo | — |
| *"Seleccione un archivo"* | No adjuntó archivo | Adjunte el archivo | — |
| *"Formato no permitido; use CSV o Excel"* | El archivo no es `.csv`, `.xlsx` ni `.xls` | Un PDF del banco no sirve. Descargue el formato correcto del portal | — |
| *"El archivo supera el límite de 10 MB"* | Archivo muy grande | Divida el estado de cuenta por rangos de fecha | — |
| *"No se reconoció el encabezado del estado bancario. Se necesita una columna de descripción o concepto y otra de débito, crédito o monto."* | Los encabezados no coinciden con ningún alias conocido | Abra el archivo y renombre las columnas según el **Anexo B.1** | — |
| *"El archivo tiene encabezados válidos pero ninguna fila de movimientos"* | El rango descargado está vacío | Verifique las fechas en el portal del banco | — |
| *"El archivo no contiene hojas para procesar"* | Excel vacío o dañado | Vuelva a descargarlo del portal | — |
| *"El período AAAA-MM está cerrado…"* | El estado de cuenta cae en un mes cerrado | Solicite la reapertura (cap. 13) | Administrador |

---

### 14.6 Conciliación bancaria

**Al generar**

| Mensaje | Qué pasó | Qué hacer | Escalar a |
|---|---|---|---|
| *"Seleccione el reporte bancario a conciliar"* | No eligió estado de cuenta | Elija uno de la lista | — |
| *"Solo se pueden conciliar reportes bancarios procesados"* | El estado de cuenta quedó en error | Vuelva a cargarlo (14.5) | — |
| *"Este reporte bancario ya tiene una conciliación generada"* | Ya existe | Ábrala desde el listado en vez de generar otra | — |
| *"El reporte no tiene cuenta bancaria asociada; vuelva a cargarlo indicando la cuenta"* | Se cargó sin elegir cuenta | Cargue de nuevo el archivo seleccionando la cuenta | — |

**Al enlazar líneas**

| Mensaje | Qué pasó | Qué hacer | Escalar a |
|---|---|---|---|
| *"Seleccione el movimiento contable a enlazar"* | No eligió la minuta | Selecciónela en la lista de la fila | — |
| *"La moneda de la línea no coincide con la cuenta bancaria"* | Desajuste de moneda | Verifique que el estado de cuenta se cargó en la cuenta correcta | — |
| *"Esta línea es de una cuenta USD y no tiene tasa de cambio registrada para su fecha; está pendiente de completar. Registre la tasa del día en Configuración…"* | Línea histórica en dólares sin tasa | Solicite el registro de la tasa de esa fecha. El sistema **no la estima** (ver 11.3) | Administrador |
| *"Moneda, importe o datos históricos incompatibles con la línea bancaria"* | La minuta elegida no corresponde: distinta moneda, importe o dirección | Verifique importe original y sentido (entrada/salida) | — |
| *"El movimiento está anulado y no puede conciliarse"* | La minuta fue anulada | Elija la minuta vigente que la reemplazó | — |
| *"El movimiento ya está enlazado con otra línea bancaria"* | Doble enlace | Busque la otra línea y deshaga el enlace si fue un error | — |
| *"El movimiento pertenece a otra cuenta bancaria"* | La minuta es de otra cuenta | Elija una minuta de la misma cuenta | — |
| *"Línea bancaria no encontrada en este reporte"* | La línea cambió o el reporte se recargó | Actualice la pantalla | — |

**Al aprobar o rechazar**

| Mensaje | Qué pasó | Qué hacer | Escalar a |
|---|---|---|---|
| *"Indique el motivo del rechazo en las observaciones"* | Rechazo sin observaciones | Escriba qué debe corregirse: el operador solo tiene ese texto | — |
| *"No se puede aprobar: quedan N líneas bancarias sin conciliar ni descartar"* | Hay pendientes | Devuelva la conciliación al operador o trabaje las líneas | — |
| *"No se puede aprobar: existen líneas sin tasa o enlaces incompatibles/incompletos"* | Hay líneas en dólares sin tasa, o enlaces incompletos | Registre las tasas faltantes y revise los enlaces | — |
| *"La conciliación ya fue revisada"* | Otra persona la aprobó o rechazó antes | Actualice la pantalla | — |
| *"El período AAAA-MM está cerrado…"* | El período se cerró mientras trabajaba | Solicite la reapertura (cap. 13) | Administrador |

---

### 14.7 Importaciones contables

**Comunes a los cuatro importadores**

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"Formato no permitido; use CSV o Excel"* | Formato incorrecto | Convierta a `.csv`, `.xlsx` o `.xls` |
| *"El archivo supera el límite de 10 MB"* | Archivo muy grande | Divídalo |
| *"El archivo no contiene hojas para procesar"* | Excel vacío o dañado | Verifique el archivo de origen |
| *"Período inválido; use formato YYYY-MM"* | Período mal escrito | Use AAAA-MM (ejemplo: 2026-09) |

**Balanza de comprobación**

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"No se encontraron encabezados de balanza: Cuenta, Descripción, Débitos y Créditos"* | Encabezados no reconocidos | Renombre las columnas (Anexo B.2) |
| *"El archivo no contiene líneas de balanza"* | Encabezados válidos, sin filas | Verifique el rango exportado |
| Estado **Con diferencias** | Débitos ≠ créditos | **No continúe.** Corrija en el origen y vuelva a importar. Impide cerrar el período |

**Estado de Situación Financiera**

| Mensaje o estado | Qué pasó | Qué hacer |
|---|---|---|
| Estado **Con diferencias** con *"El estado no cuadra…"* | Total ACTIVOS no coincide con pasivos más patrimonio | Corrija en el sistema que genera el Excel y vuelva a importar |
| Estado **Con diferencias** con *"…aparece N veces con importes distintos"* | Un concepto se repite con importes que no coinciden | Corrija el archivo de origen: el reporte no puede elegir cuál usar |
| *"No se pudo verificar el cuadre contable…"* | Falta una de las dos líneas de cierre | Informativo. El archivo se importa, pero nadie verificó que cuadre |

**Catálogo contable**

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"No tiene permiso para importar catálogo contable"* | Su rol no incluye `catalogo:administrar` | **Limitación conocida** (ver 7.1). Solicítelo al Administrador |
| *"No se encontraron encabezados de catálogo: Código/Cuenta y Descripción/Nombre"* | Faltan las columnas obligatorias | Renombre las columnas (Anexo B.3) |
| *"El archivo no contiene cuentas contables"* | Encabezados válidos, sin filas | Verifique el archivo |
| *"El código debe tener 8 dígitos"* | Códigos de otra longitud | Los códigos son de **exactamente 8 caracteres**. Corrija el archivo |
| *"Naturaleza inválida"* / *"Clasificación de flujo inválida"* / *"Estado inválido"* | Valores no reconocidos | Use los valores de la tabla del Anexo B.3 |

**Auxiliar contable**

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"No se encontraron encabezados de auxiliar: Fecha y Cuenta"* | Faltan las columnas obligatorias | Renombre las columnas (Anexo B.4) |
| *"El archivo no contiene movimientos para importar"* | Sin filas de datos | Verifique el archivo |
| *"El auxiliar contiene movimientos que no cumplen partida doble"* | Algún movimiento no cuadra | Corrija el archivo. **Ningún movimiento se importa si uno falla** |
| *"El auxiliar contiene un movimiento duplicado por fecha, iglesia, cuenta bancaria y referencia"* | Duplicado dentro del archivo, o ya existe en el sistema | Revise el archivo y las minutas ya registradas |
| *"…trae débito y crédito en la misma línea"* | Una fila con ambos valores | Separe en dos filas |
| *"…no trae monto válido"* | Fila sin importe legible | Revise el formato numérico de esa fila |
| *"El período AAAA-MM está cerrado…"* | Algún movimiento cae en un mes cerrado | Divida el archivo o solicite la reapertura |

**Estado de Situación Financiera**

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"No se encontraron los encabezados Descripción y Saldo Final…"* | Faltan las columnas obligatorias | Renombre las columnas (Anexo B.5) |
| *"No se encontraron valores numéricos en la columna Saldo Final"* | La columna trae texto, o números como texto | Convierta la columna a número en Excel |
| *"El archivo no contiene líneas con Saldo Final"* | Encabezados válidos, sin datos | Verifique el archivo |

---

### 14.8 Cierre de períodos

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"Período inválido; use el formato AAAA-MM"* | Formato incorrecto | Use AAAA-MM (ejemplo: 2026-09) |
| *"Ese período ya está registrado"* | Ya existe en la lista | Búsquelo en la tabla |
| *"El período no está registrado; ábralo antes de administrarlo"* | Se intentó cerrar sin abrirlo | Ábralo con **Abrir período** |
| *"El período ya está cerrado"* / *"El período ya está en revisión"* | Otra persona lo cambió antes | Actualice la pantalla |
| *"El período está cerrado; reabralo antes de marcarlo en revisión"* | Orden incorrecto de acciones | Reabra primero |
| *"Solo se puede reabrir un período cerrado"* | El período no está cerrado | Verifique el estado en la tabla |
| *"Indique el motivo de la reapertura con al menos 15 caracteres"* | Motivo vacío o corto | Escriba la justificación real (cap. 13) |
| El botón **Cerrar período** está deshabilitado | Hay impedimentos | Pase el cursor sobre el botón: el sistema los lista. Suelen ser conciliaciones en borrador o balanzas con diferencias |

---

### 14.9 Tasas de cambio

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"La tasa es obligatoria"* / *"La tasa de cambio debe ser mayor que cero"* | Tasa vacía, cero o negativa | Digite la tasa correcta |
| *"Indique la fuente de la tasa (por ejemplo, BCN o el banco correspondiente)"* | Falta la fuente | Documente de dónde salió la tasa |
| *"Ya existe una tasa registrada para esa fecha; edítela en vez de crear una nueva"* | Duplicado | Búsquela en la tabla y edítela |
| *"Moneda inválida; use NIO o USD"* | Moneda no soportada | El sistema solo maneja USD → NIO |
| *"Tasa de cambio no encontrada"* | El registro ya no existe | Actualice la pantalla |

> **Corregir una tasa nunca recalcula minutas ya guardadas.** Si el error afectó asientos ya registrados, hay que anularlos y volver a registrarlos (cap. 12).

---

### 14.10 Administración

**Usuarios y roles**

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"Usuario inválido; use 3 a 40 caracteres en minúsculas, números, punto, guion o guion bajo"* | Nombre de usuario con formato inválido | Corrija el nombre |
| *"La contraseña debe tener al menos 8 caracteres"* | Contraseña corta | Use una más larga |
| *"No se pudo crear el usuario; verifique que el nombre de usuario no exista"* | Usuario duplicado | Elija otro nombre |
| *"No puede cambiar su propio rol ni inactivar su usuario"* | Protección contra autobloqueo | Pida a otro administrador que lo haga |
| *"El rol administrador debe conservar permisos administrativos"* | Se intentó dejar al administrador sin permisos | Protección del sistema: no se puede |
| *"La lista de permisos contiene valores inválidos"* | Permiso inexistente | Use los del Anexo A |

**Catálogo, iglesias y cuentas bancarias**

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"El código debe tener 8 dígitos"* / *"El código de iglesia debe tener 8 dígitos"* | Longitud incorrecta | Use exactamente 8 caracteres |
| *"No se pudo crear la cuenta; verifique que el código no exista"* | Código duplicado | Búsquela en el catálogo: puede estar inactiva |
| *"Ya existe una cuenta bancaria con ese número"* | Número duplicado | Búsquela: puede estar inactiva |
| *"No se puede cambiar la moneda: esta cuenta ya tiene minutas o estados de cuenta registrados en su moneda actual"* | La cuenta tiene historial | **No se puede cambiar.** Cree una cuenta nueva y desactive la incorrecta (ver 8.4) |
| *"El nombre de la cuenta bancaria es obligatorio"* / *"El número de cuenta es obligatorio"* | Campos vacíos | Complete los campos |
| *"No hay cambios para guardar"* | Se guardó sin modificar nada | No es un error |

**Configuración institucional**

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"El logo institucional debe ser una ruta interna que comience con /"* | Se puso una dirección externa | Use una ruta interna, por ejemplo `/universal-nicaragua-login.png` |
| *"… admite hasta N caracteres"* / *"… no puede quedar vacío"* | Longitud del campo | Ajuste el texto |

---

### 14.11 Reportes

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *"No tiene permiso para descargar reportes"* | Su rol solo permite ver | Solicite la descarga al Contador general o al Auditor |
| *"La exportación Excel está disponible para el flujo de efectivo"* | Se pidió Excel de otro reporte | Solo el flujo de efectivo tiene formato oficial en Excel |
| *"El reporte no contiene los períodos requeridos para exportar Excel"* | Faltan Estados de Situación Financiera importados | Importe el estado de cada período que debe aparecer (ver 7.1) |
| *"No se pudo cargar la plantilla de flujo de efectivo"* | La plantilla oficial no está disponible en el servidor | Reporte: es un problema de instalación |
| *"Granularidad inválida"* / *"Período inválido"* / *"Mes inválido"* / *"Trimestre inválido"* | Parámetro fuera de rango | Vuelva a seleccionar desde la pantalla |
| El reporte sale vacío | No hay datos para el período, o falta el estado financiero importado | Verifique en Importaciones que el período esté cargado |

---

### 14.12 Errores del sistema

Los mensajes que empiezan con **"No se pudo…"** indican una falla del servidor o de la base de datos, no un error del usuario.

| Mensaje | Qué significa |
|---|---|
| *"No se pudo guardar el movimiento"* | La operación falló al escribir en la base de datos |
| *"No se pudo cargar el historial bancario"* | El sistema no pudo leer los datos |
| *"No se pudo generar la conciliación bancaria"* | La operación falló a mitad de camino |
| *"No se pudo conectar con el servicio de…"* | El navegador no alcanzó al servidor |

**Qué hacer**

1. **Reintente una vez.** Puede ser una interrupción momentánea.
2. Si vuelve a fallar, **no siga reintentando**: anote la hora exacta, la pantalla y qué estaba haciendo.
3. Escale al responsable técnico con esa información.

**Caso especial: conflicto contable**

> *"Conflicto contable: actualice la pantalla y vuelva a intentar"*

**No es una falla.** Significa que otra persona estaba guardando algo sobre los mismos datos en ese mismo instante, y el sistema serializó las operaciones para no corromper la contabilidad.

**Qué hacer:** presione **Actualizar**, verifique que su cambio no se haya aplicado ya, y repita la operación.

---

### 14.13 Cuándo y a quién escalar

| Síntoma | Escalar a | Qué informar |
|---|---|---|
| *"No tiene permiso para…"* | Administrador | Su usuario, la pantalla y la operación |
| Falta una tasa de cambio | Administrador | La fecha exacta |
| Falta una cuenta o iglesia | Administrador | El código y el nombre |
| Un período está cerrado y necesita registrar | Administrador | El período y la justificación |
| Una conciliación fue rechazada | Operador bancario | El texto de las observaciones |
| *"No se pudo…"* (después de un reintento) | **Responsable técnico** | Hora exacta, pantalla, operación, captura |
| *"El sistema no está configurado para operar de forma segura"* | **Responsable técnico, de inmediato** | Hora y pantalla |
| El sistema no carga o va muy lento | **Responsable técnico** | Hora, cuántas personas lo notan |

### 14.14 Qué incluir al reportar un problema

Un reporte útil tiene cinco datos. Sin ellos, el diagnóstico se vuelve adivinanza:

1. **Usuario** con el que ingresó.
2. **Fecha y hora** exactas.
3. **Pantalla** donde ocurrió.
4. **Qué estaba haciendo** (paso a paso, no "no funciona").
5. **Captura de pantalla** con el mensaje completo visible.

> **La bitácora de auditoría conserva el registro de la operación**, incluidos los intentos rechazados. Con la hora y el usuario, el responsable técnico puede reconstruir qué pasó.

---

> _Este capítulo se actualiza durante la capacitación y los primeros meses de operación. Cuando aparezca una consulta recurrente que no esté aquí, agréguela con el mismo formato: **mensaje → qué pasó → qué hacer → a quién escalar**._

---

## 15. Respaldos

### 15.1 Cómo funciona

El respaldo de la base de datos **no es un botón dentro del SIC**. Es un proceso que corre solo, todas las noches, directamente en el servidor donde vive la base de datos — deliberadamente separado de la aplicación, para que siga funcionando aunque el SIC esté caído.

| | |
|---|---|
| **Qué respalda** | Toda la base de datos: catálogo, minutas, conciliaciones, usuarios, auditoría — todo |
| **Cuándo** | Automáticamente, una vez por noche |
| **Formato** | Un archivo `.dump` de PostgreSQL, comprimido, restaurable con las herramientas estándar de PostgreSQL |
| **Retención** | Los últimos 30 días se conservan en el servidor; los más viejos se eliminan automáticamente |
| **Dónde se ve el resultado** | **Configuración → Respaldo de la base de datos** (solo el Administrador) |

> **Este sistema entrega el mecanismo del respaldo.** Que efectivamente esté programado y corriendo en el servidor de la institución es responsabilidad de quien administra ese servidor — ver 15.3.

### 15.2 Cómo leer la pantalla

![Panel de respaldo de la base de datos en Configuración](img/admin-respaldos.png)

**Configuración → Respaldo de la base de datos** muestra un estado con tres colores, sin necesidad de tocar una terminal:

| Estado | Qué significa | Qué hacer |
|---|---|---|
| 🟢 **Al día** | Hay un respaldo correcto de las últimas 26 horas | Nada — está funcionando |
| 🟡 **Atrasado** | El último respaldo correcto tiene más de 26 horas | Avisar al responsable técnico; puede ser un retraso de una sola noche |
| 🔴 **Crítico** | El último intento falló, o no hay ningún respaldo correcto en más de 50 horas | Avisar al responsable técnico **el mismo día** |
| 🔴 **Sin respaldos** | Nunca se ha registrado ningún respaldo | El proceso automático probablemente no está programado en el servidor — avisar de inmediato |

Debajo del estado hay una tabla con el historial: fecha, si fue automático o manual, si terminó correcto, el tamaño del archivo, y si además se copió a un destino externo.

**Botón "Generar respaldo ahora".** El Administrador puede pedir un respaldo fuera del horario nocturno habitual, sin esperar a la próxima medianoche. El botón no genera el respaldo al instante: dentro del SIC no es técnicamente posible ejecutarlo directamente. Lo que hace es dejar la solicitud pedida, y el servidor la atiende en su próxima corrida programada (pensada para cada pocos minutos — ver 15.3). Mientras la solicitud está pendiente, la pantalla muestra un aviso ("Solicitud de respaldo enviada por…, en espera de que el servidor la genere") y el botón queda deshabilitado, para que dos administradores no encolen dos respaldos a la vez. Si la solicitud lleva más de 10 minutos sin atenderse, el aviso cambia de tono y sugiere verificar que el proceso corto esté programado en el servidor.

> **Esta pantalla no genera respaldos por sí sola ni permite descargarlos.** Solo informa y, con el botón, solicita. Restaurar un respaldo es una tarea técnica que se hace directamente en el servidor — ver 15.4.

### 15.3 Para el responsable técnico: instalación

Dos archivos, ambos en `scripts/` del proyecto:

| Script | Para qué |
|---|---|
| `respaldo-postgresql.sh` | El que corre todas las noches. Hace el respaldo y registra el resultado |
| `restaurar-postgresql.sh` | El que se usa para restaurar, a mano, cuando hace falta |

**Instalación en el servidor Linux:**

1. Copie ambos scripts al servidor y déles permiso de ejecución: `chmod +x respaldo-postgresql.sh restaurar-postgresql.sh`.
2. Configure autenticación sin contraseña interactiva con un archivo `~/.pgpass` (permisos `600`):
   ```
   localhost:5432:sic:usuario:contraseña
   ```
3. Programe la ejecución nocturna con `cron` (por ejemplo, todas las noches a la 1:00 a. m.):
   ```
   0 1 * * * DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/sic" /ruta/a/respaldo-postgresql.sh >> /var/log/sic-respaldo.log 2>&1
   ```
4. **Programe también el proceso corto que atiende el botón "Generar respaldo ahora"** (ver 15.2), cada pocos minutos. Cuando no hay ninguna solicitud pendiente termina de inmediato, sin respaldar nada, así que no tiene costo dejarlo corriendo seguido:
   ```
   */5 * * * * DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/sic" /ruta/a/respaldo-postgresql.sh --atender-solicitudes >> /var/log/sic-respaldo-solicitudes.log 2>&1
   ```
5. **Configure un destino secundario.** Un respaldo que vive solo en el mismo servidor no protege contra que ese servidor falle. Defina `SIC_RESPALDOS_DESTINO_SECUNDARIO` apuntando a una unidad de red, un disco externo, o una carpeta sincronizada a otro sitio:
   ```
   SIC_RESPALDOS_DESTINO_SECUNDARIO="/mnt/respaldo-externo/sic"
   ```
6. Verifique que corrió: `Configuración → Respaldo de la base de datos` debe mostrar **Al día** al día siguiente.

**Variables de entorno que acepta el script** (todas opcionales salvo `DATABASE_URL`):

| Variable | Para qué | Por defecto |
|---|---|---|
| `SIC_RESPALDOS_DIR` | Carpeta donde se guardan los archivos | `/var/backups/sic` |
| `SIC_RESPALDOS_DESTINO_SECUNDARIO` | Segunda carpeta a la que se copia cada respaldo | (ninguna) |
| `SIC_RESPALDOS_RETENCION_DIAS` | Días que se conservan los respaldos locales | 30 |

### 15.4 Para el responsable técnico: restauración

**Nunca se restaura sobre la base de datos en uso sin autorización expresa de la institución** — reemplaza todo su contenido.

```
./restaurar-postgresql.sh sic-20260315-010000.dump --url postgresql://usuario:contraseña@host:5432/sic
```

Sin `--confirmar`, el comando solo **lista las tablas que contiene el respaldo**, sin tocar nada — úselo para verificar que es el archivo correcto antes de continuar. Agregar `--confirmar` ejecuta la restauración real, dentro de una sola transacción (si algo falla a mitad de camino, no queda una restauración a medias), y al terminar muestra los conteos de las tablas principales para verificar que el resultado tiene sentido.

### 15.5 Prueba periódica de restauración

Un respaldo que nunca se probó restaurar **no es un respaldo confiable, es una suposición**. Recomendado: una vez por trimestre, restaurar el respaldo más reciente en una base de datos aparte (nunca en la de producción) y confirmar que los conteos de usuarios, minutas y cuentas coinciden con lo esperado. Regístrelo como una tarea recurrente del responsable técnico.

### 15.6 Lo que este mecanismo no cubre

- **No respalda el código del sistema** — eso lo cubre el control de versiones (Git), independiente de este proceso.
- **No sustituye una política de continuidad del negocio** completa (qué hacer si el servidor físico se pierde, cuánto tiempo de inactividad es aceptable, etc.) — eso debe definirlo la institución con su responsable técnico.
- **No verifica automáticamente que el respaldo sea restaurable** — por eso 15.5 es una tarea manual, no automática.

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
| **Período** | Formato AAAA-MM, obligatorio |
| **Columnas** | Cuenta, Descripción, Saldo Inicial, Débitos, Créditos, Saldo Final |

### B.3 Catálogo contable

| Aspecto | Requisito |
|---|---|
| **Formatos** | `.csv`, `.xlsx`, `.xls` · máximo 10 MB |
| **Período** | No aplica |
| **Obligatorias** | Código **y** Descripción. Sin ambas: *"No se encontraron encabezados de catálogo: Código/Cuenta y Descripción/Nombre"* |

| Dato | Nombres reconocidos |
|---|---|
| **Código** | código, codigo, cuenta, cuenta código, código cuenta |
| **Descripción** | descripción, nombre, nombre cuenta, cuenta nombre |
| **Cuenta padre** | cuenta padre, padre, código padre |
| **Naturaleza** | naturaleza, tipo saldo, saldo normal |
| **Movimiento** | movimiento, cuenta movimiento, es cuenta movimiento, detalle, afectable |
| **Flujo** | flujo, clasificación flujo, estado flujo, tipo flujo |
| **Estado** | estado, estatus |

**Valores que el sistema interpreta**

| Columna | Se lee como sí / deudora / activa | Se lee como no / acreedora / inactiva |
|---|---|---|
| Movimiento | `si` `s` `true` `1` `x` `detalle` `movimiento` `afectable` | `no` `n` `false` `0` `mayor` `titulo` `grupo` |
| Naturaleza | `deudora` `deudor` `debito` `debe` | `acreedora` `acreedor` `credito` `haber` |
| Estado | (cualquier otro valor) | `inactiva` `inactivo` `baja` `0` |
| Flujo | `operación` `inversión` `financiamiento` | `no aplica` `n/a` `na` |

> **El código debe tener exactamente 8 caracteres.** Es una restricción de la base de datos: un archivo con códigos de otra longitud será rechazado.

### B.4 Auxiliar contable

| Aspecto | Requisito |
|---|---|
| **Formatos** | `.csv`, `.xlsx`, `.xls` · máximo 10 MB |
| **Período** | No aplica; lo determina la fecha de cada movimiento |
| **Obligatorias** | Fecha **y** Cuenta. Sin ambas: *"No se encontraron encabezados de auxiliar: Fecha y Cuenta"* |

| Dato | Nombres reconocidos |
|---|---|
| **Fecha** | fecha, fecha movimiento, fecha contable, fecha documento |
| **Iglesia** | iglesia, código iglesia, sucursal, centro, centro costo |
| **Cuenta bancaria** | cuenta bancaria, banco, cuenta banco, número cuenta bancaria |
| **Referencia** | referencia, documento, número documento, comprobante, minuta |
| **Concepto** | concepto, descripción, detalle, glosa |
| **Cuenta contable** | cuenta, código cuenta, cuenta código |
| **Nombre de cuenta** | nombre cuenta, cuenta nombre, descripción cuenta |
| **Tipo** | tipo, naturaleza movimiento, débito crédito |
| **Débito** | débito, debe, cargo, egreso |
| **Crédito** | crédito, haber, abono |
| **Monto** | monto, importe, valor |
| **Afecta banco** | afecta banco, afecta cuenta bancaria, banco afectado, línea banco |
| **Monto original (USD)** | monto original, importe original, valor original, monto usd, importe usd |

> ### ⚠️ Este importador crea minutas reales
>
> No es una carga informativa: inserta asientos contables con sus líneas, igual que la captura manual. Aplica las mismas reglas:
>
> - valida partida doble — *"El auxiliar contiene movimientos que no cumplen partida doble"*;
> - rechaza duplicados — *"El auxiliar contiene un movimiento duplicado por fecha, iglesia, cuenta bancaria y referencia"*;
> - **no escribe en períodos cerrados**.
>
> **No hay deshacer masivo.** Si importa un archivo equivocado, cada minuta creada debe anularse una por una desde el módulo Minutas. Revise el archivo antes de importarlo.

### B.5 Estado de Situación Financiera

| Aspecto | Requisito |
|---|---|
| **Formatos** | `.csv`, `.xlsx`, `.xls` · máximo 10 MB |
| **Período** | Formato AAAA-MM, obligatorio |
| **Encabezados** | Una columna **Descripción** (o *Concepto*) y una columna **Saldo Final** con valores numéricos |

**Mensajes de error**

| Mensaje | Causa |
|---|---|
| *"No se encontraron los encabezados Descripción y Saldo Final del Estado de Situación Financiera"* | Faltan las columnas obligatorias |
| *"No se encontraron valores numéricos en la columna Saldo Final"* | La columna existe pero trae texto, o los números vienen como texto |
| *"El archivo no contiene líneas con Saldo Final"* | El archivo tiene encabezados pero ninguna fila con dato |
| *"El archivo no contiene hojas para procesar"* | El Excel está vacío o dañado |

> **Es la fuente exclusiva del estado de flujo de efectivo.** El reporte compara el *Saldo Final* de este estado entre períodos. Importe uno por cada mes que deba aparecer en el flujo.

**Revisión automática al importar**

El sistema revisa el archivo antes de guardarlo y deja el resultado por escrito en la columna Estado:

| Estado | Cuándo | Consecuencia |
|---|---|---|
| **Procesado** | El estado cuadra y no hay conceptos ambiguos | Se puede continuar |
| **Con diferencias** | Total ACTIVOS no coincide con pasivos más patrimonio, o un concepto se repite con importes distintos | **Impide cerrar el período** |
| **Error** | El archivo no se pudo leer | Revise formato y encabezados |

Bajo el estado aparece el motivo. Ejemplos reales del texto que muestra:

- *"El estado no cuadra: Total ACTIVOS 1000.00 contra pasivos más patrimonio 950.00, diferencia 50.00."*
- *"El concepto «Total INCREMENTO O DECREMENTO» aparece 2 veces con importes distintos (500.00, 700.00). Los reportes no pueden decidir cuál usar."*
- *"El concepto «Total INCREMENTO O DECREMENTO» aparece 2 veces con el mismo importe; se toma una sola vez."* — informativo, no bloquea.

> **Un concepto repetido con el mismo importe no es problema** y el archivo se importa normalmente: el formato de origen repite alguna línea de total. Solo bloquea cuando los importes difieren, porque ahí el reporte tendría que elegir uno.

> **Si falta Total ACTIVOS o el total de pasivos más patrimonio**, el sistema no puede verificar el cuadre y lo dice explícitamente en vez de darlo por bueno.

---

## Anexo C — Glosario

| Término | Significado en el SIC |
|---|---|
| **Minuta** | Asiento contable registrado en el sistema. Se compone de líneas de débito y crédito que deben cuadrar |
| **Partida doble** | Regla contable que el sistema valida: el total de débitos debe ser igual al total de créditos |
| **Asiento de diario** | Minuta que cuadra entre cuentas contables sin afectar ninguna cuenta bancaria: ajustes, reclasificaciones, provisiones. No entra en conciliación |
| **Línea bancaria** | La línea de la minuta que representa el movimiento real de dinero en la cuenta bancaria. **No** es necesariamente la suma de todos los débitos |
| **Balanza de comprobación** | Reporte mensual con saldos iniciales, movimientos y saldos finales por cuenta |
| **Auxiliar contable** | Archivo de movimientos que el sistema convierte en minutas cuadradas al importarlo |
| **Estado de Situación Financiera** | Archivo de saldos finales por período. Es la fuente del estado de flujo de efectivo |
| **Cuenta de movimiento** | Cuenta que admite asientos directos. Solo estas aparecen al registrar una minuta |
| **Campos detectados** | Lo que el importador reconoció del archivo. Si falta un campo esperado, los encabezados están mal |
| **Conciliación bancaria** | Cruce entre el estado de cuenta del banco y las minutas registradas en libros |
| **Línea pendiente** | Movimiento del estado de cuenta que aún no se ha enlazado con una minuta |
| **Pendiente de tasa** | Línea en dólares cuya tasa de cambio no está registrada en el catálogo. No se puede enlazar hasta registrarla |
| **Período contable** | Un mes calendario (AAAA-MM). Puede estar abierto, en revisión o cerrado |
| **Anular** | Dejar sin efecto una minuta conservando su detalle y registrando el motivo. No es borrar |
| **Tasa aplicada** | La tasa de cambio con la que se convirtió un movimiento. Queda congelada y no se recalcula |
| **Bitácora de auditoría** | Registro permanente de quién hizo qué, cuándo y con qué resultado |

---

_Fin del documento._
