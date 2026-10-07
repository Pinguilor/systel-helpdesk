-- ============================================================
-- Firma de proyectos → Acta PDF
-- Agrega a bitacora_firmas la referencia al PDF generado y la
-- geolocalización de la firma. Columnas nullable: las firmas
-- históricas (sin PDF) siguen mostrándose con la imagen.
-- Ejecutar en Supabase Dashboard → SQL Editor.
-- ============================================================
ALTER TABLE bitacora_firmas
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url  TEXT,
  ADD COLUMN IF NOT EXISTS latitud  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION;
