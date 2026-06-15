'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export interface SolicitudProyectoItem {
    proyectoEquipamientoId: string;
    inventarioId: string;
    cantidad: number;
}

export async function crearSolicitudProyectoAction(
    proyectoId: string,
    items: SolicitudProyectoItem[]
) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return { error: 'No autenticado' };
        }

        if (!items || items.length === 0) {
            return { error: 'El carrito de retiro está vacío.' };
        }

        const db = createAdminClient();

        // 1. Insertar la cabecera
        const { data: solicitud, error: headerError } = await db
            .from('solicitudes_materiales')
            .insert({
                proyecto_id: proyectoId,
                tecnico_id: user.id,
                tipo_solicitud: 'proyecto',
                estado: 'pendiente'
            })
            .select('id')
            .single();

        if (headerError || !solicitud) {
            throw new Error(headerError?.message || 'Error al crear la solicitud principal.');
        }

        // 2. Insertar las filas de detalle
        const filasItems = items.map(item => ({
            solicitud_id: solicitud.id,
            inventario_id: null, // Dejamos esto nulo porque es una solicitud genérica basada en la Receta, el bodeguero asignará el físico.
            cantidad: item.cantidad,
            proyecto_equipamiento_id: item.proyectoEquipamientoId
        }));

        const { error: itemsError } = await db
            .from('solicitud_items')
            .insert(filasItems);

        if (itemsError) {
            // Intentamos rollback manual en caso de fallo
            await db.from('solicitudes_materiales').delete().eq('id', solicitud.id);
            throw new Error(`Error al insertar los ítems: ${itemsError.message}`);
        }

        // Revalidar las rutas relevantes para actualizar la UI en tiempo real
        revalidatePath(`/dashboard/proyectos/${proyectoId}`);
        revalidatePath(`/dashboard/admin/bodegas/solicitudes`);
        
        return { success: true };
    } catch (error: any) {
        console.error('Error en crearSolicitudProyectoAction:', error);
        return { error: error.message || 'Error interno del servidor.' };
    }
}
