-- Soporte USD/NIO: catálogo de tasas de cambio, e importe original/moneda/tasa aplicada en cada
-- línea contable y cada línea de estado de cuenta. La contabilidad se sigue llevando en NIO; estas
-- columnas permiten reconstruir el importe original de cada movimiento bancario sin inventar datos
-- para los registros existentes (NIO usa tasa 1, ningún histórico se marca como USD por adivinanza).

CREATE TABLE IF NOT EXISTS "tasas_cambio" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fecha" date NOT NULL,
  "moneda" varchar(3) DEFAULT 'USD' NOT NULL,
  "tasa" numeric(14, 6) NOT NULL,
  "fuente" text NOT NULL,
  "creado_por" varchar(40) NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_por" varchar(40),
  "actualizado_en" timestamp with time zone,
  CONSTRAINT "ck_tasas_cambio_moneda" CHECK ("moneda" = 'USD'),
  CONSTRAINT "ck_tasas_cambio_positiva" CHECK ("tasa" > 0),
  CONSTRAINT "ck_tasas_cambio_fuente" CHECK (length(trim("fuente")) > 0)
);
--> statement-breakpoint
ALTER TABLE "tasas_cambio" ADD CONSTRAINT "tasas_cambio_creado_por_usuarios_id_fk"
  FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tasas_cambio" ADD CONSTRAINT "tasas_cambio_actualizado_por_usuarios_id_fk"
  FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_tasas_cambio_fecha_moneda" ON "tasas_cambio" ("fecha", "moneda");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasas_cambio_moneda" ON "tasas_cambio" ("moneda");

-- detalles_movimientos: cada línea contable conserva su moneda, el importe bancario original y la
-- tasa NIO-por-unidad aplicada al registrarla. La línea (o líneas) que realmente afecta la cuenta
-- bancaria de la minuta se marca explícitamente en vez de asumir que es la suma de los débitos.
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD COLUMN IF NOT EXISTS "afecta_cuenta_bancaria" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD COLUMN IF NOT EXISTS "moneda" varchar(3) DEFAULT 'NIO' NOT NULL;
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD COLUMN IF NOT EXISTS "monto_original" numeric(18, 2);
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD COLUMN IF NOT EXISTS "tasa_cambio" numeric(14, 6) DEFAULT 1 NOT NULL;
--> statement-breakpoint
-- Todo registro existente se guardó únicamente en NIO (tasa 1); su importe original es el mismo
-- monto contable. No se inventa un importe USD para líneas que nunca lo capturaron.
UPDATE "detalles_movimientos" SET "monto_original" = "monto" WHERE "monto_original" IS NULL;
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ALTER COLUMN "monto_original" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_detalles_movimientos_afecta_banco" ON "detalles_movimientos" ("movimiento_id", "afecta_cuenta_bancaria");
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD CONSTRAINT "ck_detalles_movimientos_moneda" CHECK ("moneda" in ('USD', 'NIO'));
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD CONSTRAINT "ck_detalles_movimientos_monto_original" CHECK ("monto_original" > 0);
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD CONSTRAINT "ck_detalles_movimientos_tasa_cambio" CHECK ("tasa_cambio" > 0);
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD CONSTRAINT "ck_detalles_movimientos_nio_tasa_unitaria" CHECK ("moneda" <> 'NIO' or "tasa_cambio" = 1);
--> statement-breakpoint
ALTER TABLE "detalles_movimientos" ADD CONSTRAINT "ck_detalles_movimientos_conversion" CHECK ("monto" = round("monto_original" * "tasa_cambio", 2));

-- lineas_reporte_bancario: debito/credito ya representan el importe en la moneda original de la
-- cuenta bancaria (nunca se convierte un estado de cuenta completo con una tasa única). Se agrega
-- la moneda, la tasa vigente para la fecha de la línea y su equivalente en NIO.
--> statement-breakpoint
ALTER TABLE "lineas_reporte_bancario" ADD COLUMN IF NOT EXISTS "moneda" varchar(3) DEFAULT 'NIO' NOT NULL;
--> statement-breakpoint
ALTER TABLE "lineas_reporte_bancario" ADD COLUMN IF NOT EXISTS "tasa_cambio" numeric(14, 6);
--> statement-breakpoint
ALTER TABLE "lineas_reporte_bancario" ADD COLUMN IF NOT EXISTS "debito_nio" numeric(18, 2);
--> statement-breakpoint
ALTER TABLE "lineas_reporte_bancario" ADD COLUMN IF NOT EXISTS "credito_nio" numeric(18, 2);
--> statement-breakpoint
-- La moneda real de cada línea existente es la de su cuenta bancaria (eso sí se conoce con certeza).
-- La tasa histórica NO se infiere: para cuentas USD la línea queda con tasa_cambio nula, es decir
-- "pendiente de completar", y bloqueada para enlace o aprobación hasta que se registre la tasa del
-- día en el catálogo y se recalcule la conciliación.
UPDATE "lineas_reporte_bancario" AS l
SET "moneda" = c."moneda"
FROM "reportes_bancarios" AS r
JOIN "cuentas_bancarias" AS c ON c."numero_cuenta" = r."cuenta_bancaria_numero"
WHERE r."id" = l."reporte_id" AND c."moneda" = 'USD';
--> statement-breakpoint
UPDATE "lineas_reporte_bancario"
SET "tasa_cambio" = 1, "debito_nio" = "debito", "credito_nio" = "credito"
WHERE "moneda" = 'NIO';
--> statement-breakpoint
ALTER TABLE "lineas_reporte_bancario" ADD CONSTRAINT "ck_lineas_reporte_bancario_moneda" CHECK ("moneda" in ('USD', 'NIO'));
--> statement-breakpoint
ALTER TABLE "lineas_reporte_bancario" ADD CONSTRAINT "ck_lineas_reporte_bancario_tasa_cambio" CHECK ("tasa_cambio" is null or "tasa_cambio" > 0);
--> statement-breakpoint
ALTER TABLE "lineas_reporte_bancario" ADD CONSTRAINT "ck_lineas_reporte_bancario_nio_tasa_unitaria" CHECK ("moneda" <> 'NIO' or "tasa_cambio" = 1);
--> statement-breakpoint
ALTER TABLE "lineas_reporte_bancario" ADD CONSTRAINT "ck_lineas_reporte_bancario_conversion" CHECK (
  "tasa_cambio" is null or ("debito_nio" = round("debito" * "tasa_cambio", 2) and "credito_nio" = round("credito" * "tasa_cambio", 2))
);
-- El bloqueo de enlace/aprobación para líneas USD sin tasa ("pendientes de completar") se aplica en
-- la capa de aplicación (lib/banco.ts y app/api/conciliaciones), no como restricción de base de
-- datos: es una regla de negocio sobre acciones nuevas, no un invariante estructural de los datos,
-- y no debe impedir que una instalación con conciliaciones USD previas aplique esta migración.
