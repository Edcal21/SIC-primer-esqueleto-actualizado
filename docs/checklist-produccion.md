# Checklist de salida a produccion

Use este checklist en un ambiente de ensayo antes de habilitar datos reales.

## 1. Base de datos

- Crear una base PostgreSQL limpia para produccion.
- Usar un pooler entre Cloudflare Workers y PostgreSQL: Supabase Pooler, PgBouncer o Cloudflare Hyperdrive.
- Configurar respaldos automaticos diarios y probar una restauracion.
- Aplicar migraciones:

```bash
DATABASE_URL="postgresql://..." pnpm db:migrate
```

## 2. Secretos de Cloudflare

Declarar los secretos con Wrangler:

```bash
wrangler secret put DATABASE_URL
wrangler secret put SIC_SESSION_SECRET
```

Generar `SIC_SESSION_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

`SIC_ENTORNO=produccion` queda en `wrangler.jsonc`.

## 3. Usuarios iniciales

- Iniciar sesion con cada usuario sembrado.
- Cambiar la contrasena obligatoria en el primer ingreso.
- Verificar que solo queden activos los usuarios operativos:
  - `contador`
  - `finanzas`
  - `auditor`
- Confirmar que `administrador` este inactivo.

## 4. QA por rol con usuario final

### Finanzas

- Inicia sesion.
- Registra una minuta.
- Carga un reporte bancario.
- Confirma que no ve el centro de reportes financieros.
- Confirma que no puede conciliar ni aprobar conciliaciones.

### Contador

- Inicia sesion.
- Administra catalogo, iglesias y cuentas bancarias.
- Importa catalogo contable.
- Importa balanza valida contra catalogo existente.
- Genera conciliacion.
- Concilia, descarta y reabre lineas.
- Rechaza una conciliacion, luego usa `reabrir_conciliacion` desde la UI/API cuando corresponda.
- Aprueba conciliacion.
- Descarga reportes financieros.
- Cierra periodo.
- Reabre periodo con motivo y vuelve a cerrarlo.

### Auditor

- Inicia sesion.
- Consulta bancos, reportes y auditoria.
- Verifica que no pueda registrar minutas, cargar bancos, conciliar, aprobar, importar ni administrar usuarios.

## 5. Deploy

Construir y publicar:

```bash
pnpm deploy
```

Despues del deploy:

- Probar `POST /api/auth/login`.
- Confirmar que una configuracion sin `SIC_SESSION_SECRET` no permite iniciar sesion.
- Revisar logs de Cloudflare.
- Descargar un reporte de prueba.
- Ejecutar una conciliacion completa en staging antes de repetir en produccion.
