-- Rollouts masivos: un Proyecto Padre (campaña) agrupa N proyectos hijos (uno por local).
-- Cada hijo sigue siendo un proyecto independiente (receta, bitácora, BOM, etc).
-- Ejecutar en Supabase → SQL Editor ANTES de desplegar el código.

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS proyecto_padre_id UUID
    REFERENCES proyectos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS es_campana_masiva BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_proyectos_padre ON proyectos(proyecto_padre_id)
  WHERE proyecto_padre_id IS NOT NULL;

-- Un proyecto no puede ser su propio padre.
ALTER TABLE proyectos
  DROP CONSTRAINT IF EXISTS proyectos_padre_distinto_chk;
ALTER TABLE proyectos
  ADD CONSTRAINT proyectos_padre_distinto_chk CHECK (proyecto_padre_id IS NULL OR proyecto_padre_id <> id);

-- Solo 1 nivel: el padre debe ser campaña, y una campaña no puede ser hija de otra.
CREATE OR REPLACE FUNCTION proyectos_validar_jerarquia() RETURNS trigger AS $$
BEGIN
  IF NEW.proyecto_padre_id IS NOT NULL THEN
    IF NEW.es_campana_masiva THEN
      RAISE EXCEPTION 'Una campaña masiva no puede ser hija de otro proyecto';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM proyectos WHERE id = NEW.proyecto_padre_id AND es_campana_masiva
    ) THEN
      RAISE EXCEPTION 'El proyecto padre debe ser una campaña masiva';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proyectos_validar_jerarquia ON proyectos;
CREATE TRIGGER trg_proyectos_validar_jerarquia
  BEFORE INSERT OR UPDATE OF proyecto_padre_id, es_campana_masiva ON proyectos
  FOR EACH ROW EXECUTE FUNCTION proyectos_validar_jerarquia();

-- Ejemplo: crear la campaña y colgarle proyectos existentes
-- INSERT INTO proyectos (nombre, es_campana_masiva) VALUES ('Proyecto BDAP', TRUE) RETURNING id;
-- UPDATE proyectos SET proyecto_padre_id = '<id_campana>' WHERE id IN ('<id_local_1>', '<id_local_2>');
