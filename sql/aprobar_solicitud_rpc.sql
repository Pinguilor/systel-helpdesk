-- =============================================================================
--  aprobar_solicitud_rpc  ·  Systel Loop  ·  v2 — Despacho Multibodega
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
--
--  CAMBIOS RESPECTO A v1:
--    • p_bodega_central UUID  →  p_item_bodegas JSONB
--      Formato: [{"solicitud_item_id":"<uuid>","bodega_id":"<uuid>"}, ...]
--    • La bodega de origen se resuelve por ítem, no globalmente.
--    • Para genéricos: descuento multi-fila en la bodega asignada (FIFO descendente).
--    • Al finalizar escribe bodega_origen_id en cada solicitud_items para auditoría.
-- =============================================================================

CREATE OR REPLACE FUNCTION aprobar_solicitud_rpc(
    p_solicitud_id      UUID,
    p_bodeguero_id      UUID,
    p_item_bodegas      JSONB,     -- [{"solicitud_item_id":"<uuid>","bodega_id":"<uuid>"}]
    p_approved_item_ids UUID[],    -- array de solicitud_items.id aprobados
    p_comentario        TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_id     UUID;
    v_tecnico_id    UUID;
    v_mochila_id    UUID;

    v_item          RECORD;   -- fila de solicitud_items
    v_inv           RECORD;   -- fila de inventario (metadatos del ítem solicitado)
    v_src_row       RECORD;   -- filas de inventario en bodega origen (genéricos)

    v_bodega_origen UUID;     -- bodega origen asignada a este ítem
    v_dest_id       UUID;
    v_dest_cant     INTEGER;
    v_remaining     INTEGER;
BEGIN

    -- ─────────────────────────────────────────────────────────────────────────
    -- 1. Metadatos de la solicitud
    -- ─────────────────────────────────────────────────────────────────────────
    SELECT ticket_id, tecnico_id
      INTO v_ticket_id, v_tecnico_id
      FROM solicitudes_materiales
     WHERE id = p_solicitud_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Solicitud no encontrada.');
    END IF;


    -- ─────────────────────────────────────────────────────────────────────────
    -- 2. Mochila del técnico
    -- ─────────────────────────────────────────────────────────────────────────
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


    -- ─────────────────────────────────────────────────────────────────────────
    -- 3. Procesar cada ítem aprobado
    -- ─────────────────────────────────────────────────────────────────────────
    FOR v_item IN
        SELECT si.id,
               si.cantidad,
               si.inventario_id
          FROM solicitud_items si
         WHERE si.solicitud_id = p_solicitud_id
           AND si.id = ANY(p_approved_item_ids)
    LOOP

        -- Extraer la bodega de origen asignada a este ítem desde el JSONB.
        -- TOLERANTE a variaciones de llave entre versiones de frontend desplegadas:
        --   snake_case {"solicitud_item_id","bodega_id"} | camelCase {"solicitudItemId","bodegaId"} | {"id"}
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

        -- Metadatos del ítem de inventario (modelo, familia, tipo)
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


        -- ── Rama A: Serializado ───────────────────────────────────────────────
        IF v_inv.es_serializado THEN

            IF v_inv.cantidad < 1 THEN
                RETURN json_build_object(
                    'error',
                    format('Sin stock disponible para "%s" (SN: %s).',
                        v_inv.modelo,
                        COALESCE(v_inv.numero_serie, 'N/A'))
                );
            END IF;

            -- Mover la fila completa a la mochila del técnico
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


        -- ── Rama B: Genérico ──────────────────────────────────────────────────
        ELSE

            v_remaining := v_item.cantidad;

            -- Descontar de la bodega de origen (multi-fila, mayor stock primero)
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

            -- Acreditar en mochila del técnico
            -- Clave compuesta: (bodega_id + modelo + familia + ticket_id)
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

        END IF; -- fin rama serializado/genérico

        -- Persistir la bodega de origen para auditoría post-aprobación
        UPDATE solicitud_items
           SET bodega_origen_id = v_bodega_origen
         WHERE id = v_item.id;

    END LOOP; -- fin bucle ítems


    -- ─────────────────────────────────────────────────────────────────────────
    -- 4. Marcar la solicitud como APROBADA
    -- ─────────────────────────────────────────────────────────────────────────
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

-- Permitir que el rol autenticado invoque la nueva función
GRANT EXECUTE ON FUNCTION aprobar_solicitud_rpc(UUID, UUID, JSONB, UUID[], TEXT)
    TO authenticated;
