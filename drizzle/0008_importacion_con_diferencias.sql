ALTER TABLE "importaciones_balanza" DROP CONSTRAINT "ck_importaciones_balanza_estado";
--> statement-breakpoint
ALTER TABLE "importaciones_balanza" ALTER COLUMN "estado" TYPE varchar(16);
--> statement-breakpoint
ALTER TABLE "importaciones_balanza" ADD CONSTRAINT "ck_importaciones_balanza_estado" CHECK ("importaciones_balanza"."estado" in ('procesado', 'con_diferencias', 'error'));
