-- Agrega las columnas de estado de revisión y observación a bitacora_entradas.
-- Idempotente: seguro de ejecutar múltiples veces.
ALTER TABLE bitacora_entradas
    ADD COLUMN IF NOT EXISTS estado_revision VARCHAR(50)  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS observacion      TEXT         DEFAULT NULL;

-- Valores posibles de estado_revision:
--   NULL        → sin iniciar (estado por defecto)
--   'completado' → tarea completada
--   'pendiente'  → tarea marcada como pendiente con observación obligatoria

-- Índice para consultas por estado dentro de un proyecto
CREATE INDEX IF NOT EXISTS idx_bitacora_estado_revision
    ON bitacora_entradas(proyecto_id, estado_revision)
    WHERE estado_revision IS NOT NULL;
