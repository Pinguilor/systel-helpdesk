-- ============================================================
-- FIX: Limpiar fechas_limite_devolucion incorrectas en mochilas
-- Motivo: El bug previo actualizaba TODOS los ítems de la mochila
--         en lugar de solo los sobrantes del ticket cerrado.
-- Acción: Poner NULL en todos los ítems de mochilas que tengan
--         fecha_limite_devolucion. El sistema volverá a aplicar
--         el reloj correctamente la próxima vez que se cierre un ticket.
-- ============================================================

-- Vista previa (ejecutar primero para verificar alcance):
SELECT
    b.nombre            AS mochila,
    i.modelo,
    i.familia,
    i.cantidad,
    i.ticket_id,
    i.estado,
    i.fecha_limite_devolucion
FROM inventario i
JOIN bodegas b ON b.id = i.bodega_id
WHERE b.tipo ILIKE 'MOCHILA'
  AND i.fecha_limite_devolucion IS NOT NULL
ORDER BY b.nombre, i.modelo;

-- ============================================================
-- LIMPIEZA: Ejecutar solo después de confirmar la vista previa.
-- Elimina toda fecha_limite_devolucion de ítems en mochilas.
-- ============================================================

UPDATE inventario
SET fecha_limite_devolucion = NULL
FROM bodegas
WHERE inventario.bodega_id = bodegas.id
  AND bodegas.tipo ILIKE 'MOCHILA'
  AND inventario.fecha_limite_devolucion IS NOT NULL;

-- Verificar resultado (debe devolver 0 filas):
SELECT COUNT(*) AS filas_con_mora_pendiente
FROM inventario i
JOIN bodegas b ON b.id = i.bodega_id
WHERE b.tipo ILIKE 'MOCHILA'
  AND i.fecha_limite_devolucion IS NOT NULL;
