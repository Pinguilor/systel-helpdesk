import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AuditoriaMochilasClient } from './AuditoriaMochilasClient';

export const metadata = {
    title: 'Auditoría de Mochilas — Systel Loop',
    description: 'Supervisa el inventario en campo asignado a cada técnico.',
};

export default async function MochilasPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    const rol = profile?.rol?.toUpperCase() ?? '';
    if (!['ADMIN', 'COORDINADOR'].includes(rol)) redirect('/dashboard');

    // ── 1. Obtener todos los técnicos ──────────────────────────
    const { data: tecnicos } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('rol', 'tecnico')
        .order('full_name');

    // ── 2. Obtener todos los emails (auth.users via admin) ─────
    // Evitamos el admin client aquí — el email lo traemos de profiles si está,
    // o usamos el nombre como fallback. (email no está en profiles→ omitimos)

    // ── 3. Obtener todas las mochilas MOCHILA con su tecnico_id ─
    const { data: bodegas } = await supabase
        .from('bodegas')
        .select('id, nombre, tecnico_id')
        .eq('tipo', 'MOCHILA');

    // ── 4. Obtener todo el inventario de mochilas ──────────────
    const mochilaIds = (bodegas ?? []).map(b => b.id);

    const { data: inventario } = mochilaIds.length > 0
        ? await supabase
            .from('inventario')
            .select('id, bodega_id, modelo, familia, es_serializado, numero_serie, cantidad, estado')
            .in('bodega_id', mochilaIds)
            .gt('cantidad', 0)
        : { data: [] };

    // ── 5. Construir el mapa de mochila por tecnico_id ─────────
    const bodegaMap = new Map((bodegas ?? []).map(b => [b.tecnico_id, b]));
   const inventarioMap = new Map<string, any[]>();

    (inventario ?? []).forEach(item => {
        if (!item.bodega_id) return;
        if (!inventarioMap.has(item.bodega_id)) inventarioMap.set(item.bodega_id, []);
        inventarioMap.get(item.bodega_id)!.push(item);
    });

    // ── 6. Combinar técnicos + mochilas + inventario ───────────
    const mochilas = (tecnicos ?? []).map(t => {
        const bodega      = bodegaMap.get(t.id) ?? null;
        const items       = bodega ? (inventarioMap.get(bodega.id) ?? []) : [];
        const totalUnidades = items.reduce((s, i) => s + (i.cantidad ?? 0), 0);

        return {
            tecnico_id:    t.id,
            tecnico_nombre: t.full_name,
            tecnico_email: null,           // no disponible sin admin client
            mochila_id:    bodega?.id ?? null,
            mochila_nombre: bodega?.nombre ?? null,
            items,
            total_items:   items.length,
            total_unidades: totalUnidades,
        };
    });

    return <AuditoriaMochilasClient mochilas={mochilas} />;
}
