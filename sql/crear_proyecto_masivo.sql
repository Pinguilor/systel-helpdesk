-- Creación masiva de un Rollout (padre) con un proyecto hijo por local.
-- Todo ocurre en UNA transacción: si cualquier paso falla, no queda nada creado.
--
-- Contiene:
--   • proyecto_masivo_poblar_hijos(...)  → lógica compartida: crea los hijos de un padre existente
--     (también la usa agregar_locales_proyecto_masivo, ver sql/proyecto_masivo_gestion.sql).
--   • crear_proyecto_masivo(...)         → crea el padre y llama a la función anterior.
--
-- Qué hace al poblar hijos:
--   1. Valida locales y plantillas.
--   2. Crea un hijo por local, heredando descripción, coordinador y fechas del padre.
--      Un local PUEDE tener varios proyectos en paralelo (no se bloquea por proyectos activos).
--   3. Opcional: aplica la plantilla de checklist a todos los hijos (misma estructura que
--      aplicarPlantillaChecklistAction: raíz [CHECKLIST_RAIZ] + tareas con grupo/parent_id).
--   4. Opcional: aplica la receta de materiales a todos los hijos (misma que aplicarRecetaBOMAction:
--      proyecto_equipamiento + registro en proyecto_recetas_aplicadas).
--   5. Deja una entrada de auditoría en la bitácora de cada hijo.
--
-- Prerrequisito: sql/proyectos_campanas_masivas.sql (columnas padre/hijo y trigger).
-- Solo invocable con service role (Server Action); sin acceso para anon/authenticated.
-- Ejecutar en Supabase → SQL Editor.

CREATE OR REPLACE FUNCTION proyecto_masivo_poblar_hijos(
  p_padre_id   UUID,
  p_locales    UUID[],
  p_plantilla  UUID,
  p_receta     UUID,
  p_creado_por UUID
) RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_padre       proyectos%ROWTYPE;
  v_hijos       UUID[];
  v_faltantes   TEXT;
  v_checklist   proyecto_plantillas_checklist%ROWTYPE;
  v_grupos      JSONB;
  v_receta      proyecto_plantillas_bom%ROWTYPE;
  v_items       JSONB;
  v_obsoletos   TEXT;
BEGIN
  SELECT * INTO v_padre FROM proyectos WHERE id = p_padre_id AND es_campana_masiva;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rollout no encontrado.';
  END IF;

  -- Locales inexistentes
  SELECT string_agg(x::TEXT, ', ') INTO v_faltantes
    FROM unnest(p_locales) AS x
   WHERE NOT EXISTS (SELECT 1 FROM restaurantes r WHERE r.id = x);
  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'LOCALES_INEXISTENTES: %', v_faltantes;
  END IF;

  IF p_plantilla IS NOT NULL THEN
    SELECT * INTO v_checklist FROM proyecto_plantillas_checklist WHERE id = p_plantilla;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plantilla de checklist no encontrada.';
    END IF;
    v_grupos := CASE
      WHEN jsonb_typeof(v_checklist.grupos) = 'array' AND jsonb_array_length(v_checklist.grupos) > 0
        THEN v_checklist.grupos
      ELSE jsonb_build_array(jsonb_build_object('nombre', 'General', 'tareas', to_jsonb(v_checklist.tareas)))
    END;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_grupos) g, jsonb_array_elements_text(g->'tareas')
    ) THEN
      RAISE EXCEPTION 'La plantilla de checklist no tiene tareas definidas.';
    END IF;
  END IF;

  IF p_receta IS NOT NULL THEN
    SELECT * INTO v_receta FROM proyecto_plantillas_bom WHERE id = p_receta;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Receta de materiales no encontrada.';
    END IF;
    v_items := COALESCE(v_receta.items, '[]'::JSONB);
    IF jsonb_array_length(v_items) = 0 THEN
      RAISE EXCEPTION 'La receta no contiene ítems definidos.';
    END IF;

    -- Ítems de la receta cuyo equipo ya no existe en el catálogo (rompería la FK de proyecto_equipamiento)
    SELECT string_agg(DISTINCT COALESCE(it->>'nombre_modelo', it->>'modelo_id'), ', ') INTO v_obsoletos
      FROM jsonb_array_elements(v_items) AS it
     WHERE (it->>'modelo_id') ~* '^[0-9a-f]{8}-'
       AND NOT EXISTS (SELECT 1 FROM catalogo_equipos c WHERE c.id = (it->>'modelo_id')::UUID);
    IF v_obsoletos IS NOT NULL THEN
      RAISE EXCEPTION 'RECETA_OBSOLETA: %', v_obsoletos;
    END IF;
  END IF;

  -- Hijos (uno por local), heredan datos del padre
  WITH ins AS (
    INSERT INTO proyectos (nombre, descripcion, cliente_id, coordinador_id, fecha_inicio,
                           fecha_fin_estimada, creado_por, proyecto_padre_id)
    SELECT v_padre.nombre || ' – ' || COALESCE(NULLIF(r.sigla, ''), r.nombre_restaurante),
           v_padre.descripcion, r.id, v_padre.coordinador_id, v_padre.fecha_inicio,
           v_padre.fecha_fin_estimada, p_creado_por, v_padre.id
      FROM restaurantes r
     WHERE r.id = ANY(p_locales)
     ORDER BY r.nombre_restaurante
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hijos FROM ins;

  -- Auditoría de origen
  INSERT INTO bitacora_entradas (proyecto_id, autor_id, tipo, contenido, adjuntos)
  SELECT h, p_creado_por, 'hito', '[SISTEMA] Proyecto creado como parte del Rollout: ' || v_padre.nombre, '[]'::JSONB
    FROM unnest(v_hijos) AS h;

  -- Checklist: raíz por hijo + tareas colgando de la raíz (grupo + parent_id)
  IF p_plantilla IS NOT NULL THEN
    WITH raices AS (
      INSERT INTO bitacora_entradas (proyecto_id, autor_id, tipo, contenido, adjuntos)
      SELECT h, p_creado_por, 'hito', '[CHECKLIST_RAIZ] ' || v_checklist.nombre, '[]'::JSONB
        FROM unnest(v_hijos) AS h
      RETURNING id, proyecto_id
    )
    INSERT INTO bitacora_entradas (proyecto_id, autor_id, tipo, contenido, adjuntos, grupo, parent_id)
    SELECT r.proyecto_id, p_creado_por, 'hito', '[CHECKLIST] ' || t.tarea,
           '[{"completado": false, "asignado_a": null}]'::JSONB, t.grupo, r.id
      FROM raices r
     CROSS JOIN (
       SELECT g->>'nombre' AS grupo, tarea
         FROM jsonb_array_elements(v_grupos) AS g,
              jsonb_array_elements_text(g->'tareas') AS tarea
     ) t;

    INSERT INTO bitacora_entradas (proyecto_id, autor_id, tipo, contenido, adjuntos)
    SELECT h, p_creado_por, 'hito', '[SISTEMA] Se aplicó la plantilla de checklist: ' || v_checklist.nombre, '[]'::JSONB
      FROM unnest(v_hijos) AS h;
  END IF;

  -- Receta de materiales: ítems con catálogo se agrupan por modelo (suma); manuales van como fila propia
  IF p_receta IS NOT NULL THEN
    INSERT INTO proyecto_equipamiento (proyecto_id, inventario_id, tipo_item, cantidad_total, cantidad_entregada)
    SELECT h, i.inventario_id, i.tipo_item, i.cantidad, 0
      FROM unnest(v_hijos) AS h
     CROSS JOIN (
       SELECT (it->>'modelo_id')::UUID                    AS inventario_id,
              COALESCE(MAX(it->>'tipo'), 'Equipamiento')   AS tipo_item,
              SUM((it->>'cantidad')::INT)                  AS cantidad
         FROM jsonb_array_elements(v_items) AS it
        WHERE (it->>'modelo_id') ~* '^[0-9a-f]{8}-'
        GROUP BY (it->>'modelo_id')::UUID
       UNION ALL
       SELECT NULL::UUID,
              COALESCE(it->>'tipo', 'Equipamiento'),
              (it->>'cantidad')::INT
         FROM jsonb_array_elements(v_items) AS it
        WHERE NOT COALESCE((it->>'modelo_id') ~* '^[0-9a-f]{8}-', FALSE)
     ) i;

    INSERT INTO proyecto_recetas_aplicadas (proyecto_id, plantilla_id, nombre, items, aplicada_por)
    SELECT h, p_receta, v_receta.nombre, v_items, p_creado_por
      FROM unnest(v_hijos) AS h;

    INSERT INTO bitacora_entradas (proyecto_id, autor_id, tipo, contenido, adjuntos)
    SELECT h, p_creado_por, 'hito', '[SISTEMA] Se aplicó la receta de materiales: ' || v_receta.nombre, '[]'::JSONB
      FROM unnest(v_hijos) AS h;
  END IF;

  RETURN v_hijos;
END;
$$;

CREATE OR REPLACE FUNCTION crear_proyecto_masivo(
  p_nombre                 TEXT,
  p_descripcion            TEXT,
  p_coordinador_id         UUID,
  p_fecha_inicio           DATE,
  p_fecha_fin_estimada     DATE,
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
  v_nombre      TEXT := NULLIF(BTRIM(p_nombre), '');
  v_locales     UUID[];
  v_padre_id    UUID;
  v_hijos       UUID[];
BEGIN
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'El nombre del Rollout es obligatorio.';
  END IF;
  IF p_creado_por IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario creador.';
  END IF;

  SELECT ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_local_ids, '{}')) AS x WHERE x IS NOT NULL)
    INTO v_locales;
  IF COALESCE(array_length(v_locales, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Debes seleccionar al menos un local.';
  END IF;

  -- Serializa creaciones masivas simultáneas (el chequeo anti doble envío de abajo queda libre de carreras).
  PERFORM pg_advisory_xact_lock(hashtext('crear_proyecto_masivo'));

  -- Anti doble envío: mismo nombre creado hace menos de 1 minuto (los locales no se bloquean,
  -- así que un segundo clic crearía todo duplicado).
  IF EXISTS (
    SELECT 1 FROM proyectos
     WHERE es_campana_masiva
       AND LOWER(nombre) = LOWER(v_nombre)
       AND created_at > NOW() - INTERVAL '1 minute'
  ) THEN
    RAISE EXCEPTION 'MASIVO_DUPLICADO: ya se creó un Rollout con este nombre hace instantes.';
  END IF;

  INSERT INTO proyectos (nombre, descripcion, coordinador_id, fecha_inicio, fecha_fin_estimada,
                         creado_por, es_campana_masiva)
  VALUES (v_nombre, NULLIF(BTRIM(p_descripcion), ''), p_coordinador_id, p_fecha_inicio,
          p_fecha_fin_estimada, p_creado_por, TRUE)
  RETURNING id INTO v_padre_id;

  v_hijos := proyecto_masivo_poblar_hijos(v_padre_id, v_locales, p_plantilla_checklist_id,
                                          p_receta_bom_id, p_creado_por);

  RETURN jsonb_build_object('proyecto_padre_id', v_padre_id, 'creados', array_length(v_hijos, 1));
END;
$$;

REVOKE ALL ON FUNCTION proyecto_masivo_poblar_hijos(UUID, UUID[], UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION proyecto_masivo_poblar_hijos(UUID, UUID[], UUID, UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION crear_proyecto_masivo(TEXT, TEXT, UUID, DATE, DATE, UUID[], UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION crear_proyecto_masivo(TEXT, TEXT, UUID, DATE, DATE, UUID[], UUID, UUID, UUID)
  TO service_role;

-- Terminología: "Rollout" (no "campaña"). Solo cambia el texto de los errores del trigger.
CREATE OR REPLACE FUNCTION proyectos_validar_jerarquia() RETURNS trigger AS $$
BEGIN
  IF NEW.proyecto_padre_id IS NOT NULL THEN
    IF NEW.es_campana_masiva THEN
      RAISE EXCEPTION 'Un Rollout no puede ser hijo de otro proyecto';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM proyectos WHERE id = NEW.proyecto_padre_id AND es_campana_masiva
    ) THEN
      RAISE EXCEPTION 'El proyecto padre debe ser un Rollout';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
