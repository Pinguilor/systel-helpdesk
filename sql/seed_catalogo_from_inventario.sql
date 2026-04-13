-- ============================================================
-- Backfill: poblar catalogo_equipos desde inventario histórico
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Problema que resuelve:
--   Los registros antiguos de catalogo_equipos tienen bodega_id=NULL
--   y apuntan a familias globales (UUID-A). Las nuevas familias
--   bodega-específicas (UUID-B) no tienen modelos asociados.
--   Este script crea las entradas faltantes en catalogo_equipos
--   para cada bodega, usando las familias bodega-específicas
--   que ya existen (cruzando por nombre).
--
-- Condición previa:
--   Debes haber creado las familias bodega-específicas en el modal
--   "Catálogo de Equipos" para cada bodega (ya lo hiciste).
-- ============================================================

INSERT INTO catalogo_equipos (familia_id, modelo, es_serializado, bodega_id)
SELECT
    fh.id          AS familia_id,
    i.modelo,
    BOOL_OR(i.es_serializado) AS es_serializado,
    i.bodega_id
FROM inventario i
JOIN familias_hardware fh
    ON LOWER(TRIM(fh.nombre)) = LOWER(TRIM(i.familia))
    AND fh.bodega_id = i.bodega_id          -- solo familias bodega-específicas (UUID-B)
WHERE i.modelo    IS NOT NULL AND i.modelo    <> ''
  AND i.familia   IS NOT NULL AND i.familia   <> ''
  AND i.bodega_id IS NOT NULL
  AND i.estado    != 'Inactivo'
GROUP BY fh.id, i.modelo, i.bodega_id
ON CONFLICT (familia_id, modelo) DO NOTHING;

-- ============================================================
-- Verifica el resultado:
-- ============================================================
SELECT
    b.nombre                            AS bodega,
    fh.nombre                           AS familia,
    ce.modelo,
    ce.es_serializado,
    ce.bodega_id IS NOT NULL            AS tiene_bodega_id
FROM catalogo_equipos ce
JOIN familias_hardware fh ON fh.id = ce.familia_id
JOIN bodegas b            ON b.id  = fh.bodega_id
ORDER BY b.nombre, fh.nombre, ce.modelo;
-- ============================================================
