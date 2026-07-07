-- ─────────────────────────────────────────────────────────────────────────────
-- GARANTÍA ESTRUCTURAL: trigger que instala automáticamente cualquier ítem
-- 'En proceso' que haya quedado en la mochila cuando un ticket se cierra.
--
-- Funciona como red de seguridad de último nivel: si el código TypeScript
-- completó la instalación correctamente, el trigger no encontrará filas
-- con estado='En proceso' y será un no-op. Si el código falló a mitad,
-- el trigger lo repara antes de que el cierre quede confirmado.
--
-- Ejecutar en Supabase SQL Editor una sola vez.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Función del trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_cierre_ticket_instalar_pendientes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bodega_restaurante UUID;
    v_eq                 RECORD;
    v_count              INT := 0;
BEGIN
    -- Solo actúa cuando el estado cambia a 'cerrado' o 'resuelto'
    IF NEW.estado NOT IN ('cerrado', 'resuelto') THEN
        RETURN NEW;
    END IF;
    -- No re-procesar si ya estaba en ese estado
    IF OLD.estado = NEW.estado THEN
        RETURN NEW;
    END IF;

    -- Obtener la bodega del restaurante asociado al ticket
    SELECT r.bodega_id
    INTO   v_bodega_restaurante
    FROM   restaurantes r
    WHERE  r.id = NEW.restaurante_id
    LIMIT  1;

    -- Sin bodega configurada → no se puede instalar, dejar pasar el cierre
    -- (el reloj de 72h del código TypeScript tomará el control)
    IF v_bodega_restaurante IS NULL THEN
        RETURN NEW;
    END IF;

    -- Buscar ítems aún en estado 'En proceso' para este ticket
    -- (incluye tanto serializados como genéricos, en cualquier tipo de mochila)
    FOR v_eq IN
        SELECT i.id, i.cantidad, i.bodega_id
        FROM   inventario i
        JOIN   bodegas b ON b.id = i.bodega_id
        WHERE  i.ticket_id = NEW.id
          AND  i.estado    = 'En proceso'
          AND  b.tipo      ILIKE ANY (ARRAY['%MOCHILA%', '%VEHÍCULO%', '%VEHICULO%'])
    LOOP
        -- Instalar en la bodega del restaurante
        UPDATE inventario
        SET    estado    = 'Operativo',
               bodega_id = v_bodega_restaurante
        WHERE  id = v_eq.id;

        -- Registrar movimiento de instalación
        INSERT INTO movimientos_inventario
            (inventario_id, ticket_id, tipo_movimiento,
             bodega_origen_id, bodega_destino_id,
             cantidad, fecha_movimiento, realizado_por)
        VALUES
            (v_eq.id, NEW.id, 'salida',
             v_eq.bodega_id, v_bodega_restaurante,
             v_eq.cantidad,  now(),                NULL);

        v_count := v_count + 1;
    END LOOP;

    IF v_count > 0 THEN
        RAISE LOG 'trg_cierre_ticket: ticket=% — % ítem(s) instalado(s) automáticamente.',
            NEW.numero_ticket, v_count;
    END IF;

    RETURN NEW;
END;
$$;


-- ── Trigger AFTER UPDATE en tickets ──────────────────────────────────────────
-- AFTER (no BEFORE) para que la actualización del ticket ya esté confirmada
-- antes de modificar inventario; evita conflictos de visibilidad de filas.

DROP TRIGGER IF EXISTS trg_cierre_ticket_instalar_pendientes ON tickets;

CREATE TRIGGER trg_cierre_ticket_instalar_pendientes
AFTER UPDATE OF estado ON tickets
FOR EACH ROW
EXECUTE FUNCTION fn_cierre_ticket_instalar_pendientes();


-- ── Test de humo (opcional) ───────────────────────────────────────────────────
-- Para verificar que el trigger existe:
SELECT tgname, tgenabled, tgtype
FROM   pg_trigger
WHERE  tgname = 'trg_cierre_ticket_instalar_pendientes';
