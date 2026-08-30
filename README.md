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

## Estructura

```text
app/                 Interfaz principal y rutas API
  api/auth/          Inicio, consulta y cierre de sesión
  api/movimientos/   Registro y consulta de movimientos contables
  api/iglesias/      Catálogo de iglesias disponible para movimientos
  api/banco/         Consulta y carga de reportes bancarios
  api/catalogo/      Administración de cuentas contables
  api/reportes/      Generación y descarga de reportes
  api/auditoria/     Consulta de eventos de auditoría
db/                  Esquema Drizzle y acceso a PostgreSQL
drizzle/             Migraciones SQL
lib/                 Autenticación y lógica de reportes
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
| `/api/banco/reportes` | `GET`, `POST` | Consulta o recibe archivos bancarios. |
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

`pnpm test` está disponible, pero las pruebas actuales parecen heredadas de una plantilla de vista previa y no reflejan completamente la interfaz SIC; deben actualizarse antes de utilizarlas como criterio de aceptación.

Pendiente para producción: conciliación bancaria real, pruebas alineadas al flujo SIC, PostgreSQL administrado, secretos, HTTPS, monitoreo y respaldos.

## Soporte

Al informar un incidente, incluya comando ejecutado, versiones de Node y pnpm, navegador, error completo y pasos para reproducirlo. Nunca comparta contraseñas, cookies, secretos ni datos financieros reales.
