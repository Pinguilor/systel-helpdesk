-- =============================================================================
--  procesar_guia_ingreso_rpc  ·  Systel Loop  ·  v4
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
--
--  CAMBIOS v4:
--    • p_tipo_documento TEXT DEFAULT 'GD'  (nuevo parámetro)
--    • Inserta tipo_documento en guias_ingreso
--
--  CAMBIOS v3 (incluidos):
--    • p_proveedor TEXT → p_proveedor_id UUID (FK a tabla proveedores)
--    • Valida que el proveedor exista antes de insertar
--
--  CAMBIOS v2 (incluidos):
--    • p_documento_url TEXT DEFAULT NULL
--    • Soporte multi-serial: p_items con "seriales":["SN1","SN2",...]
-- =============================================================================

-- Eliminar versiones anteriores
DROP FUNCTION IF EXISTS procesar_guia_ingreso_rpc(TEXT, UUID, UUID, DATE, TEXT, UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS procesar_guia_ingreso_rpc(TEXT, TEXT, UUID, DATE, TEXT, UUID, JSONB, TEXT);

CREATE OR REPLACE FUNCTION procesar_guia_ingreso_rpc(
    p_numero_guia       TEXT,
    p_proveedor_id      UUID,
    p_bodega_destino_id UUID,
    p_fecha_guia        DATE,
    p_observaciones     TEXT,
    p_registrado_por    UUID,
    p_items             JSONB,
    p_documento_url     TEXT    DEFAULT NULL,
    p_tipo_documento    TEXT    DEFAULT 'GD'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_guia_id       UUID;
    v_item          JSONB;
    v_inv_id        UUID;
    v_existing_id   UUID;
    v_existing_cant INTEGER;
    v_serie         TEXT;
    v_modelo        TEXT;
    v_familia       TEXT;
    v_es_serial     BOOLEAN;
    v_cantidad      INTEGER;
    v_seriales      JSONB;
    v_serial_elem   JSONB;
    v_tipo          TEXT;
BEGIN

    -- ── Validaciones básicas ─────────────────────────────────────────────────
    IF p_numero_guia IS NULL OR trim(p_numero_guia) = '' THEN
        RETURN json_build_object('error', 'El número de guía es obligatorio.');
    END IF;

    v_tipo := COALESCE(NULLIF(trim(p_tipo_documento), ''), 'GD');
    IF v_tipo NOT IN ('GD', 'FC') THEN
        RETURN json_build_object('error', 'Tipo de documento inválido. Use GD o FC.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM proveedores WHERE id = p_proveedor_id) THEN
        RETURN json_build_object('error', 'Proveedor inválido o no encontrado.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM bodegas WHERE id = p_bodega_destino_id AND activo = true) THEN
        RETURN json_build_object('error', 'Bodega destino inválida o inactiva.');
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RETURN json_build_object('error', 'La guía debe contener al menos un ítem.');
    END IF;

    -- ── 1. Cabecera ──────────────────────────────────────────────────────────
    INSERT INTO guias_ingreso
        (numero_guia, tipo_documento, proveedor_id, bodega_destino_id,
         fecha_guia, observaciones, documento_url, registrado_por)
    VALUES
        (trim(p_numero_guia), v_tipo, p_proveedor_id, p_bodega_destino_id, p_fecha_guia,
         nullif(trim(p_observaciones), ''), nullif(trim(p_documento_url), ''), p_registrado_por)
    RETURNING id INTO v_guia_id;

    -- ── 2. Procesar cada ítem ────────────────────────────────────────────────
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_familia   := v_item->>'familia';
        v_modelo    := v_item->>'modelo';
        v_es_serial := COALESCE((v_item->>'es_serializado')::BOOLEAN, false);
        v_cantidad  := COALESCE((v_item->>'cantidad')::INTEGER, 1);

        IF v_cantidad < 1 THEN
            RETURN json_build_object('error', format('Cantidad inválida para "%s %s".', v_familia, v_modelo));
        END IF;

        IF v_es_serial THEN
            -- Serializado: procesar array de seriales
            v_seriales := v_item->'seriales';

            IF v_seriales IS NULL OR jsonb_array_length(v_seriales) = 0 THEN
                -- Fallback a campo "numero_serie" simple (compat v1)
                v_serie := nullif(trim(v_item->>'numero_serie'), '');
                IF v_serie IS NULL THEN
                    RETURN json_build_object('error', format('Seriales requeridos para ítem serializado "%s %s".', v_familia, v_modelo));
                END IF;
                v_seriales := jsonb_build_array(to_jsonb(v_serie));
            END IF;

            IF jsonb_array_length(v_seriales) <> v_cantidad THEN
                RETURN json_build_object('error',
                    format('Ítem "%s %s": se declararon %s unidades pero se enviaron %s seriales.',
                        v_familia, v_modelo, v_cantidad, jsonb_array_length(v_seriales)));
            END IF;

            FOR v_serial_elem IN SELECT * FROM jsonb_array_elements(v_seriales)
            LOOP
                v_serie := trim(v_serial_elem #>> '{}');

                IF v_serie IS NULL OR v_serie = '' THEN
                    RETURN json_build_object('error', format('Serial vacío en ítem "%s %s".', v_familia, v_modelo));
                END IF;

                IF EXISTS (SELECT 1 FROM inventario WHERE numero_serie = v_serie) THEN
                    RETURN json_build_object('error', format('El serial "%s" ya existe en inventario.', v_serie));
                END IF;

                INSERT INTO guias_ingreso_items (guia_ingreso_id, familia, modelo, es_serializado, numero_serie, cantidad)
                VALUES (v_guia_id, v_familia, v_modelo, true, v_serie, 1);

                INSERT INTO inventario (bodega_id, modelo, familia, es_serializado, numero_serie, cantidad, estado)
                VALUES (p_bodega_destino_id, v_modelo, v_familia, true, v_serie, 1, 'Disponible')
                RETURNING id INTO v_inv_id;

                INSERT INTO movimientos_inventario
                    (inventario_id, bodega_origen_id, bodega_destino_id,
                     cantidad, tipo_movimiento, realizado_por, fecha_movimiento,
                     guia_ingreso_id)
                VALUES
                    (v_inv_id, p_bodega_destino_id, p_bodega_destino_id,
                     1, 'ingreso_guia', p_registrado_por, NOW(),
                     v_guia_id);
            END LOOP;

        ELSE
            -- Genérico: una fila en detalle, upsert en inventario
            INSERT INTO guias_ingreso_items (guia_ingreso_id, familia, modelo, es_serializado, numero_serie, cantidad)
            VALUES (v_guia_id, v_familia, v_modelo, false, NULL, v_cantidad);

            SELECT id, cantidad INTO v_existing_id, v_existing_cant
            FROM inventario
            WHERE bodega_id      = p_bodega_destino_id
              AND modelo         = v_modelo
              AND familia        = v_familia
              AND es_serializado = false
              AND ticket_id IS NULL
            LIMIT 1;

            IF FOUND THEN
                UPDATE inventario
                   SET cantidad = v_existing_cant + v_cantidad
                 WHERE id = v_existing_id;
                v_inv_id := v_existing_id;
            ELSE
                INSERT INTO inventario (bodega_id, modelo, familia, es_serializado, cantidad, estado)
                VALUES (p_bodega_destino_id, v_modelo, v_familia, false, v_cantidad, 'Disponible')
                RETURNING id INTO v_inv_id;
            END IF;

            INSERT INTO movimientos_inventario
                (inventario_id, bodega_origen_id, bodega_destino_id,
                 cantidad, tipo_movimiento, realizado_por, fecha_movimiento,
                 guia_ingreso_id)
            VALUES
                (v_inv_id, p_bodega_destino_id, p_bodega_destino_id,
                 v_cantidad, 'ingreso_guia', p_registrado_por, NOW(),
                 v_guia_id);
        END IF;

    END LOOP;

    RETURN json_build_object('success', true, 'guia_id', v_guia_id);

EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('error', 'Ya existe un documento con ese tipo y número.');
WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION procesar_guia_ingreso_rpc(TEXT, UUID, UUID, DATE, TEXT, UUID, JSONB, TEXT, TEXT)
    TO authenticated;
