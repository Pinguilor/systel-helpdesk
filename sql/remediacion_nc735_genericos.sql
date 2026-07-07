-- ─────────────────────────────────────────────────────────────────────────────
-- REMEDIACIÓN NC-735: Ítems genéricos atrapados en mochila de Lorenzo Montecinos
-- ─────────────────────────────────────────────────────────────────────────────
-- Causa: closeTicketWithActaAction usaba un if/else donde el fallback
-- (ticket_id + estado='En proceso') nunca corría si ya existía ≥1 movimiento.
-- El ítem serializado sí tenía movimiento → los genéricos fueron ignorados.
--
-- Este script:
--   1. Diagnostica los ítems afectados (solo lectura).
--   2. Los mueve a la bodega del restaurante (estado='Operativo').
--   3. Registra los movimientos de instalación faltantes.
--
-- Ejecutar en Supabase SQL Editor.
-- PRIMERO corre el bloque de diagnóstico. Si los resultados son los esperados,
-- corre el bloque de remediación.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── PASO 0: Identificar IDs relevantes ───────────────────────────────────────

WITH
ticket AS (
    SELECT t.id              AS ticket_id,
           t.restaurante_id,
           r.bodega_id       AS bodega_restaurante
    FROM   tickets t
    JOIN   restaurantes r ON r.id = t.restaurante_id
    WHERE  t.numero_ticket = 735
    LIMIT  1
),
mochila AS (
    SELECT b.id AS mochila_id
    FROM   bodegas b
    JOIN   profiles p ON p.id = b.tecnico_id
    WHERE  p.full_name ILIKE '%Lorenzo%Montecinos%'
      AND  b.tipo       ILIKE 'MOCHILA'
    LIMIT  1
)

-- ── DIAGNÓSTICO: ítems genéricos atrapados ───────────────────────────────────
SELECT
    i.id,
    i.modelo,
    i.familia,
    i.cantidad,
    i.estado,
    i.ticket_id,
    i.bodega_id,
    b_inv.nombre  AS bodega_actual,
    t.ticket_id   AS ticket_nc735_id,
    t.bodega_restaurante
FROM   inventario i
JOIN   ticket  t ON i.ticket_id = t.ticket_id
JOIN   mochila m ON i.bodega_id = m.mochila_id
JOIN   bodegas b_inv ON b_inv.id = i.bodega_id
WHERE  i.es_serializado = false
  AND  i.estado         = 'En proceso';

-- ─────────────────────────────────────────────────────────────────────────────
-- Si el diagnóstico muestra los ítems correctos, ejecuta la REMEDIACIÓN:
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_ticket_id          UUID;
    v_bodega_restaurante UUID;
    v_mochila_id         UUID;
    v_eq                 RECORD;
    v_count              INT := 0;
BEGIN
    -- Resolver IDs
    SELECT t.id, r.bodega_id
    INTO   v_ticket_id, v_bodega_restaurante
    FROM   tickets t
    JOIN   restaurantes r ON r.id = t.restaurante_id
    WHERE  t.numero_ticket = 735
    LIMIT  1;

    IF v_ticket_id IS NULL THEN
        RAISE EXCEPTION 'Ticket NC-735 no encontrado.';
    END IF;

    IF v_bodega_restaurante IS NULL THEN
        RAISE EXCEPTION 'El restaurante del ticket NC-735 no tiene bodega_id configurado.';
    END IF;

    SELECT b.id INTO v_mochila_id
    FROM   bodegas b
    JOIN   profiles p ON p.id = b.tecnico_id
    WHERE  p.full_name ILIKE '%Lorenzo%Montecinos%'
      AND  b.tipo       ILIKE 'MOCHILA'
    LIMIT  1;

    IF v_mochila_id IS NULL THEN
        RAISE EXCEPTION 'Mochila de Lorenzo Montecinos no encontrada.';
    END IF;

    RAISE NOTICE 'ticket_id=%, bodega_restaurante=%, mochila_id=%',
        v_ticket_id, v_bodega_restaurante, v_mochila_id;

    -- Procesar cada ítem genérico atrapado
    FOR v_eq IN
        SELECT id, cantidad, bodega_id, modelo, familia
        FROM   inventario
        WHERE  ticket_id      = v_ticket_id
          AND  bodega_id      = v_mochila_id
          AND  es_serializado = false
          AND  estado         = 'En proceso'
    LOOP
        RAISE NOTICE 'Procesando: % | % | cantidad=%', v_eq.modelo, v_eq.familia, v_eq.cantidad;

        -- 1. Marcar como instalado en el local del restaurante
        UPDATE inventario
        SET    estado    = 'Operativo',
               bodega_id = v_bodega_restaurante
        WHERE  id = v_eq.id;

        -- 2. Registrar movimiento de instalación faltante
        INSERT INTO movimientos_inventario
            (inventario_id, ticket_id, tipo_movimiento,
             bodega_origen_id, bodega_destino_id,
             cantidad, fecha_movimiento, realizado_por)
        VALUES
            (v_eq.id, v_ticket_id, 'salida',
             v_mochila_id, v_bodega_restaurante,
             v_eq.cantidad, now(), NULL);

        v_count := v_count + 1;
    END LOOP;

    RAISE NOTICE '✅ Remediación completa: % ítem(s) instalado(s).', v_count;

    IF v_count = 0 THEN
        RAISE WARNING 'No se encontraron ítems genéricos atrapados para NC-735. Verifica el diagnóstico.';
    END IF;
END $$;


-- ── VERIFICACIÓN POST-REMEDIACIÓN ─────────────────────────────────────────────
-- Corre este SELECT para confirmar que los ítems ahora tienen estado='Operativo'
-- y bodega_id apunta a la bodega del restaurante.

WITH ticket AS (
    SELECT id FROM tickets WHERE numero_ticket = 735 LIMIT 1
)
SELECT
    i.id,
    i.modelo,
    i.familia,
    i.cantidad,
    i.estado,
    b.nombre AS bodega_actual
FROM   inventario i
JOIN   ticket     t ON i.ticket_id = t.id
JOIN   bodegas    b ON b.id = i.bodega_id
WHERE  i.es_serializado = false
ORDER  BY i.modelo;
