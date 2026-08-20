'use server';

import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath }    from 'next/cache';

async function requireBodegaRole() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).single();
    const rol = profile?.rol?.toUpperCase();
    if (rol !== 'ADMIN' && rol !== 'ADMIN_BODEGA') return null;
    return user;
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface Proveedor {
    id:     string;
    nombre: string;
}

export interface GuiaIngresoItem {
    familia:        string;
    modelo:         string;
    es_serializado: boolean;
    seriales:       string[];
    cantidad:       number;
}

export interface GuiaIngresoPayload {
    numero_guia:       string;
    tipo_documento:    'GD' | 'FC';
    proveedor_id:      string;         // FK a proveedores
    bodega_destino_id: string;
    fecha_guia:        string;
    observaciones:     string;
    documento_url:     string | null;
    items:             GuiaIngresoItem[];
}

export interface GuiaResumen {
    id:               string;
    numero_guia:      string;
    tipo_documento:   'GD' | 'FC';
    proveedor:        string;          // nombre para display (join)
    bodega_nombre:    string;
    fecha_guia:       string;
    total_items:      number;
    total_unidades:   number;
    registrado_por:   string;
    estado:           string;
    created_at:       string;
    documento_url:    string | null;
}

// ── Proveedores ──────────────────────────────────────────────────────────────

export async function getProveedoresAction(): Promise<{ data: Proveedor[]; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'No autorizado.' };

    const db = createAdminClient();
    const { data, error } = await db
        .from('proveedores')
        .select('id, nombre')
        .order('nombre');

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as Proveedor[] };
}

export async function crearProveedorAction(
    nombre: string,
): Promise<{ data: Proveedor | null; error: string | null }> {
    const user = await requireBodegaRole();
    if (!user) return { data: null, error: 'No autorizado.' };

    const trimmed = nombre.trim();
    if (!trimmed) return { data: null, error: 'El nombre del proveedor es obligatorio.' };
    if (trimmed.length > 200) return { data: null, error: 'Nombre demasiado largo (máx. 200 caracteres).' };

    const db = createAdminClient();

    const { data, error } = await db
        .from('proveedores')
        .insert({ nombre: trimmed })
        .select('id, nombre')
        .single();

    if (error) {
        // Conflicto de unicidad: el proveedor ya existe, devolverlo
        if (error.code === '23505') {
            const { data: existing } = await db
                .from('proveedores')
                .select('id, nombre')
                .eq('nombre', trimmed)
                .single();
            return { data: existing as Proveedor, error: null };
        }
        return { data: null, error: error.message };
    }

    revalidatePath('/dashboard/admin/inventario/guias');
    return { data: data as Proveedor, error: null };
}

// ── Procesar guía (atómica vía RPC) ─────────────────────────────────────────

export async function procesarGuiaIngresoAction(
    payload: GuiaIngresoPayload
): Promise<{ error: string | null; guia_id?: string }> {
    const user = await requireBodegaRole();
    if (!user) return { error: 'No autorizado.' };

    const { numero_guia, tipo_documento, proveedor_id, bodega_destino_id, fecha_guia, observaciones, documento_url, items } = payload;

    if (!numero_guia.trim())  return { error: 'El número de documento es obligatorio.' };
    if (!proveedor_id)        return { error: 'Selecciona un proveedor.' };
    if (!bodega_destino_id)   return { error: 'Selecciona una bodega de destino.' };
    if (!items.length)        return { error: 'Agrega al menos un ítem a la guía.' };

    for (const item of items) {
        if (!item.familia.trim() || !item.modelo.trim()) {
            return { error: 'Todos los ítems deben tener familia y modelo.' };
        }
        if (item.cantidad < 1) {
            return { error: `Cantidad inválida para "${item.familia} — ${item.modelo}".` };
        }
        if (item.es_serializado) {
            if (item.seriales.length !== item.cantidad) {
                return { error: `"${item.modelo}": faltan seriales (${item.seriales.length}/${item.cantidad}).` };
            }
            const dupes = item.seriales.filter((s, i) => item.seriales.indexOf(s) !== i);
            if (dupes.length) {
                return { error: `Serial duplicado en "${item.modelo}": ${dupes[0]}` };
            }
        }
    }

    const db = createAdminClient();

    const { data, error } = await db.rpc('procesar_guia_ingreso_rpc', {
        p_numero_guia:       numero_guia.trim(),
        p_tipo_documento:    tipo_documento,
        p_proveedor_id:      proveedor_id,
        p_bodega_destino_id: bodega_destino_id,
        p_fecha_guia:        fecha_guia,
        p_observaciones:     observaciones,
        p_registrado_por:    user.id,
        p_items:             items,
        p_documento_url:     documento_url ?? null,
    });

    if (error) return { error: error.message };

    const result = data as any;
    if (result?.error) return { error: result.error };

    revalidatePath('/dashboard/admin/bodegas');
    revalidatePath('/dashboard/admin/inventario/guias');

    return { error: null, guia_id: result?.guia_id };
}

// ── Listar guías (historial) ─────────────────────────────────────────────────

export async function getGuiasIngresoAction(
    page = 0,
    pageSize = 20,
): Promise<{ data: GuiaResumen[]; total: number; error?: string }> {
    const user = await requireBodegaRole();
    if (!user) return { data: [], total: 0, error: 'No autorizado.' };

    const db = createAdminClient();

    const from = page * pageSize;
    const to   = from + pageSize - 1;

    const [guiasResult, countResult] = await Promise.all([
        db.from('guias_ingreso')
            .select('id, numero_guia, tipo_documento, proveedor_id, proveedores(nombre), bodega_destino_id, fecha_guia, observaciones, documento_url, estado, created_at, registrado_por')
            .order('created_at', { ascending: false })
            .range(from, to),
        db.from('guias_ingreso')
            .select('*', { count: 'exact', head: true }),
    ]);

    if (guiasResult.error) return { data: [], total: 0, error: guiasResult.error.message };

    const guias = guiasResult.data ?? [];
    if (!guias.length) return { data: [], total: (countResult as any).count ?? 0 };

    const bodegaIds = [...new Set(guias.map(g => g.bodega_destino_id as string))];
    const userIds   = [...new Set(guias.map(g => g.registrado_por   as string))];
    const guiaIds   = guias.map(g => g.id as string);

    const [bodegasRes, profilesRes, itemsRes] = await Promise.all([
        db.from('bodegas').select('id, nombre').in('id', bodegaIds),
        db.from('profiles').select('id, full_name').in('id', userIds),
        db.from('guias_ingreso_items')
            .select('guia_ingreso_id, cantidad')
            .in('guia_ingreso_id', guiaIds),
    ]);

    const bodegaMap  = Object.fromEntries((bodegasRes.data  ?? []).map(b => [b.id, b.nombre]));
    const profileMap = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p.full_name]));

    const itemStats = new Map<string, { count: number; units: number }>();
    for (const row of (itemsRes.data ?? []) as any[]) {
        const gid  = row.guia_ingreso_id as string;
        const prev = itemStats.get(gid) ?? { count: 0, units: 0 };
        itemStats.set(gid, { count: prev.count + 1, units: prev.units + (row.cantidad ?? 1) });
    }

    const data: GuiaResumen[] = guias.map(g => {
        const stats = itemStats.get(g.id as string) ?? { count: 0, units: 0 };
        return {
            id:             g.id             as string,
            numero_guia:    g.numero_guia    as string,
            tipo_documento: ((g as any).tipo_documento as 'GD' | 'FC') ?? 'GD',
            proveedor:      ((g as any).proveedores as { nombre: string } | null)?.nombre ?? '—',
            bodega_nombre:  bodegaMap[g.bodega_destino_id as string] ?? '—',
            fecha_guia:     g.fecha_guia     as string,
            total_items:    stats.count,
            total_unidades: stats.units,
            registrado_por: profileMap[g.registrado_por as string] ?? 'Desconocido',
            estado:         g.estado         as string,
            created_at:     g.created_at     as string,
            documento_url:  (g.documento_url as string | null) ?? null,
        };
    });

    return { data, total: (countResult as any).count ?? 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs del historial (estadísticas rápidas del mes actual)
// ─────────────────────────────────────────────────────────────────────────────

export interface KPIsGuias {
    guiasEsteMes:    number;
    unidadesEsteMes: number;
    ultimoProveedor: string | null;
}

export async function getKPIsGuiasAction(): Promise<KPIsGuias> {
    const db = createAdminClient();
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const [countRes, ultimoRes] = await Promise.all([
        db.from('guias_ingreso').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        db.from('guias_ingreso')
            .select('proveedor_id, proveedores(nombre)')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const guiasEsteMes    = countRes.count ?? 0;
    const ultimoProveedor = (ultimoRes.data as any)?.proveedores?.nombre ?? null;

    const { data: idsData } = await db
        .from('guias_ingreso').select('id').gte('created_at', startOfMonth);
    const ids = (idsData ?? []).map(g => g.id);

    let unidadesEsteMes = 0;
    if (ids.length > 0) {
        const { data: itemsData } = await db
            .from('guias_ingreso_items').select('cantidad').in('guia_ingreso_id', ids);
        unidadesEsteMes = (itemsData ?? []).reduce((s, i) => s + (i.cantidad ?? 0), 0);
    }

    return { guiasEsteMes, unidadesEsteMes, ultimoProveedor };
}

// ─────────────────────────────────────────────────────────────────────────────
// Búsqueda con filtros (llama al RPC buscar_guias_ingreso_rpc)
// ─────────────────────────────────────────────────────────────────────────────

export interface GuiasFiltrosParams {
    search?:         string;
    desde?:          string;
    hasta?:          string;
    proveedorId?:    string;
    tipoDocumento?:  'GD' | 'FC' | '';
    page?:           number;
    pageSize?:       number;
}

export async function getGuiasConFiltrosAction(
    params: GuiasFiltrosParams = {}
): Promise<{ data: GuiaResumen[]; total: number; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], total: 0, error: 'No autenticado.' };

    const { search = '', desde = '', hasta = '', proveedorId = '', tipoDocumento = '', page = 0, pageSize = 10 } = params;
    const db = createAdminClient();

    const { data: rpcData, error } = await db.rpc('buscar_guias_ingreso_rpc', {
        p_search:         search         || null,
        p_desde:          desde          || null,
        p_hasta:          hasta          || null,
        p_proveedor_id:   proveedorId    || null,
        p_tipo_documento: tipoDocumento  || null,
        p_offset:         page * pageSize,
        p_limit:          pageSize,
    });

    if (error) return { data: [], total: 0, error: error.message };

    const result = rpcData as { data: any[]; total: number };
    const rows   = result?.data ?? [];
    const total  = result?.total ?? 0;

    const userIds = [...new Set(rows.map((g: any) => g.registrado_por).filter(Boolean))];
    const profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
        const { data: profiles } = await db.from('profiles').select('id, full_name').in('id', userIds);
        for (const p of profiles ?? []) profileMap[p.id] = (p as any).full_name ?? p.id;
    }

    const data: GuiaResumen[] = rows.map((g: any) => ({
        id:             g.id,
        numero_guia:    g.numero_guia,
        tipo_documento: (g.tipo_documento as 'GD' | 'FC') ?? 'GD',
        proveedor:      g.proveedor_nombre  ?? '',
        bodega_nombre:  g.bodega_nombre     ?? '',
        fecha_guia:     g.fecha_guia,
        total_items:    Number(g.total_items    ?? 0),
        total_unidades: Number(g.total_unidades ?? 0),
        registrado_por: profileMap[g.registrado_por] ?? 'Desconocido',
        estado:         g.estado,
        created_at:     g.created_at,
        documento_url:  g.documento_url ?? null,
    }));

    return { data, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalle completo de una guía (ítems + seriales + estado de stock)
// ─────────────────────────────────────────────────────────────────────────────

export interface DetalleSerial {
    serial: string;
    estado: string;
    bodega: string | null;
}

export interface DetalleItem {
    familia:        string;
    modelo:         string;
    es_serializado: boolean;
    cantidad:       number;
    seriales:       DetalleSerial[];
}

export interface DetalleGuia {
    id:                    string;
    numero_guia:           string;
    tipo_documento:        'GD' | 'FC';
    proveedor_nombre:      string;
    bodega_nombre:         string;
    fecha_guia:            string;
    observaciones:         string | null;
    documento_url:         string | null;
    estado:                string;
    created_at:            string;
    registrado_por_nombre: string;
    items:                 DetalleItem[];
}

export async function getDetalleGuiaAction(
    guiaId: string
): Promise<{ data: DetalleGuia | null; error?: string }> {
    try {
        const db = createAdminClient();

        const [guiaRes, itemsRes] = await Promise.all([
            db.from('guias_ingreso')
                .select('id, numero_guia, tipo_documento, proveedor_id, proveedores(nombre), bodega_destino_id, bodegas(nombre), fecha_guia, observaciones, documento_url, estado, created_at, registrado_por')
                .eq('id', guiaId)
                .single(),
            db.from('guias_ingreso_items')
                .select('familia, modelo, es_serializado, numero_serie, cantidad')
                .eq('guia_ingreso_id', guiaId)
                .order('modelo'),
        ]);

        if (guiaRes.error || !guiaRes.data) return { data: null, error: 'Guía no encontrada.' };

        const guia  = guiaRes.data as any;
        const items = (itemsRes.data ?? []) as any[];

        const profileRes = await db.from('profiles').select('full_name').eq('id', guia.registrado_por).maybeSingle();

        // Agrupar ítems por familia+modelo
        const grouped = new Map<string, DetalleItem>();
        for (const item of items) {
            const key = `${item.familia}|${item.modelo}`;
            if (!grouped.has(key)) {
                grouped.set(key, { familia: item.familia, modelo: item.modelo, es_serializado: !!item.es_serializado, cantidad: 0, seriales: [] });
            }
            const g = grouped.get(key)!;
            g.cantidad += item.cantidad ?? 1;
            if (item.numero_serie) g.seriales.push({ serial: item.numero_serie, estado: 'Consultando…', bodega: null });
        }

        // Estado de stock para seriales
        const allSerials = [...grouped.values()].flatMap(g => g.seriales.map(s => s.serial));
        if (allSerials.length > 0) {
            const { data: stocks } = await db
                .from('inventario')
                .select('numero_serie, estado, bodega_id, bodegas(nombre)')
                .in('numero_serie', allSerials);

            const stockMap = new Map((stocks ?? []).map((s: any) => [s.numero_serie, s]));
            for (const item of grouped.values()) {
                for (const s of item.seriales) {
                    const stock = stockMap.get(s.serial) as any;
                    s.estado = stock?.estado ?? 'Desconocido';
                    s.bodega = stock?.bodegas?.nombre ?? null;
                }
            }
        }

        return {
            data: {
                id:                    guia.id,
                numero_guia:           guia.numero_guia,
                tipo_documento:        (guia.tipo_documento as 'GD' | 'FC') ?? 'GD',
                proveedor_nombre:      guia.proveedores?.nombre ?? '—',
                bodega_nombre:         guia.bodegas?.nombre     ?? '—',
                fecha_guia:            guia.fecha_guia,
                observaciones:         guia.observaciones ?? null,
                documento_url:         guia.documento_url ?? null,
                estado:                guia.estado,
                created_at:            guia.created_at,
                registrado_por_nombre: (profileRes.data as any)?.full_name ?? 'Desconocido',
                items:                 [...grouped.values()],
            },
        };
    } catch (e: any) {
        return { data: null, error: e.message };
    }
}
