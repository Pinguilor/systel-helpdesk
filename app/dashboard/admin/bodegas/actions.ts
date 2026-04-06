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

export async function addStockAction(formData: FormData) {
    const user = await requireBodegaRole();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();

    const bodegaId    = formData.get('bodega_id') as string;
    const modelo      = (formData.get('modelo') as string)?.trim();
    const familia     = (formData.get('familia') as string)?.trim();
    const esSerial    = formData.get('es_serializado') === 'true';
    const serialesRaw = formData.get('seriales') as string | null;
    const cantidadRaw = parseInt(formData.get('cantidad') as string, 10);

    if (!bodegaId || !modelo || !familia) return { error: 'Datos incompletos.' };

    // Validate bodega is INTERNA
    const { data: bodega } = await db
        .from('bodegas').select('tipo').eq('id', bodegaId).maybeSingle();
    if (!bodega || bodega.tipo?.toUpperCase() !== 'INTERNA') {
        return { error: 'Bodega de destino inválida o no permitida.' };
    }

    if (esSerial) {
        const seriales: string[] = serialesRaw ? JSON.parse(serialesRaw) : [];
        if (seriales.length === 0) return { error: 'Debes ingresar al menos un número de serie.' };

        // Check for duplicates globally
        const { data: existingSerials } = await db
            .from('inventario')
            .select('numero_serie')
            .in('numero_serie', seriales);

        const duplicados = (existingSerials ?? []).map((r: any) => r.numero_serie);
        if (duplicados.length > 0) {
            return { error: `Serie(s) ya registrada(s): ${duplicados.join(', ')}` };
        }

        const rows = seriales.map(serie => ({
            bodega_id: bodegaId,
            modelo,
            familia,
            es_serializado: true,
            numero_serie: serie,
            cantidad: 1,
            estado: 'Disponible',
        }));

        const { error } = await db.from('inventario').insert(rows);
        if (error) {
            console.error('[addStockAction] serial insert:', error.message);
            return { error: 'No se pudieron registrar los equipos.' };
        }
    } else {
        if (isNaN(cantidadRaw) || cantidadRaw < 1) return { error: 'La cantidad debe ser al menos 1.' };

        // Try to sum to existing row in same bodega
        const { data: existing } = await db
            .from('inventario')
            .select('id, cantidad')
            .eq('bodega_id', bodegaId)
            .eq('modelo', modelo)
            .eq('es_serializado', false)
            .is('ticket_id', null)
            .neq('estado', 'Inactivo')
            .maybeSingle();

        if (existing) {
            const { error } = await db
                .from('inventario')
                .update({ cantidad: (existing as any).cantidad + cantidadRaw })
                .eq('id', (existing as any).id);
            if (error) {
                console.error('[addStockAction] update:', error.message);
                return { error: 'No se pudo actualizar el stock.' };
            }
        } else {
            const { error } = await db.from('inventario').insert({
                bodega_id: bodegaId,
                modelo,
                familia,
                es_serializado: false,
                cantidad: cantidadRaw,
                estado: 'Disponible',
            });
            if (error) {
                console.error('[addStockAction] insert:', error.message);
                return { error: 'No se pudo registrar el equipo.' };
            }
        }
    }

    revalidatePath('/dashboard/admin/bodegas');
    return { success: true };
}
