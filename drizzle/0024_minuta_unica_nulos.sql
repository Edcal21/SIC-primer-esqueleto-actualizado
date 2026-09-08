-- Refuerza la unicidad de minutas cuando hay columnas nulas.
--
-- El índice anterior (fecha, iglesia_codigo, cuenta_bancaria_numero, referencia) no impedía
-- duplicados si alguna de esas columnas era NULL: PostgreSQL trata cada NULL como distinto, así que
-- dos minutas sin referencia -o dos asientos de diario sin cuenta bancaria- pasaban el control.
--
-- Se sustituye por un índice funcional sobre COALESCE, que trata "sin valor" como un valor único.
-- Se prefiere COALESCE sobre NULLS NOT DISTINCT porque este último exige PostgreSQL 15 y el
-- sistema declara soporte desde PostgreSQL 14.

DO $$
DECLARE duplicados integer;
BEGIN
  SELECT count(*) INTO duplicados FROM (
    SELECT 1
    FROM movimientos_cuentas
    WHERE estado = 'registrado'
    GROUP BY fecha, coalesce(iglesia_codigo, ''), coalesce(cuenta_bancaria_numero, ''), coalesce(referencia, '')
    HAVING count(*) > 1
  ) AS repetidos;

  IF duplicados > 0 THEN
    RAISE EXCEPTION
      'No se puede aplicar la migración: existen % combinaciones de minutas duplicadas por fecha, iglesia, cuenta bancaria y referencia. Anule o corrija esas minutas antes de migrar.', duplicados;
  END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "ux_movimientos_unico";--> statement-breakpoint
CREATE UNIQUE INDEX "ux_movimientos_unico" ON "movimientos_cuentas" USING btree (
  "fecha",
  coalesce("iglesia_codigo", ''),
  coalesce("cuenta_bancaria_numero", ''),
  coalesce("referencia", '')
) WHERE "estado" = 'registrado';
