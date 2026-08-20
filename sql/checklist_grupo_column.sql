-- Add grupo column to bitacora_entradas for flat task grouping
ALTER TABLE bitacora_entradas
    ADD COLUMN IF NOT EXISTS grupo VARCHAR(150) DEFAULT 'General';

-- Migrate existing tasks: copy group name from their [CHECKLIST_GRUPO] parent row
-- Only touches tasks that still have the default value and have a valid parent
UPDATE bitacora_entradas AS child
SET grupo = TRIM(REPLACE(parent.contenido, '[CHECKLIST_GRUPO]', ''))
FROM bitacora_entradas AS parent
WHERE child.parent_id = parent.id
  AND child.contenido LIKE '[CHECKLIST]%'
  AND parent.contenido LIKE '[CHECKLIST_GRUPO]%'
  AND child.grupo = 'General';
