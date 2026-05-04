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
    // Present only when user picked "+ Crear nuevo" from the combobox
    const familiaId   = (formData.get('familia_id') as string | null) ?? null;

    if (!bodegaId || !modelo || !familia) return { error: 'Datos incompletos.' };

    // ── Upsert catalog entry with bodega_id (prevents orphan rows) ────────────
    // Only runs for new-model creations (familiaId is passed from the frontend).
    // Uses ON CONFLICT (familia_id, modelo) to update bodega_id if the row already
    // exists without it (e.g. created via a trigger or an earlier flow).
    if (familiaId) {
        const { error: catError } = await db
            .from('catalogo_equipos')
            .upsert(
                { familia_id: familiaId, modelo, es_serializado: esSerial, bodega_id: bodegaId },
                { onConflict: 'familia_id,modelo' }
            );
        if (catError) {
            console.error('[addStockToBodegaAction] catalogo upsert:', catError.message);
            return { error: 'No se pudo registrar el modelo en el catálogo.' };
        }
    }

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

// ── Modelos catálogo CRUD extra ───────────────────────────────

export async function editarModeloCatalogoAction(id: string, modelo: string, bodegaId: string) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const nuevoNombre = modelo.trim();
    if (!nuevoNombre) return { error: 'El nombre no puede estar vacío.' };

    const db = createAdminClient();

    // 1. Obtener nombre actual antes de sobrescribir
    const { data: modeloRow } = await db
        .from('catalogo_equipos')
        .select('modelo')
        .eq('id', id)
        .maybeSingle();

    if (!modeloRow) return { error: 'Modelo no encontrado.' };
    const nombreAntiguo = modeloRow.modelo as string;

    // 2. Actualizar diccionario (catalogo_equipos) y stock físico (inventario) en paralelo
    const [catalogoRes, inventarioRes] = await Promise.all([
        db.from('catalogo_equipos')
            .update({ modelo: nuevoNombre })
            .eq('id', id),
        db.from('inventario')
            .update({ modelo: nuevoNombre })
            .eq('modelo', nombreAntiguo)
            .eq('bodega_id', bodegaId),
    ]);

    if (catalogoRes.error) {
        if (catalogoRes.error.code === '23505') return { error: 'Ya existe ese modelo en esta familia.' };
        console.error('[editarModeloCatalogoAction] catalogo:', catalogoRes.error.message);
        return { error: 'No se pudo actualizar el modelo.' };
    }

    if (inventarioRes.error) {
        console.error('[editarModeloCatalogoAction] inventario:', inventarioRes.error.message);
        return { error: 'Catálogo actualizado pero falló la sincronización con el inventario físico.' };
    }

    revalidatePath(`/dashboard/configuracion/bodegas/${bodegaId}`);
    return { success: true };
}

export async function eliminarModeloCatalogoAction(id: string, bodegaId: string) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();

    // Lookup modelo name to check stock
    const { data: modeloRow } = await db
        .from('catalogo_equipos')
        .select('modelo')
        .eq('id', id)
        .maybeSingle();

    if (!modeloRow) return { error: 'Modelo no encontrado.' };

    // Block deletion only if items are physically present and available in this bodega.
    // Mirrors the exact same filters used by the UI inventory query (page.tsx):
    //   - eq('estado','Disponible') → excludes dispatched serials (Operativo, cantidad=1)
    //   - is('ticket_id', null)     → excludes items reserved to a ticket (hidden in UI)
    // Without ticket_id filter, serialized models show "Sin ingresos" in UI but the check
    // still finds Disponible rows with ticket_id set, causing a false-positive block.
    const { data: stockCheck } = await db
        .from('inventario')
        .select('id')
        .eq('bodega_id', bodegaId)
        .eq('modelo', modeloRow.modelo)
        .eq('estado', 'Disponible')
        .is('ticket_id', null)
        .gt('cantidad', 0)
        .limit(1);

    if ((stockCheck ?? []).length > 0) {
        return { error: 'No puedes eliminar un modelo que tiene stock físico en bodega. Ajusta el stock a 0 primero.' };
    }

    // A. Best-effort purge of ghost rows only (no usable stock, no active ticket assignment).
    // Never touch rows with ticket_id set — those are historical dispatched items with FK refs.
    // This step is non-fatal: inventario uses texto fields for modelo/familia (no FK to
    // catalogo_equipos), so the catalog entry can be deleted even if ghost rows remain.
    const { error: invError } = await db
        .from('inventario')
        .delete()
        .eq('modelo', modeloRow.modelo)
        .eq('bodega_id', bodegaId)
        .is('ticket_id', null);

    if (invError) {
        if (invError.code === '23503') {
            // FK reference exists — soft-delete ghost rows instead of hard-delete
            await db
                .from('inventario')
                .update({ cantidad: 0, estado: 'Inactivo' })
                .eq('modelo', modeloRow.modelo)
                .eq('bodega_id', bodegaId)
                .is('ticket_id', null);
        } else {
            console.warn('[eliminarModeloCatalogoAction] inventario cleanup non-fatal:', invError.message);
        }
        // Always continue — catalog entry delete does not require inventario cleanup
    }

    // B. Remove the model from the catalog dictionary
    const { error } = await db
        .from('catalogo_equipos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[eliminarModeloCatalogoAction]', error.message);
        return { error: 'No se pudo eliminar el modelo.' };
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

export async function crearFamiliaAction(nombre: string, bodegaId: string) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const n = nombre.trim();
    if (!n) return { error: 'El nombre no puede estar vacío.' };
    if (!bodegaId) return { error: 'Bodega no especificada.' };

    const db = createAdminClient();
    const { error } = await db.from('familias_hardware').insert({ nombre: n, bodega_id: bodegaId });
    if (error) {
        if (error.code === '23505') return { error: 'Ya existe una familia con ese nombre en esta bodega.' };
        console.error('[crearFamiliaAction]', error.message);
        return { error: 'No se pudo crear la familia.' };
    }

    revalidatePath(`/dashboard/configuracion/bodegas/${bodegaId}`);
    return { success: true };
}

export async function editarFamiliaAction(id: string, nombre: string, bodegaId: string) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const n = nombre.trim();
    if (!n) return { error: 'El nombre no puede estar vacío.' };

    const db = createAdminClient();

    // 1. Capturar el nombre antiguo antes de sobrescribir
    const { data: familiaRow } = await db
        .from('familias_hardware').select('nombre').eq('id', id).maybeSingle();

    if (!familiaRow) return { error: 'Familia no encontrada.' };
    const nombreAntiguo = familiaRow.nombre as string;

    // 2. Actualizar familias_hardware e inventario en paralelo (cascada)
    const [familiaRes, inventarioRes] = await Promise.all([
        db.from('familias_hardware').update({ nombre: n }).eq('id', id),
        db.from('inventario')
            .update({ familia: n })
            .eq('familia', nombreAntiguo)
            .eq('bodega_id', bodegaId),
    ]);

    if (familiaRes.error) {
        if (familiaRes.error.code === '23505') return { error: 'Ya existe una familia con ese nombre.' };
        console.error('[editarFamiliaAction] familia:', familiaRes.error.message);
        return { error: 'No se pudo actualizar la familia.' };
    }

    if (inventarioRes.error) {
        console.error('[editarFamiliaAction] inventario:', inventarioRes.error.message);
        return { error: 'Familia actualizada pero falló la sincronización con el inventario físico.' };
    }

    revalidatePath(`/dashboard/configuracion/bodegas/${bodegaId}`);
    return { success: true };
}

// ── Catálogo de modelos ───────────────────────────────────────

export async function crearModeloCatalogoAction(familiaId: string, modelo: string, esSerializado: boolean, bodegaId: string) {
    const user = await requireAdmin();
    if (!user) return { error: 'No autorizado.' };

    const m = modelo.trim();
    if (!m || !familiaId) return { error: 'Datos incompletos.' };
    if (!bodegaId) return { error: 'Bodega no especificada.' };

    const db = createAdminClient();
    const { error } = await db.from('catalogo_equipos').insert({
        familia_id: familiaId,
        modelo: m,
        es_serializado: esSerializado,
        bodega_id: bodegaId,
    });

    if (error) {
        if (error.code === '23505') return { error: 'Ya existe ese modelo en esta familia.' };
        if (error.code === 'PGRST205' || error.message?.includes('catalogo_equipos')) {
            return { error: 'La tabla catalogo_equipos no existe. Ejecuta sql/create_catalogo_equipos.sql en Supabase.' };
        }
        console.error('[crearModeloCatalogoAction]', error.message);
        return { error: 'No se pudo crear el modelo.' };
    }

    revalidatePath(`/dashboard/configuracion/bodegas/${bodegaId}`);
    return { success: true };
}
