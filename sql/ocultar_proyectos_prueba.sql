-- Ocultar proyectos de prueba sin borrar datos (reversible).
-- Los proyectos ocultos no aparecen en listados ni en el dashboard, y su URL devuelve 404.
-- Su historial (solicitudes, movimientos de stock, bitácora) se conserva intacto.
-- Ejecutar en Supabase → SQL Editor ANTES de desplegar el código.

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE proyectos
SET oculto = TRUE
WHERE id IN (
  '0a9a6a5a-f18d-4d29-914f-3653576ed33f',  -- CDP CNC OLD
  '15f224dc-bd8e-4958-b37b-2a7ab1037416',  -- Inventado
  '6eb7e31f-a3c7-4f55-98dd-d8f5aa5c3dfc'   -- proyecto de pruebas
);

-- Para volver a mostrar uno:
-- UPDATE proyectos SET oculto = FALSE WHERE id = '<id>';
