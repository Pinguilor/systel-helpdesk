-- Migration: create catalogo_equipos table + seed from existing inventario
-- Run this once in the Supabase SQL editor

-- ── 1. Create table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_equipos (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    familia_id    UUID NOT NULL REFERENCES familias_hardware(id) ON DELETE CASCADE,
    modelo        VARCHAR NOT NULL,
    es_serializado BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (familia_id, modelo)
);

-- Enable RLS
ALTER TABLE catalogo_equipos ENABLE ROW LEVEL SECURITY;

-- Allow read for all authenticated users
CREATE POLICY "Authenticated read catalogo_equipos"
    ON catalogo_equipos FOR SELECT
    TO authenticated
    USING (true);

-- Allow insert/update/delete for service_role only (admin server actions)
-- No additional policy needed: service_role bypasses RLS by default.

-- ── 2. Ensure every familia name from inventario exists ──────────
-- (handles typos / familia names that were entered free-form)
INSERT INTO familias_hardware (nombre)
SELECT DISTINCT familia
FROM inventario
WHERE familia IS NOT NULL
  AND familia <> ''
ON CONFLICT DO NOTHING;

-- ── 3. Seed catalog from distinct (familia, modelo) in inventario ─
INSERT INTO catalogo_equipos (familia_id, modelo, es_serializado)
SELECT DISTINCT
    fh.id,
    i.modelo,
    COALESCE(MAX(i.es_serializado::int)::boolean, false)
FROM inventario i
JOIN familias_hardware fh ON fh.nombre = i.familia
WHERE i.modelo IS NOT NULL
  AND i.modelo <> ''
  AND i.familia IS NOT NULL
GROUP BY fh.id, i.modelo
ON CONFLICT (familia_id, modelo) DO NOTHING;
