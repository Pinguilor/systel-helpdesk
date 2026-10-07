-- ─────────────────────────────────────────────────────────────────────────────
-- analiticas_resumen — agregados para /dashboard/analiticas
--
-- Reemplaza la descarga de TODOS los tickets (64 MB, tope de 1000 filas) por un
-- único JSON con los números ya calculados. SECURITY INVOKER (por defecto):
-- respeta RLS, cada rol agrega solo los tickets que ya puede ver.
--
-- p_solo_propios = true  → solo tickets con creado_por = auth.uid() (rol USUARIO)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.analiticas_resumen(p_solo_propios boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH t AS (
    SELECT
        tk.estado,
        tk.prioridad,
        tk.fecha_creacion,
        tk.fecha_resolucion,
        tk.agente_asignado_id,
        tk.restaurante_id,
        COALESCE(c.nombre, ts.nombre, 'Sin Clasificar') AS categoria
    FROM public.tickets tk
    LEFT JOIN public.ticket_categorias      c  ON c.id  = tk.categoria_id
    LEFT JOIN public.ticket_tipos_servicio  ts ON ts.id = tk.tipo_servicio_id
    WHERE NOT p_solo_propios OR tk.creado_por = auth.uid()
),
meses AS (
    SELECT date_trunc('month', (now() AT TIME ZONE 'America/Santiago')) - (n || ' month')::interval AS mes
    FROM generate_series(0, 5) AS n
)
SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM t),
    'por_estado', COALESCE((
        SELECT jsonb_object_agg(estado, n)
        FROM (SELECT estado, count(*) AS n FROM t GROUP BY estado) s
    ), '{}'::jsonb),
    'por_prioridad', COALESCE((
        SELECT jsonb_object_agg(prioridad, n)
        FROM (SELECT prioridad, count(*) AS n FROM t GROUP BY prioridad) s
    ), '{}'::jsonb),
    'criticos_activos', (
        SELECT count(*) FROM t
        WHERE prioridad = 'crítica'
          AND estado IN ('abierto','en_progreso','pendiente','programado','esperando_agente')
    ),
    'mensual', (
        SELECT jsonb_agg(jsonb_build_object(
                   'anio', EXTRACT(year  FROM m.mes)::int,
                   'mes',  EXTRACT(month FROM m.mes)::int,
                   'creados', (SELECT count(*) FROM t
                               WHERE date_trunc('month', t.fecha_creacion AT TIME ZONE 'America/Santiago') = m.mes),
                   'resueltos', (SELECT count(*) FROM t
                                 WHERE t.fecha_resolucion IS NOT NULL
                                   AND date_trunc('month', t.fecha_resolucion AT TIME ZONE 'America/Santiago') = m.mes)
               ) ORDER BY m.mes)
        FROM meses m
    ),
    'categorias', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', categoria, 'value', n) ORDER BY n DESC)
        FROM (SELECT categoria, count(*) AS n FROM t GROUP BY categoria ORDER BY n DESC LIMIT 6) s
    ), '[]'::jsonb),
    'agentes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'total', total, 'resueltos', resueltos)
                         ORDER BY resueltos DESC, total DESC)
        FROM (
            SELECT COALESCE(p.full_name, 'Técnico') AS name,
                   count(*) AS total,
                   count(*) FILTER (WHERE t.estado IN ('resuelto','cerrado')) AS resueltos
            FROM t
            LEFT JOIN public.profiles p ON p.id = t.agente_asignado_id
            WHERE t.agente_asignado_id IS NOT NULL
            GROUP BY t.agente_asignado_id, p.full_name
            ORDER BY resueltos DESC, total DESC
            LIMIT 5
        ) s
    ), '[]'::jsonb),
    'restaurantes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'sigla', sigla, 'value', n) ORDER BY n DESC)
        FROM (
            SELECT COALESCE(r.nombre_restaurante, 'Restaurante') AS name,
                   COALESCE(r.sigla, '—') AS sigla,
                   count(*) AS n
            FROM t
            LEFT JOIN public.restaurantes r ON r.id = t.restaurante_id
            WHERE t.restaurante_id IS NOT NULL
            GROUP BY t.restaurante_id, r.nombre_restaurante, r.sigla
            ORDER BY n DESC
            LIMIT 8
        ) s
    ), '[]'::jsonb)
);
$$;

GRANT EXECUTE ON FUNCTION public.analiticas_resumen(boolean) TO authenticated;

-- Índice para el ORDER/filtro por fecha en tablas grandes (opcional pero barato).
CREATE INDEX IF NOT EXISTS idx_tickets_fecha_creacion ON public.tickets (fecha_creacion DESC);
