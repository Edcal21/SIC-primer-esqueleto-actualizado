DELETE FROM "iglesias" AS "iglesia"
WHERE "iglesia"."estado" = 'inactiva'
  AND NOT EXISTS (
    SELECT 1
    FROM "movimientos_cuentas" AS "movimiento"
    WHERE "movimiento"."iglesia_codigo" = "iglesia"."codigo"
  );
