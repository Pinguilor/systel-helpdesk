-- ============================================================
-- FASE 2: PROYECTOS Y LOGÍSTICA — Loop x Systel ERP
-- ============================================================
-- Instrucciones: Pegar en Supabase Dashboard → SQL Editor → Run
-- Prerequisito: Las tablas core (profiles, restaurantes, bodegas,
--               inventario, catalogo_equipos) deben existir.
-- ============================================================

-- ============================================================
-- TABLA 1: proyectos
-- Header del proyecto de instalación/apertura
-- ============================================================
CREATE TABLE proyectos (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT        NOT NULL,
  descripcion         TEXT,
  cliente_id          UUID        REFERENCES restaurantes(id),
  estado              TEXT        NOT NULL DEFAULT 'planificacion'
                                  CHECK (estado IN (
                                    'planificacion',
                                    'en_progreso',
                                    'pausado',
                                    'completado',
                                    'cancelado'
                                  )),
  fecha_inicio        DATE,
  fecha_fin_estimada  DATE,
  fecha_fin_real      DATE,
  creado_por          UUID        NOT NULL REFERENCES profiles(id),
  coordinador_id      UUID        REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA 2: proyecto_participantes
-- Equipo técnico asignado al proyecto
-- ============================================================
CREATE TABLE proyecto_participantes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id      UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  perfil_id        UUID        NOT NULL REFERENCES profiles(id),
  rol_en_proyecto  TEXT        NOT NULL DEFAULT 'tecnico',
  activo           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proyecto_id, perfil_id)
);

-- ============================================================
-- TABLA 3: bitacora_entradas
-- Timeline de eventos de terreno: notas, fotos, firmas, hitos
-- ============================================================
CREATE TABLE bitacora_entradas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  autor_id    UUID        NOT NULL REFERENCES profiles(id),
  tipo        TEXT        NOT NULL DEFAULT 'nota'
                          CHECK (tipo IN ('nota', 'foto', 'firma', 'hito')),
  contenido   TEXT,
  adjuntos    JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA 4: bitacora_firmas
-- Firma digital inmutable del cliente (SIN updated_at por diseño)
-- Inmutabilidad garantizada a nivel DB: sólo INSERT, nunca UPDATE
-- ============================================================
CREATE TABLE bitacora_firmas (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id      UUID        NOT NULL REFERENCES proyectos(id),
  entrada_id       UUID        NOT NULL REFERENCES bitacora_entradas(id),
  firmante_nombre  TEXT        NOT NULL,
  firmante_cargo   TEXT,
  storage_path     TEXT        NOT NULL,
  storage_url      TEXT        NOT NULL,
  sha256_hash      TEXT        NOT NULL,
  signed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA 5: proyecto_bom
-- Contenedor del Bill of Materials por proyecto
-- ============================================================
CREATE TABLE proyecto_bom (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL DEFAULT 'BOM Principal',
  descripcion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA 6: proyecto_bom_items
-- Ítems de material con 4 estados fijos:
--   requerido → asignado → instalado (terminal)
--   requerido → pendiente → requerido
-- ============================================================
CREATE TABLE proyecto_bom_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id            UUID        NOT NULL REFERENCES proyecto_bom(id) ON DELETE CASCADE,
  proyecto_id       UUID        NOT NULL REFERENCES proyectos(id),
  familia           TEXT        NOT NULL,
  modelo            TEXT        NOT NULL,
  es_serializado    BOOLEAN     NOT NULL DEFAULT FALSE,
  cantidad_requerida INTEGER    NOT NULL DEFAULT 1 CHECK (cantidad_requerida > 0),
  estado            TEXT        NOT NULL DEFAULT 'requerido'
                                CHECK (estado IN (
                                  'requerido',
                                  'asignado',
                                  'instalado',
                                  'pendiente'
                                )),
  bodega_origen_id  UUID        REFERENCES bodegas(id),
  inventario_id     UUID        REFERENCES inventario(id),
  numero_serie      TEXT,
  notas             TEXT,
  actualizado_por   UUID        REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA 7: movimientos_proyecto
-- Audit trail inmutable de cada transición de estado en el BOM
-- ============================================================
CREATE TABLE movimientos_proyecto (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_item_id     UUID        NOT NULL REFERENCES proyecto_bom_items(id),
  proyecto_id     UUID        NOT NULL REFERENCES proyectos(id),
  estado_anterior TEXT,
  estado_nuevo    TEXT        NOT NULL,
  realizado_por   UUID        NOT NULL REFERENCES profiles(id),
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================
CREATE INDEX idx_proyectos_estado       ON proyectos(estado);
CREATE INDEX idx_proyectos_cliente      ON proyectos(cliente_id);
CREATE INDEX idx_proyectos_coordinador  ON proyectos(coordinador_id);
CREATE INDEX idx_bitacora_proyecto_time ON bitacora_entradas(proyecto_id, created_at DESC);
CREATE INDEX idx_bitacora_tipo          ON bitacora_entradas(tipo);
CREATE INDEX idx_bom_items_proyecto     ON proyecto_bom_items(proyecto_id, estado);
CREATE INDEX idx_bom_items_estado       ON proyecto_bom_items(estado);
CREATE INDEX idx_movimientos_item       ON movimientos_proyecto(bom_item_id);
CREATE INDEX idx_movimientos_proyecto   ON movimientos_proyecto(proyecto_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Acceso exclusivo: roles 'admin' y 'coordinador'
-- ============================================================

ALTER TABLE proyectos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora_entradas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora_firmas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_bom         ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_bom_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_proyecto ENABLE ROW LEVEL SECURITY;

-- ── proyectos ─────────────────────────────────────────────
CREATE POLICY "proyectos_admin_coord"
  ON proyectos FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  );

-- ── proyecto_participantes ────────────────────────────────
CREATE POLICY "participantes_admin_coord"
  ON proyecto_participantes FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  );

-- ── bitacora_entradas ─────────────────────────────────────
CREATE POLICY "bitacora_admin_coord"
  ON bitacora_entradas FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  );

-- ── bitacora_firmas (INMUTABLE: SELECT + INSERT únicamente) ──
-- La ausencia de política UPDATE/DELETE garantiza inmutabilidad a nivel DB.
CREATE POLICY "firmas_select"
  ON bitacora_firmas FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  );

CREATE POLICY "firmas_insert"
  ON bitacora_firmas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  );

-- ── proyecto_bom ──────────────────────────────────────────
CREATE POLICY "bom_admin_coord"
  ON proyecto_bom FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  );

-- ── proyecto_bom_items ────────────────────────────────────
CREATE POLICY "bom_items_admin_coord"
  ON proyecto_bom_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  );

-- ── movimientos_proyecto ──────────────────────────────────
CREATE POLICY "movimientos_admin_coord"
  ON movimientos_proyecto FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND rol IN ('admin', 'coordinador'))
  );

-- ============================================================
-- VERIFICACIÓN FINAL
-- Ejecutar para confirmar que todo está correcto:
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'proyectos', 'proyecto_participantes', 'bitacora_entradas',
--     'bitacora_firmas', 'proyecto_bom', 'proyecto_bom_items',
--     'movimientos_proyecto'
--   )
-- ORDER BY table_name;
-- Resultado esperado: 7 filas
