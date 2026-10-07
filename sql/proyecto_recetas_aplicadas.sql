-- Registro de cada receta de hardware aplicada a un proyecto.
-- Permite eliminar UNA receta (restando sus ítems) cuando hay varias cargadas.
-- Ejecutar en Supabase → SQL Editor.
CREATE TABLE IF NOT EXISTS proyecto_recetas_aplicadas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  plantilla_id  UUID,                      -- receta maestra de origen (puede borrarse después)
  nombre        TEXT        NOT NULL,      -- nombre al momento de aplicar
  items         JSONB       NOT NULL,      -- snapshot de los ítems aplicados
  aplicada_por  UUID        REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recetas_aplicadas_proyecto
  ON proyecto_recetas_aplicadas(proyecto_id);

-- Solo accesible vía service role (server actions); sin políticas para usuarios.
ALTER TABLE proyecto_recetas_aplicadas ENABLE ROW LEVEL SECURITY;
