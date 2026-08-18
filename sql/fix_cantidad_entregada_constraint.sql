-- ================================================================
-- PARCHE: reparar datos corruptos + constraint de seguridad
-- ================================================================
-- Desactiva temporalmente el trigger de solo-lectura en proyectos
-- completados, repara las filas corruptas y lo reactiva.
--
-- Ejecutar en Supabase Dashboard → SQL Editor → Run
-- ================================================================

-- ── Paso 1: Auditoría — ver las filas corruptas ANTES de reparar ─────────
SELECT
    pe.id,
    pe.tipo_item,
    pe.cantidad_total,
    pe.cantidad_entregada,
    pe.cantidad_instalada,
    COALESCE(pe.cantidad_reingresada, 0) AS cantidad_reingresada,
    pe.cantidad_total + COALESCE(pe.cantidad_reingresada, 0) AS tope_legitimo,
    pe.cantidad_entregada - (pe.cantidad_total + COALESCE(pe.cantidad_reingresada, 0)) AS exceso,
    p.nombre AS proyecto,
    p.estado AS estado_proyecto
FROM proyecto_equipamiento pe
JOIN proyectos p ON p.id = pe.proyecto_id
WHERE pe.cantidad_entregada > pe.cantidad_total + COALESCE(pe.cantidad_reingresada, 0)
ORDER BY exceso DESC;

-- ── Paso 2: Desactivar trigger de solo-lectura ──────────────────────────
ALTER TABLE proyecto_equipamiento DISABLE TRIGGER trg_equipamiento_readonly;

-- ── Paso 3: Reparar — recortar al tope legítimo ────────────────────────
UPDATE proyecto_equipamiento
SET
    cantidad_entregada = cantidad_total + COALESCE(cantidad_reingresada, 0),
    cantidad_instalada = LEAST(
        cantidad_instalada,
        cantidad_total + COALESCE(cantidad_reingresada, 0)
    )
WHERE cantidad_entregada > cantidad_total + COALESCE(cantidad_reingresada, 0);

-- ── Paso 4: Reactivar trigger de solo-lectura ───────────────────────────
ALTER TABLE proyecto_equipamiento ENABLE TRIGGER trg_equipamiento_readonly;

-- ── Paso 5: Aplicar CHECK constraint ────────────────────────────────────
ALTER TABLE proyecto_equipamiento
DROP CONSTRAINT IF EXISTS chk_cantidad_entregada;

ALTER TABLE proyecto_equipamiento
ADD CONSTRAINT chk_cantidad_entregada CHECK (
    COALESCE(cantidad_entregada, 0)
    <= COALESCE(cantidad_total, 0) + COALESCE(cantidad_reingresada, 0)
);
