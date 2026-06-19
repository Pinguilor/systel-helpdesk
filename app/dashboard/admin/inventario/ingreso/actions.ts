'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

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

export async function ingresoLoteAction(params: {
    bodegaId: string;
    modelo: string;
    familia: string;
    seriales: string[];
}): Promise<{ error: string | null; inserted: number }> {
    const user = await requireBodegaRole();
    if (!user) return { error: 'No autorizado.', inserted: 0 };

    const { bodegaId, modelo, familia, seriales } = params;
    if (!bodegaId || !modelo || !familia) return { error: 'Datos de configuración incompletos.', inserted: 0 };
    if (!seriales?.length) return { error: 'No hay seriales válidos para ingresar.', inserted: 0 };

    const db = createAdminClient();

    // Validate bodega is INTERNA and active
    const { data: bodega } = await db
        .from('bodegas').select('tipo, activo').eq('id', bodegaId).maybeSingle();
    if (!bodega || bodega.tipo?.toUpperCase() !== 'INTERNA') {
        return { error: 'Bodega de destino inválida.', inserted: 0 };
    }
    if (bodega.activo === false) {
        return { error: 'La bodega de destino está inactiva y no puede recibir stock.', inserted: 0 };
    }

    // Final server-side duplicate check (defense in depth — client already filtered)
    const { data: existing } = await db
        .from('inventario')
        .select('numero_serie')
        .in('numero_serie', seriales);

    const duplicados = new Set((existing ?? []).map((r: any) => r.numero_serie as string));
    const serialesFinales = seriales.filter(s => !duplicados.has(s));

    if (!serialesFinales.length) {
        return { error: 'Todos los seriales ya existen en el inventario.', inserted: 0 };
    }

    const rows = serialesFinales.map(serie => ({
        bodega_id:      bodegaId,
        modelo,
        familia,
        es_serializado: true,
        numero_serie:   serie,
        cantidad:       1,
        estado:         'Disponible' as const,
    }));

    const { error } = await db.from('inventario').insert(rows);
    if (error) return { error: error.message, inserted: 0 };

    revalidatePath('/dashboard/admin/bodegas');
    revalidatePath('/dashboard/admin/inventario/ingreso');

    return { error: null, inserted: serialesFinales.length };
}
