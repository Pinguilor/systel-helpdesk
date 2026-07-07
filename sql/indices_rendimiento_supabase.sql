-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES DE RENDIMIENTO — Systel Loop
--
-- Objetivo: eliminar Sequential Scans en las tablas de mayor tráfico para
-- reducir consumo de RAM/CPU y permitir bajar la instancia de Supabase a 'Micro'
-- sin colapsar.
--
-- Basado en auditoría de todos los filtros .eq()/.in()/.order() del código.
-- Todos usan IF NOT EXISTS → seguro de re-ejecutar. No duplica índices ya creados
-- en add_bodegas_fields.sql, add_mochila_72hr_fields.sql, fase2_proyectos_schema.sql,
-- rack_mapper.sql ni add_bodega_id_to_catalogo.sql.
--
-- NOTA SOBRE BLOQUEOS: en tablas grandes con tráfico de escritura, ejecuta cada
-- statement con CREATE INDEX CONCURRENTLY (uno a la vez, fuera de transacción)
-- para no bloquear writes. En una base pequeña (Micro/Small) el CREATE INDEX
-- normal tarda milisegundos y el bloqueo es despreciable — puedes correr el bloque
-- completo tal cual.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ INVENTARIO ══ (tabla más consultada: stock, mochilas, asignaciones)
-- Patrón dominante: filtrar por bodega + estado juntos.
CREATE INDEX IF NOT EXISTS idx_inventario_bodega_estado
    ON inventario (bodega_id, estado);

-- Cierre de tickets / logística inversa: ítems por ticket y estado.
CREATE INDEX IF NOT EXISTS idx_inventario_ticket_estado
    ON inventario (ticket_id, estado)
    WHERE ticket_id IS NOT NULL;

-- Búsqueda por número de serie (validación de duplicados, check-serial).
CREATE INDEX IF NOT EXISTS idx_inventario_numero_serie
    ON inventario (numero_serie)
    WHERE numero_serie IS NOT NULL;

-- Listados de bodega que separan serializados de genéricos.
CREATE INDEX IF NOT EXISTS idx_inventario_bodega_serializado
    ON inventario (bodega_id, es_serializado);

-- ══ TICKETS ══ (tabla de mayor cardinalidad de lectura)
-- Tickets de un usuario, ordenados por fecha (vista Usuario).
CREATE INDEX IF NOT EXISTS idx_tickets_creado_por_fecha
    ON tickets (creado_por, fecha_creacion DESC);

-- Filtro multi-tenant directo por empresa.
CREATE INDEX IF NOT EXISTS idx_tickets_cliente_id
    ON tickets (cliente_id)
    WHERE cliente_id IS NOT NULL;

-- Tickets asignados a un técnico (vista Técnico).
CREATE INDEX IF NOT EXISTS idx_tickets_agente_fecha
    ON tickets (agente_asignado_id, fecha_creacion DESC)
    WHERE agente_asignado_id IS NOT NULL;

-- Filtros por estado (dashboards admin, exportaciones).
CREATE INDEX IF NOT EXISTS idx_tickets_estado
    ON tickets (estado);

-- Tickets de un restaurante / local.
CREATE INDEX IF NOT EXISTS idx_tickets_restaurante_id
    ON tickets (restaurante_id)
    WHERE restaurante_id IS NOT NULL;

-- Tickets hijos (adicionales) de un ticket padre.
CREATE INDEX IF NOT EXISTS idx_tickets_padre_id
    ON tickets (ticket_padre_id)
    WHERE ticket_padre_id IS NOT NULL;

-- ══ PROFILES ══ (leída en cada request; el middleware ya NO la consulta)
-- Usuarios de una empresa (vista de equipo, TicketList).
CREATE INDEX IF NOT EXISTS idx_profiles_cliente_id
    ON profiles (cliente_id)
    WHERE cliente_id IS NOT NULL;

-- Selección de admins/coordinadores (.in('rol', [...])).
CREATE INDEX IF NOT EXISTS idx_profiles_rol
    ON profiles (rol);

-- ══ MOVIMIENTOS_INVENTARIO ══ (trazabilidad, crece de forma continua)
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_id
    ON movimientos_inventario (inventario_id);

CREATE INDEX IF NOT EXISTS idx_movimientos_ticket_id
    ON movimientos_inventario (ticket_id)
    WHERE ticket_id IS NOT NULL;

-- ══ RESTAURANTES ══ (filtro multi-tenant por empresa)
CREATE INDEX IF NOT EXISTS idx_restaurantes_cliente_id
    ON restaurantes (cliente_id)
    WHERE cliente_id IS NOT NULL;

-- ══ SOLICITUDES_DEVOLUCIONES ══ (bandeja de aprobaciones filtra por estado)
CREATE INDEX IF NOT EXISTS idx_solicitudes_devoluciones_estado
    ON solicitudes_devoluciones (estado);

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-EJECUCIÓN
-- Lista los índices creados y su tamaño; útil para confirmar que existen.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    schemaname,
    relname   AS tabla,
    indexrelname AS indice,
    pg_size_pretty(pg_relation_size(indexrelid)) AS tamano,
    idx_scan  AS veces_usado
FROM   pg_stat_user_indexes
WHERE  indexrelname LIKE 'idx_%'
ORDER  BY relname, indexrelname;
