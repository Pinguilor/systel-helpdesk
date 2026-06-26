-- ════════════════════════════════════════════════════════════════════════════
-- RACK MAPPER — Mapa interactivo de switch/rack por proyecto
-- Fase 1: esquema (3 tablas) + RLS (alineado a proyectos) + triggers + índices.
--
-- Modelo híbrido: relacional para datos vivos (switches/puertos, con FK a la
-- Receta Maestra) + JSONB para plantillas (definiciones portables).
-- Diseño: docs/superpowers/specs/rack-mapper-design.md
--
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- ════════════════════════════════════════════════════════════════════════════

-- ── TABLA 1: proyecto_switches ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyecto_switches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL DEFAULT 'Switch',
  num_puertos  INTEGER NOT NULL CHECK (num_puertos IN (8, 24, 48)),
  orden        INTEGER NOT NULL DEFAULT 0,            -- orden visual en el rack
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLA 2: proyecto_puertos ───────────────────────────────────────────────
-- Modelo disperso: sin fila = puerto libre. Una fila puede existir solo por sus
-- atributos (uplink/PoE reservado) sin equipo ni etiqueta todavía.
CREATE TABLE IF NOT EXISTS proyecto_puertos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_id     UUID NOT NULL REFERENCES proyecto_switches(id) ON DELETE CASCADE,
  numero_puerto INTEGER NOT NULL CHECK (numero_puerto >= 1),
  rol           TEXT NOT NULL DEFAULT 'acceso' CHECK (rol IN ('acceso', 'uplink')),
  es_poe        BOOLEAN NOT NULL DEFAULT FALSE,
  -- asignación (todos opcionales)
  proyecto_equipamiento_id UUID REFERENCES proyecto_equipamiento(id) ON DELETE SET NULL,
  inventario_id            UUID REFERENCES inventario(id)            ON DELETE SET NULL,
  etiqueta_libre           TEXT,
  notas         TEXT,
  actualizado_por UUID REFERENCES profiles(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (switch_id, numero_puerto)
);

-- ── TABLA 3: rack_templates (biblioteca global) ─────────────────────────────
CREATE TABLE IF NOT EXISTS rack_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  payload     JSONB NOT NULL,           -- { switches: [{ nombre, num_puertos, puertos: [...] }] }
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ÍNDICES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_switches_proyecto   ON proyecto_switches(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_puertos_switch      ON proyecto_puertos(switch_id);
CREATE INDEX IF NOT EXISTS idx_puertos_equip       ON proyecto_puertos(proyecto_equipamiento_id);
CREATE INDEX IF NOT EXISTS idx_rack_templates_act  ON rack_templates(activo);

-- ── TRIGGER: updated_at automático en proyecto_puertos ──────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_puertos_updated_at ON proyecto_puertos;
CREATE TRIGGER trg_puertos_updated_at
  BEFORE UPDATE ON proyecto_puertos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── TRIGGER: numero_puerto dentro del rango del switch ──────────────────────
-- (CHECK no puede mirar otra tabla; lo validamos por trigger)
CREATE OR REPLACE FUNCTION fn_validar_numero_puerto()
RETURNS TRIGGER AS $$
DECLARE v_max INTEGER;
BEGIN
  SELECT num_puertos INTO v_max FROM proyecto_switches WHERE id = NEW.switch_id;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'El switch % no existe.', NEW.switch_id;
  END IF;
  IF NEW.numero_puerto < 1 OR NEW.numero_puerto > v_max THEN
    RAISE EXCEPTION 'numero_puerto % fuera de rango (1..%) para este switch.', NEW.numero_puerto, v_max;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_numero_puerto ON proyecto_puertos;
CREATE TRIGGER trg_validar_numero_puerto
  BEFORE INSERT OR UPDATE OF numero_puerto, switch_id ON proyecto_puertos
  FOR EACH ROW EXECUTE FUNCTION fn_validar_numero_puerto();

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — alineado a las políticas de `proyectos`
--   Escritura: admin / coordinador.
--   Lectura adicional: técnico participante del proyecto.
--   (Las mutaciones de la app corren con service-role tras chequear rol; estas
--    políticas son la red de seguridad para accesos directos.)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE proyecto_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_puertos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_templates    ENABLE ROW LEVEL SECURITY;

-- ── proyecto_switches ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS switches_admin_coord ON proyecto_switches;
CREATE POLICY switches_admin_coord
  ON proyecto_switches FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')));

DROP POLICY IF EXISTS switches_participante_read ON proyecto_switches;
CREATE POLICY switches_participante_read
  ON proyecto_switches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM proyecto_participantes pp
    WHERE pp.proyecto_id = proyecto_switches.proyecto_id
      AND pp.perfil_id = auth.uid() AND pp.activo
  ));

-- ── proyecto_puertos ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS puertos_admin_coord ON proyecto_puertos;
CREATE POLICY puertos_admin_coord
  ON proyecto_puertos FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')));

DROP POLICY IF EXISTS puertos_participante_read ON proyecto_puertos;
CREATE POLICY puertos_participante_read
  ON proyecto_puertos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM proyecto_switches s
    JOIN proyecto_participantes pp ON pp.proyecto_id = s.proyecto_id
    WHERE s.id = proyecto_puertos.switch_id
      AND pp.perfil_id = auth.uid() AND pp.activo
  ));

-- ── rack_templates (biblioteca global) ──────────────────────────────────────
DROP POLICY IF EXISTS templates_write_admin_coord ON rack_templates;
CREATE POLICY templates_write_admin_coord
  ON rack_templates FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')));

DROP POLICY IF EXISTS templates_read_staff ON rack_templates;
CREATE POLICY templates_read_staff
  ON rack_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador','tecnico')));
