-- ================================================================
-- PARCHE: aprobar_solicitud_rpc — re-despacho de material reingresado
-- ================================================================
-- Permite que unidades devueltas a logística (cantidad_reingresada > 0)
-- puedan volver a despacharse al proyecto sin superar el presupuesto.
--
-- Cambio: el tope de cantidad_entregada pasa de:
--   LEAST(cantidad_total, ...)                                  (anterior)
-- a:
--   LEAST(cantidad_total + COALESCE(cantidad_reingresada, 0), ...) (nuevo)
--
-- Ejemplo: 10 presupuestadas, 10 entregadas, 3 reingresadas.
--   • Antes: saldo = 0 → imposible re-despachar.
--   • Ahora: saldo = 3 → se pueden volver a despachar las 3 devueltas.
--
-- Ejecutar en Supabase Dashboard → SQL Editor → Run
-- ================================================================

DROP FUNCTION IF EXISTS aprobar_solicitud_rpc(UUID, UUID, JSONB, UUID[], TEXT);

CREATE OR REPLACE FUNCTION aprobar_solicitud_rpc(
    p_solicitud_id      UUID,
    p_bodeguero_id      UUID,
    p_item_bodegas      JSONB,
    p_approved_item_ids UUID[],
    p_comentario        TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_id      UUID;
    v_tecnico_id     UUID;
    v_tipo_solicitud TEXT;
    v_mochila_id     UUID;

    v_item           RECORD;
    v_inv            RECORD;
    v_src_row        RECORD;

    v_bodega_origen  UUID;
    v_dest_id        UUID;
    v_dest_cant      INTEGER;
    v_remaining      INTEGER;
BEGIN

    -- ── 1. Metadatos de la solicitud ──────────────────────────────────────────
    SELECT ticket_id, tecnico_id, tipo_solicitud
      INTO v_ticket_id, v_tecnico_id, v_tipo_solicitud
      FROM solicitudes_materiales
     WHERE id = p_solicitud_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Solicitud no encontrada.');
    END IF;


    -- ── 2. Mochila del técnico (solo si no es proyecto) ───────────────────────
    IF COALESCE(v_tipo_solicitud, '') != 'proyecto' THEN
        SELECT id INTO v_mochila_id
          FROM bodegas
         WHERE tecnico_id = v_tecnico_id
           AND UPPER(tipo) = 'MOCHILA'
         LIMIT 1;

        IF v_mochila_id IS NULL THEN
            RETURN json_build_object(
                'error',
                'El técnico no tiene una mochila asignada. Contacta al administrador.'
            );
        END IF;
    END IF;


    -- ── 3. Procesar cada ítem aprobado ────────────────────────────────────────
    FOR v_item IN
        SELECT si.id,
               si.cantidad,
               si.inventario_id,
               si.proyecto_equipamiento_id
          FROM solicitud_items si
         WHERE si.solicitud_id = p_solicitud_id
           AND si.id = ANY(p_approved_item_ids)
    LOOP

        -- Bodega de origen (tolerante a snake_case / camelCase / id corto)
        SELECT (COALESCE(elem->>'bodega_id', elem->>'bodegaId'))::UUID
          INTO v_bodega_origen
          FROM jsonb_array_elements(p_item_bodegas) AS elem
         WHERE COALESCE(
                   elem->>'solicitud_item_id',
                   elem->>'solicitudItemId',
                   elem->>'id'
               )::UUID = v_item.id;

        IF v_bodega_origen IS NULL THEN
            RETURN json_build_object(
                'error',
                format('Ítem %s no tiene bodega de origen asignada. (items en payload: %s)',
                       v_item.id, jsonb_array_length(p_item_bodegas))
            );
        END IF;

        IF v_item.inventario_id IS NOT NULL THEN
            -- Ítem de inventario específico ya inyectado/seleccionado
            SELECT id, modelo, familia, es_serializado,
                   numero_serie, cantidad, bodega_id
              INTO v_inv
              FROM inventario
             WHERE id = v_item.inventario_id;

            IF NOT FOUND THEN
                RETURN json_build_object(
                    'error',
                    format('Ítem de inventario %s no encontrado.', v_item.inventario_id)
                );
            END IF;

            -- ── Rama A: Serializado ───────────────────────────────────────────
            IF v_inv.es_serializado THEN

                IF v_inv.cantidad < 1 THEN
                    RETURN json_build_object(
                        'error',
                        format('Sin stock disponible para "%s" (SN: %s).',
                            v_inv.modelo,
                            COALESCE(v_inv.numero_serie, 'N/A'))
                    );
                END IF;

                IF COALESCE(v_tipo_solicitud, '') = 'proyecto' THEN
                    UPDATE inventario
                       SET bodega_id = NULL,
                           estado = 'En Proyecto'
                     WHERE id = v_inv.id;

                    INSERT INTO movimientos_inventario
                        (inventario_id, ticket_id,
                         bodega_origen_id, bodega_destino_id,
                         cantidad, tipo_movimiento,
                         realizado_por, fecha_movimiento)
                    VALUES
                        (v_inv.id, v_ticket_id,
                         v_bodega_origen, NULL,
                         1, 'salida',
                         p_bodeguero_id, NOW());
                ELSE
                    UPDATE inventario
                       SET bodega_id = v_mochila_id,
                           ticket_id = v_ticket_id
                     WHERE id = v_inv.id;

                    INSERT INTO movimientos_inventario
                        (inventario_id, ticket_id,
                         bodega_origen_id, bodega_destino_id,
                         cantidad, tipo_movimiento,
                         realizado_por, fecha_movimiento)
                    VALUES
                        (v_inv.id, v_ticket_id,
                         v_bodega_origen, v_mochila_id,
                         1, 'salida',
                         p_bodeguero_id, NOW());
                END IF;


            -- ── Rama B: Genérico (multi-fila) ────────────────────────────────
            ELSE
                v_remaining := v_item.cantidad;

                FOR v_src_row IN
                    SELECT id, cantidad
                      FROM inventario
                     WHERE bodega_id      = v_bodega_origen
                       AND modelo         = v_inv.modelo
                       AND familia        = v_inv.familia
                       AND es_serializado = false
                       AND cantidad       > 0
                     ORDER BY cantidad DESC
                LOOP
                    EXIT WHEN v_remaining <= 0;

                    IF v_src_row.cantidad >= v_remaining THEN
                        UPDATE inventario
                           SET cantidad = v_src_row.cantidad - v_remaining
                         WHERE id = v_src_row.id;
                        v_remaining := 0;
                    ELSE
                        UPDATE inventario
                           SET cantidad = 0
                         WHERE id = v_src_row.id;
                        v_remaining := v_remaining - v_src_row.cantidad;
                    END IF;
                END LOOP;

                IF v_remaining > 0 THEN
                    RETURN json_build_object(
                        'error',
                        format(
                            'Stock insuficiente en bodega de origen para "%s %s". Faltaron %s ud.',
                            v_inv.familia, v_inv.modelo, v_remaining
                        )
                    );
                END IF;

                IF COALESCE(v_tipo_solicitud, '') = 'proyecto' THEN
                    INSERT INTO movimientos_inventario
                        (inventario_id, ticket_id,
                         bodega_origen_id, bodega_destino_id,
                         cantidad, tipo_movimiento,
                         realizado_por, fecha_movimiento)
                    VALUES
                        (v_inv.id, v_ticket_id,
                         v_bodega_origen, NULL,
                         v_item.cantidad, 'salida',
                         p_bodeguero_id, NOW());
                ELSE
                    SELECT id, cantidad
                      INTO v_dest_id, v_dest_cant
                      FROM inventario
                     WHERE bodega_id      = v_mochila_id
                       AND modelo         = v_inv.modelo
                       AND familia        = v_inv.familia
                       AND es_serializado = false
                       AND (
                             (ticket_id  = v_ticket_id)
                          OR (ticket_id IS NULL AND v_ticket_id IS NULL)
                       )
                     LIMIT 1;

                    IF FOUND THEN
                        UPDATE inventario
                           SET cantidad = v_dest_cant + v_item.cantidad
                         WHERE id = v_dest_id;
                    ELSE
                        INSERT INTO inventario
                            (bodega_id, modelo, familia,
                             es_serializado, cantidad,
                             estado, ticket_id)
                        VALUES
                            (v_mochila_id, v_inv.modelo, v_inv.familia,
                             false, v_item.cantidad,
                             'Disponible', v_ticket_id)
                        RETURNING id INTO v_dest_id;
                    END IF;

                    INSERT INTO movimientos_inventario
                        (inventario_id, ticket_id,
                         bodega_origen_id, bodega_destino_id,
                         cantidad, tipo_movimiento,
                         realizado_por, fecha_movimiento)
                    VALUES
                        (v_dest_id, v_ticket_id,
                         v_bodega_origen, v_mochila_id,
                         v_item.cantidad, 'salida',
                         p_bodeguero_id, NOW());
                END IF;

            END IF; -- fin rama serializado/genérico

        ELSE
            -- ── Rama C: Sin inventario_id (Auto-asignación Proyectos Bulk) ───
            IF COALESCE(v_tipo_solicitud, '') != 'proyecto' THEN
                RETURN json_build_object('error', 'Falta inventario_id en solicitud normal.');
            END IF;

            IF v_item.proyecto_equipamiento_id IS NULL THEN
                RETURN json_build_object('error', 'Ítem de proyecto sin receta asociada.');
            END IF;

            DECLARE
                v_cat_id             UUID;
                v_cat_modelo         TEXT;
                v_cat_familia        TEXT;
                v_cat_es_serializado BOOLEAN;
                v_assigned           INTEGER := 0;
            BEGIN
                SELECT pe.inventario_id, ce.modelo, ce.es_serializado, fh.nombre
                  INTO v_cat_id, v_cat_modelo, v_cat_es_serializado, v_cat_familia
                  FROM proyecto_equipamiento pe
                  JOIN catalogo_equipos ce       ON ce.id = pe.inventario_id
                  LEFT JOIN familias_hardware fh  ON fh.id = ce.familia_id
                 WHERE pe.id = v_item.proyecto_equipamiento_id;

                IF NOT FOUND OR v_cat_id IS NULL THEN
                    RETURN json_build_object(
                        'error',
                        'La receta del proyecto no tiene un inventario_id válido apuntando al modelo (catálogo).'
                    );
                END IF;

                IF v_cat_es_serializado THEN
                    v_remaining := v_item.cantidad;

                    FOR v_src_row IN
                        SELECT id
                          FROM inventario
                         WHERE bodega_id      = v_bodega_origen
                           AND modelo         = v_cat_modelo
                           AND es_serializado = true
                           AND estado IN ('Disponible', 'Operativo', 'operativo', 'disponible')
                         ORDER BY created_at
                         LIMIT v_item.cantidad
                         FOR UPDATE SKIP LOCKED
                    LOOP
                        UPDATE inventario
                           SET bodega_id = NULL,
                               estado    = 'En Proyecto'
                         WHERE id = v_src_row.id;

                        INSERT INTO movimientos_inventario
                            (inventario_id, ticket_id, bodega_origen_id, bodega_destino_id,
                             cantidad, tipo_movimiento, realizado_por, fecha_movimiento)
                        VALUES
                            (v_src_row.id, v_ticket_id, v_bodega_origen, NULL,
                             1, 'salida', p_bodeguero_id, NOW());

                        v_remaining := v_remaining - 1;
                        v_assigned  := v_assigned  + 1;
                    END LOOP;

                    IF v_remaining > 0 THEN
                        RETURN json_build_object(
                            'error',
                            format('Stock insuficiente en bodega de origen para "%s" (serializado). Faltaron %s ud.',
                                   v_cat_modelo, v_remaining)
                        );
                    END IF;
                ELSE
                    RETURN json_build_object(
                        'error',
                        'Auto-asignación de genéricos debe procesarse en frontend antes de llegar aquí.'
                    );
                END IF;
            END;
        END IF;

        -- ── Actualizar cantidad_entregada en la Receta Maestra ────────────────
        IF COALESCE(v_tipo_solicitud, '') = 'proyecto'
           AND v_item.proyecto_equipamiento_id IS NOT NULL THEN

            -- Pre-validación: abortar si el despacho excedería el presupuesto.
            -- Esto evita que el inventario salga de bodega sin contabilizarse.
            DECLARE
                v_pe_total       INTEGER;
                v_pe_entregada   INTEGER;
                v_pe_reingresada INTEGER;
                v_pe_tope        INTEGER;
                v_pe_tipo        TEXT;
            BEGIN
                SELECT cantidad_total,
                       cantidad_entregada,
                       COALESCE(cantidad_reingresada, 0),
                       tipo_item
                  INTO v_pe_total, v_pe_entregada, v_pe_reingresada, v_pe_tipo
                  FROM proyecto_equipamiento
                 WHERE id = v_item.proyecto_equipamiento_id
                   FOR UPDATE;

                v_pe_tope := v_pe_total + v_pe_reingresada;

                IF v_pe_entregada + v_item.cantidad > v_pe_tope THEN
                    RETURN json_build_object(
                        'error',
                        format(
                            'El despacho de %s ud. de "%s" excedería el presupuesto (%s/%s). Posible solicitud duplicada.',
                            v_item.cantidad,
                            COALESCE(v_pe_tipo, 'Material'),
                            v_pe_entregada,
                            v_pe_tope
                        )
                    );
                END IF;

                UPDATE proyecto_equipamiento
                   SET cantidad_entregada = v_pe_entregada + v_item.cantidad
                 WHERE id = v_item.proyecto_equipamiento_id;
            END;
        END IF;

        UPDATE solicitud_items
           SET bodega_origen_id = v_bodega_origen
         WHERE id = v_item.id;

    END LOOP;


    -- ── 4. Marcar solicitud como APROBADA ─────────────────────────────────────
    UPDATE solicitudes_materiales
       SET estado        = 'aprobada',
           bodeguero_id  = p_bodeguero_id,
           gestionado_en = NOW()
     WHERE id = p_solicitud_id;

    RETURN json_build_object('success', true);


EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);

END;
$$;

GRANT EXECUTE ON FUNCTION aprobar_solicitud_rpc(UUID, UUID, JSONB, UUID[], TEXT)
    TO authenticated;
