-- ─────────────────────────────────────────────────────────────────────────────
-- SWEEP GLOBAL: ítems 'En proceso' huérfanos en mochilas de técnicos
-- para tickets ya cerrados o resueltos.
--
-- Ejecutar en Supabase SQL Editor (solo lectura, sin efectos secundarios).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Vista completa del problema ───────────────────────────────────────────────
SELECT
    -- Ticket
    t.numero_ticket,
    t.estado                            AS ticket_estado,
    t.fecha_resolucion,

    -- Material atrapado
    i.id                                AS inventario_id,
    i.modelo,
    i.familia,
    i.cantidad,
    CASE WHEN i.es_serializado THEN 'SERIALIZADO' ELSE 'GENÉRICO' END AS tipo_item,
    i.numero_serie,

    -- Dónde está (mochila del técnico)
    b_mochila.nombre                    AS bodega_actual,
    b_mochila.tipo                      AS tipo_bodega,
    p_tec.full_name                     AS tecnico,

    -- A dónde debería haber ido (restaurante)
    r.nombre_restaurante,
    r.bodega_id                         AS bodega_restaurante_id,
    b_rest.nombre                       AS bodega_restaurante_nombre,
    CASE WHEN r.bodega_id IS NULL THEN '⚠️ SIN BODEGA CONFIGURADA' ELSE '✅ OK' END
                                        AS estado_configuracion

FROM   inventario i
JOIN   tickets     t       ON t.id       = i.ticket_id
JOIN   bodegas     b_mochila ON b_mochila.id = i.bodega_id
JOIN   restaurantes r      ON r.id       = t.restaurante_id
LEFT JOIN bodegas  b_rest  ON b_rest.id  = r.bodega_id
LEFT JOIN profiles p_tec   ON p_tec.id   = b_mochila.tecnico_id

WHERE  i.estado         = 'En proceso'
  AND  i.ticket_id      IS NOT NULL
  AND  t.estado         IN ('cerrado', 'resuelto')
  AND  b_mochila.tipo   ILIKE ANY (ARRAY['%MOCHILA%', '%VEHÍCULO%', '%VEHICULO%'])

ORDER BY t.numero_ticket, i.modelo;

-- ── Resumen ejecutivo ─────────────────────────────────────────────────────────
SELECT
    COUNT(*)                                        AS total_items_atrapados,
    COUNT(DISTINCT t.numero_ticket)                 AS tickets_afectados,
    COUNT(DISTINCT p_tec.full_name)                 AS tecnicos_afectados,
    SUM(CASE WHEN r.bodega_id IS NULL THEN 1 END)   AS items_sin_bodega_restaurante,
    SUM(CASE WHEN r.bodega_id IS NOT NULL THEN 1 END) AS items_remedidables
FROM   inventario i
JOIN   tickets     t         ON t.id       = i.ticket_id
JOIN   bodegas     b_mochila ON b_mochila.id = i.bodega_id
JOIN   restaurantes r        ON r.id       = t.restaurante_id
LEFT JOIN profiles p_tec     ON p_tec.id   = b_mochila.tecnico_id
WHERE  i.estado         = 'En proceso'
  AND  i.ticket_id      IS NOT NULL
  AND  t.estado         IN ('cerrado', 'resuelto')
  AND  b_mochila.tipo   ILIKE ANY (ARRAY['%MOCHILA%', '%VEHÍCULO%', '%VEHICULO%']);
