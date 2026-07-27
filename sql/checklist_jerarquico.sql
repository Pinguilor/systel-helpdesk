-- ─────────────────────────────────────────────────────────────────────────────
-- CHECKLIST JERÁRQUICO — bitacora_entradas
--
-- Agrega soporte para agrupar tareas de checklist en grupos colapsables.
-- Los grupos (tipo [CHECKLIST_GRUPO]) son entradas padre; las tareas hijas
-- referencian el grupo a través de parent_id con cascade delete.
--
-- Ejecutar una sola vez en Supabase SQL Editor (es idempotente con IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE bitacora_entradas
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES bitacora_entradas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bitacora_parent_id
    ON bitacora_entradas (parent_id)
    WHERE parent_id IS NOT NULL;
