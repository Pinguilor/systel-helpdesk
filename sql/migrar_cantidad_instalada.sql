-- ================================================================
-- MIGRACIÓN: Poblar cantidad_instalada desde historial previo
-- ================================================================
-- Rellena proyecto_equipamiento.cantidad_instalada usando el conteo
-- de ítems marcados como 'instalado' en el sistema anterior
-- (proyecto_bom_items), que no pobló esta columna al crearla.
--
-- Idempotente: usa GREATEST para no sobrescribir valores ya correctos.
-- Segura:      usa LEAST para respetar el CHECK constraint de custodia.
--
-- Ejecutar en Supabase Dashboard → SQL Editor → Run
-- ================================================================


-- ── Paso 1: Items con catálogo (inventario_id → catalogo_equipos) ─────────────
--
-- Matcheo: proyecto_id + catalogo_equipos.modelo = proyecto_bom_items.modelo
-- DISTINCT ON (pe.id) evita duplicados si hay varias familias con mismo modelo.

WITH historico AS (
    SELECT
        proyecto_id,
        modelo,
        COUNT(*) AS qty
    FROM   proyecto_bom_items
    WHERE  estado = 'instalado'
    GROUP  BY proyecto_id, modelo
),
mejor_match AS (
    SELECT DISTINCT ON (pe.id)
        pe.id                           AS equip_id,
        LEAST(
            -- Máximo permitido por la constraint de custodia inversa
            GREATEST(0,
                COALESCE(pe.cantidad_entregada,   0)
                - COALESCE(pe.cantidad_estacionada, 0)
                - COALESCE(pe.cantidad_en_transito, 0)
                - COALESCE(pe.cantidad_reingresada, 0)
            ),
            -- Conteo histórico (tomamos el mayor disponible entre actual e histórico)
            GREATEST(COALESCE(pe.cantidad_instalada, 0), h.qty)
        ) AS nueva_cantidad
    FROM   proyecto_equipamiento pe
    JOIN   historico h           ON h.proyecto_id = pe.proyecto_id
    JOIN   catalogo_equipos ce   ON ce.id = pe.inventario_id
                                AND ce.modelo = h.modelo
    WHERE  COALESCE(h.qty, 0) > COALESCE(pe.cantidad_instalada, 0)
    ORDER  BY pe.id, h.qty DESC   -- si hay varias familias, tomamos la de mayor conteo
)
UPDATE proyecto_equipamiento pe
SET    cantidad_instalada = mm.nueva_cantidad
FROM   mejor_match mm
WHERE  pe.id = mm.equip_id;


-- ── Paso 2: Items manuales (sin inventario_id, match por tipo_item) ───────────

WITH historico AS (
    SELECT
        proyecto_id,
        modelo,
        COUNT(*) AS qty
    FROM   proyecto_bom_items
    WHERE  estado = 'instalado'
    GROUP  BY proyecto_id, modelo
)
UPDATE proyecto_equipamiento pe
SET    cantidad_instalada = LEAST(
           GREATEST(0,
               COALESCE(pe.cantidad_entregada,   0)
               - COALESCE(pe.cantidad_estacionada, 0)
               - COALESCE(pe.cantidad_en_transito, 0)
               - COALESCE(pe.cantidad_reingresada, 0)
           ),
           GREATEST(COALESCE(pe.cantidad_instalada, 0), h.qty)
       )
FROM   historico h
WHERE  pe.proyecto_id   = h.proyecto_id
  AND  pe.inventario_id IS NULL
  AND  pe.tipo_item     = h.modelo
  AND  COALESCE(h.qty, 0) > COALESCE(pe.cantidad_instalada, 0);


-- ── Verificación post-migración ───────────────────────────────────────────────
-- Ejecutar por separado para revisar los resultados antes de confirmar.

SELECT
    p.nombre                        AS proyecto,
    COALESCE(ce.modelo, pe.tipo_item, 'Manual') AS material,
    pe.cantidad_entregada,
    pe.cantidad_instalada,
    pe.cantidad_estacionada,
    pe.cantidad_en_transito,
    pe.cantidad_reingresada,
    -- Unidades sin declarar después de la migración
    GREATEST(0,
        pe.cantidad_entregada
        - COALESCE(pe.cantidad_instalada,   0)
        - COALESCE(pe.cantidad_estacionada, 0)
        - COALESCE(pe.cantidad_en_transito, 0)
        - COALESCE(pe.cantidad_reingresada, 0)
    ) AS libres_post_migracion
FROM   proyecto_equipamiento pe
JOIN   proyectos p        ON p.id = pe.proyecto_id
LEFT JOIN catalogo_equipos ce ON ce.id = pe.inventario_id
WHERE  pe.cantidad_instalada > 0
ORDER  BY p.nombre, material;
