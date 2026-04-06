'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

/** Returns the authenticated user only if they are ADMIN. */
async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle();
    if (profile?.rol?.toUpperCase() !== 'ADMIN') return null;
    return user;
}

// ── Stock ingress ─────────────────────────────────────────────

export async function addStockToBodegaAction(formData: FormData) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();

    const bodegaId    = formData.get('bodega_id') as string;
    const modelo      = (formData.get('modelo') as string)?.trim();
    const familia     = (formData.get('familia') as string)?.trim();
    const esSerial    = formData.get('es_serializado') === 'true';
    const serialesRaw = formData.get('seriales') as string | null;
    const cantidadRaw = parseInt(formData.get('cantidad') as string, 10);

    if (!bodegaId || !modelo || !familia) return { error: 'Datos incompletos.' };

    if (esSerial) {
        const seriales: string[] = serialesRaw ? JSON.parse(serialesRaw) : [];
        if (seriales.length === 0) return { error: 'Debes ingresar al menos un número de serie.' };

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
            console.error('[addStockToBodegaAction] serial insert:', error.message);
            return { error: 'No se pudieron registrar los equipos.' };
        }
    } else {
        if (isNaN(cantidadRaw) || cantidadRaw < 1) return { error: 'La cantidad debe ser al menos 1.' };

        const { data: existing } = await db
            .from('inventario')
            .select('id, cantidad')
            .eq('bodega_id', bodegaId)
            .eq('modelo', modelo)
            .eq('es_serializado', false)
            .is('ticket_id', null)
            .maybeSingle();

        if (existing) {
            const { error } = await db
                .from('inventario')
                .update({ cantidad: (existing as any).cantidad + cantidadRaw })
                .eq('id', (existing as any).id);
            if (error) {
                console.error('[addStockToBodegaAction] update:', error.message);
                return { error: 'No se pudo actualizar el stock.' };
            }
        } else {
            const { error } = await db.from('inventario').insert({
                bodega_id: bodegaId, modelo, familia,
                es_serializado: false, cantidad: cantidadRaw, estado: 'Disponible',
            });
            if (error) {
                console.error('[addStockToBodegaAction] insert:', error.message);
                return { error: 'No se pudo registrar el equipo.' };
            }
        }
    }

    revalidatePath(`/dashboard/configuracion/bodegas/${bodegaId}`);
    return { success: true };
}

// ── Ajustar stock genérico ────────────────────────────────────

export async function ajustarStockAction(inventarioId: string, nuevaCantidad: number) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };
    if (isNaN(nuevaCantidad) || nuevaCantidad < 0) return { error: 'Cantidad inválida.' };

    const db = createAdminClient();

    const { data: item } = await db
        .from('inventario').select('bodega_id').eq('id', inventarioId).maybeSingle();

    const { error } = await db
        .from('inventario').update({ cantidad: nuevaCantidad }).eq('id', inventarioId);

    if (error) {
        console.error('[ajustarStockAction]', error.message);
        return { error: 'No se pudo ajustar el stock.' };
    }

    if ((item as any)?.bodega_id) revalidatePath(`/dashboard/configuracion/bodegas/${(item as any).bodega_id}`);
    return { success: true };
}

// ── Dar de baja seriales (eliminar filas seleccionadas) ───────

export async function darBajaSeriesAction(bodegaId: string, inventarioIds: string[]) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };
    if (!inventarioIds.length) return { error: 'Selecciona al menos un serial.' };

    const db = createAdminClient();

    const { error } = await db
        .from('inventario')
        .delete()
        .in('id', inventarioIds);

    if (error) {
        // FK constraint: item referenced in tickets — soft delete instead
        if (error.code === '23503') {
            await db
                .from('inventario')
                .update({ cantidad: 0, estado: 'Inactivo' })
                .in('id', inventarioIds);
            revalidatePath(`/dashboard/configuracion/bodegas/${bodegaId}`);
            return { softDeleted: true };
        }
        console.error('[darBajaSeriesAction]', error.message);
        return { error: 'No se pudieron dar de baja los seriales.' };
    }

    revalidatePath(`/dashboard/configuracion/bodegas/${bodegaId}`);
    return { success: true };
}

// ── Quitar grupo completo de bodega ───────────────────────────

export async function quitarGrupoBodegaAction(bodegaId: string, inventarioIds: string[]) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };
    if (!inventarioIds.length) return { error: 'Sin ítems que eliminar.' };

    const db = createAdminClient();

    const { error } = await db
        .from('inventario')
        .delete()
        .in('id', inventarioIds);

    if (error) {
        // FK constraint: some items referenced in tickets — soft delete instead
        if (error.code === '23503') {
            await db
                .from('inventario')
                .update({ cantidad: 0, estado: 'Inactivo' })
                .in('id', inventarioIds);
            revalidatePath(`/dashboard/configuracion/bodegas/${bodegaId}`);
            return { softDeleted: true };
        }
        console.error('[quitarGrupoBodegaAction]', error.message);
        return { error: 'No se pudo quitar el equipo de la bodega.' };
    }

    revalidatePath(`/dashboard/configuracion/bodegas/${bodegaId}`);
    return { success: true };
}

// ── Familias CRUD ─────────────────────────────────────────────

export async function eliminarFamiliaAction(id: string) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();

    // Verify no models in catalogo_equipos reference this family
    const { data: modelos } = await db
        .from('catalogo_equipos')
        .select('id')
        .eq('familia_id', id)
        .limit(1);

    if ((modelos ?? []).length > 0) {
        return { error: 'No puedes eliminar una familia que tiene modelos registrados.' };
    }

    // Verify no inventory rows reference this family (by name)
    const { data: familiaRow } = await db
        .from('familias_hardware')
        .select('nombre')
        .eq('id', id)
        .maybeSingle();

    if (familiaRow?.nombre) {
        const { data: invCheck } = await db
            .from('inventario')
            .select('id')
            .eq('familia', familiaRow.nombre)
            .limit(1);

        if ((invCheck ?? []).length > 0) {
            return { error: 'No puedes eliminar una familia que tiene equipos en el inventario.' };
        }
    }

    const { error } = await db
        .from('familias_hardware')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[eliminarFamiliaAction]', error.message);
        return { error: 'No se pudo eliminar la familia.' };
    }

    revalidatePath('/dashboard/configuracion/bodegas');
    return { success: true };
}

export async function crearFamiliaAction(nombre: string) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const n = nombre.trim();
    if (!n) return { error: 'El nombre no puede estar vacío.' };

    const db = createAdminClient();
    const { error } = await db.from('familias_hardware').insert({ nombre: n });
    if (error) {
        if (error.code === '23505') return { error: 'Ya existe una familia con ese nombre.' };
        console.error('[crearFamiliaAction]', error.message);
        return { error: 'No se pudo crear la familia.' };
    }

    revalidatePath('/dashboard/configuracion/bodegas');
    return { success: true };
}

export async function editarFamiliaAction(id: string, nombre: string) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const n = nombre.trim();
    if (!n) return { error: 'El nombre no puede estar vacío.' };

    const db = createAdminClient();
    const { error } = await db
        .from('familias_hardware').update({ nombre: n }).eq('id', id);

    if (error) {
        console.error('[editarFamiliaAction]', error.message);
        return { error: 'No se pudo actualizar la familia.' };
    }

    revalidatePath('/dashboard/configuracion/bodegas');
    return { success: true };
}

// ── Catálogo de modelos ───────────────────────────────────────

export async function crearModeloCatalogoAction(familiaId: string, modelo: string, esSerializado: boolean) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const m = modelo.trim();
    if (!m || !familiaId) return { error: 'Datos incompletos.' };

    const db = createAdminClient();
    const { error } = await db.from('catalogo_equipos').insert({
        familia_id: familiaId,
        modelo: m,
        es_serializado: esSerializado,
    });

    if (error) {
        if (error.code === '23505') return { error: 'Ya existe ese modelo en esta familia.' };
        if (error.code === 'PGRST205' || error.message?.includes('catalogo_equipos')) {
            return { error: 'La tabla catalogo_equipos no existe. Ejecuta sql/create_catalogo_equipos.sql en Supabase.' };
        }
        console.error('[crearModeloCatalogoAction]', error.message);
        return { error: 'No se pudo crear el modelo.' };
    }

    revalidatePath('/dashboard/configuracion/bodegas');
    return { success: true };
}
