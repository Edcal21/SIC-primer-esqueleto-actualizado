CREATE OR REPLACE FUNCTION validar_partida_doble_movimiento(p_movimiento_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado text;
  v_total_debitos numeric(18, 2);
  v_total_creditos numeric(18, 2);
  v_lineas integer;
BEGIN
  SELECT estado INTO v_estado
  FROM movimientos_cuentas
  WHERE id = p_movimiento_id;

  IF v_estado IS NULL OR v_estado <> 'registrado' THEN
    RETURN;
  END IF;

  SELECT
    count(*)::integer,
    coalesce(sum(CASE WHEN tipo = 'debito' THEN monto ELSE 0 END), 0)::numeric(18, 2),
    coalesce(sum(CASE WHEN tipo = 'credito' THEN monto ELSE 0 END), 0)::numeric(18, 2)
  INTO v_lineas, v_total_debitos, v_total_creditos
  FROM detalles_movimientos
  WHERE movimiento_id = p_movimiento_id;

  IF v_lineas < 2 THEN
    RAISE EXCEPTION 'La minuta % debe tener al menos dos líneas contables', p_movimiento_id
      USING ERRCODE = '23514';
  END IF;

  IF v_total_debitos <> v_total_creditos THEN
    RAISE EXCEPTION 'La minuta % no cumple partida doble: débitos % y créditos %',
      p_movimiento_id, v_total_debitos, v_total_creditos
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION check_partida_doble()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'detalles_movimientos' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      PERFORM validar_partida_doble_movimiento(OLD.movimiento_id);
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.movimiento_id IS DISTINCT FROM OLD.movimiento_id) THEN
      PERFORM validar_partida_doble_movimiento(NEW.movimiento_id);
    END IF;
  ELSE
    PERFORM validar_partida_doble_movimiento(COALESCE(NEW.id, OLD.id));
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ck_partida_doble_detalles ON detalles_movimientos;
CREATE CONSTRAINT TRIGGER ck_partida_doble_detalles
AFTER INSERT OR UPDATE OR DELETE ON detalles_movimientos
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_partida_doble();

DROP TRIGGER IF EXISTS ck_partida_doble_movimientos ON movimientos_cuentas;
CREATE CONSTRAINT TRIGGER ck_partida_doble_movimientos
AFTER INSERT OR UPDATE OF estado ON movimientos_cuentas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_partida_doble();

CREATE UNIQUE INDEX IF NOT EXISTS ux_movimientos_unico
ON movimientos_cuentas (fecha, iglesia_codigo, cuenta_bancaria_numero, referencia) NULLS NOT DISTINCT
WHERE estado = 'registrado';
