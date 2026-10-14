-- ================================================================
-- DEVOLUCIÓN MASIVA / INCIDENCIA POR LOTE (carrito inverso)
-- ================================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Prerequisitos: custodia_inversa.sql, aprobar_devolucion_generica_rpc.sql
--
-- Un "lote" agrupa N líneas de la Receta Maestra (genéricos con cantidad y
-- seriales exactos) bajo una misma incidencia/devolución. Compatibilidad:
--   · Se crea UNA fila en proyecto_material_custodia por línea de receta
--     (con lote_id), por lo que contadores, historial y panel de custodia
--     existentes siguen funcionando sin cambios.
--   · cantidad_entregada NO se modifica (el saldo JIT se calcula como
--     total - (entregada - reingresada)); la recepción mueve
--     en_transito → reingresada igual que el flujo individual.
-- ================================================================

-- ── 1. Tablas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyecto_devolucion_lotes (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id               UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    accion                    TEXT        NOT NULL,
    estado                    TEXT        NOT NULL DEFAULT 'pendiente',
    motivo                    TEXT        NOT NULL,
    observacion               TEXT,
    evidencia_fotografica_url TEXT,
    firma_custodia_url        TEXT,
    reportado_por_id          UUID        NOT NULL REFERENCES profiles(id),
    total_unidades            INTEGER     NOT NULL DEFAULT 0,
    total_lineas              INTEGER     NOT NULL DEFAULT 0,
    bodega_destino_id         UUID        REFERENCES bodegas(id),
    gestionado_por_id         UUID        REFERENCES profiles(id),
    gestionado_en             TIMESTAMPTZ,
    comentario_recepcion      TEXT,
    motivo_rechazo            TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_lote_accion CHECK (accion IN ('Estacionado_Obra', 'En_Transito_Devolucion')),
    CONSTRAINT chk_lote_estado CHECK (estado IN ('pendiente', 'recibido', 'rechazado', 'registrado'))
);

CREATE TABLE IF NOT EXISTS proyecto_devolucion_lote_items (
    id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    lote_id                   UUID    NOT NULL REFERENCES proyecto_devolucion_lotes(id) ON DELETE CASCADE,
    proyecto_equipamiento_id  UUID    NOT NULL REFERENCES proyecto_equipamiento(id),
    inventario_id             UUID    REFERENCES inventario(id),   -- NULL = genérico
    cantidad                  INTEGER NOT NULL DEFAULT 1,
    estado                    TEXT    NOT NULL DEFAULT 'pendiente',

    CONSTRAINT chk_lote_item_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_lote_item_estado   CHECK (estado IN ('pendiente', 'recibido', 'rechazado', 'estacionado'))
);

-- Un serial no puede estar en dos lotes vivos a la vez (evita doble descuento)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lote_item_serial_vivo
    ON proyecto_devolucion_lote_items(inventario_id)
    WHERE inventario_id IS NOT NULL AND estado IN ('pendiente', 'estacionado');

CREATE INDEX IF NOT EXISTS idx_lote_items_lote   ON proyecto_devolucion_lote_items(lote_id);
CREATE INDEX IF NOT EXISTS idx_lotes_estado      ON proyecto_devolucion_lotes(estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lotes_proyecto    ON proyecto_devolucion_lotes(proyecto_id);

ALTER TABLE proyecto_material_custodia
    ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES proyecto_devolucion_lotes(id);
CREATE INDEX IF NOT EXISTS idx_custodia_lote ON proyecto_material_custodia(lote_id) WHERE lote_id IS NOT NULL;

-- Acceso solo vía service role (server actions). Sin políticas = denegado a anon/authenticated.
ALTER TABLE proyecto_devolucion_lotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_devolucion_lote_items ENABLE ROW LEVEL SECURITY;

-- ── 2. Seriales "En Proyecto" que pertenecen a un proyecto ─────────────────
-- Prioridad 1: vínculo directo solicitud_items.inventario_id (JIT), vigente solo
-- si el último movimiento del serial no es posterior a esa aprobación (descarta
-- seriales devueltos y re-entregados a otro proyecto).
-- Prioridad 2 (fallback registros antiguos): el último movimiento coincide con la
-- aprobación (mismo bodeguero, ±2 s) y el modelo coincide con la línea de receta.
CREATE OR REPLACE FUNCTION get_seriales_proyecto(p_proyecto_id UUID)
RETURNS TABLE (
    inventario_id            UUID,
    numero_serie             TEXT,
    modelo                   TEXT,
    familia                  TEXT,
    proyecto_equipamiento_id UUID
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    WITH ult AS (
        SELECT DISTINCT ON (m.inventario_id)
               m.inventario_id, m.fecha_movimiento, m.realizado_por
          FROM movimientos_inventario m
          JOIN inventario i ON i.id = m.inventario_id
         WHERE i.es_serializado = true
           AND i.estado         = 'En Proyecto'
           AND i.bodega_id IS NULL
         ORDER BY m.inventario_id, m.fecha_movimiento DESC
    ),
    vinculos AS (
        SELECT i.id AS inv_id, i.numero_serie::TEXT AS numero_serie,
               i.modelo::TEXT AS modelo, i.familia::TEXT AS familia,
               pe.id AS equip_id, 1 AS prioridad
          FROM ult u
          JOIN inventario i              ON i.id = u.inventario_id
          JOIN solicitud_items si        ON si.inventario_id = i.id
          JOIN solicitudes_materiales sm ON sm.id = si.solicitud_id
                                        AND sm.proyecto_id    = p_proyecto_id
                                        AND sm.tipo_solicitud = 'proyecto'
                                        AND sm.estado         = 'aprobada'
                                        AND u.fecha_movimiento <= sm.gestionado_en + INTERVAL '2 seconds'
          JOIN proyecto_equipamiento pe  ON pe.id = si.proyecto_equipamiento_id
                                        AND pe.proyecto_id = p_proyecto_id

        UNION ALL

        SELECT i.id, i.numero_serie::TEXT, i.modelo::TEXT, i.familia::TEXT,
               pe.id, 2
          FROM ult u
          JOIN inventario i              ON i.id = u.inventario_id
          JOIN solicitudes_materiales sm ON sm.proyecto_id    = p_proyecto_id
                                        AND sm.tipo_solicitud = 'proyecto'
                                        AND sm.estado         = 'aprobada'
                                        AND sm.bodeguero_id   = u.realizado_por
                                        AND abs(extract(epoch FROM (sm.gestionado_en - u.fecha_movimiento))) < 2
          JOIN solicitud_items si        ON si.solicitud_id = sm.id
          JOIN proyecto_equipamiento pe  ON pe.id = si.proyecto_equipamiento_id
                                        AND pe.proyecto_id = p_proyecto_id
          JOIN catalogo_equipos ce       ON ce.id = pe.inventario_id
                                        AND ce.modelo = i.modelo
    )
    SELECT DISTINCT ON (v.inv_id)
           v.inv_id, v.numero_serie, v.modelo, v.familia, v.equip_id
      FROM vinculos v
     WHERE NOT EXISTS (
         SELECT 1 FROM proyecto_devolucion_lote_items li
          WHERE li.inventario_id = v.inv_id
            AND li.estado IN ('pendiente', 'estacionado')
     )
     ORDER BY v.inv_id, v.prioridad;
$$;

-- ── 3. Crear lote (atómico) ────────────────────────────────────────────────
-- p_items: [{ "equip_id": uuid, "cantidad": int, "inventario_ids": [uuid,...] }]
--   · genérico:   cantidad > 0, sin inventario_ids
--   · serializado: inventario_ids (la cantidad se deriva de su largo)
CREATE OR REPLACE FUNCTION crear_devolucion_lote_rpc(
    p_proyecto_id UUID,
    p_user_id     UUID,
    p_accion      TEXT,
    p_motivo      TEXT,
    p_observacion TEXT,
    p_foto_url    TEXT,
    p_firma_url   TEXT,
    p_items       JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lote_id   UUID;
    v_elem      JSONB;
    v_equip     proyecto_equipamiento%ROWTYPE;
    v_ser       BOOLEAN;
    v_modelo    TEXT;
    v_ids       UUID[];
    v_n         INTEGER;
    v_libres    INTEGER;
    v_total     INTEGER := 0;
    v_lineas    INTEGER := 0;
    v_bad       INTEGER;
    v_dup       INTEGER;
    v_estado_it TEXT;
BEGIN
    IF p_accion NOT IN ('Estacionado_Obra', 'En_Transito_Devolucion') THEN
        RETURN jsonb_build_object('error', 'Acción inválida.');
    END IF;
    IF COALESCE(btrim(p_motivo), '') = '' THEN
        RETURN jsonb_build_object('error', 'El motivo es obligatorio.');
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('error', 'El paquete no contiene ítems.');
    END IF;

    -- Validación global de seriales: todos deben seguir En Proyecto, pertenecer
    -- a la línea indicada y no estar en otro lote vivo. Sin duplicados.
    WITH ok AS MATERIALIZED (
        SELECT s.inventario_id, s.proyecto_equipamiento_id
          FROM get_seriales_proyecto(p_proyecto_id) s
    ),
    req AS (
        SELECT (e->>'equip_id')::UUID AS equip_id, x::UUID AS inv_id
          FROM jsonb_array_elements(p_items) e,
               jsonb_array_elements_text(COALESCE(e->'inventario_ids', '[]'::JSONB)) x
    )
    SELECT COUNT(*) FILTER (WHERE NOT EXISTS (
               SELECT 1 FROM ok
                WHERE ok.inventario_id = req.inv_id
                  AND ok.proyecto_equipamiento_id = req.equip_id)),
           COUNT(*) - COUNT(DISTINCT req.inv_id)
      INTO v_bad, v_dup
      FROM req;

    IF v_bad > 0 THEN
        RETURN jsonb_build_object('error', format(
            '%s serial(es) ya no están disponibles en el proyecto (devueltos, en otro lote o reasignados). Recarga y vuelve a intentarlo.', v_bad));
    END IF;
    IF v_dup > 0 THEN
        RETURN jsonb_build_object('error', 'Hay seriales duplicados en el paquete.');
    END IF;

    INSERT INTO proyecto_devolucion_lotes
        (proyecto_id, accion, estado, motivo, observacion,
         evidencia_fotografica_url, firma_custodia_url, reportado_por_id)
    VALUES
        (p_proyecto_id, p_accion,
         CASE WHEN p_accion = 'Estacionado_Obra' THEN 'registrado' ELSE 'pendiente' END,
         btrim(p_motivo), NULLIF(btrim(COALESCE(p_observacion, '')), ''),
         p_foto_url, p_firma_url, p_user_id)
    RETURNING id INTO v_lote_id;

    v_estado_it := CASE WHEN p_accion = 'Estacionado_Obra' THEN 'estacionado' ELSE 'pendiente' END;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT * INTO v_equip
          FROM proyecto_equipamiento
         WHERE id = (v_elem->>'equip_id')::UUID
           AND proyecto_id = p_proyecto_id
           FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Una línea de la receta no pertenece a este proyecto.';
        END IF;

        SELECT ce.modelo, COALESCE(ce.es_serializado, false)
          INTO v_modelo, v_ser
          FROM catalogo_equipos ce
         WHERE ce.id = v_equip.inventario_id;

        v_modelo := COALESCE(v_modelo, v_equip.tipo_item, 'Material');

        v_ids := ARRAY(
            SELECT jsonb_array_elements_text(COALESCE(v_elem->'inventario_ids', '[]'::JSONB))::UUID
        );

        IF v_ser THEN
            IF cardinality(v_ids) = 0 THEN
                RAISE EXCEPTION '"%" es serializado: debes indicar los números de serie.', v_modelo;
            END IF;
            v_n := cardinality(v_ids);
        ELSE
            IF cardinality(v_ids) > 0 THEN
                RAISE EXCEPTION '"%" es genérico: no admite seriales.', v_modelo;
            END IF;
            v_n := COALESCE((v_elem->>'cantidad')::INTEGER, 0);
        END IF;

        v_libres := COALESCE(v_equip.cantidad_entregada, 0)
                  - COALESCE(v_equip.cantidad_instalada,   0)
                  - COALESCE(v_equip.cantidad_estacionada, 0)
                  - COALESCE(v_equip.cantidad_en_transito, 0)
                  - COALESCE(v_equip.cantidad_reingresada, 0);

        IF v_n < 1 THEN
            RAISE EXCEPTION 'Cantidad inválida para "%".', v_modelo;
        END IF;
        IF v_n > v_libres THEN
            RAISE EXCEPTION '"%": solo hay % unidad(es) sin estado declarado (intentas reportar %).',
                v_modelo, GREATEST(v_libres, 0), v_n;
        END IF;

        -- Detalle del lote
        IF v_ser THEN
            INSERT INTO proyecto_devolucion_lote_items
                (lote_id, proyecto_equipamiento_id, inventario_id, cantidad, estado)
            SELECT v_lote_id, v_equip.id, x, 1, v_estado_it FROM unnest(v_ids) x;
        ELSE
            INSERT INTO proyecto_devolucion_lote_items
                (lote_id, proyecto_equipamiento_id, inventario_id, cantidad, estado)
            VALUES (v_lote_id, v_equip.id, NULL, v_n, v_estado_it);
        END IF;

        -- Custodia (audit trail por línea, compatible con el flujo individual)
        INSERT INTO proyecto_material_custodia
            (proyecto_id, proyecto_equipamiento_id, cantidad, estado, motivo_incidencia,
             evidencia_fotografica_url, firma_custodia_url, responsable_actual_id,
             reportado_por_id, lote_id)
        VALUES
            (p_proyecto_id, v_equip.id, v_n, p_accion,
             btrim(p_motivo) || COALESCE(' — ' || NULLIF(btrim(COALESCE(p_observacion, '')), ''), ''),
             p_foto_url, p_firma_url,
             CASE WHEN p_accion = 'En_Transito_Devolucion' THEN p_user_id ELSE NULL END,
             p_user_id, v_lote_id);

        -- Contadores de la receta
        IF p_accion = 'Estacionado_Obra' THEN
            UPDATE proyecto_equipamiento
               SET cantidad_estacionada      = COALESCE(cantidad_estacionada, 0) + v_n,
                   motivo_incidencia         = btrim(p_motivo),
                   evidencia_fotografica_url = p_foto_url,
                   firma_custodia_url        = p_firma_url
             WHERE id = v_equip.id;
        ELSE
            UPDATE proyecto_equipamiento
               SET cantidad_en_transito      = COALESCE(cantidad_en_transito, 0) + v_n,
                   responsable_actual_id     = p_user_id,
                   motivo_incidencia         = btrim(p_motivo),
                   evidencia_fotografica_url = p_foto_url,
                   firma_custodia_url        = p_firma_url
             WHERE id = v_equip.id;
        END IF;

        v_total  := v_total  + v_n;
        v_lineas := v_lineas + 1;
    END LOOP;

    UPDATE proyecto_devolucion_lotes
       SET total_unidades = v_total, total_lineas = v_lineas
     WHERE id = v_lote_id;

    RETURN jsonb_build_object('success', true, 'lote_id', v_lote_id,
                              'total_unidades', v_total, 'total_lineas', v_lineas);

EXCEPTION WHEN OTHERS THEN
    -- Revierte todo el bloque (lote, items, custodia y contadores)
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ── 4. Recepción del lote por el bodeguero (atómico) ───────────────────────
CREATE OR REPLACE FUNCTION recibir_lote_devolucion_rpc(
    p_lote_id        UUID,
    p_bodeguero_id   UUID,
    p_bodega_destino UUID,
    p_comentario     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lote     proyecto_devolucion_lotes%ROWTYPE;
    v_expected INTEGER;
    v_cnt      INTEGER;
    v_dest_id  UUID;
    r          RECORD;
BEGIN
    SELECT * INTO v_lote FROM proyecto_devolucion_lotes WHERE id = p_lote_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Lote no encontrado.');
    END IF;
    IF v_lote.accion <> 'En_Transito_Devolucion' OR v_lote.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('error',
            format('Este lote ya fue procesado (estado: %s).', v_lote.estado));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM bodegas WHERE id = p_bodega_destino) THEN
        RETURN jsonb_build_object('error', 'Bodega de destino inválida.');
    END IF;

    -- Seriales → de vuelta a bodega, Disponibles
    SELECT COUNT(*) INTO v_expected
      FROM proyecto_devolucion_lote_items
     WHERE lote_id = p_lote_id AND inventario_id IS NOT NULL AND estado = 'pendiente';

    UPDATE inventario i
       SET bodega_id               = p_bodega_destino,
           estado                  = 'Disponible',
           ticket_id               = NULL,
           fecha_limite_devolucion = NULL
      FROM proyecto_devolucion_lote_items li
     WHERE li.lote_id = p_lote_id
       AND li.inventario_id = i.id
       AND li.estado = 'pendiente'
       AND i.estado = 'En Proyecto';
    GET DIAGNOSTICS v_cnt = ROW_COUNT;

    IF v_cnt <> v_expected THEN
        RAISE EXCEPTION '% serial(es) del lote ya no están "En Proyecto". Operación abortada.',
            v_expected - v_cnt;
    END IF;

    INSERT INTO movimientos_inventario
        (inventario_id, ticket_id, bodega_origen_id, bodega_destino_id,
         cantidad, tipo_movimiento, realizado_por, fecha_movimiento)
    SELECT li.inventario_id, NULL, NULL, p_bodega_destino,
           1, 'DEVOLUCION', p_bodeguero_id, NOW()
      FROM proyecto_devolucion_lote_items li
     WHERE li.lote_id = p_lote_id AND li.inventario_id IS NOT NULL;

    -- Genéricos → acreditar stock en bodega destino (una fila por modelo/familia)
    FOR r IN
        SELECT ce.modelo, fh.nombre AS familia, SUM(li.cantidad)::INTEGER AS qty
          FROM proyecto_devolucion_lote_items li
          JOIN proyecto_equipamiento pe ON pe.id = li.proyecto_equipamiento_id
          JOIN catalogo_equipos ce      ON ce.id = pe.inventario_id
          LEFT JOIN familias_hardware fh ON fh.id = ce.familia_id
         WHERE li.lote_id = p_lote_id AND li.inventario_id IS NULL
         GROUP BY ce.modelo, fh.nombre
    LOOP
        SELECT id INTO v_dest_id
          FROM inventario
         WHERE bodega_id = p_bodega_destino
           AND modelo    = r.modelo
           AND (familia = r.familia OR (familia IS NULL AND r.familia IS NULL))
           AND es_serializado = false
         LIMIT 1
           FOR UPDATE;

        IF v_dest_id IS NOT NULL THEN
            UPDATE inventario SET cantidad = cantidad + r.qty WHERE id = v_dest_id;
        ELSE
            INSERT INTO inventario (bodega_id, modelo, familia, es_serializado, cantidad, estado)
            VALUES (p_bodega_destino, r.modelo, r.familia, false, r.qty, 'Disponible')
            RETURNING id INTO v_dest_id;
        END IF;

        INSERT INTO movimientos_inventario
            (inventario_id, ticket_id, bodega_origen_id, bodega_destino_id,
             cantidad, tipo_movimiento, realizado_por, fecha_movimiento)
        VALUES (v_dest_id, NULL, NULL, p_bodega_destino, r.qty, 'DEVOLUCION', p_bodeguero_id, NOW());

        v_dest_id := NULL;
    END LOOP;

    -- Contadores de receta: en_transito → reingresada
    UPDATE proyecto_equipamiento pe
       SET cantidad_en_transito  = GREATEST(0, COALESCE(pe.cantidad_en_transito, 0) - s.n),
           cantidad_reingresada  = COALESCE(pe.cantidad_reingresada, 0) + s.n,
           responsable_actual_id = NULL
      FROM (
          SELECT proyecto_equipamiento_id AS eq, SUM(cantidad)::INTEGER AS n
            FROM proyecto_devolucion_lote_items
           WHERE lote_id = p_lote_id AND estado = 'pendiente'
           GROUP BY proyecto_equipamiento_id
      ) s
     WHERE pe.id = s.eq;

    -- Handshake de custodia
    UPDATE proyecto_material_custodia
       SET estado                = 'Reingresado_Logistica',
           aceptado_por_id       = p_bodeguero_id,
           aceptado_en           = NOW(),
           responsable_actual_id = NULL
     WHERE lote_id = p_lote_id AND estado = 'En_Transito_Devolucion';

    UPDATE proyecto_devolucion_lote_items SET estado = 'recibido'
     WHERE lote_id = p_lote_id AND estado = 'pendiente';

    UPDATE proyecto_devolucion_lotes
       SET estado               = 'recibido',
           bodega_destino_id    = p_bodega_destino,
           gestionado_por_id    = p_bodeguero_id,
           gestionado_en        = NOW(),
           comentario_recepcion = NULLIF(btrim(COALESCE(p_comentario, '')), '')
     WHERE id = p_lote_id;

    RETURN jsonb_build_object('success', true,
                              'total_unidades', v_lote.total_unidades,
                              'proyecto_id', v_lote.proyecto_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ── 5. Rechazo del lote: libera contadores y seriales ──────────────────────
CREATE OR REPLACE FUNCTION rechazar_lote_devolucion_rpc(
    p_lote_id      UUID,
    p_bodeguero_id UUID,
    p_motivo       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lote proyecto_devolucion_lotes%ROWTYPE;
BEGIN
    SELECT * INTO v_lote FROM proyecto_devolucion_lotes WHERE id = p_lote_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Lote no encontrado.');
    END IF;
    IF v_lote.accion <> 'En_Transito_Devolucion' OR v_lote.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('error',
            format('Este lote ya fue procesado (estado: %s).', v_lote.estado));
    END IF;
    IF COALESCE(btrim(p_motivo), '') = '' THEN
        RETURN jsonb_build_object('error', 'El motivo de rechazo es obligatorio.');
    END IF;

    -- Las unidades vuelven a "sin declarar" (libres) en la receta
    UPDATE proyecto_equipamiento pe
       SET cantidad_en_transito = GREATEST(0, COALESCE(pe.cantidad_en_transito, 0) - s.n)
      FROM (
          SELECT proyecto_equipamiento_id AS eq, SUM(cantidad)::INTEGER AS n
            FROM proyecto_devolucion_lote_items
           WHERE lote_id = p_lote_id AND estado = 'pendiente'
           GROUP BY proyecto_equipamiento_id
      ) s
     WHERE pe.id = s.eq;

    DELETE FROM proyecto_material_custodia
     WHERE lote_id = p_lote_id AND estado = 'En_Transito_Devolucion';

    UPDATE proyecto_devolucion_lote_items SET estado = 'rechazado'
     WHERE lote_id = p_lote_id AND estado = 'pendiente';

    UPDATE proyecto_devolucion_lotes
       SET estado            = 'rechazado',
           motivo_rechazo    = btrim(p_motivo),
           gestionado_por_id = p_bodeguero_id,
           gestionado_en     = NOW()
     WHERE id = p_lote_id;

    RETURN jsonb_build_object('success', true, 'proyecto_id', v_lote.proyecto_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION get_seriales_proyecto(UUID)                              TO service_role;
GRANT EXECUTE ON FUNCTION crear_devolucion_lote_rpc(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION recibir_lote_devolucion_rpc(UUID, UUID, UUID, TEXT)      TO service_role;
GRANT EXECUTE ON FUNCTION rechazar_lote_devolucion_rpc(UUID, UUID, TEXT)           TO service_role;
