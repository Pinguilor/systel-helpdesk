-- ─────────────────────────────────────────────────────────────────────────────
-- Sub-bodegas: jerarquía padre/hijo en `bodegas` (1 solo nivel de anidación)
--
-- Permite modelar "bodegas de proyecto" como espacios delimitados dentro de
-- una bodega física principal (ej. sub-bodega "TAC" dentro de "Bodega SYSTEL
-- [B.216]"), sin ensuciar el Catálogo Maestro con equipos/familias falsas.
--
-- Reglas (validadas por trigger, no solo por convención):
--   1. Una bodega no puede ser su propia bodega física principal.
--   2. La bodega elegida como padre debe ser de nivel superior
--      (su propio bodega_padre_id debe ser NULL) -> evita cadenas de 2+ niveles.
--   3. Una bodega que ya tiene sub-bodegas propias no puede convertirse en
--      sub-bodega de otra (no puede ser hija y padre a la vez).
--
-- ON DELETE SET NULL: si se elimina la bodega física principal, sus
-- sub-bodegas pasan a ser bodegas de nivel superior (no se cascadea borrado).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE bodegas
  ADD COLUMN IF NOT EXISTS bodega_padre_id UUID REFERENCES bodegas(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION fn_validar_jerarquia_bodega()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.bodega_padre_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.bodega_padre_id = NEW.id THEN
        RAISE EXCEPTION 'Una bodega no puede ser su propia bodega física principal.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM bodegas
         WHERE id = NEW.bodega_padre_id
           AND bodega_padre_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'La bodega física principal seleccionada ya es una sub-bodega; solo se permite un nivel de anidación.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM bodegas
         WHERE bodega_padre_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'Esta bodega ya tiene sub-bodegas asociadas; no puede asignársele una bodega física principal.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_jerarquia_bodega ON bodegas;

CREATE TRIGGER trg_validar_jerarquia_bodega
    BEFORE INSERT OR UPDATE OF bodega_padre_id ON bodegas
    FOR EACH ROW EXECUTE FUNCTION fn_validar_jerarquia_bodega();
