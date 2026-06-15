'use server';

/*
 * ─── SQL REQUERIDO EN SUPABASE (ejecutar una sola vez) ───────────────────────
 *
 *  CREATE TABLE IF NOT EXISTS solicitudes_devoluciones (
 *    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *    ticket_id       UUID REFERENCES tickets(id),
 *    tecnico_id      UUID NOT NULL REFERENCES profiles(id),
 *    bodeguero_id    UUID REFERENCES profiles(id),
 *    inventario_id   UUID NOT NULL REFERENCES inventario(id),
 *    cantidad        INTEGER NOT NULL DEFAULT 1,
 *    motivo          TEXT,
 *    estado          TEXT NOT NULL DEFAULT 'pendiente',
 *    motivo_rechazo  TEXT,
 *    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
 *    gestionado_en   TIMESTAMPTZ,
 *    url_firma       TEXT
 *  );
 *
 *  -- Si la tabla ya existe, agregar columna url_firma:
 *  ALTER TABLE solicitudes_devoluciones ADD COLUMN IF NOT EXISTS url_firma TEXT;
 *  ALTER TABLE solicitudes_materiales   ADD COLUMN IF NOT EXISTS url_firma TEXT;
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── PATCH CRÍTICO: aprobar_solicitud_rpc ────────────────────────────────────
 *
 *  El bloque que transfiere ítems GENÉRICOS (es_serializado = false) a la
 *  mochila del técnico debe usar ticket_id como parte de la clave de búsqueda.
 *  Sin este parche, todos los genéricos del mismo modelo/familia se fusionan
 *  en una sola fila y pierden el contexto de ticket (aparecen como "Sin Ticket").
 *
 *  Localiza en el cuerpo de aprobar_solicitud_rpc el bloque que transfiere
 *  genéricos y reemplaza el SELECT/INSERT de destino así:
 *
 *  -- Primero, obtener el ticket_id de la solicitud (una vez, al inicio):
 *  DECLARE
 *    v_ticket_id UUID;
 *    ...
 *  BEGIN
 *    SELECT ticket_id INTO v_ticket_id
 *      FROM solicitudes_materiales WHERE id = p_solicitud_id;
 *
 *  -- Dentro del bucle, en la rama ELSE (es_serializado = false),
 *  -- reemplazar el SELECT/INSERT de la mochila destino:
 *
 *    -- ANTES (fusiona todo por modelo/familia):
 *    -- SELECT id, cantidad INTO v_dest_id, v_dest_cant
 *    -- FROM inventario
 *    -- WHERE bodega_id = v_mochila_id AND modelo = v_modelo AND familia = v_familia
 *    -- LIMIT 1;
 *
 *    -- DESPUÉS (clave exacta incluye ticket_id):
 *    SELECT id, cantidad INTO v_dest_id, v_dest_cant
 *      FROM inventario
 *     WHERE bodega_id     = v_mochila_id
 *       AND modelo        = v_modelo
 *       AND familia       = v_familia
 *       AND es_serializado = false
 *       AND (
 *         (ticket_id = v_ticket_id) OR
 *         (ticket_id IS NULL AND v_ticket_id IS NULL)
 *       )
 *     LIMIT 1;
 *
 *    IF FOUND THEN
 *      UPDATE inventario SET cantidad = v_dest_cant + v_cant WHERE id = v_dest_id;
 *    ELSE
 *      INSERT INTO inventario
 *        (bodega_id, modelo, familia, es_serializado, cantidad, estado, ticket_id)
 *      VALUES
 *        (v_mochila_id, v_modelo, v_familia, false, v_cant, 'Disponible', v_ticket_id)
 *      RETURNING id INTO v_dest_id;
 *    END IF;
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Cliente con Service Role para operaciones que RLS bloquearía (ej: insertar mensajes en tickets ajenos)
function getAdminSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) throw new Error('Faltan variables de entorno SUPABASE_SERVICE_ROLE_KEY.');
    return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const REVALIDATE_PATHS = [
    '/dashboard/admin/bodegas/solicitudes',
    '/dashboard/admin/solicitudes',
];

const SOLICITUD_MATERIALES_SELECT = `
    *,
    tecnico:tecnico_id ( id, full_name ),
    bodeguero:bodeguero_id ( full_name ),
    ticket:ticket_id ( id, numero_ticket, titulo ),
    proyecto:proyecto_id ( id, nombre ),
    solicitud_items (
        id, cantidad,
        inventario:inventario_id (
            id, modelo, familia, es_serializado, numero_serie, cantidad
        ),
        proyecto_equipamiento:proyecto_equipamiento_id(
            id,
            inventario:catalogo_equipos!inventario_id(
                modelo,
                es_serializado,
                familia_obj:familias_hardware(nombre)
            )
        )
    )
` as const;

const SOLICITUD_DEVOLUCION_SELECT = `
    *,
    tecnico:tecnico_id ( id, full_name ),
    bodeguero:bodeguero_id ( full_name ),
    ticket:ticket_id ( id, numero_ticket, titulo ),
    inventario:inventario_id ( id, modelo, familia, es_serializado, numero_serie, cantidad )
` as const;

// ─────────────────────────────────────────────────────────────────────────────
// Obtener solicitudes de ENTREGA paginadas por estado
// Pendientes: todas (sin límite). Aprobadas/Rechazadas: primera página de 30.
// ─────────────────────────────────────────────────────────────────────────────
export async function getSolicitudesMaterialesAction() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'No autorizado.', data: [], totalAprobadas: 0, totalRechazadas: 0 };

        const { data: profile } = await supabase
            .from('profiles').select('rol').eq('id', user.id).maybeSingle();

        const rol = profile?.rol?.toUpperCase() || '';
        if (!['ADMIN_BODEGA', 'ADMIN', 'COORDINADOR'].includes(rol)) {
            return { error: 'Permisos insuficientes.', data: [], totalAprobadas: 0, totalRechazadas: 0 };
        }

        // Lectura con service-role (bypass RLS). El bodeguero ya quedó autorizado arriba.
        // Necesario porque ADMIN_BODEGA no tiene políticas SELECT sobre `proyectos` ni
        // `proyecto_equipamiento`; sin esto PostgREST devuelve esos embeds anidados como
        // null y la tarjeta del proyecto renderiza en blanco ("—").
        const db = getAdminSupabase();

        const [pendientesRes, aprobadasRes, rechazadasRes] = await Promise.all([
            db
                .from('solicitudes_materiales')
                .select(SOLICITUD_MATERIALES_SELECT)
                .eq('estado', 'pendiente')
                .order('creado_en', { ascending: false }),
            db
                .from('solicitudes_materiales')
                .select(SOLICITUD_MATERIALES_SELECT, { count: 'exact' })
                .eq('estado', 'aprobada')
                .order('creado_en', { ascending: false })
                .range(0, 29),
            db
                .from('solicitudes_materiales')
                .select(SOLICITUD_MATERIALES_SELECT, { count: 'exact' })
                .eq('estado', 'rechazada')
                .order('creado_en', { ascending: false })
                .range(0, 29),
        ]);

        if (pendientesRes.error) throw new Error(pendientesRes.error.message);

        return {
            data: [
                ...(pendientesRes.data ?? []),
                ...(aprobadasRes.data  ?? []),
                ...(rechazadasRes.data ?? []),
            ],
            totalAprobadas:  aprobadasRes.count  ?? 0,
            totalRechazadas: rechazadasRes.count ?? 0,
        };
    } catch (e: any) {
        return { error: e.message, data: [], totalAprobadas: 0, totalRechazadas: 0 };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener solicitudes de DEVOLUCIÓN paginadas por estado
// ─────────────────────────────────────────────────────────────────────────────
export async function getSolicitudesDevolucionAction() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'No autorizado.', data: [], totalAprobadas: 0, totalRechazadas: 0 };

        const { data: profile } = await supabase
            .from('profiles').select('rol').eq('id', user.id).maybeSingle();

        const rol = profile?.rol?.toUpperCase() || '';
        if (!['ADMIN_BODEGA', 'ADMIN', 'COORDINADOR'].includes(rol)) {
            return { error: 'Permisos insuficientes.', data: [], totalAprobadas: 0, totalRechazadas: 0 };
        }

        const [pendientesRes, aprobadasRes, rechazadasRes] = await Promise.all([
            supabase
                .from('solicitudes_devoluciones')
                .select(SOLICITUD_DEVOLUCION_SELECT)
                .eq('estado', 'pendiente')
                .order('creado_en', { ascending: false }),
            supabase
                .from('solicitudes_devoluciones')
                .select(SOLICITUD_DEVOLUCION_SELECT, { count: 'exact' })
                .eq('estado', 'aprobada')
                .order('creado_en', { ascending: false })
                .range(0, 29),
            supabase
                .from('solicitudes_devoluciones')
                .select(SOLICITUD_DEVOLUCION_SELECT, { count: 'exact' })
                .eq('estado', 'rechazada')
                .order('creado_en', { ascending: false })
                .range(0, 29),
        ]);

        if (pendientesRes.error) {
            console.warn('[solicitudes_devoluciones] Tabla no encontrada:', pendientesRes.error.message);
            return { data: [], totalAprobadas: 0, totalRechazadas: 0 };
        }

        return {
            data: [
                ...(pendientesRes.data ?? []),
                ...(aprobadasRes.data  ?? []),
                ...(rechazadasRes.data ?? []),
            ],
            totalAprobadas:  aprobadasRes.count  ?? 0,
            totalRechazadas: rechazadasRes.count ?? 0,
        };
    } catch (e: any) {
        return { error: e.message, data: [], totalAprobadas: 0, totalRechazadas: 0 };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cargar más historial (aprobadas / rechazadas) — usado por load-more client
// ─────────────────────────────────────────────────────────────────────────────
export async function loadMoreHistorialAction(
    tabla: 'solicitudes_materiales' | 'solicitudes_devoluciones',
    estado: 'aprobada' | 'rechazada',
    page: number,
): Promise<{ data: any[]; error: string | null }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: [], error: 'No autorizado.' };

        const { data: profile } = await supabase
            .from('profiles').select('rol').eq('id', user.id).maybeSingle();

        const rol = profile?.rol?.toUpperCase() || '';
        if (!['ADMIN_BODEGA', 'ADMIN', 'COORDINADOR'].includes(rol)) {
            return { data: [], error: 'Permisos insuficientes.' };
        }

        const selectQuery = tabla === 'solicitudes_materiales'
            ? SOLICITUD_MATERIALES_SELECT
            : SOLICITUD_DEVOLUCION_SELECT;

        const from = page * 30;
        const to   = from + 29;

        // Service-role (bypass RLS): el embed proyecto/proyecto_equipamiento se anula
        // bajo la sesión del bodeguero. Usuario ya autorizado arriba.
        const db = getAdminSupabase();

        const { data, error } = await db
            .from(tabla)
            .select(selectQuery)
            .eq('estado', estado)
            .order('creado_en', { ascending: false })
            .range(from, to);

        if (error) return { data: [], error: error.message };
        return { data: data ?? [], error: null };
    } catch (e: any) {
        return { data: [], error: e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener Bodegas Centrales (para selector en modales de aprobación)
// ─────────────────────────────────────────────────────────────────────────────
export async function getBodegasCentralesAction() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'No autorizado.', data: [] };

        const { data, error } = await supabase
            .from('bodegas')
            .select('id, nombre, tipo')
            .ilike('tipo', 'INTERNA')
            .eq('activo', true)
            .order('nombre', { ascending: true });

        if (error) throw new Error(error.message);
        return { data: data || [] };
    } catch (e: any) {
        return { error: e.message, data: [] };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar stock disponible en una bodega para una lista de ítems solicitados
// Usado por el modal del aprobador cuando cambia la bodega de origen
// ─────────────────────────────────────────────────────────────────────────────
export interface StockCheckItem {
    solicitudItemId: string;
    modelo: string | null;
    familia: string | null;
    esSerializado: boolean;
    cantidad: number;
}

export interface StockCheckResult {
    solicitudItemId: string;
    disponible: number;
    suficiente: boolean;
}

export async function getStockEnBodegaAction(
    bodegaId: string,
    items: StockCheckItem[]
): Promise<{ data: StockCheckResult[] | null; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: 'No autorizado.' };

        const results: StockCheckResult[] = await Promise.all(
            items.map(async (item) => {
                if (item.esSerializado) {
                    // Serializado: ¿existe al menos 1 unidad disponible del mismo modelo en esta bodega?
                    const { count } = await supabase
                        .from('inventario')
                        .select('id', { count: 'exact', head: true })
                        .eq('bodega_id', bodegaId)
                        .eq('modelo', item.modelo ?? '')
                        .eq('es_serializado', true)
                        .in('estado', ['Disponible', 'operativo', 'Operativo', 'disponible']);

                    const disponible = count ?? 0;
                    return { solicitudItemId: item.solicitudItemId, disponible, suficiente: disponible >= item.cantidad };
                } else {
                    // Genérico: suma total de cantidad en la bodega para ese modelo/familia
                    const { data: rows } = await supabase
                        .from('inventario')
                        .select('cantidad')
                        .eq('bodega_id', bodegaId)
                        .eq('modelo', item.modelo ?? '')
                        .eq('familia', item.familia ?? '')
                        .eq('es_serializado', false)
                        .gt('cantidad', 0);

                    const disponible = (rows ?? []).reduce((s, r) => s + (r.cantidad ?? 0), 0);
                    return { solicitudItemId: item.solicitudItemId, disponible, suficiente: disponible >= item.cantidad };
                }
            })
        );

        return { data: results };
    } catch (e: any) {
        return { data: null, error: e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-asignación inteligente de bodega de origen por ítem
// Devuelve la mejor bodega (mayor stock que cubre la cantidad) para cada ítem.
// Para serializados la bodega es fija (la que contiene el serial específico).
// ─────────────────────────────────────────────────────────────────────────────
export interface AutoAsignacionInput {
    solicitudItemId: string;
    inventarioId: string;
    modelo: string | null;
    familia: string | null;
    esSerializado: boolean;
    cantidad: number;
}

export interface AutoAsignacionResult {
    solicitudItemId: string;
    bodegaId: string;
    bodegaNombre: string;
    disponible: number;
    suficiente: boolean;
}

export async function getAutoAsignacionBodegasAction(
    items: AutoAsignacionInput[]
): Promise<{ data: AutoAsignacionResult[] | null; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: 'No autorizado.' };

        const { data: bodegas } = await supabase
            .from('bodegas')
            .select('id, nombre')
            .ilike('tipo', 'INTERNA')
            .eq('activo', true)
            .order('nombre', { ascending: true });

        const bodegasMap = new Map<string, string>((bodegas || []).map(b => [b.id, b.nombre]));
        const bodegaIds = (bodegas || []).map(b => b.id);

        if (bodegaIds.length === 0) {
            return { data: null, error: 'No hay bodegas internas configuradas.' };
        }

        // Serialized: read bodega_id from the specific inventario row
        const serializedIds = items.filter(i => i.esSerializado).map(i => i.inventarioId);
        const { data: serializedRows } = serializedIds.length
            ? await supabase.from('inventario').select('id, bodega_id').in('id', serializedIds)
            : { data: [] as { id: string; bodega_id: string }[] };
        const serializedBodegaMap = new Map((serializedRows || []).map(r => [r.id, r.bodega_id]));

        // Generic OR Serialized Bulk (Projects): fetch all available stock across INTERNA bodegas for the requested combos
        const genericOrBulkItems = items.filter(i => !i.esSerializado || !i.inventarioId);
        let genericStock: { bodega_id: string; modelo: string; familia: string; cantidad: number }[] = [];

        if (genericOrBulkItems.length > 0) {
            const { data: stockRows } = await supabase
                .from('inventario')
                .select('bodega_id, modelo, familia, cantidad, es_serializado')
                .in('bodega_id', bodegaIds)
                .in('estado', ['Disponible', 'operativo', 'Operativo', 'disponible'])
                .gt('cantidad', 0);

            const combos = new Set(genericOrBulkItems.map(i => `${i.modelo}__${i.familia}`));
            genericStock = (stockRows || []).filter(r => combos.has(`${r.modelo}__${r.familia}`));
        }

        const results: AutoAsignacionResult[] = items.map(item => {
            if (item.esSerializado && item.inventarioId) {
                const bodegaId = serializedBodegaMap.get(item.inventarioId) || bodegaIds[0];
                return {
                    solicitudItemId: item.solicitudItemId,
                    bodegaId,
                    bodegaNombre: bodegasMap.get(bodegaId) || 'Desconocida',
                    disponible: 1,
                    suficiente: true,
                };
            }

            // Aggregate stock per bodega for this generic item
            const stockByBodega: Record<string, number> = {};
            for (const row of genericStock) {
                if (row.modelo === item.modelo && row.familia === item.familia) {
                    stockByBodega[row.bodega_id] = (stockByBodega[row.bodega_id] || 0) + row.cantidad;
                }
            }

            // Pick: prefer bodega with sufficient stock (highest stock wins ties),
            // fall back to bodega with most stock even if insufficient
            let bestId = bodegaIds[0];
            let bestStock = 0;
            let hasSufficient = false;

            for (const [bId, stock] of Object.entries(stockByBodega)) {
                if (!bodegasMap.has(bId)) continue;
                if (stock >= item.cantidad && (!hasSufficient || stock > bestStock)) {
                    bestId = bId; bestStock = stock; hasSufficient = true;
                } else if (!hasSufficient && stock > bestStock) {
                    bestId = bId; bestStock = stock;
                }
            }

            return {
                solicitudItemId: item.solicitudItemId,
                bodegaId: bestId,
                bodegaNombre: bodegasMap.get(bestId) || 'Desconocida',
                disponible: bestStock,
                suficiente: bestStock >= item.cantidad,
            };
        });

        return { data: results };
    } catch (e: any) {
        return { data: null, error: e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aprobar solicitud de ENTREGA → RPC atómica (Despacho Multibodega)
// ─────────────────────────────────────────────────────────────────────────────
export interface ItemContexto {
    cantidad: number;
    modelo: string | null;
    es_serializado: boolean;
    numero_serie: string | null;
}

export interface ItemBodegaAsignacion {
    solicitudItemId: string;
    bodegaId: string;
}

export async function aprobarSolicitudAction(
    solicitudId: string,
    itemBodegas: ItemBodegaAsignacion[],  // bodega de origen por ítem
    approvedItemIds: string[],
    comentario: string | null = null,
    firmaBase64: string | null = null,
    ticketIdCliente: string | null = null,
    tecnicoNombreCliente: string | null = null,
    itemsContexto: ItemContexto[] = []
) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'No autorizado.' };

        const { data: profile } = await supabase
            .from('profiles').select('rol').eq('id', user.id).maybeSingle();

        if (profile?.rol?.toUpperCase() !== 'ADMIN_BODEGA') {
            return { error: 'Solo el bodeguero puede aprobar solicitudes.' };
        }

        if (!approvedItemIds || approvedItemIds.length === 0) {
            return { error: 'Debes seleccionar al menos un ítem para aprobar.' };
        }

        // Verify every approved item has a bodega assigned
        for (const itemId of approvedItemIds) {
            if (!itemBodegas.find(ib => ib.solicitudItemId === itemId)?.bodegaId) {
                return { error: 'Todos los ítems aprobados deben tener una bodega de origen asignada.' };
            }
        }

        // ── Validación de stock por ítem con su bodega específica ─────────────
        const { data: itemsToValidate, error: itemsErr } = await supabase
            .from('solicitud_items')
            .select(`
                id, 
                cantidad, 
                inventario:inventario_id(id, modelo, familia, es_serializado, numero_serie),
                proyecto_equipamiento:proyecto_equipamiento_id(
                    id, 
                    inventario:catalogo_equipos!inventario_id(modelo, es_serializado, familia_obj:familias_hardware(nombre))
                )
            `)
            .in('id', approvedItemIds);

        if (itemsErr) throw new Error(`Error obteniendo ítems: ${itemsErr.message}`);

        for (const si of (itemsToValidate ?? []) as any[]) {
            const inv = si.inventario || {
                modelo: si.proyecto_equipamiento?.inventario?.modelo,
                familia: si.proyecto_equipamiento?.inventario?.familia_obj?.nombre,
                es_serializado: si.proyecto_equipamiento?.inventario?.es_serializado ?? false,
                numero_serie: null
            };
            if (!inv || !inv.modelo) throw new Error(`Ítem ${si.id} no tiene inventario asociado.`);

            const bodegaId = itemBodegas.find(ib => ib.solicitudItemId === si.id)!.bodegaId;

            // Ítem serializado de PROYECTO (sin inventario físico fijo): NO validamos aquí.
            // El RPC `aprobar_solicitud_rpc` (rama C) toma el primer serial disponible en la
            // bodega de origen, lo pasa a 'En Proyecto' y libera su bodega_id. Validar por
            // modelo/familia en el front bloquea injustamente estos retiros.
            const esProyectoAutoSerial = !si.inventario && inv.es_serializado;

            if (inv.es_serializado && !esProyectoAutoSerial) {
                const { count } = await supabase
                    .from('inventario')
                    .select('id', { count: 'exact', head: true })
                    .eq('bodega_id', bodegaId)
                    .eq('modelo', inv.modelo)
                    .eq('es_serializado', true)
                    .in('estado', ['Disponible', 'operativo', 'Operativo', 'disponible']);
                if ((count ?? 0) < si.cantidad) {
                    throw new Error(
                        `Stock insuficiente en bodega de origen para "${inv.modelo}" (serializado).`
                    );
                }
            } else if (!inv.es_serializado) {
                const { data: stockRows } = await supabase
                    .from('inventario')
                    .select('cantidad')
                    .eq('bodega_id', bodegaId)
                    .eq('modelo', inv.modelo)
                    .eq('familia', inv.familia)
                    .eq('es_serializado', false)
                    .gt('cantidad', 0);

                const totalDisponible = (stockRows ?? []).reduce((s: number, r: any) => s + (r.cantidad ?? 0), 0);
                if (totalDisponible < si.cantidad) {
                    throw new Error(
                        `Stock insuficiente en bodega de origen para "${inv.modelo}" — disponible: ${totalDisponible}, requerido: ${si.cantidad}.`
                    );
                }
            }

            // Inyectar el inventario_id en la BD si la solicitud es de proyecto (inventario_id era null)
            if (!si.inventario && !inv.es_serializado) {
                const { data: stockRows } = await supabase
                    .from('inventario')
                    .select('id')
                    .eq('bodega_id', bodegaId)
                    .eq('modelo', inv.modelo)
                    .eq('familia', inv.familia)
                    .eq('es_serializado', false)
                    .gt('cantidad', 0)
                    .limit(1);

                if (stockRows && stockRows.length > 0) {
                    const adminSupabase = getAdminSupabase();
                    const { error: updErr } = await adminSupabase
                        .from('solicitud_items')
                        .update({ inventario_id: stockRows[0].id })
                        .eq('id', si.id);
                    if (updErr) throw new Error(`Error asignando inventario físico: ${updErr.message}`);
                }
            }
            // NOTA: Si es serializado y si.inventario es null, el RPC se encargará de
            // buscar N unidades físicas y auto-asignarlas al proyecto.
        }
        // ─────────────────────────────────────────────────────────────────────

        const approvedItemBodegas = itemBodegas.filter(ib => approvedItemIds.includes(ib.solicitudItemId));
        const itemBodegasPayload = approvedItemBodegas.map(ib => ({
            solicitud_item_id: ib.solicitudItemId,
            bodega_id: ib.bodegaId
        }));

        const { data, error } = await supabase.rpc('aprobar_solicitud_rpc', {
            p_solicitud_id:      solicitudId,
            p_bodeguero_id:      user.id,
            p_item_bodegas:      itemBodegasPayload,
            p_approved_item_ids: approvedItemIds,
            p_comentario:        comentario ?? null,
        });

        if (error) throw new Error(error.message);

        const result = data as { success?: boolean; error?: string };
        if (result?.error) return { error: result.error };

        // ── Obtener ticket_id desde el servidor (fuente de verdad) ───────────
        // Aunque el cliente también pasa ticketIdCliente, leemos directamente
        // la columna FK para garantizar que es el UUID correcto sin depender de joins.
        const { data: meta } = await supabase
            .from('solicitudes_materiales')
            .select('ticket_id')
            .eq('id', solicitudId)
            .maybeSingle();

        const ticketId      = meta?.ticket_id ?? ticketIdCliente ?? null;
        const tecnicoNombre = tecnicoNombreCliente ?? 'Técnico';

        // ── Firma digital (solo upload + persistencia, sin incrustar en chat) ──
        if (ticketId && firmaBase64?.startsWith('data:image/png;base64,')) {
            const base64Data = firmaBase64.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const signaturePath = `${ticketId}/firma_custodia_${Date.now()}.png`;

            const { error: sigError } = await supabase.storage
                .from('ticket-attachments')
                .upload(signaturePath, buffer, { contentType: 'image/png' });

            if (!sigError) {
                const firmaUrl = supabase.storage
                    .from('ticket-attachments')
                    .getPublicUrl(signaturePath).data.publicUrl;

                await supabase
                    .from('solicitudes_materiales')
                    .update({ url_firma: firmaUrl })
                    .eq('id', solicitudId);
            }
        }

        // ── Mensaje de trazabilidad (admin client para evitar bloqueo RLS) ──
        if (ticketId) {
            const lineasMateriales = itemsContexto.map((item) => {
                const label = item.es_serializado && item.numero_serie
                    ? `${item.modelo} (S/N: ${item.numero_serie})`
                    : `${item.cantidad}x ${item.modelo ?? 'Material'}`;
                return `<li style="margin:4px 0;font-size:12px;color:#334155;"><b>${label}</b></li>`;
            }).join('') || `<li style="margin:4px 0;font-size:12px;color:#334155;"><b>Materiales entregados</b></li>`;

            const comentarioHtml = comentario?.trim()
                ? `<p style="margin:8px 0 0;font-size:12px;color:#475569;border-top:1px solid #dcfce7;padding-top:8px;"><b>Comentario:</b> ${comentario.trim()}</p>`
                : '';

            const mensajeHtml = `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;max-width:480px;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
    <span style="font-size:20px;">📦</span>
    <div>
      <span style="font-size:10px;font-weight:900;text-transform:uppercase;color:#15803d;">Solicitud Aprobada</span>
      <p style="margin:2px 0 0;font-size:13px;font-weight:700;color:#14532d;">Materiales despachados a ${tecnicoNombre}</p>
    </div>
  </div>
  <ul style="margin:0;padding-left:18px;border-top:1px solid #dcfce7;padding-top:8px;">
    ${lineasMateriales}
  </ul>
  ${comentarioHtml}
</div>`;

            const adminSupabase = getAdminSupabase();
            const { error: msgErr } = await adminSupabase.from('ticket_messages').insert({
                ticket_id:  ticketId,
                sender_id:  user.id,
                mensaje:    mensajeHtml.trim(),
                es_sistema: false,
                es_interno: true,
            });

            if (msgErr) console.error('[aprobarSolicitud] ticket_messages error:', msgErr.message);
        }

        REVALIDATE_PATHS.forEach(p => revalidatePath(p));
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error interno al aprobar la solicitud.' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rechazar solicitud de ENTREGA
// ─────────────────────────────────────────────────────────────────────────────
export async function rechazarSolicitudAction(solicitudId: string, motivo: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'No autorizado.' };

        const { data: profile } = await supabase
            .from('profiles').select('rol').eq('id', user.id).maybeSingle();

        if (profile?.rol?.toUpperCase() !== 'ADMIN_BODEGA') {
            return { error: 'Solo el bodeguero puede rechazar solicitudes.' };
        }

        if (!motivo?.trim()) return { error: 'El motivo de rechazo es obligatorio.' };

        const { data, error } = await supabase.rpc('rechazar_solicitud_rpc', {
            p_solicitud_id: solicitudId,
            p_bodeguero_id: user.id,
            p_motivo:       motivo.trim(),
        });

        if (error) throw new Error(error.message);

        const result = data as { success?: boolean; error?: string };
        if (result?.error) return { error: result.error };

        REVALIDATE_PATHS.forEach(p => revalidatePath(p));
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error interno al rechazar la solicitud.' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aprobar solicitud de DEVOLUCIÓN → mueve stock mochila → bodega central
// ─────────────────────────────────────────────────────────────────────────────
export async function aprobarDevolucionAction(
    devolucionId: string,
    bodegaCentralId: string,
    comentario: string | null = null,
    firmaBase64: string | null = null
) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'No autorizado.' };

        const { data: profile } = await supabase
            .from('profiles').select('rol').eq('id', user.id).maybeSingle();

        if (profile?.rol?.toUpperCase() !== 'ADMIN_BODEGA') {
            return { error: 'Solo el bodeguero puede aprobar devoluciones.' };
        }

        // 1. Obtener la devolución con datos del inventario y técnico
        const { data: dev, error: devErr } = await supabase
            .from('solicitudes_devoluciones')
            .select(`
                id, tecnico_id, cantidad, estado, ticket_id,
                inventario:inventario_id (
                    id, modelo, familia, es_serializado, numero_serie, bodega_id, cantidad
                ),
                tecnico:tecnico_id ( full_name )
            `)
            .eq('id', devolucionId)
            .maybeSingle();

        if (devErr || !dev) return { error: 'Devolución no encontrada.' };
        if (dev.estado !== 'pendiente') return { error: 'Esta devolución ya fue procesada.' };

        const inv = dev.inventario as any;
        if (!inv) return { error: 'Inventario no encontrado.' };

        // 2. Obtener la mochila del técnico (bodega tipo MOCHILA con tecnico_id)
        const { data: mochila, error: mochilaErr } = await supabase
            .from('bodegas')
            .select('id')
            .ilike('tipo', 'MOCHILA')
            .eq('tecnico_id', dev.tecnico_id)
            .maybeSingle();

        if (mochilaErr || !mochila) return { error: 'No se encontró la mochila del técnico.' };

        if (inv.es_serializado) {
            // ── Serializado: cambiar bodega_id directamente ──────────────────
            const { error: updErr } = await supabase
                .from('inventario')
                .update({ bodega_id: bodegaCentralId })
                .eq('id', inv.id);

            if (updErr) throw new Error(updErr.message);
        } else {
            // ── Genérico: descontar de mochila y sumar a central ─────────────
            const nuevaCantMochila = (inv.cantidad ?? 0) - dev.cantidad;
            if (nuevaCantMochila < 0) {
                return { error: `Stock insuficiente en mochila (disponible: ${inv.cantidad ?? 0}).` };
            }

            const { error: mochilaUpdErr } = await supabase
                .from('inventario')
                .update({ cantidad: nuevaCantMochila })
                .eq('id', inv.id);

            if (mochilaUpdErr) throw new Error(mochilaUpdErr.message);

            // Buscar registro en bodega central con mismo modelo/familia
            const { data: centralInv } = await supabase
                .from('inventario')
                .select('id, cantidad')
                .eq('bodega_id', bodegaCentralId)
                .eq('modelo', inv.modelo)
                .eq('familia', inv.familia)
                .maybeSingle();

            if (centralInv) {
                const { error: centralUpdErr } = await supabase
                    .from('inventario')
                    .update({ cantidad: centralInv.cantidad + dev.cantidad })
                    .eq('id', centralInv.id);

                if (centralUpdErr) throw new Error(centralUpdErr.message);
            } else {
                // Crear nuevo registro en central
                const { error: insertErr } = await supabase
                    .from('inventario')
                    .insert({
                        bodega_id:     bodegaCentralId,
                        modelo:        inv.modelo,
                        familia:       inv.familia,
                        es_serializado: false,
                        cantidad:      dev.cantidad,
                    });

                if (insertErr) throw new Error(insertErr.message);
            }
        }

        // 3. Registrar movimiento de inventario
        await supabase.from('movimientos_inventario').insert({
            inventario_id:    inv.id,
            ticket_id:        null,
            bodega_origen_id: mochila.id,
            bodega_destino_id: bodegaCentralId,
            cantidad:         dev.cantidad,
            tipo_movimiento:  'DEVOLUCION',
            fecha_movimiento: new Date().toISOString(),
            realizado_por:    user.id,
        });

        // 4. Actualizar estado de la devolución
        const { error: stateErr } = await supabase
            .from('solicitudes_devoluciones')
            .update({
                estado:        'aprobada',
                bodeguero_id:  user.id,
                gestionado_en: new Date().toISOString(),
                ...(comentario ? { motivo: comentario } : {}),
            })
            .eq('id', devolucionId);

        if (stateErr) throw new Error(stateErr.message);

        // 5. Firma digital (sólo upload + persistencia, sin incrustar en chat)
        const ticketId = (dev as any).ticket_id ?? null;
        const tecnicoNombre = (dev as any).tecnico?.full_name ?? 'Técnico';
        const materialLabel = inv?.es_serializado && inv?.numero_serie
            ? `${inv.modelo} (S/N: ${inv.numero_serie})`
            : `${dev.cantidad}x ${inv?.modelo ?? 'Material'}`;

        if (ticketId && firmaBase64?.startsWith('data:image/png;base64,')) {
            const base64Data = firmaBase64.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const signaturePath = `${ticketId}/firma_reingreso_${Date.now()}.png`;

            const { error: sigError } = await supabase.storage
                .from('ticket-attachments')
                .upload(signaturePath, buffer, { contentType: 'image/png' });

            if (!sigError) {
                const firmaUrl = supabase.storage
                    .from('ticket-attachments')
                    .getPublicUrl(signaturePath).data.publicUrl;

                // Persistir URL en solicitudes_devoluciones para auditoría posterior
                await supabase
                    .from('solicitudes_devoluciones')
                    .update({ url_firma: firmaUrl })
                    .eq('id', devolucionId);
            }
        }

        // ── Mensaje de trazabilidad en historial del ticket ──────────────────
        if (ticketId) {
            const comentarioHtml = comentario?.trim()
                ? `<p style="font-size:11px;color:#4b5563;margin-top:8px;"><strong>Comentario:</strong> ${comentario.trim()}</p>`
                : '';

            const mensajeHtml = `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:14px;max-width:480px;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
    <span style="font-size:18px;">↩️</span>
    <div>
      <span style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#4338ca;">Devolución Aprobada</span>
      <p style="margin:2px 0 0;font-size:13px;font-weight:700;color:#312e81;">Material reingresado a bodega por ${tecnicoNombre}</p>
    </div>
  </div>
  <ul style="margin:0;padding-left:18px;">
    <li style="font-size:13px;color:#3730a3;font-weight:700;">${materialLabel}</li>
  </ul>
  ${comentarioHtml}
</div>`;

            const adminSupabase = getAdminSupabase();
            const { error: msgErr } = await adminSupabase.from('ticket_messages').insert({
                ticket_id:  ticketId,
                sender_id:  user.id,
                mensaje:    mensajeHtml,
                es_sistema: false,
                es_interno: true,
            });

            if (msgErr) console.error('[aprobarDevolucion] ticket_messages error:', msgErr.message);
        }

        REVALIDATE_PATHS.forEach(p => revalidatePath(p));
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error interno al aprobar la devolución.' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rechazar solicitud de DEVOLUCIÓN
// ─────────────────────────────────────────────────────────────────────────────
export async function rechazarDevolucionAction(devolucionId: string, motivo: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'No autorizado.' };

        const { data: profile } = await supabase
            .from('profiles').select('rol').eq('id', user.id).maybeSingle();

        if (profile?.rol?.toUpperCase() !== 'ADMIN_BODEGA') {
            return { error: 'Solo el bodeguero puede rechazar devoluciones.' };
        }

        if (!motivo?.trim()) return { error: 'El motivo de rechazo es obligatorio.' };

        const { error } = await supabase
            .from('solicitudes_devoluciones')
            .update({
                estado:         'rechazada',
                motivo_rechazo: motivo.trim(),
                bodeguero_id:   user.id,
                gestionado_en:  new Date().toISOString(),
            })
            .eq('id', devolucionId);

        if (error) throw new Error(error.message);

        REVALIDATE_PATHS.forEach(p => revalidatePath(p));
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error interno al rechazar la devolución.' };
    }
}
