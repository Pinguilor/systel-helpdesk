-- Migration: Add grupos JSONB column to proyecto_plantillas_checklist
-- Structure: [{ "nombre": "AutoMac", "tareas": ["Tarea 1", "Tarea 2"] }]
ALTER TABLE proyecto_plantillas_checklist
    ADD COLUMN IF NOT EXISTS grupos JSONB DEFAULT '[]'::jsonb;
