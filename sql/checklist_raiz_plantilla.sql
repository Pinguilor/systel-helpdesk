-- Ensure parent_id column exists with CASCADE FK on bitacora_entradas.
-- The column may already exist from a previous migration — this script is idempotent.
ALTER TABLE bitacora_entradas
    ADD COLUMN IF NOT EXISTS parent_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bitacora_entradas_parent_id_fkey'
    ) THEN
        ALTER TABLE bitacora_entradas
            ADD CONSTRAINT bitacora_entradas_parent_id_fkey
            FOREIGN KEY (parent_id) REFERENCES bitacora_entradas(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Index for parent_id lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_bitacora_entradas_parent_id
    ON bitacora_entradas(parent_id)
    WHERE parent_id IS NOT NULL;
