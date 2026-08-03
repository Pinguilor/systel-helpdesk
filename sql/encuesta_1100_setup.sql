-- ================================================================
-- ENCUESTA DE CELEBRACIÓN: 1.100 Tickets — Systel HelpDesk
-- Encuesta ID: encuesta_1100_tickets_030826
-- ================================================================

-- ── Tabla principal ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encuestas_respuestas (
    id           UUID         PRIMARY KEY  DEFAULT gen_random_uuid(),
    encuesta_id  TEXT         NOT NULL     DEFAULT 'encuesta_1100_tickets_030826',
    usuario_id   UUID         NOT NULL     REFERENCES auth.users(id) ON DELETE CASCADE,
    satisfaccion INT          NOT NULL     CHECK (satisfaccion BETWEEN 1 AND 5),
    comentario   TEXT,
    created_at   TIMESTAMPTZ  NOT NULL     DEFAULT now(),

    -- Cada usuario solo puede responder una vez por encuesta
    CONSTRAINT uq_usuario_encuesta UNIQUE (usuario_id, encuesta_id)
);

-- Índice para acelerar consultas del admin por encuesta
CREATE INDEX IF NOT EXISTS idx_encuestas_by_encuesta
    ON encuestas_respuestas (encuesta_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE encuestas_respuestas ENABLE ROW LEVEL SECURITY;

-- 1. INSERT: cualquier usuario autenticado puede enviar su propia respuesta
CREATE POLICY "encuestas_insert_propia"
    ON encuestas_respuestas
    FOR INSERT
    TO authenticated
    WITH CHECK (usuario_id = auth.uid());

-- 2. SELECT: cada usuario puede leer solo su propio registro
--    (para que el layout pueda verificar si ya respondió vía RLS)
CREATE POLICY "encuestas_select_propia"
    ON encuestas_respuestas
    FOR SELECT
    TO authenticated
    USING (usuario_id = auth.uid());

-- Nota: los administradores consultan con el service_role client
-- (createAdminClient), que bypasea RLS completamente.

-- ── Verificación ─────────────────────────────────────────────────
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename  = 'encuestas_respuestas';
