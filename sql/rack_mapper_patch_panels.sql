-- ════════════════════════════════════════════════════════════════════════════
-- RACK MAPPER — Patch Panels + Cruzadas (Fase 3)
-- Extiende sql/rack_mapper.sql. Tablas paralelas a switches/puertos para
-- infraestructura pasiva, más una FK de cruzada en proyecto_puertos.
-- Diseño: docs/superpowers/specs/2026-09-24-rack-patch-panels-design.md
-- Idempotente: usa IF NOT EXISTS / DROP ... IF EXISTS.
-- ════════════════════════════════════════════════════════════════════════════

-- ── TABLA: proyecto_patch_panels ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyecto_patch_panels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL DEFAULT 'Patch Panel',
  num_bocas    INTEGER NOT NULL CHECK (num_bocas IN (24, 48)),
  orden        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLA: proyecto_bocas ────────────────────────────────────────────────────
-- Modelo disperso, igual que proyecto_puertos: sin fila = boca no rematada.
-- Sin rol/es_poe/vlan: son atributos de puerto activo, no de infraestructura pasiva.
CREATE TABLE IF NOT EXISTS proyecto_bocas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_panel_id   UUID NOT NULL REFERENCES proyecto_patch_panels(id) ON DELETE CASCADE,
  numero_boca      INTEGER NOT NULL CHECK (numero_boca >= 1),
  proyecto_equipamiento_id UUID REFERENCES proyecto_equipamiento(id) ON DELETE SET NULL,
  etiqueta_libre   TEXT,
  notas            TEXT,
  actualizado_por  UUID REFERENCES profiles(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patch_panel_id, numero_boca)
);

-- ── proyecto_puertos: columna de cruzada ────────────────────────────────────
ALTER TABLE proyecto_puertos
  ADD COLUMN IF NOT EXISTS cruzado_boca_id UUID REFERENCES proyecto_bocas(id) ON DELETE RESTRICT;

-- Una boca solo puede alimentar un puerto de switch (1:1).
CREATE UNIQUE INDEX IF NOT EXISTS uq_puertos_cruzado_boca
  ON proyecto_puertos(cruzado_boca_id) WHERE cruzado_boca_id IS NOT NULL;

-- Mutuamente excluyente con la asignación directa de dispositivo.
ALTER TABLE proyecto_puertos DROP CONSTRAINT IF EXISTS chk_puerto_directo_o_cruzada;
ALTER TABLE proyecto_puertos ADD CONSTRAINT chk_puerto_directo_o_cruzada
  CHECK (NOT (proyecto_equipamiento_id IS NOT NULL AND cruzado_boca_id IS NOT NULL));

-- ── ÍNDICES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patchpanels_proyecto ON proyecto_patch_panels(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_bocas_panel           ON proyecto_bocas(patch_panel_id);
CREATE INDEX IF NOT EXISTS idx_bocas_equip           ON proyecto_bocas(proyecto_equipamiento_id);
CREATE INDEX IF NOT EXISTS idx_puertos_cruzado_boca  ON proyecto_puertos(cruzado_boca_id);

-- ── TRIGGER: updated_at automático en proyecto_bocas ────────────────────────
-- Reutiliza set_updated_at() ya creada en rack_mapper.sql.
DROP TRIGGER IF EXISTS trg_bocas_updated_at ON proyecto_bocas;
CREATE TRIGGER trg_bocas_updated_at
  BEFORE UPDATE ON proyecto_bocas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── TRIGGER: numero_boca dentro del rango del panel ─────────────────────────
CREATE OR REPLACE FUNCTION fn_validar_numero_boca()
RETURNS TRIGGER AS $$
DECLARE v_max INTEGER;
BEGIN
  SELECT num_bocas INTO v_max FROM proyecto_patch_panels WHERE id = NEW.patch_panel_id;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'El patch panel % no existe.', NEW.patch_panel_id;
  END IF;
  IF NEW.numero_boca < 1 OR NEW.numero_boca > v_max THEN
    RAISE EXCEPTION 'numero_boca % fuera de rango (1..%) para este panel.', NEW.numero_boca, v_max;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_numero_boca ON proyecto_bocas;
CREATE TRIGGER trg_validar_numero_boca
  BEFORE INSERT OR UPDATE OF numero_boca, patch_panel_id ON proyecto_bocas
  FOR EACH ROW EXECUTE FUNCTION fn_validar_numero_boca();

-- ── TRIGGER: la cruzada debe apuntar a una boca del MISMO proyecto ──────────
CREATE OR REPLACE FUNCTION fn_validar_cruzada_mismo_proyecto()
RETURNS TRIGGER AS $$
DECLARE v_proyecto_switch UUID; v_proyecto_boca UUID;
BEGIN
  IF NEW.cruzado_boca_id IS NULL THEN RETURN NEW; END IF;
  SELECT s.proyecto_id INTO v_proyecto_switch FROM proyecto_switches s WHERE s.id = NEW.switch_id;
  SELECT pp.proyecto_id INTO v_proyecto_boca
    FROM proyecto_bocas b JOIN proyecto_patch_panels pp ON pp.id = b.patch_panel_id
    WHERE b.id = NEW.cruzado_boca_id;
  IF v_proyecto_boca IS NULL OR v_proyecto_boca <> v_proyecto_switch THEN
    RAISE EXCEPTION 'La boca cruzada debe pertenecer a un patch panel del mismo proyecto.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_cruzada ON proyecto_puertos;
CREATE TRIGGER trg_validar_cruzada
  BEFORE INSERT OR UPDATE OF cruzado_boca_id, switch_id ON proyecto_puertos
  FOR EACH ROW EXECUTE FUNCTION fn_validar_cruzada_mismo_proyecto();

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — mismo patrón que proyecto_switches/proyecto_puertos
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE proyecto_patch_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_bocas        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patch_panels_admin_coord ON proyecto_patch_panels;
CREATE POLICY patch_panels_admin_coord
  ON proyecto_patch_panels FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')));

DROP POLICY IF EXISTS patch_panels_participante_read ON proyecto_patch_panels;
CREATE POLICY patch_panels_participante_read
  ON proyecto_patch_panels FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM proyecto_participantes pp
    WHERE pp.proyecto_id = proyecto_patch_panels.proyecto_id
      AND pp.perfil_id = auth.uid() AND pp.activo
  ));

DROP POLICY IF EXISTS bocas_admin_coord ON proyecto_bocas;
CREATE POLICY bocas_admin_coord
  ON proyecto_bocas FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','coordinador')));

DROP POLICY IF EXISTS bocas_participante_read ON proyecto_bocas;
CREATE POLICY bocas_participante_read
  ON proyecto_bocas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM proyecto_patch_panels p
    JOIN proyecto_participantes pp ON pp.proyecto_id = p.proyecto_id
    WHERE p.id = proyecto_bocas.patch_panel_id
      AND pp.perfil_id = auth.uid() AND pp.activo
  ));
