-- ════════════════════════════════════════════════════════════════════════════
-- REMEDIACIÓN DE STOCK FANTASMA  (script de saneamiento puntual)
--
-- Mueve ítems atascados en mochilas (estado 'En proceso') cuyo ticket YA está
-- cerrado/completado → estado 'Operativo' + bodega_id del local del restaurante.
-- Deja los ítems idénticos a como los habría dejado un cierre correcto.
--
-- Garantías de seguridad:
--   • t.estado IN ('cerrado','completado')  → nunca toca tickets vivos / En proceso.
--   • b.tipo ILIKE 'MOCHILA'                → solo lo que sigue físicamente en mochila.
--   • r.bodega_id IS NOT NULL               → nunca deja bodega_id en NULL.
--   • Todo el saneamiento va en BEGIN…COMMIT/ROLLBACK con verificación intermedia.
--
-- Ejecutar por etapas: PASO 0 → PASO 1 (preview) → PASO 2 (transacción).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PASO 0: confirmar los nombres EXACTOS de los estados de cierre ──────────
-- Si tus tickets finalizados usan otra etiqueta (p. ej. 'resuelto'), ajústala en
-- los WHERE de los pasos 1 y 2.
SELECT estado, COUNT(*) FROM tickets GROUP BY estado ORDER BY 2 DESC;


-- ─── PASO 1: PREVIEW (dry-run) — NO modifica nada ───────────────────────────
SELECT
    i.id              AS inventario_id,
    i.modelo,
    i.numero_serie,
    i.cantidad,
    i.estado          AS estado_actual,      -- 'En proceso'
    b_orig.nombre     AS mochila_origen,
    t.numero_ticket,
    t.estado          AS ticket_estado,      -- 'cerrado' / 'completado'
    r.nombre_restaurante,
    b_dest.nombre     AS bodega_local_destino -- a dónde se moverá
FROM inventario i
JOIN tickets      t      ON t.id = i.ticket_id
JOIN restaurantes r      ON r.id = t.restaurante_id
JOIN bodegas      b_orig ON b_orig.id = i.bodega_id          -- bodega actual (mochila)
LEFT JOIN bodegas b_dest ON b_dest.id = r.bodega_id          -- bodega destino (local)
WHERE i.estado = 'En proceso'
  AND b_orig.tipo ILIKE 'MOCHILA'           -- solo lo que sigue físicamente en una mochila
  AND t.estado IN ('cerrado', 'completado') -- ticket ya finalizado (requisito estricto)
  AND r.bodega_id IS NOT NULL               -- el local SÍ tiene bodega (nunca movemos a NULL)
ORDER BY t.numero_ticket, i.modelo;


-- ─── PASO 2: REMEDIACIÓN (transacción reversible) ───────────────────────────
BEGIN;

-- 2.a — Trazabilidad: registrar el movimiento de salida mochila → local.
--       (Opcional pero recomendado.) realizado_por = NULL marca "ajuste de sistema".
--       Si la columna es NOT NULL, reemplaza NULL por el UUID de un usuario admin,
--       o si no te importa la traza de estos ajustes, omite este bloque 2.a.
INSERT INTO movimientos_inventario
    (inventario_id, ticket_id, tipo_movimiento, bodega_origen_id, bodega_destino_id, cantidad, fecha_movimiento, realizado_por)
SELECT
    i.id, i.ticket_id, 'salida', i.bodega_id, r.bodega_id, i.cantidad, now(), NULL
FROM inventario i
JOIN tickets      t ON t.id = i.ticket_id
JOIN restaurantes r ON r.id = t.restaurante_id
JOIN bodegas      b ON b.id = i.bodega_id
WHERE i.estado = 'En proceso'
  AND b.tipo ILIKE 'MOCHILA'
  AND t.estado IN ('cerrado', 'completado')
  AND r.bodega_id IS NOT NULL;

-- 2.b — El UPDATE de saneamiento.
UPDATE inventario i
SET estado    = 'Operativo',
    bodega_id = r.bodega_id
FROM tickets      t,
     restaurantes r,
     bodegas      b
WHERE i.ticket_id = t.id
  AND r.id  = t.restaurante_id
  AND b.id  = i.bodega_id                    -- bodega actual del ítem
  AND i.estado = 'En proceso'
  AND b.tipo ILIKE 'MOCHILA'
  AND t.estado IN ('cerrado', 'completado')
  AND r.bodega_id IS NOT NULL;

-- 2.c — Verificación post-UPDATE: este SELECT debe devolver 0.
--       Si devuelve algo, NO hagas COMMIT — investiga primero (ROLLBACK).
SELECT COUNT(*) AS fantasmas_restantes
FROM inventario i
JOIN tickets t ON t.id = i.ticket_id
JOIN bodegas b ON b.id = i.bodega_id
WHERE i.estado = 'En proceso'
  AND b.tipo ILIKE 'MOCHILA'
  AND t.estado IN ('cerrado', 'completado');

-- ─── Si todo se ve bien:
COMMIT;
-- ─── Si algo no cuadra:
-- ROLLBACK;
