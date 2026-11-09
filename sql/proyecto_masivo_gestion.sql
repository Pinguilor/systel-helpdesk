-- Gestión de un Rollout ya creado:
--   • agregar_locales_proyecto_masivo  → suma locales nuevos (misma lógica de creación, una transacción).
--   • resumen_proyecto_masivo          → avance por local (checklist, materiales, actividad, acta).
--   • materiales_proyecto_masivo       → materiales consolidados de todos los locales vs stock en bodega.
--
-- Quitar un local NO necesita función: la Server Action lo desvincula (proyecto_padre_id = NULL)
-- y el proyecto sigue existiendo como proyecto normal, con todo su historial.
--
-- Prerrequisitos: sql/proyectos_campanas_masivas.sql y sql/crear_proyecto_masivo.sql.
-- Solo invocables con service role (Server Actions). Ejecutar en Supabase → SQL Editor.

-- ── Agregar locales a un Rollout existente ──────────────────────────
CREATE OR REPLACE FUNCTION agregar_locales_proyecto_masivo(
  p_padre_id               UUID,
  p_local_ids              UUID[],
  p_plantilla_checklist_id UUID,
  p_receta_bom_id          UUID,
  p_creado_por             UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locales UUID[];
  v_ya      TEXT;
  v_hijos   UUID[];
BEGIN
  IF p_creado_por IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario.';
  END IF;

  SELECT ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_local_ids, '{}')) AS x WHERE x IS NOT NULL)
    INTO v_locales;
  IF COALESCE(array_length(v_locales, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Debes seleccionar al menos un local.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('crear_proyecto_masivo'));

  IF NOT EXISTS (SELECT 1 FROM proyectos WHERE id = p_padre_id AND es_campana_masiva) THEN
    RAISE EXCEPTION 'Rollout no encontrado.';
  END IF;

  -- Dentro del MISMO Rollout un local no puede repetirse (en otros proyectos sí)
  SELECT string_agg(DISTINCT COALESCE(NULLIF(r.sigla, ''), r.nombre_restaurante), ', ') INTO v_ya
    FROM proyectos h
    JOIN restaurantes r ON r.id = h.cliente_id
   WHERE h.proyecto_padre_id = p_padre_id
     AND h.cliente_id = ANY(v_locales)
     AND NOT h.oculto;
  IF v_ya IS NOT NULL THEN
    RAISE EXCEPTION 'LOCALES_YA_EN_MASIVO: %', v_ya;
  END IF;

  v_hijos := proyecto_masivo_poblar_hijos(p_padre_id, v_locales, p_plantilla_checklist_id,
                                          p_receta_bom_id, p_creado_por);

  RETURN jsonb_build_object('creados', array_length(v_hijos, 1));
END;
$$;

-- ── Avance por local ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resumen_proyecto_masivo(p_padre_id UUID)
RETURNS TABLE (
  proyecto_id         UUID,
  nombre              TEXT,
  estado              TEXT,
  fecha_fin_estimada  DATE,
  sigla               TEXT,
  local_nombre        TEXT,
  tareas_total        BIGINT,
  tareas_completadas  BIGINT,
  tareas_pendientes   BIGINT,
  mat_requerido       BIGINT,
  mat_entregado       BIGINT,
  mat_instalado       BIGINT,
  ultima_actividad    TIMESTAMPTZ,
  acta_firmada        BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.nombre, h.estado, h.fecha_fin_estimada,
         r.sigla, r.nombre_restaurante,
         COALESCE(t.total, 0), COALESCE(t.completadas, 0), COALESCE(t.pendientes, 0),
         COALESCE(e.requerido, 0), COALESCE(e.entregado, 0), COALESCE(e.instalado, 0),
         GREATEST(a.ultima, h.updated_at),
         EXISTS (SELECT 1 FROM bitacora_firmas f WHERE f.proyecto_id = h.id)
    FROM proyectos h
    LEFT JOIN restaurantes r ON r.id = h.cliente_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)                                                     AS total,
             COUNT(*) FILTER (WHERE (b.adjuntos->0->>'completado') = 'true') AS completadas,
             COUNT(*) FILTER (WHERE b.estado_revision = 'pendiente')      AS pendientes
        FROM bitacora_entradas b
       WHERE b.proyecto_id = h.id AND b.tipo = 'hito' AND b.contenido LIKE '[CHECKLIST]%'
    ) t ON TRUE
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(pe.cantidad_total, 0))::BIGINT      AS requerido,
             SUM(COALESCE(pe.cantidad_entregada, 0))::BIGINT  AS entregado,
             SUM(COALESCE(pe.cantidad_instalada, 0))::BIGINT  AS instalado
        FROM proyecto_equipamiento pe
       WHERE pe.proyecto_id = h.id
    ) e ON TRUE
    LEFT JOIN LATERAL (
      SELECT MAX(b.created_at) AS ultima FROM bitacora_entradas b WHERE b.proyecto_id = h.id
    ) a ON TRUE
   WHERE h.proyecto_padre_id = p_padre_id
     AND NOT h.oculto
   ORDER BY r.sigla NULLS LAST, h.nombre;
$$;

-- ── Materiales consolidados vs stock ────────────────────────────────────────
-- por_retirar = lo que falta sacar de bodega (requerido - entregado, por local, sin negativos).
-- stock_disponible = unidades en inventario con estado 'Disponible' para ese familia+modelo
-- (NULL en ítems manuales sin catálogo).
CREATE OR REPLACE FUNCTION materiales_proyecto_masivo(p_padre_id UUID)
RETURNS TABLE (
  inventario_id      UUID,
  familia            TEXT,
  modelo             TEXT,
  requerido          BIGINT,
  entregado          BIGINT,
  instalado          BIGINT,
  por_retirar        BIGINT,
  locales_pendientes BIGINT,
  stock_disponible   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT pe.inventario_id,
           f.nombre AS familia_nombre,
           c.modelo AS modelo_nombre,
           MAX(pe.tipo_item) AS tipo_item,
           SUM(COALESCE(pe.cantidad_total, 0))                                           AS requerido,
           SUM(COALESCE(pe.cantidad_entregada, 0))                                       AS entregado,
           SUM(COALESCE(pe.cantidad_instalada, 0))                                       AS instalado,
           SUM(GREATEST(COALESCE(pe.cantidad_total, 0) - COALESCE(pe.cantidad_entregada, 0), 0)) AS por_retirar,
           COUNT(DISTINCT pe.proyecto_id)
             FILTER (WHERE COALESCE(pe.cantidad_total, 0) > COALESCE(pe.cantidad_entregada, 0)) AS locales_pendientes
      FROM proyecto_equipamiento pe
      JOIN proyectos h ON h.id = pe.proyecto_id AND h.proyecto_padre_id = p_padre_id AND NOT h.oculto
      LEFT JOIN catalogo_equipos c ON c.id = pe.inventario_id
      LEFT JOIN familias_hardware f ON f.id = c.familia_id
     GROUP BY pe.inventario_id, f.nombre, c.modelo,
              CASE WHEN pe.inventario_id IS NULL THEN pe.tipo_item END
  )
  SELECT a.inventario_id,
         COALESCE(a.familia_nombre, 'Manual'),
         COALESCE(a.modelo_nombre, a.tipo_item, 'Sin nombre'),
         a.requerido::BIGINT, a.entregado::BIGINT, a.instalado::BIGINT,
         a.por_retirar::BIGINT, a.locales_pendientes,
         CASE WHEN a.inventario_id IS NULL THEN NULL ELSE (
           SELECT COALESCE(SUM(i.cantidad), 0)::BIGINT
             FROM inventario i
            WHERE LOWER(i.familia) = LOWER(a.familia_nombre)
              AND LOWER(i.modelo)  = LOWER(a.modelo_nombre)
              AND i.estado = 'Disponible'
         ) END
    FROM agg a
   ORDER BY 2, 3;
$$;

REVOKE ALL ON FUNCTION agregar_locales_proyecto_masivo(UUID, UUID[], UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION resumen_proyecto_masivo(UUID)                                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION materiales_proyecto_masivo(UUID)                                FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agregar_locales_proyecto_masivo(UUID, UUID[], UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION resumen_proyecto_masivo(UUID)                                   TO service_role;
GRANT EXECUTE ON FUNCTION materiales_proyecto_masivo(UUID)                                TO service_role;
