#!/usr/bin/env bash
#
# Restaura un respaldo del SIC generado por respaldo-postgresql.sh.
#
# Deliberadamente NO existe un botón de restaurar en la aplicación: restaurar reemplaza
# el contenido de la base de datos, y es una decisión que debe tomar una persona con
# supervisión técnica, no un clic en el navegador.
#
# Uso:
#   ./restaurar-postgresql.sh <archivo.dump> --url postgres://... [--confirmar]
#
# Sin --confirmar, solo lista lo que contiene el respaldo (para verificar que es el
# correcto antes de tocar nada). Con --confirmar, reemplaza el contenido de las tablas.

set -euo pipefail

ARCHIVO="${1:-}"
URL=""
CONFIRMAR="false"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --confirmar) CONFIRMAR="true"; shift ;;
    *) echo "Argumento no reconocido: $1" >&2; exit 1 ;;
  esac
done
URL="${URL:-${DATABASE_URL:-}}"

if [ -z "$ARCHIVO" ] || [ -z "$URL" ]; then
  echo "Uso: $0 <archivo.dump> --url postgres://usuario:clave@host:5432/base [--confirmar]" >&2
  exit 1
fi
[ -f "$ARCHIVO" ] || { echo "Error: no existe el archivo '$ARCHIVO'." >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "Error: no se encontró 'pg_restore' en el PATH." >&2; exit 1; }

echo "Respaldo: $ARCHIVO"
echo "Contenido (tablas incluidas en el respaldo):"
# El listado de pg_restore trae, por línea de TABLE DATA: id; oid catálogo, esquema, tabla, dueño.
# El nombre de tabla es siempre el penúltimo campo (el último es el dueño) — más robusto que
# contar cuántos números hay antes de "TABLE DATA", que varía entre versiones de PostgreSQL.
pg_restore -l "$ARCHIVO" | awk '/ TABLE DATA / { print "  " $(NF-1) }' | sort

if [ "$CONFIRMAR" != "true" ]; then
  echo ""
  echo "Simulación: no se modificó nada. Agregue --confirmar para restaurar de verdad."
  echo "ADVERTENCIA: restaurar reemplaza el contenido actual de la base de datos indicada."
  exit 0
fi

echo ""
echo "Restaurando sobre la base de datos indicada por --url. Esto reemplaza su contenido actual."
# --clean --if-exists: elimina los objetos existentes antes de recrearlos, para que la
# restauración no falle por choque con datos ya presentes.
# --single-transaction: si algo falla a mitad de camino, no queda una restauración a medias.
pg_restore --clean --if-exists --single-transaction --no-owner --dbname "$URL" "$ARCHIVO"

echo ""
echo "Restauración completa. Verificando algunas tablas clave..."
psql "$URL" -v ON_ERROR_STOP=1 -c "
  select 'usuarios' as tabla, count(*) from usuarios
  union all select 'movimientos_cuentas', count(*) from movimientos_cuentas
  union all select 'detalles_movimientos', count(*) from detalles_movimientos
  union all select 'cuentas_contables', count(*) from cuentas_contables
  union all select 'respaldos_sistema', count(*) from respaldos_sistema
  order by 1;
"
echo ""
echo "Revise que estos conteos coincidan con lo esperado antes de dar la restauración por buena."
