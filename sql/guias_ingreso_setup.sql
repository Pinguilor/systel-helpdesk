-- =============================================================================
--  guias_ingreso  ·  Systel Loop  ·  Ingreso de Stock por Guía de Despacho
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
--
--  Crea las tablas de cabecera + detalle para el registro documental de
--  ingresos de stock, y agrega la columna de trazabilidad a movimientos_inventario.
-- =============================================================================

-- ── 1. Cabecera ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guias_ingreso (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_guia         TEXT         NOT NULL,
    proveedor           TEXT         NOT NULL,
    bodega_destino_id   UUID         NOT NULL REFERENCES bodegas(id),
    fecha_guia          DATE         NOT NULL DEFAULT CURRENT_DATE,
    observaciones       TEXT,
    documento_url       TEXT,
    registrado_por      UUID         NOT NULL REFERENCES auth.users(id),
    estado              TEXT         NOT NULL DEFAULT 'completada'
                                     CHECK (estado IN ('completada', 'anulada')),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_numero_guia UNIQUE (numero_guia)
);

-- Si la tabla ya existe y falta la columna documento_url, agregarla:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'guias_ingreso'
          AND column_name = 'documento_url'
    ) THEN
        ALTER TABLE guias_ingreso ADD COLUMN documento_url TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_guias_ingreso_bodega
    ON guias_ingreso (bodega_destino_id);
CREATE INDEX IF NOT EXISTS idx_guias_ingreso_fecha
    ON guias_ingreso (fecha_guia DESC);

-- ── 2. Detalle (ítems de la guía) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guias_ingreso_items (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    guia_ingreso_id     UUID         NOT NULL REFERENCES guias_ingreso(id) ON DELETE CASCADE,
    familia             TEXT         NOT NULL,
    modelo              TEXT         NOT NULL,
    es_serializado      BOOLEAN      NOT NULL DEFAULT false,
    numero_serie        TEXT,
    cantidad            INTEGER      NOT NULL DEFAULT 1 CHECK (cantidad >= 1),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guias_ingreso_items_guia
    ON guias_ingreso_items (guia_ingreso_id);

-- ── 3. Columna de trazabilidad en movimientos_inventario ─────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'movimientos_inventario'
          AND column_name = 'guia_ingreso_id'
    ) THEN
        ALTER TABLE movimientos_inventario
            ADD COLUMN guia_ingreso_id UUID REFERENCES guias_ingreso(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_movimientos_guia
    ON movimientos_inventario (guia_ingreso_id)
    WHERE guia_ingreso_id IS NOT NULL;

-- ── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE guias_ingreso ENABLE ROW LEVEL SECURITY;
ALTER TABLE guias_ingreso_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guias_ingreso_select_auth"
    ON guias_ingreso FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "guias_ingreso_insert_auth"
    ON guias_ingreso FOR INSERT TO authenticated
    WITH CHECK (registrado_por = auth.uid());

CREATE POLICY "guias_ingreso_items_select_auth"
    ON guias_ingreso_items FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "guias_ingreso_items_insert_auth"
    ON guias_ingreso_items FOR INSERT TO authenticated
    WITH CHECK (true);

-- ── 5. Bucket y políticas de Storage para guías de despacho ──────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('guias_despacho', 'guias_despacho', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "guias_despacho_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'guias_despacho');

CREATE POLICY "guias_despacho_select_auth"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'guias_despacho');

CREATE POLICY "guias_despacho_update_auth"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'guias_despacho');
