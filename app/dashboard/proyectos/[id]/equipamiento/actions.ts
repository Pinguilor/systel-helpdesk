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

        // Validar saldo disponible descontando solicitudes PENDIENTES:
        // Disponible = Presupuestado - (Entregado - Reingresado) - EnVuelo
        const equipIds = items.map(i => i.proyectoEquipamientoId).filter(Boolean);
        const { data: equipRows } = await db
            .from('proyecto_equipamiento')
            .select('id, cantidad_total, cantidad_entregada, cantidad_reingresada, tipo_item')
            .in('id', equipIds);

        // Sumar cantidades en solicitudes pendientes por equip_id
        const { data: pendientesRaw } = await db
            .from('solicitud_items')
            .select('proyecto_equipamiento_id, cantidad, solicitud:solicitud_id!inner(estado)')
            .in('proyecto_equipamiento_id', equipIds)
            .eq('solicitud.estado', 'pendiente');

        const enVuelo = new Map<string, number>();
        for (const p of pendientesRaw ?? []) {
            const peId = p.proyecto_equipamiento_id as string;
            enVuelo.set(peId, (enVuelo.get(peId) ?? 0) + (p.cantidad as number));
        }

        const equipMap = Object.fromEntries((equipRows ?? []).map(e => [e.id, e]));
        for (const item of items) {
            const equip = equipMap[item.proyectoEquipamientoId];
            if (equip) {
                const reingresada = (equip.cantidad_reingresada as number) ?? 0;
                const pendiente = enVuelo.get(equip.id as string) ?? 0;
                const saldo = (equip.cantidad_total as number) - ((equip.cantidad_entregada as number) - reingresada) - pendiente;
                if (item.cantidad > saldo) {
                    return {
                        error: `"${(equip.tipo_item as string) ?? 'Ítem'}" sólo tiene ${Math.max(0, saldo)} unidad(es) disponible(s) para solicitar${pendiente > 0 ? ` (${pendiente} en solicitudes pendientes)` : ''}.`,
                    };
                }
            }
        }

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
// Historial de Incidencias: registros de proyecto_material_custodia
// ─────────────────────────────────────────────────────────────────────────────
export interface IncidenciaCustodia {
    id:                      string;
    createdAt:               string;
    materialNombre:          string;
    cantidad:                number;
    estado:                  string;
    motivoIncidencia:        string | null;
    registradoPorNombre:     string | null;
    evidenciaFotograficaUrl: string | null;
    firmaCustodiaUrl:        string | null;
}

export async function getHistorialIncidenciasProyecto(
    proyectoId: string
): Promise<{ data: IncidenciaCustodia[]; error?: string }> {
    try {
        const db = createAdminClient();

        const { data, error } = await db
            .from('proyecto_material_custodia')
            .select(`
                id, created_at, cantidad, estado, motivo_incidencia,
                evidencia_fotografica_url, firma_custodia_url,
                registrado_por:reportado_por_id ( full_name ),
                equipamiento:proyecto_equipamiento_id (
                    tipo_item,
                    catalogo:catalogo_equipos!inventario_id ( modelo )
                )
            `)
            .eq('proyecto_id', proyectoId)
            .order('created_at', { ascending: false });

        if (error) return { data: [], error: error.message };

        const incidencias: IncidenciaCustodia[] = (data ?? []).map((r: any) => ({
            id:                      r.id,
            createdAt:               r.created_at,
            materialNombre:          r.equipamiento?.catalogo?.modelo
                                     ?? r.equipamiento?.tipo_item
                                     ?? 'Material sin nombre',
            cantidad:                r.cantidad ?? 0,
            estado:                  r.estado ?? '',
            motivoIncidencia:        r.motivo_incidencia ?? null,
            registradoPorNombre:     r.registrado_por?.full_name ?? null,
            evidenciaFotograficaUrl: r.evidencia_fotografica_url ?? null,
            firmaCustodiaUrl:        r.firma_custodia_url ?? null,
        }));

        return { data: incidencias };
    } catch (e: any) {
        return { data: [], error: e.message };
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
