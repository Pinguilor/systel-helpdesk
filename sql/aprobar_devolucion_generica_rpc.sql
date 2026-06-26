-- RPC para aprobar la devolución de ítems GENÉRICOS (no serializados) de forma atómica.
-- Ambas operaciones (descontar mochila + acreditar central) corren en la misma
-- transacción PL/pgSQL, eliminando el riesgo de pérdida de stock si la segunda
-- operación falla después de que la primera ya se confirmó.
--
-- Ejecutar en Supabase SQL Editor una sola vez.

CREATE OR REPLACE FUNCTION aprobar_devolucion_generica_rpc(
    p_inventario_id  UUID,   -- fila en la mochila del técnico (se descuenta)
    p_bodega_central UUID,   -- bodega destino (se acredita)
    p_cantidad       INT,    -- unidades a mover
    p_modelo         TEXT,
    p_familia        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_central_id UUID;
BEGIN
    -- ── 1. Descontar mochila (guard atómico: falla si cantidad < p_cantidad) ──
    UPDATE inventario
    SET    cantidad = cantidad - p_cantidad
    WHERE  id       = p_inventario_id
      AND  cantidad >= p_cantidad;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error', 'Stock insuficiente en mochila o ítem no encontrado.'
        );
    END IF;

    -- ── 2. Buscar fila existente en bodega central ────────────────────────────
    SELECT id INTO v_central_id
    FROM   inventario
    WHERE  bodega_id        = p_bodega_central
      AND  modelo           = p_modelo
      AND  (
               familia      = p_familia
            OR (familia IS NULL AND p_familia IS NULL)
           )
      AND  id               != p_inventario_id   -- excluye la propia fila de mochila
      AND  es_serializado   = false
    LIMIT 1;

    IF v_central_id IS NOT NULL THEN
        -- Acreditar sobre fila existente
        UPDATE inventario
        SET    cantidad = cantidad + p_cantidad
        WHERE  id = v_central_id;
    ELSE
        -- Crear nueva fila en bodega central
        INSERT INTO inventario
            (bodega_id, modelo, familia, es_serializado, cantidad, estado)
        VALUES
            (p_bodega_central, p_modelo, p_familia, false, p_cantidad, 'Disponible');
    END IF;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    -- El RAISE automático revierte la transacción completa.
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
