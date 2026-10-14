-- ════════════════════════════════════════════════════════════════════════════
-- RACK MAPPER — VLAN por defecto en plantillas de dispositivo + conexión directa
-- con plantillas (en vez de la Receta Maestra del proyecto).
-- Orden de ejecución:
--   1. rack_mapper.sql  2. rack_mapper_vlan.sql  3. rack_mapper_patch_panels.sql
--   4. rack_dispositivo_plantillas.sql  5. rack_dispositivo_zonas.sql  6. ESTE ARCHIVO
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

-- VLAN por defecto del dispositivo (ej: POS -> 440). Opcional.
ALTER TABLE dispositivo_plantillas
  ADD COLUMN IF NOT EXISTS vlan_default INTEGER
  CHECK (vlan_default IS NULL OR vlan_default BETWEEN 1 AND 4094);

-- Un puerto de switch en "conexión directa" ahora referencia una plantilla de
-- dispositivo. proyecto_equipamiento_id queda en desuso (se conserva por datos
-- históricos; la app deja de leerlo/escribirlo desde el modal de puerto).
ALTER TABLE proyecto_puertos
  ADD COLUMN IF NOT EXISTS dispositivo_plantilla_id UUID
  REFERENCES dispositivo_plantillas(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_puertos_dispositivo_plantilla ON proyecto_puertos(dispositivo_plantilla_id);

-- Cruzada y asignación directa (de cualquier tipo) siguen siendo mutuamente excluyentes.
ALTER TABLE proyecto_puertos DROP CONSTRAINT IF EXISTS chk_puerto_directo_o_cruzada;
ALTER TABLE proyecto_puertos ADD CONSTRAINT chk_puerto_directo_o_cruzada
  CHECK (
    cruzado_boca_id IS NULL
    OR (proyecto_equipamiento_id IS NULL AND dispositivo_plantilla_id IS NULL)
  );
