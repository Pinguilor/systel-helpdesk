-- =============================================================================
--  proveedores_setup.sql  ·  Systel Loop
--  Ejecutar ANTES de actualizar procesar_guia_ingreso_rpc.sql (v3)
--
--  Migración segura: texto libre proveedor → tabla relacional proveedores
--  Funciona tanto en tablas vacías (nuevo despliegue) como con datos existentes.
-- =============================================================================

-- ── 1. Tabla maestra de proveedores ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proveedores (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre     TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_proveedor_nombre UNIQUE (nombre)
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores (lower(nombre));

-- ── 2. Migrar datos existentes (no-op si la tabla estaba vacía) ──────────────

INSERT INTO proveedores (nombre)
SELECT DISTINCT trim(proveedor)
FROM guias_ingreso
WHERE proveedor IS NOT NULL AND trim(proveedor) <> ''
ON CONFLICT (nombre) DO NOTHING;

-- ── 3. Agregar columna FK en guias_ingreso ───────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'guias_ingreso' AND column_name = 'proveedor_id'
    ) THEN
        ALTER TABLE guias_ingreso
            ADD COLUMN proveedor_id UUID REFERENCES proveedores(id);
    END IF;
END $$;

-- ── 4. Vincular filas existentes al nuevo FK ─────────────────────────────────

UPDATE guias_ingreso g
SET proveedor_id = p.id
FROM proveedores p
WHERE trim(g.proveedor) = p.nombre
  AND g.proveedor_id IS NULL;

-- ── 5. Aplicar NOT NULL (solo si la migración fue completa) ──────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM guias_ingreso WHERE proveedor_id IS NULL LIMIT 1
    ) THEN
        ALTER TABLE guias_ingreso ALTER COLUMN proveedor_id SET NOT NULL;
    ELSE
        RAISE WARNING 'Hay filas en guias_ingreso con proveedor_id NULL — NOT NULL no aplicado. Revisar manualmente.';
    END IF;
END $$;

-- ── 6. Eliminar columna de texto libre ───────────────────────────────────────

ALTER TABLE guias_ingreso DROP COLUMN IF EXISTS proveedor;

-- ── 7. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

-- Lectura pública para autenticados (combobox en cliente)
DO $$ BEGIN
    CREATE POLICY "proveedores_select_auth"
        ON proveedores FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Inserción vía server actions (admin client bypasses RLS, pero dejamos la policy
-- para que el RPC SECURITY DEFINER también pueda validar la FK)
DO $$ BEGIN
    CREATE POLICY "proveedores_insert_auth"
        ON proveedores FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
