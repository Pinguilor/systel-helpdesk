-- Evidencia fotográfica (máx. 5) adjunta a la firma digital de proyectos.
-- Se incrusta como "Anexo" en el Acta PDF. Ejecutar en Supabase → SQL Editor.
ALTER TABLE bitacora_firmas
  ADD COLUMN IF NOT EXISTS evidencia_fotos TEXT[] NOT NULL DEFAULT '{}';
