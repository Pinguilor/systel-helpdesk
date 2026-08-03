-- ================================================================
-- ACTUALIZACIÓN: verificar_cierre_proyecto
-- Integra el Protocolo de Custodia Inversa en la validación de cierre
-- Prerrequisito: custodia_inversa.sql ya fue ejecutado
-- ================================================================
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ================================================================

CREATE OR REPLACE FUNCTION verificar_cierre_proyecto(p_proyecto_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tareas_pendientes     JSON;
    v_materiales_pendientes JSON;
BEGIN
    -- ── 1. Checklists sin completar ───────────────────────────────────────
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

    -- ── 2. Materiales con unidades pendientes ─────────────────────────────
    --
    -- Con custodia inversa los 4 estados declaran el destino de cada unidad:
    --   instalada    → instalada correctamente ✓
    --   estacionada  → dejada en obra (cliente retiene) ✓
    --   en_transito  → técnico la trae de vuelta, handshake pendiente ✗
    --   reingresada  → recibida en logística ✓
    --
    -- Bloqueadores:
    --   a) Unidades "libres" (sin estado declarado): entregada > suma de los 4
    --   b) Unidades en tránsito: cantidad_en_transito > 0 (handshake incompleto)
    --
    -- saldo = entregadas sin ningún estado declarado aún (excluye en_transito
    --         porque ya tienen estado, solo que incompleto)
    SELECT json_agg(
        json_build_object(
            'id',                   pe.id,
            'modelo',               COALESCE(ce.modelo, pe.tipo_item, 'Sin modelo'),
            'cantidad_entregada',   pe.cantidad_entregada,
            'cantidad_instalada',   COALESCE(pe.cantidad_instalada,   0),
            'cantidad_en_transito', COALESCE(pe.cantidad_en_transito, 0),
            -- saldo = unidades sin ningún estado (libres, sin declarar)
            'saldo', GREATEST(0,
                pe.cantidad_entregada
                - COALESCE(pe.cantidad_instalada,   0)
                - COALESCE(pe.cantidad_estacionada, 0)
                - COALESCE(pe.cantidad_en_transito, 0)
                - COALESCE(pe.cantidad_reingresada, 0)
            ),
            -- flag para distinguir bloqueadores en la UI
            'en_transito', (COALESCE(pe.cantidad_en_transito, 0) > 0)
        )
        ORDER BY pe.created_at
    )
    INTO v_materiales_pendientes
    FROM proyecto_equipamiento pe
    LEFT JOIN catalogo_equipos ce ON ce.id = pe.inventario_id
    WHERE pe.proyecto_id = p_proyecto_id
      AND (
          -- a) Unidades libres sin declarar
          pe.cantidad_entregada > (
              COALESCE(pe.cantidad_instalada,   0)
              + COALESCE(pe.cantidad_estacionada, 0)
              + COALESCE(pe.cantidad_en_transito, 0)
              + COALESCE(pe.cantidad_reingresada, 0)
          )
          -- b) Handshake incompleto (en tránsito)
          OR COALESCE(pe.cantidad_en_transito, 0) > 0
      );

    -- ── 3. Resultado ──────────────────────────────────────────────────────
    RETURN json_build_object(
        'puede_cerrar',          (v_tareas_pendientes IS NULL AND v_materiales_pendientes IS NULL),
        'tareas_pendientes',     COALESCE(v_tareas_pendientes,     '[]'::json),
        'materiales_pendientes', COALESCE(v_materiales_pendientes, '[]'::json)
    );
END;
$$;

-- ── Verificación ──────────────────────────────────────────────────────────
-- SELECT verificar_cierre_proyecto('<tu-proyecto-uuid>');
