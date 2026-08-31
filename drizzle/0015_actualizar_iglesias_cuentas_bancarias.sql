CREATE TABLE "cuentas_bancarias" (
  "numero_cuenta" varchar(32) PRIMARY KEY NOT NULL,
  "nombre" text NOT NULL,
  "moneda" varchar(3) NOT NULL,
  "estado" varchar(8) DEFAULT 'activa' NOT NULL,
  CONSTRAINT "ck_cuentas_bancarias_numero" CHECK (length(trim("cuentas_bancarias"."numero_cuenta")) > 0),
  CONSTRAINT "ck_cuentas_bancarias_moneda" CHECK ("cuentas_bancarias"."moneda" in ('USD', 'NIO')),
  CONSTRAINT "ck_cuentas_bancarias_estado" CHECK ("cuentas_bancarias"."estado" in ('activa', 'inactiva'))
);
--> statement-breakpoint
CREATE INDEX "idx_cuentas_bancarias_nombre" ON "cuentas_bancarias" USING btree ("nombre");
--> statement-breakpoint
CREATE INDEX "idx_cuentas_bancarias_estado" ON "cuentas_bancarias" USING btree ("estado");
--> statement-breakpoint
ALTER TABLE "movimientos_cuentas" ADD COLUMN "cuenta_bancaria_numero" varchar(32);
--> statement-breakpoint
ALTER TABLE "movimientos_cuentas" ADD CONSTRAINT "movimientos_cuentas_cuenta_bancaria_numero_cuentas_bancarias_numero_cuenta_fk" FOREIGN KEY ("cuenta_bancaria_numero") REFERENCES "public"."cuentas_bancarias"("numero_cuenta") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_movimientos_cuentas_cuenta_bancaria" ON "movimientos_cuentas" USING btree ("cuenta_bancaria_numero");
--> statement-breakpoint
UPDATE "iglesias" SET "estado" = 'inactiva';
--> statement-breakpoint
INSERT INTO "iglesias" ("codigo", "nombre", "estado") VALUES
  ('41010101', 'Iglesia Sede Nacional', 'activa'),
  ('41010102', 'Iglesia Bello Horizonte', 'activa'),
  ('41010103', 'Iglesia Linda Vista', 'activa'),
  ('41010104', 'Iglesia Nejapa', 'activa'),
  ('41010105', 'Iglesia La Fuente', 'activa'),
  ('41010106', 'Iglesia Las Americas', 'activa'),
  ('41010107', 'Iglesia Loma Linda', 'activa'),
  ('41010108', 'Iglesia Tipitapa', 'activa'),
  ('41010109', 'Iglesia Ciudad Sandino', 'activa'),
  ('41010110', 'Iglesia Jinotepe', 'activa'),
  ('41010111', 'Iglesia Esteli', 'activa'),
  ('41010112', 'Iglesia Bluefields', 'activa'),
  ('41010113', 'Iglesia Granada', 'activa'),
  ('41010114', 'Iglesia Masaya', 'activa'),
  ('41010115', 'Iglesia Leon', 'activa'),
  ('41010116', 'Iglesia Jinotega', 'activa'),
  ('41010117', 'Iglesia Rivas', 'activa'),
  ('41010118', 'Iglesia Juigalpa', 'activa'),
  ('41010119', 'Iglesia Matagalpa', 'activa'),
  ('41010120', 'Iglesia Nagarote', 'activa'),
  ('41010121', 'Iglesia Chichigalpa', 'activa'),
  ('41010122', 'Iglesia San Rafael', 'activa'),
  ('41010123', 'Iglesia Ocotal', 'activa'),
  ('41010124', 'Iglesia Boaco', 'activa'),
  ('41010125', 'Iglesia Nueva Guinea', 'activa'),
  ('41010126', 'Iglesia Diriamba', 'activa'),
  ('41010127', 'Iglesia Jalapa', 'activa'),
  ('41010128', 'Iglesia Puerto Cabezas', 'activa'),
  ('41010129', 'Iglesia Chinandega', 'activa'),
  ('41010130', 'El Viejo', 'activa'),
  ('41010131', 'Diriomo', 'activa'),
  ('41010132', 'Nucleo Ticuantepe', 'activa'),
  ('41010133', 'Nucleo Masatepe', 'activa'),
  ('41010134', 'Nucleo La Concepcion', 'activa'),
  ('41010135', 'Nucleo Somoto', 'activa')
ON CONFLICT ("codigo") DO UPDATE SET "nombre" = EXCLUDED."nombre", "estado" = 'activa';
--> statement-breakpoint
INSERT INTO "cuentas_bancarias" ("numero_cuenta", "nombre", "moneda", "estado") VALUES
  ('106203423', 'Banco LA FISE USD', 'USD', 'activa'),
  ('106005626', 'Banco LA FISE NIO', 'NIO', 'activa')
ON CONFLICT ("numero_cuenta") DO UPDATE SET "nombre" = EXCLUDED."nombre", "moneda" = EXCLUDED."moneda", "estado" = 'activa';
