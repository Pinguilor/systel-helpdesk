-- ─────────────────────────────────────────────────────────────────────────────
-- RESPONSABLE DE PROYECTO — Systel Loop
--
-- 1. Agrega columna responsable_id a la tabla proyectos.
-- 2. Actualiza la política RLS de bitacora_entradas para permitir
--    INSERT/UPDATE/DELETE al responsable del proyecto al que pertenece la entrada.
--
-- Ejecutar en Supabase Dashboard → SQL Editor.
-- Es idempotente: usa IF NOT EXISTS y DROP POLICY IF EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columna en proyectos ────────────────────────────────────────────────
ALTER TABLE proyectos
    ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_proyectos_responsable
    ON proyectos (responsable_id)
    WHERE responsable_id IS NOT NULL;

-- ── 2. Política RLS bitacora_entradas ─────────────────────────────────────
-- La política anterior sólo permitía admin/coordinador.
-- La nueva permite además al usuario cuyo id coincide con
-- proyectos.responsable_id del proyecto de la entrada.

DROP POLICY IF EXISTS "bitacora_admin_coord" ON bitacora_entradas;

CREATE POLICY "bitacora_admin_coord_responsable"
    ON bitacora_entradas FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND rol IN ('admin', 'coordinador')
        )
        OR EXISTS (
            SELECT 1 FROM proyectos p
            WHERE p.id = bitacora_entradas.proyecto_id
              AND p.responsable_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND rol IN ('admin', 'coordinador')
        )
        OR EXISTS (
            SELECT 1 FROM proyectos p
            WHERE p.id = bitacora_entradas.proyecto_id
              AND p.responsable_id = auth.uid()
        )
    );

-- ── Verificación ───────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'proyectos' AND column_name = 'responsable_id';
--
-- SELECT policyname FROM pg_policies
-- WHERE tablename = 'bitacora_entradas';
