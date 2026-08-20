-- =====================================================================
-- tipo_documento_migration.sql  ·  Systel Loop
-- Agrega columna tipo_documento a guias_ingreso y actualiza la
-- restricción UNIQUE a (tipo_documento, numero_guia).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- 1. Agregar columna tipo_documento con valor por defecto 'GD'
ALTER TABLE guias_ingreso
    ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(10) NOT NULL DEFAULT 'GD';

-- 2. Eliminar restricción UNIQUE anterior sobre solo numero_guia
--    (el nombre por defecto en Postgres es <tabla>_<columna>_key)
ALTER TABLE guias_ingreso
    DROP CONSTRAINT IF EXISTS guias_ingreso_numero_guia_key;

-- Si se usó un nombre personalizado, descomentar y ajustar:
-- ALTER TABLE guias_ingreso DROP CONSTRAINT IF EXISTS uq_numero_guia;

-- 3. Nueva restricción UNIQUE compuesta (tipo_documento + numero_guia)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_guia_tipo_numero'
          AND conrelid = 'guias_ingreso'::regclass
    ) THEN
        ALTER TABLE guias_ingreso
            ADD CONSTRAINT uq_guia_tipo_numero UNIQUE (tipo_documento, numero_guia);
    END IF;
END $$;

-- 4. Índice para búsquedas por tipo_documento
CREATE INDEX IF NOT EXISTS idx_guias_tipo_documento
    ON guias_ingreso(tipo_documento);
