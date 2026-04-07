-- Migración: Reloj de 72 horas para devolución de materiales sobrantes
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar campo fecha_limite_devolucion a la tabla inventario
--    Se marca cuando un ticket se cierra y quedan ítems en la mochila del técnico.
ALTER TABLE inventario
ADD COLUMN IF NOT EXISTS fecha_limite_devolucion TIMESTAMPTZ DEFAULT NULL;

-- 2. Índice para acelerar las consultas de bloqueo (filtra nulos rápido)
CREATE INDEX IF NOT EXISTS idx_inventario_fecha_limite
  ON inventario (fecha_limite_devolucion)
  WHERE fecha_limite_devolucion IS NOT NULL;

-- Verificación
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'inventario'
  AND column_name = 'fecha_limite_devolucion';
