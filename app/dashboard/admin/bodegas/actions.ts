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

    const bodegaId = formData.get('bodega_id') as string;
    const mode = formData.get('mode') as string; // 'existing' | 'new'

    if (!bodegaId) {
        return { error: 'Falta la bodega de destino.' };
    }

    try {
        // Validar que la bodega elegida de hecho pertenezca a Central o Dañados
        const { data: bodegaDestino } = await supabase.from('bodegas').select('tipo').eq('id', bodegaId).maybeSingle();
        if (!bodegaDestino || !['CENTRAL', 'DAÑADOS'].includes(bodegaDestino.tipo?.toUpperCase() || '')) {
            return { error: 'Bodega de destino inválida o no permitida.' };
        }

        if (mode === 'existing') {
            const inventarioId = formData.get('inventario_id') as string;
            
            if (!inventarioId) {
                return { error: 'Debe seleccionar un equipo existente.' };
            }

            // Fetch current equipment details
            const { data: existingStock, error: errStock } = await supabase
                .from('inventario')
                .select('id, cantidad, es_serializado, modelo, familia')
                .eq('id', inventarioId)
                .maybeSingle();
            
            if (errStock || !existingStock) throw new Error('Equipo no encontrado en inventario');
            
            if (existingStock.es_serializado) {
                const nuevoSerieBruto = formData.get('nuevo_numero_serie') as string;
                if (!nuevoSerieBruto) {
                    return { error: 'El número de serie es obligatorio para ingresar un nuevo equipo serializado.' };
                }
                const serieLimpia = nuevoSerieBruto.trim();
                
                if (serieLimpia.length < 5) {
                    return { error: 'El número de serie debe tener al menos 5 caracteres.' };
                }

                // Insertar nueva fila en lugar de updatear
                const { error: insertErr } = await supabase
                    .from('inventario')
                    .insert({
                        bodega_id: bodegaId,
                        modelo: existingStock.modelo,
                        familia: existingStock.familia,
                        cantidad: 1,
                        es_serializado: true,
                        numero_serie: serieLimpia,
                        estado: 'Disponible'
                    });
                
                if (insertErr) throw insertErr;
            } else {
                const cantidadToAdd = Number(formData.get('cantidad'));
                if (isNaN(cantidadToAdd) || cantidadToAdd <= 0) {
                    return { error: 'Debe especificar una cantidad válida a sumar.' };
                }

                const { error: updateErr } = await supabase
                    .from('inventario')
                    .update({ cantidad: existingStock.cantidad + cantidadToAdd })
                    .eq('id', inventarioId);
                
                if (updateErr) throw updateErr;
            }

        } else if (mode === 'new') {
            const cantidad = Number(formData.get('cantidad'));
            const numeroSerie = formData.get('numero_serie') as string | null;
            let esSerializado = formData.get('es_serializado') === 'true';
            const modelo = formData.get('modelo') as string;
            const familia = formData.get('familia') as string;

            if (isNaN(cantidad) || cantidad <= 0 || !modelo || !familia) {
                return { error: 'Faltan campos obligatorios para el nuevo equipo (modelo, familia, cantidad).' };
            }

            // Validaciones Seriales
            let serieLimpiaNuevo = numeroSerie ? numeroSerie.trim() : null;

            if (esSerializado) {
                if (!serieLimpiaNuevo) {
                    return { error: 'El número de serie es obligatorio para equipos serializados.' };
                }
                if (serieLimpiaNuevo.length < 5) {
                    return { error: 'El número de serie debe tener al menos 5 caracteres.' };
                }
                if (cantidad > 1) {
                    return { error: 'Los equipos serializados deben ingresarse de a 1 indicando su respectivo número de serie.' };
                }
            }

            const { error: insertErr } = await supabase
                .from('inventario')
                .insert({
                    bodega_id: bodegaId,
                    modelo,
                    familia,
                    cantidad: esSerializado ? 1 : cantidad,
                    es_serializado: esSerializado,
                    numero_serie: serieLimpiaNuevo,
                    estado: 'Disponible'
                });
            
            if (insertErr) throw insertErr;
        }

        revalidatePath('/dashboard/admin/bodegas');
        return { success: true };
    } catch (err: any) {
        return { error: err.message };
    }
}
