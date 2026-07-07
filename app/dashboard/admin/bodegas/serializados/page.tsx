import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TrazabilidadClient } from './TrazabilidadClient';

export const dynamic = 'force-dynamic';

export interface SerializadoInstalado {
    inventario_id: string;
    modelo: string;
    familia: string;
    numero_serie: string;
    fecha_instalacion: string;
    ticket_id: string;
    ticket_numero: number;
    tecnico_nombre: string;
    restaurante_id: string;
    restaurante_nombre: string;
    restaurante_sigla: string;
}

export default async function TrazabilidadPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    const rol = profile?.rol?.toUpperCase() || '';
    if (rol !== 'ADMIN' && rol !== 'ADMIN_BODEGA') redirect('/dashboard/usuario');

    // ── Consulta principal ──────────────────────────────────────────────────
    // Cruzamos:
    //   movimientos_inventario  (el evento de instalación, bodega_destino = bodega de tipo Local)
    //   inventario              (para modelo, familia, numero_serie, es_serializado)
    //   bodegas (destino)       (para filtrar solo bodegas tipo Local y obtener local_id)
    //   restaurantes            (nombre, sigla del restaurante dueño de esa bodega)
    //   tickets                 (numero_ticket del ticket origen)
    //   profiles (realizado_por)(nombre del técnico)
    //
    // Regla: solo serializados (es_serializado = true), solo destino tipo 'Local',
    //        agrupamos en JS por restaurante_id eliminando los sin nombre.

    // Query principal — sin join a profiles (realizado_por no tiene FK nombrada a profiles)
    const { data: movimientos, error } = await supabase
        .from('movimientos_inventario')
        .select(`
            id,
            fecha_movimiento,
            inventario_id,
            ticket_id,
            bodega_destino_id,
            realizado_por,
            inventario (
                id,
                modelo,
                familia,
                numero_serie,
                es_serializado
            ),
            bodega_destino:bodegas!movimientos_inventario_bodega_destino_id_fkey (
                id,
                tipo
            ),
            tickets (
                numero_ticket,
                restaurantes (
                    id,
                    nombre_restaurante,
                    sigla
                )
            )
        `)
        .order('fecha_movimiento', { ascending: false });

    if (error) console.error('[serializados] Error al cargar movimientos:', error.message);

    // ── Filtrar: serializados cuyo destino sea bodega tipo Local ──────────────
    const soloLocales = (movimientos || []).filter((m: any) => {
        if (m.inventario?.es_serializado !== true) return false;
        const tipo = m.bodega_destino?.tipo?.toLowerCase();
        return tipo === 'cliente' && m.tickets?.restaurantes;
    });

    // ── Resolver nombres de técnicos en una sola query separada ──────────────
    const tecnicoIds: string[] = [...new Set(
        soloLocales.map((m: any) => m.realizado_por).filter(Boolean) as string[]
    )];

    let tecnicosMap: Record<string, string> = {};
    if (tecnicoIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', tecnicoIds);
        (profiles || []).forEach((p: any) => {
            tecnicosMap[p.id] = p.full_name ?? 'Desconocido';
        });
    }

    // ── Construir lista tipada ────────────────────────────────────────────────
    const serializados: SerializadoInstalado[] = soloLocales
        .map((m: any) => {
            const restaurante = m.tickets?.restaurantes;
            if (!restaurante) return null;

            return {
                inventario_id: m.inventario_id,
                modelo: m.inventario?.modelo ?? '—',
                familia: m.inventario?.familia ?? '—',
                numero_serie: m.inventario?.numero_serie ?? '—',
                fecha_instalacion: m.fecha_movimiento,
                ticket_id: m.ticket_id,
                ticket_numero: m.tickets?.numero_ticket ?? 0,
                tecnico_nombre: tecnicosMap[m.realizado_por] ?? 'Desconocido',
                restaurante_id: restaurante.id,
                restaurante_nombre: restaurante.nombre_restaurante ?? '—',
                restaurante_sigla: restaurante.sigla ?? '',
            } satisfies SerializadoInstalado;
        })
        .filter(Boolean) as SerializadoInstalado[];

    return <TrazabilidadClient serializados={serializados} />;
}
