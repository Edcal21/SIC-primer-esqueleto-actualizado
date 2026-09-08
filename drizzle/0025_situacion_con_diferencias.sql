-- El Estado de Situación Financiera solo admitía "procesado" o "error": entraba aunque no cuadrara.
-- La balanza de comprobación sí distingue "con_diferencias" y eso impide cerrar el período; este
-- estado, que alimenta el flujo de efectivo, no tenía control equivalente.
--
-- Se amplía la columna para admitir "con_diferencias" y se agrega "observaciones", donde queda por
-- escrito qué encontró la revisión (descuadre, conceptos repetidos, líneas ausentes).

ALTER TABLE "importaciones_situacion_financiera"
  ALTER COLUMN "estado" TYPE varchar(15);--> statement-breakpoint
ALTER TABLE "importaciones_situacion_financiera"
  ADD COLUMN IF NOT EXISTS "observaciones" text;--> statement-breakpoint
ALTER TABLE "importaciones_situacion_financiera"
  DROP CONSTRAINT IF EXISTS "ck_importaciones_situacion_estado";--> statement-breakpoint
ALTER TABLE "importaciones_situacion_financiera"
  ADD CONSTRAINT "ck_importaciones_situacion_estado"
  CHECK ("estado" IN ('procesado', 'con_diferencias', 'error'));
