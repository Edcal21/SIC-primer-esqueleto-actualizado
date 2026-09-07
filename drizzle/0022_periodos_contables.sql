-- Cierre contable por período. La tabla nace vacía a propósito: la ausencia de fila significa
-- "período abierto", así que esta migración no cierra retroactivamente ningún período ni bloquea
-- nada de lo ya registrado. Un período solo restringe operaciones cuando alguien lo cierra
-- explícitamente desde la pantalla de cierre contable.
--
-- "reabierto" no es un estado propio: al reabrir, el período vuelve a 'abierto' y conserva
-- reabierto_por, reabierto_en y motivo_reapertura como evidencia permanente de la excepción.

CREATE TABLE IF NOT EXISTS "periodos_contables" (
  "periodo" varchar(7) PRIMARY KEY NOT NULL,
  "estado" varchar(8) DEFAULT 'abierto' NOT NULL,
  "fecha_apertura" timestamp with time zone DEFAULT now() NOT NULL,
  "fecha_cierre" timestamp with time zone,
  "cerrado_por" varchar(40),
  "cerrado_por_nombre" text,
  "reabierto_por" varchar(40),
  "reabierto_por_nombre" text,
  "reabierto_en" timestamp with time zone,
  "motivo_reapertura" text,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_periodos_contables_periodo" CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT "ck_periodos_contables_estado" CHECK ("estado" in ('abierto', 'revision', 'cerrado')),
  CONSTRAINT "ck_periodos_contables_cierre" CHECK (
    ("estado" = 'cerrado') = ("fecha_cierre" is not null and "cerrado_por" is not null)
  ),
  CONSTRAINT "ck_periodos_contables_reapertura" CHECK (
    ("reabierto_por" is null) = ("motivo_reapertura" is null)
    and ("reabierto_por" is null) = ("reabierto_en" is null)
  )
);
--> statement-breakpoint
ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_cerrado_por_usuarios_id_fk"
  FOREIGN KEY ("cerrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_reabierto_por_usuarios_id_fk"
  FOREIGN KEY ("reabierto_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_periodos_contables_estado" ON "periodos_contables" ("estado");
