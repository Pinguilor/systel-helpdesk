'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { BOM_ESTADO_CONFIG, type BomItemEstado } from '@/types/proyectos.types';
import { registrarEntradaAuditoria } from '../actions';

async function requireAccess() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).single();
    const rol = profile?.rol?.toUpperCase();
    if (rol !== 'ADMIN' && rol !== 'COORDINADOR') return null;
    return user;
}

// ── Reads ─────────────────────────────────────────────────────────────────

export async function getBomConItems(proyectoId: string) {
    const supabase = await createClient();
    // Reemplazado para usar la nueva Receta Maestra (proyecto_equipamiento)
    // Se asume que el frontend ahora mapea sobre "items" que vendrá directamente como array
    const { data, error } = await supabase
        .from('proyecto_equipamiento')
        .select(`
            id, proyecto_id, tipo_item, inventario_id, cantidad_total, cantidad_entregada, created_at,
            inventario:catalogo_equipos!inventario_id(
                modelo, 
                es_serializado, 
                familia_obj:familias_hardware(nombre)
            )
        `)
        .eq('proyecto_id', proyectoId)
        .order('created_at');
        
    // Flatten la familia para que el frontend la lea fácil. Si inventario es null (ej. manual), usar tipo_item
    const items = (data || []).map(item => {
        const inv = item.inventario as any;
        return {
            ...item,
            inventario: {
                ...inv,
                modelo: inv?.modelo || item.tipo_item || 'Manual',
                familia: inv?.familia_obj?.nombre || 'Manual/Sin familia',
                es_serializado: inv?.es_serializado || false
            }
        };
    });

    return { items };
}

export async function getCatalogoEquipos(): Promise<
    { id: string; familia: string; modelo: string; es_serializado: boolean }[]
> {
    // Usar admin client: catalogo_equipos puede no tener política SELECT para usuarios.
    const db = createAdminClient();

    // catalogo_equipos tiene FK a familias_hardware (no columna 'familia' directa)
    const { data: catData } = await db
        .from('catalogo_equipos')
        .select('id, modelo, es_serializado, familias_hardware(nombre)')
        .order('modelo');

    if (catData && catData.length > 0) {
        const seen = new Set<string>();
        return (catData as any[])
            .map(r => ({
                id:             r.id as string,
                familia:        (r.familias_hardware as any)?.nombre ?? 'Sin familia',
                modelo:         r.modelo as string,
                es_serializado: (r.es_serializado as boolean) ?? false,
            }))
            .filter(item => {
                const key = `${item.familia}::${item.modelo}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    // Fallback: modelos únicos desde inventario existente
    const { data: invData } = await db
        .from('inventario')
        .select('familia, modelo, es_serializado')
        .order('familia')
        .order('modelo');

    if (!invData?.length) return [];

    const seen = new Set<string>();
    return invData
        .filter(item => {
            const key = `${item.familia}::${item.modelo}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map(item => ({
            id:             `${item.familia}::${item.modelo}`,  // id sintético
            familia:        item.familia,
            modelo:         item.modelo,
            es_serializado: item.es_serializado,
        }));
}

export async function getInventarioDisponible(familia: string, modelo: string) {
    const user = await requireAccess();
    if (!user) return [];

    // Admin client bypasses RLS — coordinador role may not have SELECT on inventario
    const db = createAdminClient();
    const { data } = await db
        .from('inventario')
        .select('id, numero_serie, cantidad, bodega_id, bodegas(nombre)')
        .ilike('familia', familia)
        .ilike('modelo', modelo)
        .eq('estado', 'Disponible')
        .gt('cantidad', 0)
        .order('created_at');
    return data ?? [];
}

// ── Asegurar que existe un BOM para el proyecto ────────────────────────────

async function ensureBomExists(proyectoId: string): Promise<string> {
    const supabase = await createClient();
    const { data: existing } = await supabase
        .from('proyecto_bom')
        .select('id')
        .eq('proyecto_id', proyectoId)
        .maybeSingle();
    if (existing) return existing.id;

    const db = createAdminClient();
    const { data: newBom, error } = await db
        .from('proyecto_bom')
        .insert({ proyecto_id: proyectoId, nombre: 'BOM Principal' })
        .select('id')
        .single();
    if (error) throw new Error(error.message);
    return newBom.id;
}

// ── Agregar ítems al BOM ──────────────────────────────────────────────────
// Los ítems vienen serializados como JSON en formData para ser compatibles
// con useActionState (FormData no soporta arrays nativos).

export async function agregarItemsBom(
    _prevState: { error: string | null },
    formData: FormData
): Promise<{ error: string | null }> {
    const user = await requireAccess();
    if (!user) return { error: 'No autorizado.' };

    const proyectoId = (formData.get('proyecto_id') as string)?.trim();
    const itemsJson  =  formData.get('items')       as string;

    let items: Array<{ id?: string; familia: string; modelo: string; cantidad: number; es_serializado: boolean }>;
    try {
        items = JSON.parse(itemsJson);
    } catch {
        return { error: 'Datos de ítems inválidos.' };
    }
    if (!items?.length) return { error: 'Selecciona al menos un ítem del catálogo.' };

    const db = createAdminClient();
    const { error } = await db.from('proyecto_equipamiento').insert(
        items.map(item => {
            // item.id es catalogo_equipos.id. proyecto_equipamiento.inventario_id es
            // una FK al CATÁLOGO (no a inventario físico). Solo aceptamos UUIDs reales:
            // los ítems manuales/sintéticos (familia::modelo) quedan con catálogo NULL y
            // se resuelven por tipo_item.
            const passedId = item.id;
            const validId = passedId && /^[0-9a-f]{8}-/i.test(passedId) ? passedId : null;

            return {
                proyecto_id:        proyectoId,
                inventario_id:      validId,
                tipo_item:          item.modelo || 'Manual',
                cantidad_total:     item.cantidad,
                cantidad_entregada: 0,
            };
        })
    );
    if (error) return { error: error.message };

    // Register unified system log
    const summary = items.map(item => `${item.cantidad}x ${item.modelo}`).join(', ');
    await registrarEntradaAuditoria(
        proyectoId,
        user.id,
        `[SISTEMA] Se agregaron nuevos materiales al BOM: ${summary}`,
        'hito'
    );

    revalidatePath(`/dashboard/proyectos/${proyectoId}/bom`);
    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

// ── Transición de estado con audit trail ──────────────────────────────────

export async function cambiarEstadoBomItem(
    itemId: string,
    nuevoEstado: BomItemEstado,
    proyectoId: string,
    opts?: { inventarioId?: string; bodegaId?: string; notas?: string }
): Promise<{ error: string | null }> {
    const user = await requireAccess();
    if (!user) return { error: 'No autorizado.' };

    const supabase = await createClient();
    const { data: item, error: fetchError } = await supabase
        .from('proyecto_bom_items')
        .select('estado, modelo, familia')
        .eq('id', itemId)
        .single();
    if (fetchError || !item) return { error: 'Ítem no encontrado.' };

    const estadoActual = item.estado as BomItemEstado;
    const allowed = BOM_ESTADO_CONFIG[estadoActual]?.nextStates ?? [];
    if (!allowed.includes(nuevoEstado)) {
        return { error: `Transición inválida: ${estadoActual} → ${nuevoEstado}` };
    }

    const db = createAdminClient();
    const { error: updateError } = await db
        .from('proyecto_bom_items')
        .update({
            estado:           nuevoEstado,
            // Limpiar vínculos al revertir a requerido
            inventario_id:    nuevoEstado === 'requerido' ? null : (opts?.inventarioId ?? null),
            bodega_origen_id: nuevoEstado === 'requerido' ? null : (opts?.bodegaId    ?? null),
            actualizado_por:  user.id,
            updated_at:       new Date().toISOString(),
        })
        .eq('id', itemId);
    if (updateError) return { error: updateError.message };

    // Audit trail inmutable
    await db.from('movimientos_proyecto').insert({
        bom_item_id:     itemId,
        proyecto_id:     proyectoId,
        estado_anterior: estadoActual,
        estado_nuevo:    nuevoEstado,
        realizado_por:   user.id,
        notas:           opts?.notas ?? null,
    });

    // Register unified system log
    await registrarEntradaAuditoria(
        proyectoId,
        user.id,
        `[SISTEMA] Material ${item.modelo} (${item.familia}) cambió de estado: ${estadoActual.toUpperCase()} ➔ ${nuevoEstado.toUpperCase()}${opts?.notas ? ` (${opts.notas})` : ''}.`,
        'hito'
    );

    revalidatePath(`/dashboard/proyectos/${proyectoId}/bom`);
    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

// ── Eliminar ítem del BOM ─────────────────────────────────────────────────
// Solo permitido para ítems no terminales (no instalados)

export async function eliminarItemBom(
    itemId: string,
    proyectoId: string
): Promise<{ error: string | null }> {
    const user = await requireAccess();
    if (!user) return { error: 'No autorizado.' };

    const supabase = await createClient();
    const { data: item } = await supabase
        .from('proyecto_bom_items')
        .select('estado, modelo, familia')
        .eq('id', itemId)
        .single();
    if (item?.estado === 'instalado') {
        return { error: 'No se puede eliminar un ítem ya instalado.' };
    }

    const db = createAdminClient();
    const { error } = await db.from('proyecto_bom_items').delete().eq('id', itemId);
    if (error) return { error: error.message };

    // Register unified system log
    if (item) {
        await registrarEntradaAuditoria(
            proyectoId,
            user.id,
            `[SISTEMA] Material ${item.modelo} (${item.familia}) fue eliminado del BOM.`,
            'hito'
        );
    }

    revalidatePath(`/dashboard/proyectos/${proyectoId}/bom`);
    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

export async function aplicarRecetaBOMAction(
    proyectoId: string,
    plantillaId: string
): Promise<{ error: string | null }> {
    const user = await requireAccess();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();

    // 1. Obtener la plantilla de receta BOM
    const { data: receta, error: fetchError } = await db
        .from('proyecto_plantillas_bom')
        .select('*')
        .eq('id', plantillaId)
        .single();
    if (fetchError) return { error: `Error al cargar la receta BOM: ${fetchError.message}` };
    if (!receta) return { error: 'Receta BOM no encontrada.' };

    const items = (receta.items || []) as Array<{
        modelo_id: string;
        nombre_modelo: string;
        cantidad: number;
        tipo: string;
        familia: string;
        es_serializado: boolean;
    }>;
    if (items.length === 0) return { error: 'La receta no contiene ítems definidos.' };

    // 2. Omitido: Ya no se requiere un "bom_id" principal. La tabla es directa.

    // 3. Inserción masiva de ítems en proyecto_equipamiento
    const inserts = items.map(item => ({
        proyecto_id:        proyectoId,
        inventario_id:      item.modelo_id, // NOTA: Si el modelo_id en la receta es de catalogo_equipos, entonces esto requiere que inventario_id en esta tabla apunte allá.
        tipo_item:          item.tipo || 'Equipamiento',
        cantidad_total:     item.cantidad,
        cantidad_entregada: 0,
    }));

    const { error: insertError } = await db.from('proyecto_equipamiento').insert(inserts);
    if (insertError) return { error: `Error al inyectar materiales: ${insertError.message}` };

    // 4. Registrar un único log de auditoría
    await registrarEntradaAuditoria(
        proyectoId,
        user.id,
        `[SISTEMA] Se aplicó la receta de materiales: ${receta.nombre}`,
        'hito'
    );

    revalidatePath(`/dashboard/proyectos/${proyectoId}/bom`);
    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}
