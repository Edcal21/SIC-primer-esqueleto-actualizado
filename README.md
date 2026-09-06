# SIC — Sistema de Información Contable

Guía técnica del sistema web SIC. Implementa una interfaz contable con inicio de sesión por roles, catálogo contable, importación de balanza, reportes, archivos bancarios y auditoría.

> Estado: sistema funcional conectado a PostgreSQL. Antes de usar información financiera real, configure secretos, respaldos y controles operativos del entorno.

## Arquitectura

| Capa | Tecnología | Función |
| --- | --- | --- |
| Interfaz | React 19, TypeScript y CSS | Pantallas, módulos y navegación basada en permisos. |
| Aplicación | Vinext y Vite 8 | Renderizado y rutas tipo App Router. |
| Runtime | Cloudflare Workers y Wrangler | Entorno local y destino de despliegue. |
| Datos | Drizzle ORM y PostgreSQL | Persistencia relacional del catálogo contable. |
| Migraciones | Drizzle Kit | Generación de SQL desde TypeScript. |

## Requisitos

- Node.js 22.13 o superior.
- pnpm 9 o posterior (recomendado; el repositorio incluye `pnpm-lock.yaml`).
- PostgreSQL 14 o superior para habilitar persistencia.

```bash
node --version
pnpm --version
```

## Instalación y ejecución local

Desde la raíz del repositorio:

```bash
pnpm install
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000). Detenga el servidor con `Ctrl+C`.

También se puede usar `npm install` y `npm run dev`, aunque pnpm es la opción preferida para respetar el lockfile.

## Comandos

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Inicia Vinext y Wrangler en desarrollo. |
| `pnpm dev:lan` | Inicia el servidor accesible desde la red local. |
| `pnpm build` | Genera la compilación de producción en `dist/`. |
| `pnpm start` | Ejecuta la compilación generada; requiere `pnpm build`. |
| `pnpm lint` | Ejecuta ESLint. |
| `pnpm test` | Compila y ejecuta las pruebas Node.js. |
| `pnpm db:generate` | Genera migraciones desde `db/schema.ts`. |
| `pnpm db:migrate` | Aplica las migraciones pendientes a PostgreSQL. |
| `pnpm db:push` | Sincroniza el esquema directamente durante desarrollo. |
| `pnpm db:studio` | Abre Drizzle Studio para inspeccionar los datos. |

## Acceso de desarrollo

Los usuarios locales están definidos en `lib/auth.ts`:

| Usuario | Contraseña | Rol | Acceso |
| --- | --- | --- | --- |
| `administrador` | `Admin2026!` | Administrador | Administración de usuarios, roles y auditoría. |
| `contador` | `Conta2026!` | Contador general | Movimientos, catálogo, bancos, importaciones y reportes. |
| `banco` | `Banco2026!` | Operador bancario | Consulta y carga de archivos bancarios. |
| `auditor` | `Audit2026!` | Auditor general | Consulta de bancos, reportes y auditoría. |

Estas credenciales son exclusivamente de desarrollo. La migración `0002_security_users_roles` crea las tablas `roles`, `permisos`, `roles_permisos` y `usuarios`, y carga usuarios iniciales con hashes existentes. La aplicación exige PostgreSQL para autenticar; el fallback local de `lib/auth.ts` solo se activa si define `SIC_ALLOW_LOCAL_AUTH_FALLBACK=true`.

## Sesiones y seguridad

- Las contraseñas locales se verifican con PBKDF2-SHA256.
- La sesión se guarda en una cookie `HttpOnly`, `SameSite=Strict`, firmada con HMAC-SHA256 y válida durante ocho horas.
- En producción configure un secreto aleatorio, único y protegido:

```bash
SIC_SESSION_SECRET="un-secreto-largo-y-aleatorio"
```

No use el secreto de respaldo de `lib/auth.ts` fuera del entorno local. Para producción quedan pendientes HTTPS forzado, rotación de sesiones, monitoreo, respaldos y gestión segura de secretos.

## Base de datos y catálogo

El esquema PostgreSQL está en `db/schema.ts` y las migraciones versionadas están en `drizzle/`. El catálogo se mantiene en `cuentas_contables`. Los asientos se guardan independientemente en `movimientos_cuentas` y sus líneas de crédito o débito en `detalles_movimientos`; esta última conserva el código y nombre de cuenta sin depender de una clave foránea al catálogo.

En Windows, con PostgreSQL instalado, ejecute desde la raíz:

```powershell
.\scripts\setup-postgres.ps1
```

El asistente solicita la contraseña sin mostrarla, crea la base `sic` si no existe, guarda `DATABASE_URL` en `.dev.vars` y aplica las migraciones. `.dev.vars` está ignorado por Git y nunca debe confirmarse en el repositorio. Como alternativa, copie `.dev.vars.example` a `.dev.vars`, complete la URL y ejecute `pnpm db:migrate`.

Compruebe la conexión con la aplicación en ejecución visitando `http://localhost:3000/api/health/database`. Una conexión correcta devuelve `{ "database": "connected" }`.

El catálogo puede administrarse desde la pantalla “Catálogo contable”. Además, cada balanza importada crea o actualiza cuentas activas en `cuentas_contables` cuando detecta códigos válidos de 8 dígitos. Los reportes financieros se generan desde las balanzas importadas; si no existe información para el período solicitado, el sistema muestra un mensaje de falta de datos en vez de usar cifras de relleno.

## Bancos y conciliación bancaria

El estado de cuenta se procesa en el momento de la carga: `lib/banco.ts` interpreta CSV, XLS y XLSX,
reconoce encabezados en español o inglés (fecha, descripción o concepto, referencia, débito o cargo,
crédito o abono, monto y saldo) y guarda cada movimiento en `lineas_reporte_bancario`. Si el archivo
no es legible, el reporte queda registrado con estado `error` y el motivo, y el intento se audita.
Un archivo con una sola columna de monto se interpreta con el signo: negativo es débito y positivo es crédito.

La conciliación se genera sobre un estado de cuenta procesado y compara el banco contra las minutas
registradas en `movimientos_cuentas` para esa misma cuenta bancaria y período:

- **Neto del banco**: créditos menos débitos de todas las líneas del estado de cuenta.
- **Conciliado**: neto de las líneas enlazadas con una minuta.
- **Diferencia pendiente**: neto de las líneas que aún no se enlazaron ni descartaron.
- **Minutas sin respaldo bancario**: movimientos de libros de esa cuenta y período que no aparecen enlazados.

Al generarla, el sistema enlaza automáticamente solo las líneas con una **única** minuta coincidente por
monto y fecha; nunca decide entre empates. El resto se enlaza o descarta manualmente. Una conciliación
solo puede aprobarse cuando no quedan líneas pendientes, y aprobarla o rechazarla exige el permiso
`conciliacion:aprobar`, separado del permiso de carga `banco:cargar` para mantener segregación de funciones.
Cada enlace, descarte, aprobación y rechazo queda registrado en auditoría.

La migración `0017_conciliacion_bancaria` crea `lineas_reporte_bancario` y `conciliaciones_bancarias`,
amplía `reportes_bancarios` con cuenta bancaria, período y totales, agrega el permiso
`configuracion:administrar` y otorga al rol administrador los permisos `banco:ver`,
`conciliacion:aprobar` y `configuracion:administrar`.

## Estructura

```text
app/                 Interfaz principal y rutas API
  api/auth/          Inicio, consulta y cierre de sesión
  api/movimientos/   Registro y consulta de movimientos contables
  api/iglesias/      Catálogo de iglesias disponible para movimientos
  api/banco/         Procesamiento y consulta de estados de cuenta bancarios
  api/conciliaciones/ Conciliación bancaria entre estado de cuenta y minutas
  api/cuentas-bancarias/ Administración de cuentas bancarias
  api/configuracion/ Configuración institucional editable
  api/catalogo/      Administración de cuentas contables
  api/reportes/      Generación y descarga de reportes
  api/auditoria/     Consulta de eventos de auditoría
db/                  Esquema Drizzle y acceso a PostgreSQL
drizzle/             Migraciones SQL
lib/                 Autenticación, auditoría, reportes y procesamiento bancario
worker/              Entrada de Cloudflare Worker
public/              Recursos estáticos
tests/               Pruebas automatizadas
```

## Rutas API

| Ruta | Método | Función |
| --- | --- | --- |
| `/api/auth/login` | `POST` | Autentica y crea la sesión. |
| `/api/auth/me` | `GET` | Devuelve la sesión actual. |
| `/api/auth/logout` | `POST` | Elimina la sesión. |
| `/api/movimientos` | `GET`, `POST` | Consulta o registra encabezados y detalles de movimientos. |
| `/api/iglesias` | `GET` | Lista las iglesias activas y sus códigos. |
| `/api/banco/reportes` | `GET`, `POST` | Consulta el historial y procesa estados de cuenta guardando cada movimiento. |
| `/api/banco/reportes/:id` | `GET` | Devuelve el estado de cuenta con sus líneas persistidas. |
| `/api/conciliaciones` | `GET`, `POST` | Consulta conciliaciones y genera una nueva desde un estado de cuenta procesado. |
| `/api/conciliaciones/:id` | `GET`, `PATCH` | Detalle de la conciliación y acciones de enlace, descarte, aprobación o rechazo. |
| `/api/cuentas-bancarias` | `GET`, `POST` | Consulta y crea cuentas bancarias institucionales. |
| `/api/cuentas-bancarias/:numeroCuenta` | `PATCH` | Actualiza nombre, moneda o estado de una cuenta bancaria. |
| `/api/configuracion` | `GET`, `PUT` | Consulta y edita la configuración institucional. |
| `/api/catalogo/cuentas` | `GET`, `POST` | Consulta y crea cuentas contables. |
| `/api/catalogo/cuentas/:codigo` | `PATCH` | Actualiza cuenta contable, estado o uso en movimientos. |
| `/api/reportes` | `GET` | Consulta reportes disponibles. |
| `/api/reportes/:tipo` | `GET` | Genera un reporte y permite salida CSV. |
| `/api/auditoria` | `GET` | Consulta eventos de auditoría. |

Las rutas aplican permisos de servidor según el rol autenticado. Revise configuración de entorno, secretos y política de despliegue antes de publicar la aplicación.

## Validación y limitaciones

Antes de integrar cambios, ejecute:

```bash
pnpm lint
pnpm build
```

```bash
pnpm test
```

`pnpm test` compila el proyecto y ejecuta las pruebas de `tests/`: renderizado del acceso, ausencia de datos
de muestra en los archivos de ejecución, verificación de que todo módulo del menú tiene pantalla conectada y
comprobación de que la carga bancaria persiste líneas y de que conciliación y configuración exigen permisos.

Pendiente para producción, en orden de prioridad:

1. **Pruebas del intérprete bancario con archivos reales de cada banco.** `lib/banco.ts` cubre los encabezados
   más comunes, pero cada banco publica su propio formato; valide un archivo real por banco antes de operar.
2. **Consulta y anulación de minutas desde la interfaz.** `GET /api/movimientos` existe y no tiene pantalla;
   hoy las minutas se consultan a través de la conciliación y de los reportes.
3. **CRUD de iglesias desde administración.** Hoy el catálogo de iglesias se mantiene por migración.
4. **Conversión de moneda para cuentas en USD.** El sistema opera en córdobas; una cuenta bancaria en USD se
   concilia contra minutas registradas en córdobas sin aplicar tipo de cambio.
5. **Retención del archivo bancario original.** Se guardan los movimientos interpretados, no el archivo fuente.
6. PostgreSQL administrado, secretos, HTTPS forzado, monitoreo y respaldos del entorno.

## Soporte

Al informar un incidente, incluya comando ejecutado, versiones de Node y pnpm, navegador, error completo y pasos para reproducirlo. Nunca comparta contraseñas, cookies, secretos ni datos financieros reales.
