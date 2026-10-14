-- ════════════════════════════════════════════════════════════════════════════
-- RACK MAPPER — Zonas de dispositivos (Zona -> Dispositivos)
-- Agrupa las plantillas de dispositivo (dispositivo_plantillas) por zona
-- ("Zona Lobby" -> POS, Cámara, ...). Aditiva sobre rack_dispositivo_plantillas.sql.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dispositivo_zonas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL CHECK (length(btrim(nombre)) > 0),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dispositivo_zonas_nombre
  ON dispositivo_zonas (lower(btrim(nombre)));

-- zona_id nullable: las plantillas creadas antes de las zonas quedan "sin zona"
-- hasta que un admin las mueva.
ALTER TABLE dispositivo_plantillas
  ADD COLUMN IF NOT EXISTS zona_id UUID REFERENCES dispositivo_zonas(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_dispositivo_plantillas_zona ON dispositivo_plantillas(zona_id);

-- El nombre del dispositivo ahora es único dentro de su zona (no global).
DROP INDEX IF EXISTS uq_dispositivo_plantillas_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dispositivo_plantillas_zona_nombre
  ON dispositivo_plantillas (
    COALESCE(zona_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(nombre))
  );

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE dispositivo_zonas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disp_zonas_write_admin ON dispositivo_zonas;
CREATE POLICY disp_zonas_write_admin
  ON dispositivo_zonas FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND lower(rol::text) = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND lower(rol::text) = 'admin'));

DROP POLICY IF EXISTS disp_zonas_read_staff ON dispositivo_zonas;
CREATE POLICY disp_zonas_read_staff
  ON dispositivo_zonas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND lower(rol::text) IN ('admin','coordinador','tecnico')));
