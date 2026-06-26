-- ════════════════════════════════════════════════════════════════════════════
-- RACK MAPPER · VLANs
-- - proyecto_puertos.vlan         → VLAN asignada a ese puerto (editable).
-- - proyecto_equipamiento.vlan_default → VLAN por defecto de ese equipo en el
--   proyecto; el modal la usa para autocompletar al asignar el dispositivo.
--
-- Rango válido de VLAN: 1..4094 (0 y 4095 reservados). NULL = sin VLAN.
-- Idempotente: ADD COLUMN IF NOT EXISTS (si la columna ya existe, se omite el
-- CHECK también, evitando duplicados).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE proyecto_puertos
  ADD COLUMN IF NOT EXISTS vlan INTEGER CHECK (vlan IS NULL OR vlan BETWEEN 1 AND 4094);

ALTER TABLE proyecto_equipamiento
  ADD COLUMN IF NOT EXISTS vlan_default INTEGER CHECK (vlan_default IS NULL OR vlan_default BETWEEN 1 AND 4094);
