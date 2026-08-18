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

    const { numero_guia, proveedor_id, bodega_destino_id, fecha_guia, observaciones, documento_url, items } = payload;

    if (!numero_guia.trim())  return { error: 'El número de guía es obligatorio.' };
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
            .select('id, numero_guia, proveedor_id, proveedores(nombre), bodega_destino_id, fecha_guia, observaciones, documento_url, estado, created_at, registrado_por')
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
