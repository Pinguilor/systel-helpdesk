-- ================================================================
-- PROTOCOLO DE CUSTODIA INVERSA
-- Gestión de materiales no instalados en terreno
-- ================================================================
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Prerequisito: tabla proyecto_equipamiento debe existir
-- ================================================================

-- ── 1. Columnas de seguimiento de custodia en proyecto_equipamiento ────────
--
-- Los 4 estados de una unidad entregada se acumulan sin superponerse:
--   cantidad_instalada    → instalada correctamente (flujo normal)
--   cantidad_estacionada  → dejada en obra (cliente decidió, sin retorno)
--   cantidad_en_transito  → técnico la trae de vuelta (handshake pendiente)
--   cantidad_reingresada  → recibida en logística del proyecto (handshake ✓)
--
-- Invariante: suma de los 4 <= cantidad_entregada (aplicado vía CHECK)

ALTER TABLE proyecto_equipamiento
    ADD COLUMN IF NOT EXISTS cantidad_estacionada      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cantidad_en_transito      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cantidad_reingresada      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS motivo_incidencia         TEXT,
    ADD COLUMN IF NOT EXISTS evidencia_fotografica_url TEXT,
    ADD COLUMN IF NOT EXISTS firma_custodia_url        TEXT,
    ADD COLUMN IF NOT EXISTS responsable_actual_id     UUID REFERENCES profiles(id);

-- Garantiza que los estados declarados nunca superen lo entregado físicamente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname  = 'chk_cantidades_custodia'
          AND conrelid = 'proyecto_equipamiento'::regclass
    ) THEN
        ALTER TABLE proyecto_equipamiento
            ADD CONSTRAINT chk_cantidades_custodia CHECK (
                COALESCE(cantidad_instalada,   0)
                + COALESCE(cantidad_estacionada,  0)
                + COALESCE(cantidad_en_transito,  0)
                + COALESCE(cantidad_reingresada,  0)
                <= COALESCE(cantidad_entregada, 0)
            );
    END IF;
END $$;

-- ── 2. Tabla de historial por evento (audit trail por incidencia) ──────────

CREATE TABLE IF NOT EXISTS proyecto_material_custodia (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id               UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    proyecto_equipamiento_id  UUID        NOT NULL REFERENCES proyecto_equipamiento(id),
    cantidad                  INTEGER     NOT NULL DEFAULT 1,
    estado                    TEXT        NOT NULL,
    motivo_incidencia         TEXT        NOT NULL,
    evidencia_fotografica_url TEXT,
    firma_custodia_url        TEXT,
    responsable_actual_id     UUID        REFERENCES profiles(id),  -- NULL cuando Reingresado
    reportado_por_id          UUID        NOT NULL REFERENCES profiles(id),
    aceptado_por_id           UUID        REFERENCES profiles(id),
    aceptado_en               TIMESTAMPTZ,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_custodia_estado CHECK (
        estado IN ('Estacionado_Obra', 'En_Transito_Devolucion', 'Reingresado_Logistica')
    ),
    CONSTRAINT chk_custodia_cantidad CHECK (cantidad > 0),
    -- Si ya está Reingresado, el handshake debe constar
    CONSTRAINT chk_reingresado_requiere_aceptacion CHECK (
        estado <> 'Reingresado_Logistica' OR aceptado_por_id IS NOT NULL
    )
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_custodia_proyecto
    ON proyecto_material_custodia(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_custodia_estado_activo
    ON proyecto_material_custodia(proyecto_id, estado)
    WHERE estado IN ('En_Transito_Devolucion', 'Estacionado_Obra');
CREATE INDEX IF NOT EXISTS idx_custodia_responsable
    ON proyecto_material_custodia(responsable_actual_id)
    WHERE responsable_actual_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custodia_equipamiento
    ON proyecto_material_custodia(proyecto_equipamiento_id);
CREATE INDEX IF NOT EXISTS idx_pe_responsable_actual
    ON proyecto_equipamiento(responsable_actual_id)
    WHERE responsable_actual_id IS NOT NULL;

-- Trigger auto updated_at
CREATE OR REPLACE FUNCTION _fn_custodia_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custodia_updated_at ON proyecto_material_custodia;
CREATE TRIGGER trg_custodia_updated_at
    BEFORE UPDATE ON proyecto_material_custodia
    FOR EACH ROW EXECUTE FUNCTION _fn_custodia_updated_at();

-- ── 3. RPC: materiales activos en custodia para un proyecto ───────────────

CREATE OR REPLACE FUNCTION get_materiales_en_custodia(p_proyecto_id UUID)
RETURNS TABLE (
    custodia_id               UUID,
    proyecto_equipamiento_id  UUID,
    modelo                    TEXT,
    cantidad                  INTEGER,
    estado                    TEXT,
    motivo_incidencia         TEXT,
    evidencia_fotografica_url TEXT,
    firma_custodia_url        TEXT,
    responsable_nombre        TEXT,
    responsable_id            UUID,
    created_at                TIMESTAMPTZ
) LANGUAGE sql SECURITY DEFINER AS $$
    SELECT
        c.id                        AS custodia_id,
        c.proyecto_equipamiento_id,
        COALESCE(
            cat.modelo,
            pe.tipo_item,
            'Material sin descripción'
        )                           AS modelo,
        c.cantidad,
        c.estado,
        c.motivo_incidencia,
        c.evidencia_fotografica_url,
        c.firma_custodia_url,
        p.full_name                 AS responsable_nombre,
        c.responsable_actual_id     AS responsable_id,
        c.created_at
    FROM   proyecto_material_custodia c
    JOIN   proyecto_equipamiento      pe  ON pe.id  = c.proyecto_equipamiento_id
    LEFT JOIN catalogo_equipos        cat ON cat.id = pe.inventario_id
    LEFT JOIN profiles                p   ON p.id   = c.responsable_actual_id
    WHERE  c.proyecto_id = p_proyecto_id
      AND  c.estado IN ('Estacionado_Obra', 'En_Transito_Devolucion')
    ORDER BY c.estado DESC, c.created_at DESC;
$$;

-- ── 4. TODO: Actualizar verificar_cierre_proyecto ─────────────────────────
--
-- El RPC de cierre debe extenderse con dos condiciones adicionales:
--
--   a) Unidades sin estado declarado (libres):
--      WHERE cantidad_entregada > (instaladas + estacionadas + en_transito + reingresadas)
--
--   b) Unidades en tránsito (handshake incompleto):
--      WHERE cantidad_en_transito > 0
--
-- Ambas deben añadirse al array `materiales_pendientes` del JSON de retorno.
-- ─────────────────────────────────────────────────────────────────────────
