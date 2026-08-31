-- ================================================================
-- SANEAMIENTO: duplicados en proyecto_equipamiento + constraint UNIQUE
-- ================================================================
-- PASO 1: Diagnóstico (ejecutar primero, solo lectura)
-- ================================================================
SELECT
    proyecto_id,
    inventario_id,
    COUNT(*)                       AS filas,
    SUM(cantidad_total)            AS total_suma,
    SUM(cantidad_entregada)        AS entregada_suma,
    SUM(cantidad_instalada)        AS instalada_suma,
    SUM(cantidad_estacionada)      AS estacionada_suma,
    SUM(cantidad_en_transito)      AS en_transito_suma,
    SUM(cantidad_reingresada)      AS reingresada_suma
FROM proyecto_equipamiento
WHERE inventario_id IS NOT NULL
GROUP BY proyecto_id, inventario_id
HAVING COUNT(*) > 1
ORDER BY filas DESC;

-- Si la query anterior devuelve filas, hay duplicados. Continúa con los pasos 2 y 3.
-- Si devuelve 0 filas, salta directo al paso 3 (constraint).

-- ================================================================
-- PASO 2: Fusionar duplicados (keeper = el más antiguo por created_at)
-- ================================================================

-- 2a. Actualizar la fila keeper con la suma de todas las columnas del grupo
WITH keeper AS (
    -- Elegir la fila más antigua de cada grupo como keeper
    SELECT DISTINCT ON (proyecto_id, inventario_id)
        id AS keeper_id,
        proyecto_id,
        inventario_id
    FROM proyecto_equipamiento
    WHERE inventario_id IS NOT NULL
    ORDER BY proyecto_id, inventario_id, created_at ASC
),
sumas AS (
    SELECT
        proyecto_id,
        inventario_id,
        SUM(COALESCE(cantidad_total,       0)) AS sum_total,
        SUM(COALESCE(cantidad_entregada,   0)) AS sum_entregada,
        SUM(COALESCE(cantidad_instalada,   0)) AS sum_instalada,
        SUM(COALESCE(cantidad_estacionada, 0)) AS sum_estacionada,
        SUM(COALESCE(cantidad_en_transito, 0)) AS sum_en_transito,
        SUM(COALESCE(cantidad_reingresada, 0)) AS sum_reingresada
    FROM proyecto_equipamiento
    WHERE inventario_id IS NOT NULL
    GROUP BY proyecto_id, inventario_id
    HAVING COUNT(*) > 1
)
UPDATE proyecto_equipamiento pe
SET
    cantidad_total       = s.sum_total,
    cantidad_entregada   = s.sum_entregada,
    cantidad_instalada   = s.sum_instalada,
    cantidad_estacionada = s.sum_estacionada,
    cantidad_en_transito = s.sum_en_transito,
    cantidad_reingresada = s.sum_reingresada
FROM keeper k
JOIN sumas s ON s.proyecto_id = k.proyecto_id AND s.inventario_id = k.inventario_id
WHERE pe.id = k.keeper_id;

-- 2b. Eliminar las filas no-keeper (las "extra" del grupo)
DELETE FROM proyecto_equipamiento
WHERE inventario_id IS NOT NULL
  AND id IN (
    SELECT id FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY proyecto_id, inventario_id
                ORDER BY created_at
            ) AS rn
        FROM proyecto_equipamiento
        WHERE inventario_id IS NOT NULL
    ) ranked
    WHERE ranked.rn > 1
  );

-- Verificación post-limpieza: debe devolver 0 filas
SELECT COUNT(*) AS duplicados_restantes
FROM proyecto_equipamiento
WHERE inventario_id IS NOT NULL
GROUP BY proyecto_id, inventario_id
HAVING COUNT(*) > 1;

-- ================================================================
-- PASO 3: Agregar constraint UNIQUE para bloquear futuras duplicidades
-- ================================================================
-- El constraint solo aplica a filas con inventario_id NOT NULL.
-- PostgreSQL permite múltiples NULL en columnas UNIQUE (NULL != NULL),
-- por lo que los ítems manuales (inventario_id = NULL) siguen pudiendo
-- existir como filas separadas.

ALTER TABLE proyecto_equipamiento
ADD CONSTRAINT uq_pe_proyecto_inventario
UNIQUE (proyecto_id, inventario_id);
