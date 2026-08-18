-- =============================================================================
--  proveedores_campos_adicionales.sql  ·  Systel Loop
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
--
--  Agrega campos de contacto opcionales a la tabla proveedores.
--  Idempotente: usa ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE proveedores
    ADD COLUMN IF NOT EXISTS rut       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS email     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS telefono  VARCHAR(30),
    ADD COLUMN IF NOT EXISTS direccion TEXT;

-- Índice para búsquedas por RUT (común en contexto chileno)
CREATE INDEX IF NOT EXISTS idx_proveedores_rut
    ON proveedores (rut)
    WHERE rut IS NOT NULL;
