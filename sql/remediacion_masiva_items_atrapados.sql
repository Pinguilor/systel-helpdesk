-- ─────────────────────────────────────────────────────────────────────────────
-- REMEDIACIÓN MASIVA: instala todos los ítems 'En proceso' que quedaron
-- atrapados en mochilas de técnicos para tickets ya cerrados/resueltos.
--
-- PRE-CONDICIÓN: ejecutar sweep_items_atrapados.sql y validar los resultados.
-- Esta operación es ATÓMICA (todo en una transacción). Si algo falla, revierte.
--
-- SEGURO DE REPETIR: el WHERE i.estado = 'En proceso' garantiza idempotencia.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_eq              RECORD;
    v_bodega_rest     UUID;
    v_count_ok        INT := 0;
    v_count_skip      INT := 0;
    v_prev_ticket     INT := 0;
BEGIN
    RAISE NOTICE '══════════════════════════════════════════';
    RAISE NOTICE '  REMEDIACIÓN MASIVA — ítems En proceso  ';
    RAISE NOTICE '══════════════════════════════════════════';

    -- Iterar sobre todos los ítems atrapados (serializado y genérico)
    FOR v_eq IN
        SELECT
            i.id             AS inventario_id,
            i.cantidad,
            i.bodega_id      AS mochila_id,
            i.modelo,
            i.familia,
            i.es_serializado,
            i.numero_serie,
            t.id             AS ticket_id,
            t.numero_ticket,
            r.bodega_id      AS bodega_restaurante
        FROM   inventario i
        JOIN   tickets      t  ON t.id        = i.ticket_id
        JOIN   bodegas      b  ON b.id        = i.bodega_id
        JOIN   restaurantes r  ON r.id        = t.restaurante_id
        WHERE  i.estado       = 'En proceso'
          AND  i.ticket_id    IS NOT NULL
          AND  t.estado       IN ('cerrado', 'resuelto')
          AND  b.tipo         ILIKE ANY (ARRAY['%MOCHILA%', '%VEHÍCULO%', '%VEHICULO%'])
        ORDER  BY t.numero_ticket, i.modelo
    LOOP
        -- Encabezado por ticket (solo al cambiar de ticket)
        IF v_eq.numero_ticket <> v_prev_ticket THEN
            RAISE NOTICE '';
            RAISE NOTICE '── Ticket NC-% ──', v_eq.numero_ticket;
            v_prev_ticket := v_eq.numero_ticket;
        END IF;

        -- Verificar que el restaurante tiene bodega configurada
        IF v_eq.bodega_restaurante IS NULL THEN
            RAISE WARNING '  ⚠️  SKIP: % (NC-%) — restaurante sin bodega_id configurado.',
                v_eq.modelo, v_eq.numero_ticket;
            v_count_skip := v_count_skip + 1;
            CONTINUE;
        END IF;

        -- ── 1. Instalar ítem en la bodega del restaurante ─────────────────
        UPDATE inventario
        SET    estado    = 'Operativo',
               bodega_id = v_eq.bodega_restaurante
        WHERE  id = v_eq.inventario_id
          AND  estado = 'En proceso';      -- guard de idempotencia

        IF NOT FOUND THEN
            RAISE NOTICE '  ℹ️  Ya procesado: % (NC-%) — saltando.', v_eq.modelo, v_eq.numero_ticket;
            CONTINUE;
        END IF;

        RAISE NOTICE '  OK NC-% | % uds de [%] -> bodega_id %',
            v_eq.numero_ticket,
            v_eq.cantidad,
            v_eq.modelo,
            v_eq.bodega_restaurante;

        -- ── 2. Registrar movimiento de instalación faltante ───────────────
        INSERT INTO movimientos_inventario
            (inventario_id, ticket_id, tipo_movimiento,
             bodega_origen_id, bodega_destino_id,
             cantidad, fecha_movimiento, realizado_por)
        VALUES
            (v_eq.inventario_id, v_eq.ticket_id, 'salida',
             v_eq.mochila_id,    v_eq.bodega_restaurante,
             v_eq.cantidad,      now(),                   NULL);

        v_count_ok := v_count_ok + 1;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════';
    RAISE NOTICE '  RESULTADO: % instalado(s) | % omitido(s) por falta de bodega de restaurante',
        v_count_ok, v_count_skip;
    RAISE NOTICE '══════════════════════════════════════════';

    IF v_count_skip > 0 THEN
        RAISE WARNING 'Algunos ítems no pudieron remediarse. Configura bodega_id en los restaurantes afectados y re-ejecuta.';
    END IF;
END $$;


-- ── VERIFICACIÓN POST-REMEDIACIÓN ─────────────────────────────────────────────
-- Debe devolver 0 filas si la remediación fue completa.

SELECT COUNT(*) AS items_aun_atrapados
FROM   inventario i
JOIN   tickets  t ON t.id       = i.ticket_id
JOIN   bodegas  b ON b.id       = i.bodega_id
WHERE  i.estado       = 'En proceso'
  AND  i.ticket_id    IS NOT NULL
  AND  t.estado       IN ('cerrado', 'resuelto')
  AND  b.tipo         ILIKE ANY (ARRAY['%MOCHILA%', '%VEHÍCULO%', '%VEHICULO%']);
