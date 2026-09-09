INSERT INTO "reportes_catalogo" ("tipo", "titulo", "descripcion", "icono", "orden", "estado") VALUES
  ('minutas', 'Reporte de minutas', 'Minutas ingresadas filtradas por iglesia y período de tiempo.', 'reports', 6, 'activo')
ON CONFLICT ("tipo") DO UPDATE SET
  "titulo" = EXCLUDED."titulo",
  "descripcion" = EXCLUDED."descripcion",
  "icono" = EXCLUDED."icono",
  "orden" = EXCLUDED."orden",
  "estado" = EXCLUDED."estado",
  "actualizado_en" = now();
