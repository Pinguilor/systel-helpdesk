-- =============================================================================
-- CIERRE DE PROYECTO — Systel Loop
-- Ejecutar en Supabase Dashboard → SQL Editor. Idempotente.
-- =============================================================================

-- ── 1. Columnas de cierre en proyectos ────────────────────────────────────
ALTER TABLE proyectos
    ADD COLUMN IF NOT EXISTS fecha_cierre          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cerrado_por           UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS firma_cierre_url      TEXT,
    ADD COLUMN IF NOT EXISTS firma_cierre_hash     TEXT,
    ADD COLUMN IF NOT EXISTS firma_cierre_firmante TEXT,
    ADD COLUMN IF NOT EXISTS firma_cierre_cargo    TEXT;

-- ── 2. RPC de validación de cierre ────────────────────────────────────────
-- Retorna JSON con: puede_cerrar (bool), tareas_pendientes ([]), materiales_pendientes ([])
-- SECURITY DEFINER: puede leer todas las filas sin depender de RLS del caller.

CREATE OR REPLACE FUNCTION verificar_cierre_proyecto(p_proyecto_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tareas_pendientes     JSON;
    v_materiales_pendientes JSON;
BEGIN
    -- Checklists sin completar (sólo tareas hoja, no grupos)
    SELECT json_agg(
        json_build_object(
            'id',     id,
            'titulo', TRIM(REGEXP_REPLACE(contenido, '^\[CHECKLIST\] ?', ''))
        )
        ORDER BY created_at
    )
    INTO v_tareas_pendientes
    FROM bitacora_entradas
    WHERE proyecto_id = p_proyecto_id
      AND tipo        = 'hito'
      AND contenido   LIKE '[CHECKLIST]%'
      AND (adjuntos->0->>'completado')::boolean IS DISTINCT FROM TRUE;

    -- Materiales entregados al proyecto con saldo pendiente de instalación.
    -- saldo = cantidad_entregada − cantidad_instalada > 0  →  en manos del técnico.
    SELECT json_agg(
        json_build_object(
            'id',                 pe.id,
            'modelo',             COALESCE(ce.modelo, pe.tipo_item, 'Sin modelo'),
            'cantidad_entregada', pe.cantidad_entregada,
            'cantidad_instalada', COALESCE(pe.cantidad_instalada, 0),
            'saldo',              pe.cantidad_entregada - COALESCE(pe.cantidad_instalada, 0)
        )
        ORDER BY pe.created_at
    )
    INTO v_materiales_pendientes
    FROM proyecto_equipamiento pe
    LEFT JOIN catalogo_equipos ce ON ce.id = pe.inventario_id
    WHERE pe.proyecto_id = p_proyecto_id
      AND pe.cantidad_entregada > COALESCE(pe.cantidad_instalada, 0);

    RETURN json_build_object(
        'puede_cerrar',          (v_tareas_pendientes IS NULL AND v_materiales_pendientes IS NULL),
        'tareas_pendientes',     COALESCE(v_tareas_pendientes,     '[]'::json),
        'materiales_pendientes', COALESCE(v_materiales_pendientes, '[]'::json)
    );
END;
$$;

-- ── 3. Trigger: modo Solo Lectura en bitacora_entradas ────────────────────
-- Bloquea INSERT / UPDATE / DELETE cuando el proyecto ya está 'completado'.
-- El orden de operaciones en completarYFirmarProyecto garantiza que el log
-- de auditoría se inserta ANTES de cambiar el estado, por lo que el trigger
-- nunca bloquea la acción de cierre en sí.

CREATE OR REPLACE FUNCTION fn_bloquear_bitacora_si_completado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_estado TEXT;
BEGIN
    SELECT estado INTO v_estado
    FROM proyectos
    WHERE id = COALESCE(NEW.proyecto_id, OLD.proyecto_id);

    IF v_estado = 'completado' THEN
        RAISE EXCEPTION
            'PROYECTO_COMPLETADO: El proyecto está en estado Completado (solo lectura). No se permiten modificaciones en la bitácora.';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_readonly ON bitacora_entradas;
CREATE TRIGGER trg_bitacora_readonly
    BEFORE INSERT OR UPDATE OR DELETE ON bitacora_entradas
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_bitacora_si_completado();

-- ── 4. Trigger: modo Solo Lectura en proyecto_equipamiento ────────────────

CREATE OR REPLACE FUNCTION fn_bloquear_equipamiento_si_completado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_estado TEXT;
BEGIN
    SELECT estado INTO v_estado
    FROM proyectos
    WHERE id = COALESCE(NEW.proyecto_id, OLD.proyecto_id);

    IF v_estado = 'completado' THEN
        RAISE EXCEPTION
            'PROYECTO_COMPLETADO: El proyecto está en estado Completado (solo lectura). No se permiten modificaciones en el equipamiento.';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_equipamiento_readonly ON proyecto_equipamiento;
CREATE TRIGGER trg_equipamiento_readonly
    BEFORE INSERT OR UPDATE OR DELETE ON proyecto_equipamiento
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_equipamiento_si_completado();

-- ── Verificación ───────────────────────────────────────────────────────────
-- SELECT routine_name FROM information_schema.routines
--   WHERE routine_name = 'verificar_cierre_proyecto';
--
-- SELECT trigger_name, event_object_table FROM information_schema.triggers
--   WHERE trigger_name IN ('trg_bitacora_readonly','trg_equipamiento_readonly');
