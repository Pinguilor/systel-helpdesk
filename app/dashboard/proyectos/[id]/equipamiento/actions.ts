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

// ─────────────────────────────────────────────────────────────────────────────
// Historial de Despachos: todas las solicitudes APROBADAS del proyecto.
// Para auditoría del Project Manager (fecha, bodeguero, ítems entregados).
// ─────────────────────────────────────────────────────────────────────────────
export interface DespachoItem {
    modelo: string;
    familia: string;
    cantidad: number;
    es_serializado: boolean;
}

export interface DespachoProyecto {
    id: string;
    creadoEn: string;
    aprobadoEn: string | null;   // gestionado_en = fecha de aprobación
    bodegueroNombre: string | null;
    totalUnidades: number;
    items: DespachoItem[];
}

export async function getHistorialRetirosProyectoAction(
    proyectoId: string
): Promise<{ data: DespachoProyecto[]; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: [], error: 'No autenticado.' };

        // Service-role: el nombre del bodeguero (profiles) y los embeds anidados
        // (proyecto_equipamiento → catalogo_equipos) se anulan bajo RLS del PM.
        // El acceso al proyecto ya está gateado por el layout de la ruta.
        const db = createAdminClient();

        const { data, error } = await db
            .from('solicitudes_materiales')
            .select(`
                id, creado_en, gestionado_en,
                bodeguero:bodeguero_id ( full_name ),
                solicitud_items (
                    cantidad,
                    inventario:inventario_id ( modelo, familia, es_serializado ),
                    proyecto_equipamiento:proyecto_equipamiento_id (
                        inventario:catalogo_equipos!inventario_id (
                            modelo, es_serializado, familia_obj:familias_hardware ( nombre )
                        )
                    )
                )
            `)
            .eq('proyecto_id', proyectoId)
            .eq('estado', 'aprobada')
            .order('gestionado_en', { ascending: false });

        if (error) return { data: [], error: error.message };

        const despachos: DespachoProyecto[] = (data ?? []).map((s: any) => {
            const items: DespachoItem[] = (s.solicitud_items ?? []).map((it: any) => {
                // El modelo/familia vive en inventario (genérico inyectado) o en el
                // catálogo vía proyecto_equipamiento (serializado de proyecto).
                const cat = it.proyecto_equipamiento?.inventario;
                return {
                    modelo:         it.inventario?.modelo  || cat?.modelo || 'Equipo sin nombre',
                    familia:        it.inventario?.familia || cat?.familia_obj?.nombre || 'Sin familia',
                    cantidad:       it.cantidad ?? 0,
                    es_serializado: it.inventario?.es_serializado ?? cat?.es_serializado ?? false,
                };
            });

            return {
                id:              s.id,
                creadoEn:        s.creado_en,
                aprobadoEn:      s.gestionado_en,
                bodegueroNombre: s.bodeguero?.full_name ?? null,
                totalUnidades:   items.reduce((acc, it) => acc + it.cantidad, 0),
                items,
            };
        });

        return { data: despachos };
    } catch (e: any) {
        console.error('Error en getHistorialRetirosProyectoAction:', e);
        return { data: [], error: e.message || 'Error al cargar el historial de despachos.' };
    }
}
