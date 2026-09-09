#!/usr/bin/env bash
#
# Respaldo de la base de datos del SIC. Diseñado para correr desde cron en el servidor
# Linux donde vive PostgreSQL — no depende de la aplicación ni de Node en absoluto, así
# que sigue funcionando aunque el SIC esté caído.
#
# Qué hace, en orden:
#   1. pg_dump en formato personalizado (-Fc): comprimido, restaurable con pg_restore,
#      incluye esquema completo (índices, secuencias, restricciones) — no solo datos.
#   2. Registra el resultado (éxito o error) en la tabla respaldos_sistema, vía psql,
#      para que la pantalla de Configuración lo muestre sin tocar el servidor.
#   3. Copia el archivo a un destino secundario si SIC_RESPALDOS_DESTINO_SECUNDARIO está
#      definido (una unidad de red, un disco externo, una carpeta sincronizada) — el
#      respaldo dentro del mismo servidor no protege contra que el servidor se dañe.
#   4. Elimina respaldos locales más viejos que SIC_RESPALDOS_RETENCION_DIAS (30 por defecto).
#
# Modos:
#   ./respaldo-postgresql.sh                    modo programado — el que usa cron cada noche, siempre respalda
#   ./respaldo-postgresql.sh --manual            modo manual — lo corre una persona a mano, siempre respalda
#   ./respaldo-postgresql.sh --atender-solicitudes
#       Modo del botón "Generar respaldo ahora" del SIC. La aplicación no puede ejecutar
#       pg_dump por sí misma (esa restricción es del runtime en el que corre, no de dónde
#       está alojado el servidor); en vez de eso, deja una fila pendiente en
#       respaldos_solicitudes. Este modo revisa esa tabla: si no hay ninguna solicitud
#       pendiente, termina de inmediato sin respaldar nada — pensado para correr cada
#       pocos minutos por cron sin costo cuando no hay nada que atender. Si hay una o más
#       solicitudes pendientes, hace UN solo respaldo (no uno por solicitud) y marca todas
#       las pendientes como resueltas con ese mismo respaldo.
#
# Variables de entorno requeridas:
#   DATABASE_URL                        postgresql://usuario:clave@host:5432/basedatos
# Opcionales:
#   SIC_RESPALDOS_DIR                   carpeta de respaldos (default: /var/backups/sic)
#   SIC_RESPALDOS_DESTINO_SECUNDARIO    segunda carpeta a la que copiar cada respaldo
#   SIC_RESPALDOS_RETENCION_DIAS        días que se conservan los respaldos locales (default: 30)
#
# Autenticación no interactiva: configure ~/.pgpass (chmod 600) con la línea
#   host:5432:basedatos:usuario:clave
# así pg_dump y psql no piden contraseña ni la exponen en la lista de procesos.

set -euo pipefail

MODO="programado"
ATENDER_SOLICITUDES="false"
case "${1:-}" in
  --manual) MODO="manual" ;;
  --atender-solicitudes) MODO="manual"; ATENDER_SOLICITUDES="true" ;;
esac

DIR_RESPALDOS="${SIC_RESPALDOS_DIR:-/var/backups/sic}"
DESTINO_SECUNDARIO="${SIC_RESPALDOS_DESTINO_SECUNDARIO:-}"
RETENCION_DIAS="${SIC_RESPALDOS_RETENCION_DIAS:-30}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: defina DATABASE_URL antes de ejecutar este script." >&2
  exit 1
fi
for binario in pg_dump psql; do
  command -v "$binario" >/dev/null 2>&1 || { echo "Error: no se encontró '$binario' en el PATH. Instale los clientes de PostgreSQL." >&2; exit 1; }
done

# Escapa comillas simples para incrustar valores como texto SQL literal.
sql_escape() { printf '%s' "$1" | sed "s/'/''/g"; }

if [ "$ATENDER_SOLICITUDES" = "true" ]; then
  PENDIENTES=$(psql "$DATABASE_URL" -q -tAc "select count(*) from respaldos_solicitudes where estado = 'pendiente'")
  if [ "${PENDIENTES:-0}" -eq 0 ]; then
    echo "Sin solicitudes pendientes. Nada que hacer."
    exit 0
  fi
  echo "$PENDIENTES solicitud(es) pendiente(s). Generando un respaldo para atenderlas."
fi

mkdir -p "$DIR_RESPALDOS"
INICIO_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
INICIO_EPOCH=$(date +%s)
SERVIDOR=$(hostname)
ARCHIVO="sic-$(date -u +%Y%m%d-%H%M%S).dump"
RUTA="$DIR_RESPALDOS/$ARCHIVO"

# Inserta el resultado en respaldos_sistema y deja el id de la fila creada en
# RESPALDO_SISTEMA_ID (variable global — más simple que capturar el valor de retorno de
# una función en bash, y evita una subshell que se llevaría por delante `set -e`).
RESPALDO_SISTEMA_ID=""
registrar() {
  local estado="$1" mensaje="$2" tamano="${3:-NULL}" copia_secundaria="${4:-NULL}"
  local fin_ts fin_epoch duracion
  fin_ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  fin_epoch=$(date +%s)
  duracion=$((fin_epoch - INICIO_EPOCH))
  RESPALDO_SISTEMA_ID=$(psql "$DATABASE_URL" -q -tAc "
    INSERT INTO respaldos_sistema
      (iniciado_en, finalizado_en, estado, modo, archivo, tamano_bytes, duracion_segundos, copia_secundaria_ok, servidor, mensaje)
    VALUES
      ('$INICIO_TS', '$fin_ts', '$estado', '$MODO', '$(sql_escape "$ARCHIVO")', $tamano, $duracion, $copia_secundaria, '$(sql_escape "$SERVIDOR")', '$(sql_escape "$mensaje")')
    RETURNING id;
  " 2>/dev/null) || { echo "Advertencia: el respaldo terminó pero no se pudo registrar en respaldos_sistema. Revise la conexión a la base." >&2; RESPALDO_SISTEMA_ID=""; }
}

# Marca como resueltas (completado o error) todas las solicitudes que seguían pendientes
# cuando arrancó este respaldo. Se hace al final, tanto si el respaldo salió bien como si
# falló, para que ninguna solicitud se quede pendiente para siempre por un error de pg_dump.
resolver_solicitudes() {
  local estado_solicitud="$1"
  [ "$ATENDER_SOLICITUDES" = "true" ] || return 0
  local respaldo_id_sql="NULL"
  [ -n "$RESPALDO_SISTEMA_ID" ] && respaldo_id_sql="'$RESPALDO_SISTEMA_ID'"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
    UPDATE respaldos_solicitudes
    SET estado = '$estado_solicitud', atendido_en = now(), respaldo_id = $respaldo_id_sql
    WHERE estado = 'pendiente';
  " || echo "Advertencia: el respaldo se procesó pero no se pudieron actualizar las solicitudes pendientes." >&2
}

echo "[$INICIO_TS] Iniciando respaldo ($MODO) → $RUTA"

if ! pg_dump "$DATABASE_URL" -Fc -f "$RUTA" 2>"$DIR_RESPALDOS/.ultimo-error.log"; then
  MENSAJE_ERROR=$(tail -c 1000 "$DIR_RESPALDOS/.ultimo-error.log" 2>/dev/null || echo "pg_dump falló sin detalle disponible")
  echo "Error: pg_dump falló. $MENSAJE_ERROR" >&2
  registrar "error" "$MENSAJE_ERROR"
  resolver_solicitudes "error"
  rm -f "$RUTA"
  exit 1
fi
rm -f "$DIR_RESPALDOS/.ultimo-error.log"

TAMANO=$(stat -c%s "$RUTA" 2>/dev/null || stat -f%z "$RUTA" 2>/dev/null || echo 0)
if [ "$TAMANO" -lt 1024 ]; then
  # Un dump de una base de datos contable real nunca pesa menos de 1 KB; si pasa,
  # algo salió mal aunque pg_dump haya devuelto éxito (p. ej. conexión vacía).
  registrar "error" "El archivo generado pesa solo $TAMANO bytes; se descarta por sospechoso." "$TAMANO"
  resolver_solicitudes "error"
  rm -f "$RUTA"
  echo "Error: el respaldo generado es sospechosamente pequeño ($TAMANO bytes). Descartado." >&2
  exit 1
fi

COPIA_OK="NULL"
if [ -n "$DESTINO_SECUNDARIO" ]; then
  if mkdir -p "$DESTINO_SECUNDARIO" 2>/dev/null && cp "$RUTA" "$DESTINO_SECUNDARIO/$ARCHIVO" 2>/dev/null; then
    COPIA_OK="true"
    echo "Copia secundaria guardada en $DESTINO_SECUNDARIO/$ARCHIVO"
  else
    COPIA_OK="false"
    echo "Advertencia: no se pudo copiar el respaldo al destino secundario ($DESTINO_SECUNDARIO)." >&2
  fi
fi

registrar "correcto" "Respaldo generado correctamente" "$TAMANO" "$COPIA_OK"
resolver_solicitudes "completado"
echo "Respaldo completado: $ARCHIVO ($TAMANO bytes)"

if [ "$RETENCION_DIAS" -gt 0 ]; then
  find "$DIR_RESPALDOS" -maxdepth 1 -name 'sic-*.dump' -mtime "+$RETENCION_DIAS" -print -delete
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Fin."
