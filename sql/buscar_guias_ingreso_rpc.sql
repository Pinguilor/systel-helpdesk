-- =====================================================================
-- buscar_guias_ingreso_rpc  ·  Systel Loop  ·  v2
-- Búsqueda flexible de guías de ingreso.
-- Busca por identificador completo (GD-XXXX / FC-XXXX), proveedor,
-- modelo de producto o N° de serie.
-- Soporta filtros de rango de fechas, proveedor, tipo_documento
-- y paginación.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- Índices para acelerar búsquedas en items
CREATE INDEX IF NOT EXISTS idx_guias_items_modelo
    ON guias_ingreso_items(modelo);

CREATE INDEX IF NOT EXISTS idx_guias_items_serial
    ON guias_ingreso_items(numero_serie)
    WHERE numero_serie IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guias_tipo_documento
    ON guias_ingreso(tipo_documento);

-- ──────────────────────────────────────────────────────────────────────
-- RPC principal de búsqueda
-- ──────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS buscar_guias_ingreso_rpc(TEXT, DATE, DATE, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS buscar_guias_ingreso_rpc(TEXT, DATE, DATE, UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION buscar_guias_ingreso_rpc(
    p_search          TEXT    DEFAULT NULL,
    p_desde           DATE    DEFAULT NULL,
    p_hasta           DATE    DEFAULT NULL,
    p_proveedor_id    UUID    DEFAULT NULL,
    p_tipo_documento  TEXT    DEFAULT NULL,
    p_offset          INTEGER DEFAULT 0,
    p_limit           INTEGER DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_q     TEXT;
    v_total BIGINT := 0;
    v_rows  JSON;
BEGIN
    -- Normalizar búsqueda: NULL o vacío → sin filtro de texto
    v_q := CASE
        WHEN p_search IS NULL OR trim(p_search) = '' THEN NULL
        ELSE '%' || trim(p_search) || '%'
    END;

    -- ── Count total de guías que cumplen los filtros ──────────────────
    SELECT COUNT(DISTINCT g.id) INTO v_total
    FROM guias_ingreso g
    LEFT JOIN proveedores prov ON prov.id = g.proveedor_id
    WHERE
        (p_desde           IS NULL OR g.fecha_guia    >= p_desde)
        AND (p_hasta           IS NULL OR g.fecha_guia    <= p_hasta)
        AND (p_proveedor_id    IS NULL OR g.proveedor_id   = p_proveedor_id)
        AND (p_tipo_documento  IS NULL OR g.tipo_documento  = p_tipo_documento)
        AND (
            v_q IS NULL
            OR g.numero_guia                          ILIKE v_q
            OR (g.tipo_documento || '-' || g.numero_guia) ILIKE v_q
            OR g.tipo_documento                       ILIKE v_q
            OR prov.nombre                            ILIKE v_q
            OR EXISTS (
                SELECT 1 FROM guias_ingreso_items gi
                WHERE  gi.guia_ingreso_id = g.id
                AND    (gi.modelo ILIKE v_q OR gi.numero_serie ILIKE v_q)
            )
        );

    -- ── Página de resultados con estadísticas agregadas ───────────────
    SELECT json_agg(row_to_json(r)) INTO v_rows
    FROM (
        SELECT
            g.id::text,
            g.numero_guia,
            g.tipo_documento,
            g.proveedor_id::text,
            COALESCE(prov.nombre, '')  AS proveedor_nombre,
            g.bodega_destino_id::text,
            COALESCE(b.nombre, '')     AS bodega_nombre,
            g.fecha_guia::text,
            g.observaciones,
            g.documento_url,
            g.estado,
            g.created_at::text,
            g.registrado_por::text,
            (SELECT COUNT(*)
               FROM guias_ingreso_items
              WHERE guia_ingreso_id = g.id)                   AS total_items,
            (SELECT COALESCE(SUM(cantidad), 0)
               FROM guias_ingreso_items
              WHERE guia_ingreso_id = g.id)                   AS total_unidades
        FROM guias_ingreso g
        LEFT JOIN proveedores prov ON prov.id = g.proveedor_id
        LEFT JOIN bodegas     b   ON b.id    = g.bodega_destino_id
        WHERE
            (p_desde           IS NULL OR g.fecha_guia    >= p_desde)
            AND (p_hasta           IS NULL OR g.fecha_guia    <= p_hasta)
            AND (p_proveedor_id    IS NULL OR g.proveedor_id   = p_proveedor_id)
            AND (p_tipo_documento  IS NULL OR g.tipo_documento  = p_tipo_documento)
            AND (
                v_q IS NULL
                OR g.numero_guia                          ILIKE v_q
                OR (g.tipo_documento || '-' || g.numero_guia) ILIKE v_q
                OR g.tipo_documento                       ILIKE v_q
                OR prov.nombre                            ILIKE v_q
                OR EXISTS (
                    SELECT 1 FROM guias_ingreso_items gi
                    WHERE  gi.guia_ingreso_id = g.id
                    AND    (gi.modelo ILIKE v_q OR gi.numero_serie ILIKE v_q)
                )
            )
        ORDER BY g.created_at DESC
        LIMIT  p_limit
        OFFSET p_offset
    ) r;

    RETURN json_build_object(
        'data',  COALESCE(v_rows, '[]'::json),
        'total', v_total
    );
END;
$$;

GRANT EXECUTE ON FUNCTION buscar_guias_ingreso_rpc(TEXT, DATE, DATE, UUID, TEXT, INTEGER, INTEGER)
    TO authenticated;
