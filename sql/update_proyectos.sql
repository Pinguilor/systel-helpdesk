-- =============================================================================
--  1. Modificación de la tabla proyecto_equipamiento
-- =============================================================================

ALTER TABLE proyecto_equipamiento 
ADD COLUMN IF NOT EXISTS cantidad_instalada INTEGER NOT NULL DEFAULT 0;

-- Asegurar que nunca se instale más de lo que se ha entregado (saldo lógico)
ALTER TABLE proyecto_equipamiento 
ADD CONSTRAINT chk_cantidad_instalada 
CHECK (cantidad_instalada <= cantidad_entregada);

-- =============================================================================
--  2. Parche al RPC de Aprobación de Solicitudes (Bypass Mochila)
-- =============================================================================

DROP FUNCTION IF EXISTS aprobar_solicitud_rpc(UUID, UUID, JSONB, UUID[], TEXT);

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
    v_tipo_solicitud TEXT;
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
    SELECT ticket_id, tecnico_id, tipo_solicitud
      INTO v_ticket_id, v_tecnico_id, v_tipo_solicitud
      FROM solicitudes_materiales
     WHERE id = p_solicitud_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Solicitud no encontrada.');
    END IF;


    -- ─────────────────────────────────────────────────────────────────────────
    -- 2. Mochila del técnico (Solo si no es proyecto)
    -- ─────────────────────────────────────────────────────────────────────────
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


    -- ─────────────────────────────────────────────────────────────────────────
    -- 3. Procesar cada ítem aprobado
    -- ─────────────────────────────────────────────────────────────────────────
    FOR v_item IN
        SELECT si.id,
               si.cantidad,
               si.inventario_id,
               si.proyecto_equipamiento_id
          FROM solicitud_items si
         WHERE si.solicitud_id = p_solicitud_id
           AND si.id = ANY(p_approved_item_ids)
    LOOP

        -- Extraer la bodega de origen asignada a este ítem desde el JSONB
        SELECT (elem->>'bodega_id')::UUID
          INTO v_bodega_origen
          FROM jsonb_array_elements(p_item_bodegas) AS elem
         WHERE (elem->>'solicitud_item_id')::UUID = v_item.id;

        IF v_bodega_origen IS NULL THEN
            RETURN json_build_object(
                'error',
                format('Ítem %s no tiene bodega de origen asignada.', v_item.id)
            );
        END IF;

        IF v_item.inventario_id IS NOT NULL THEN
            -- Flujo normal con un ítem de inventario específico ya inyectado/seleccionado
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

            -- ── Rama A: Serializado (1 unidad) ──────────────────────────────────
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
                    -- BYPASS MOCHILA: Va directo a proyecto
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
                    -- FLUJO NORMAL: Mover la fila completa a la mochila del técnico
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


            -- ── Rama B: Genérico (Multi-fila) ─────────────────────────────────────
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

                IF COALESCE(v_tipo_solicitud, '') = 'proyecto' THEN
                    -- BYPASS MOCHILA: Solo registramos el movimiento de salida
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
                    -- FLUJO NORMAL: Acreditar en mochila del técnico
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
            -- ── Rama C: Sin inventario_id (Auto-asignación Proyectos Bulk) ──
            IF COALESCE(v_tipo_solicitud, '') != 'proyecto' THEN
                RETURN json_build_object('error', 'Falta inventario_id en solicitud normal.');
            END IF;

            IF v_item.proyecto_equipamiento_id IS NULL THEN
                RETURN json_build_object('error', 'Ítem de proyecto sin receta asociada.');
            END IF;

            -- Obtener metadatos desde el CATÁLOGO.
            -- IMPORTANTE: proyecto_equipamiento.inventario_id es una FK a catalogo_equipos
            -- (NO a inventario). La familia se obtiene vía familias_hardware.
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

                -- Si la receta no tiene un catálogo válido apuntando al modelo, abortar claro.
                IF NOT FOUND OR v_cat_id IS NULL THEN
                    RETURN json_build_object(
                        'error',
                        'La receta del proyecto no tiene un inventario_id válido apuntando al modelo (catálogo).'
                    );
                END IF;

                IF v_cat_es_serializado THEN
                    v_remaining := v_item.cantidad;

                    -- Tomar los primeros N seriales disponibles en la bodega de origen.
                    -- FOR UPDATE SKIP LOCKED evita que dos aprobaciones simultáneas
                    -- tomen el mismo equipo físico.
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
                        -- Transición: sale de bodega y queda asignado al proyecto.
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
                    -- Genérico sin inventario_id: la Server Action ya debió inyectar el
                    -- inventario físico (rama B). Si llega aquí, es un estado inválido.
                    RETURN json_build_object(
                        'error',
                        'Auto-asignación de genéricos debe procesarse en frontend antes de llegar aquí.'
                    );
                END IF;
            END;
        END IF;

        -- Actualizar saldo de la Receta Maestra (cantidad "Entregada/Asignada").
        -- La instalación (cantidad_instalada) es un paso posterior en terreno.
        IF COALESCE(v_tipo_solicitud, '') = 'proyecto'
           AND v_item.proyecto_equipamiento_id IS NOT NULL THEN
            UPDATE proyecto_equipamiento
               SET cantidad_entregada = LEAST(cantidad_total, cantidad_entregada + v_item.cantidad)
             WHERE id = v_item.proyecto_equipamiento_id;
        END IF;

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
