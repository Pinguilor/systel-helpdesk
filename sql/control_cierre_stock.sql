-- ════════════════════════════════════════════════════════════════════════════
-- CONTROL DE CIERRE — validación manual antes/después de cerrar un ticket
--
-- Corre la MISMA consulta principal ANTES y DESPUÉS de cerrar un ticket y compara:
--
--   Momento          estado esperado    bodega_actual esperada
--   ───────────────  ─────────────────  ──────────────────────────────────
--   ANTES del cierre 'En proceso'       la mochila del técnico (tipo MOCHILA)
--   DESPUÉS          'Operativo'        la bodega del local del restaurante
--
-- Si después del cierre alguna fila sigue 'En proceso' y/o en la mochila → la
-- fuga persiste. Si pasó a 'Operativo' + bodega del local → el descuento funcionó.
--
-- 👉 Reemplaza XXXX por el numero_ticket que vas a cerrar.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Consulta principal: estado de los ítems del ticket ─────────────────────
WITH t AS (
    SELECT id AS ticket_id
    FROM tickets
    WHERE numero_ticket = XXXX            -- 👈 PON AQUÍ EL NÚMERO DE TICKET
)
SELECT
    i.id,
    i.modelo,
    i.familia,
    i.numero_serie,
    i.es_serializado,
    i.cantidad,
    i.estado,                              -- ANTES: 'En proceso'  →  DESPUÉS: 'Operativo'
    b.nombre        AS bodega_actual,      -- ANTES: mochila       →  DESPUÉS: bodega del local
    b.tipo          AS bodega_tipo
FROM inventario i
JOIN t            ON i.ticket_id = t.ticket_id
LEFT JOIN bodegas b ON b.id = i.bodega_id
ORDER BY i.estado, i.modelo;


-- ─── Auxiliar (a): ¿qué bodega tiene asignada el local del ticket? ──────────
-- bodega_id NO debe ser nulo; si lo es, el cierre fallará a propósito (validación
-- pre-flight en closeTicketWithActaAction / smartCloseAction).
SELECT r.id AS restaurante_id, r.nombre_restaurante, r.bodega_id, b.nombre AS bodega_local
FROM tickets t
JOIN restaurantes r ON r.id = t.restaurante_id
LEFT JOIN bodegas b ON b.id = r.bodega_id
WHERE t.numero_ticket = XXXX;             -- 👈 mismo número
