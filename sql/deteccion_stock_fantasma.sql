-- ════════════════════════════════════════════════════════════════════════════
-- DETECCIÓN DE STOCK FANTASMA
--
-- Lista TODO el stock fantasma actual del sistema: ítems de inventario ligados a
-- un ticket (ticket_id) que fueron "consumidos" (estado 'En proceso') pero siguen
-- físicamente atascados en una mochila de técnico en lugar de haberse movido al
-- local. Un ítem así cuenta dos veces (aparece en el ticket Y en la mochila).
--
-- Causa raíz original (ya corregida en código):
--   - SmartCloseModal recibía un packing list agregado sin ids reales → el UPDATE
--     de descuento (.in('id', [...])) no matcheaba ninguna fila.
--   - closeTicketWithActaAction saltaba en silencio la logística si el restaurante
--     no tenía bodega_id.
--
-- Uso: correr periódicamente. En un sistema sano debe devolver 0 filas.
-- ════════════════════════════════════════════════════════════════════════════

SELECT
    i.id          AS inventario_id,
    i.modelo,
    i.numero_serie,
    i.es_serializado,
    i.cantidad,
    i.estado,
    i.ticket_id,
    b.nombre      AS bodega,
    b.tipo        AS bodega_tipo
FROM inventario i
JOIN bodegas b ON b.id = i.bodega_id
WHERE i.ticket_id IS NOT NULL
  AND i.estado = 'En proceso'
  AND b.tipo ILIKE 'MOCHILA'
ORDER BY i.ticket_id;
