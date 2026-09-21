ALTER TABLE "usuarios"
ADD COLUMN IF NOT EXISTS "debe_cambiar_password" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE "usuarios"
SET "debe_cambiar_password" = true
WHERE "id" IN ('usr-contador', 'usr-banco', 'usr-auditor');
