-- ════════════════════════════════════════════════════════════════════════════
-- RACK MAPPER — Plantillas de Dispositivos (maestro global)
-- Las bocas de patch panel dejan de referenciar equipos del proyecto
-- (proyecto_equipamiento) y pasan a referenciar una plantilla de dispositivo
-- ("Zona Lobby", "POS", "NGK", ...) gestionada por administradores.
-- Requiere: sql/rack_mapper_patch_panels.sql
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dispositivo_plantillas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL CHECK (length(btrim(nombre)) > 0),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nombre único sin distinguir mayúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_dispositivo_plantillas_nombre
  ON dispositivo_plantillas (lower(btrim(nombre)));

-- La boca referencia la plantilla. proyecto_equipamiento_id queda en desuso
-- (se conserva la columna para no perder datos históricos; la app ya no la lee).
ALTER TABLE proyecto_bocas
  ADD COLUMN IF NOT EXISTS dispositivo_plantilla_id UUID
  REFERENCES dispositivo_plantillas(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bocas_plantilla ON proyecto_bocas(dispositivo_plantilla_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE dispositivo_plantillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disp_plantillas_write_admin ON dispositivo_plantillas;
CREATE POLICY disp_plantillas_write_admin
  ON dispositivo_plantillas FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND lower(rol::text) = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND lower(rol::text) = 'admin'));

DROP POLICY IF EXISTS disp_plantillas_read_staff ON dispositivo_plantillas;
CREATE POLICY disp_plantillas_read_staff
  ON dispositivo_plantillas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND lower(rol::text) IN ('admin','coordinador','tecnico')));
