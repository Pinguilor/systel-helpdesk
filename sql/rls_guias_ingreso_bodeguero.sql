-- ================================================================
-- RLS: políticas para ADMIN_BODEGA en guias_ingreso y guias_ingreso_items
-- ================================================================
-- Ejecutar en Supabase → SQL Editor.
-- Las políticas usan EXISTS sobre profiles para evitar joins costosos
-- y son compatibles con el patrón de roles en texto libre del proyecto.
-- ================================================================

-- ── guias_ingreso ────────────────────────────────────────────────────────────

ALTER TABLE guias_ingreso ENABLE ROW LEVEL SECURITY;

-- SELECT: ADMIN, ADMIN_BODEGA y COORDINADOR pueden listar todas las guías
DROP POLICY IF EXISTS "guias_ingreso_select_bodega" ON guias_ingreso;
CREATE POLICY "guias_ingreso_select_bodega"
ON guias_ingreso
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.rol::TEXT) IN ('ADMIN', 'ADMIN_BODEGA', 'COORDINADOR')
    )
);

-- INSERT: solo ADMIN y ADMIN_BODEGA pueden crear guías
DROP POLICY IF EXISTS "guias_ingreso_insert_bodega" ON guias_ingreso;
CREATE POLICY "guias_ingreso_insert_bodega"
ON guias_ingreso
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.rol::TEXT) IN ('ADMIN', 'ADMIN_BODEGA')
    )
);

-- UPDATE: ADMIN y ADMIN_BODEGA pueden actualizar (ej. cambio de estado)
DROP POLICY IF EXISTS "guias_ingreso_update_bodega" ON guias_ingreso;
CREATE POLICY "guias_ingreso_update_bodega"
ON guias_ingreso
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.rol::TEXT) IN ('ADMIN', 'ADMIN_BODEGA')
    )
);

-- ── guias_ingreso_items ──────────────────────────────────────────────────────

ALTER TABLE guias_ingreso_items ENABLE ROW LEVEL SECURITY;

-- SELECT: mismos roles que en la cabecera
DROP POLICY IF EXISTS "guias_ingreso_items_select_bodega" ON guias_ingreso_items;
CREATE POLICY "guias_ingreso_items_select_bodega"
ON guias_ingreso_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.rol::TEXT) IN ('ADMIN', 'ADMIN_BODEGA', 'COORDINADOR')
    )
);

-- INSERT: ADMIN y ADMIN_BODEGA insertan los ítems al procesar la guía
DROP POLICY IF EXISTS "guias_ingreso_items_insert_bodega" ON guias_ingreso_items;
CREATE POLICY "guias_ingreso_items_insert_bodega"
ON guias_ingreso_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.rol::TEXT) IN ('ADMIN', 'ADMIN_BODEGA')
    )
);

-- UPDATE: permitido para correcciones (mismo gate que INSERT)
DROP POLICY IF EXISTS "guias_ingreso_items_update_bodega" ON guias_ingreso_items;
CREATE POLICY "guias_ingreso_items_update_bodega"
ON guias_ingreso_items
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.rol::TEXT) IN ('ADMIN', 'ADMIN_BODEGA')
    )
);

-- ── Bucket guias_despacho (Storage) ─────────────────────────────────────────
-- Las políticas de Storage se crean con CREATE POLICY sobre storage.objects.
-- Ejecutar solo si el bucket 'guias_despacho' existe y tiene RLS habilitado.

-- INSERT: ADMIN y ADMIN_BODEGA pueden subir documentos
DROP POLICY IF EXISTS "guias_despacho_bodeguero_upload" ON storage.objects;
CREATE POLICY "guias_despacho_bodeguero_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'guias_despacho'
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.rol::TEXT) IN ('ADMIN', 'ADMIN_BODEGA')
    )
);

-- SELECT: ADMIN, ADMIN_BODEGA y COORDINADOR pueden ver los documentos adjuntos
DROP POLICY IF EXISTS "guias_despacho_select" ON storage.objects;
CREATE POLICY "guias_despacho_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'guias_despacho'
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND UPPER(profiles.rol::TEXT) IN ('ADMIN', 'ADMIN_BODEGA', 'COORDINADOR')
    )
);
