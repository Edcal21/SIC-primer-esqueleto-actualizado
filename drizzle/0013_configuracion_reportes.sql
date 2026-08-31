CREATE TABLE IF NOT EXISTS "configuracion_sistema" (
  "clave" varchar(80) PRIMARY KEY NOT NULL,
  "valor" text NOT NULL,
  "descripcion" text,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_configuracion_sistema_clave" ON "configuracion_sistema" ("clave");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reportes_catalogo" (
  "tipo" varchar(40) PRIMARY KEY NOT NULL,
  "titulo" text NOT NULL,
  "descripcion" text NOT NULL,
  "icono" varchar(30) DEFAULT 'reports' NOT NULL,
  "orden" integer DEFAULT 1 NOT NULL,
  "estado" varchar(8) DEFAULT 'activo' NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_reportes_catalogo_estado" CHECK ("estado" in ('activo', 'inactivo'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reportes_catalogo_orden" ON "reportes_catalogo" ("orden");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reportes_catalogo_estado" ON "reportes_catalogo" ("estado");
--> statement-breakpoint
INSERT INTO "configuracion_sistema" ("clave", "valor", "descripcion") VALUES
  ('institucion_nombre', 'Universal Nicaragua', 'Nombre institucional mostrado en el sistema'),
  ('sistema_nombre', 'SIC', 'Nombre corto de la aplicación'),
  ('sistema_descripcion', 'Sistema de Información Contable', 'Descripción oficial de la aplicación'),
  ('moneda', 'NIO', 'Moneda funcional del sistema'),
  ('logo_login', '/universal-nicaragua-login.png', 'Logo usado en la pantalla de acceso')
ON CONFLICT ("clave") DO NOTHING;
--> statement-breakpoint
INSERT INTO "reportes_catalogo" ("tipo", "titulo", "descripcion", "icono", "orden", "estado") VALUES
  ('flujo-efectivo', 'Estado de flujo de efectivo', 'Entradas y salidas clasificadas por operación, inversión y financiamiento.', 'bank', 1, 'activo'),
  ('balanza-anual', 'Balanza de comprobación anual', 'Saldos deudores y acreedores acumulados del período.', 'catalog', 2, 'activo'),
  ('cambio-patrimonio', 'Estado de cambio en el patrimonio', 'Movimientos que explican la variación del patrimonio institucional.', 'dashboard', 3, 'activo'),
  ('situacion-comparativa', 'Estado de situación comparativo', 'Activos, pasivos y patrimonio comparados entre dos períodos.', 'reports', 4, 'activo'),
  ('resultado-comparativo', 'Estado de resultado comparativo', 'Ingresos, gastos y resultado neto comparados entre dos períodos.', 'entry', 5, 'activo')
ON CONFLICT ("tipo") DO NOTHING;
