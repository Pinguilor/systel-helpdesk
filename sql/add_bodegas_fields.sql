-- Migration: add descripcion and activo columns to bodegas table
-- Run this once in the Supabase SQL editor

ALTER TABLE bodegas
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- Backfill: mark all existing bodegas as active
UPDATE bodegas SET activo = true WHERE activo IS NULL;

-- Optional: index for filtering active bodegas quickly
CREATE INDEX IF NOT EXISTS idx_bodegas_activo ON bodegas (activo);
