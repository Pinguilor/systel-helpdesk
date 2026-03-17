'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addStockAction(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'No autorizado' };

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
    if (profile?.rol?.toUpperCase() !== 'ADMIN' && profile?.rol?.toUpperCase() !== 'ADMIN_BODEGA') {
        return { error: 'Permisos insuficientes' };
    }

    const mode = formData.get('mode') as 'existing' | 'new';
    const bodegaId = formData.get('bodega_id') as string;
    const cantidad = Number(formData.get('cantidad'));
    const numeroSerie = formData.get('numero_serie') as string | null;

    if (!bodegaId || isNaN(cantidad)) {
        return { error: 'Faltan campos obligatorios básicos.' };
    }

    let catalogoId = formData.get('catalogo_id') as string;
    let esSerializado = formData.get('es_serializado') === 'true';

    try {
        // Step 1: Create new catalog item if requested
        if (mode === 'new') {
            const familia = formData.get('familia') as string;
            const modelo = formData.get('modelo') as string;
            
            if (!familia || !modelo) return { error: 'La familia y modelo son obligatorios para un nuevo registro.' };

            const { data: newCatalogo, error: catError } = await supabase
                .from('catalogo_equipos')
                .insert({
                    familia,
                    modelo,
                    es_serializado: esSerializado
                })
                .select()
                .single();

            if (catError) throw new Error(`Error creando catálogo: ${catError.message}`);
            catalogoId = newCatalogo.id;
        }

        // Validate serial logic
        if (esSerializado && !numeroSerie && cantidad === 1) {
            return { error: 'El número de serie es obligatorio para equipos serializados.' };
        }

        // Prevent adding multiple identical serials
        if (esSerializado && cantidad > 1) {
             return { error: 'Los equipos serializados deben ingresarse de a 1 indicando su número de serie respectivo.' };
        }

        // Step 2: Insert into inventory (Stock always inserts a new row with 'Disponible' initially)
        // If it's non-serialized, technically we could UPDATE an existing row instead of making a new one,
        // but often appending a new row is safer for lot tracking, or we just update the existing one.
        // Let's try to update if it's non-serialized and exists in the same bodega with exactly same properties.
        
        let stockInserted;

        if (!esSerializado) {
            const { data: existingStock, error: errFind } = await supabase
                .from('inventario')
                .select('id, cantidad')
                .eq('bodega_id', bodegaId)
                .eq('catalogo_id', catalogoId)
                .eq('estado', 'Disponible')
                .maybeSingle();
            
            if (existingStock) {
                const { data, error } = await supabase
                    .from('inventario')
                    .update({ cantidad: existingStock.cantidad + cantidad })
                    .eq('id', existingStock.id)
                    .select()
                    .single();
                if (error) throw new Error(`Error actualizando stock existente: ${error.message}`);
                stockInserted = data;
            } else {
                const { data, error } = await supabase
                    .from('inventario')
                    .insert({
                        bodega_id: bodegaId,
                        catalogo_id: catalogoId,
                        cantidad: cantidad,
                        estado: 'Disponible'
                    })
                    .select()
                    .single();
                if (error) throw new Error(`Error insertando nuevo stock: ${error.message}`);
                stockInserted = data;
            }
        } else {
            // Serialized: Must insert exact 1 quantity with serial
            const { data, error } = await supabase
                .from('inventario')
                .insert({
                    bodega_id: bodegaId,
                    catalogo_id: catalogoId,
                    cantidad: 1, // enforced
                    numero_serie: numeroSerie,
                    estado: 'Disponible'
                })
                .select()
                .single();
            if (error) throw new Error(`Error insertando stock serializado: ${error.message}`);
            stockInserted = data;
        }

        revalidatePath('/dashboard/admin/bodegas');
        return { success: true };
    } catch (err: any) {
        return { error: err.message };
    }
}
