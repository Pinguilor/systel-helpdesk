'use server';

import { createClient } from '@/lib/supabase/server';

export async function createMochilaAction(tecnicoId: string, tecnicoName: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    // Validar permisos (Admins o Coordinadores)
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).maybeSingle();
    const isAllowed = ['ADMIN', 'COORDINADOR'].includes(profile?.rol?.toUpperCase() || '');
    if (!isAllowed) return { error: 'Solo administradores pueden crear mochilas virtuales.' };

    // Verificar que el técnico no tenga ya una mochila
    const { data: existing } = await supabase.from('bodegas').select('id').eq('tecnico_id', tecnicoId).eq('tipo', 'MOCHILA').maybeSingle();
    if (existing) return { error: 'Este técnico ya tiene una mochila asignada.' };

    // Crear la mochila
    const { error: insertError } = await supabase.from('bodegas').insert({
        nombre: `Mochila - ${tecnicoName}`,
        tipo: 'MOCHILA',
        tecnico_id: tecnicoId
    });

    if (insertError) return { error: 'Error al inicializar la mochila: ' + insertError.message };

    return { success: true };
}

export async function assignToMochilaAction(bodegaDestinoId: string, inventarioId: string, cantidad: number, serialIds?: string[]) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('Usuario no autorizado o sesión expirada.');

        if (serialIds && serialIds.length > 0) {
            // Flujo Serializado (Masivo)
            const { data: centralItems, error: fetchErr } = await supabase
                .from('inventario')
                .select('id, bodega_id')
                .in('id', serialIds);
                
            if (fetchErr) throw new Error(`Error buscando stock a transferir: ${fetchErr.message}`);
            
            const { error: updateErr } = await supabase
                .from('inventario')
                .update({ bodega_id: bodegaDestinoId })
                .in('id', serialIds);
                
            if (updateErr) throw new Error(`Error en transferencia masiva: ${updateErr.message}`);
            
            const movimientos = (centralItems || []).map(item => ({
                inventario_id: item.id,
                bodega_origen_id: item.bodega_id,
                bodega_destino_id: bodegaDestinoId,
                cantidad: 1,
                tipo_movimiento: 'ASIGNACION',
                realizado_por: user.id
            }));
            
            if (movimientos.length > 0) {
                const { error: moveErr } = await supabase.from('movimientos_inventario').insert(movimientos);
                if (moveErr) throw new Error(`Error registrando movimientos masivos: ${moveErr.message}`);
            }
            
            return { success: true };
        }

        // Flujo Genérico
        // 1. Validar Stock Original
        const { data: centralStock, error: fetchCentralErr } = await supabase
            .from('inventario')
            .select('*')
            .eq('id', inventarioId)
            .maybeSingle();

        if (fetchCentralErr) throw new Error(`Error buscando stock central: ${fetchCentralErr.message}`);
        if (!centralStock) throw new Error('El registro de inventario seleccionado ya no existe.');
        if (centralStock.cantidad < cantidad) throw new Error(`Stock insuficiente. Solicitado: ${cantidad}, Disponible: ${centralStock.cantidad}`);

        // 2. Descontar de Central
        const newCentralAmount = centralStock.cantidad - cantidad;
        const { error: updateCentralErr } = await supabase
            .from('inventario')
            .update({ cantidad: newCentralAmount })
            .eq('id', centralStock.id);

        if (updateCentralErr) throw new Error(`Fallo descontando inventario central: ${updateCentralErr.message}`);

        // 3. Buscar o Crear en Mochila Destino
        const { data: mochilaStock, error: fetchMochilaErr } = await supabase
            .from('inventario')
            .select('id, cantidad')
            .eq('bodega_id', bodegaDestinoId)
            .eq('modelo', centralStock.modelo)
            .eq('familia', centralStock.familia)
            .limit(1)
            .maybeSingle();

        if (fetchMochilaErr) throw new Error(`Error verificando destino: ${fetchMochilaErr.message}`);

        let targetInventarioId = '';

        if (mochilaStock) {
            // Actualizar fila existente
            targetInventarioId = mochilaStock.id;
            const newMochilaAmount = mochilaStock.cantidad + cantidad;
            const { error: updateMochilaErr } = await supabase
                .from('inventario')
                .update({ cantidad: newMochilaAmount })
                .eq('bodega_id', bodegaDestinoId)
                .eq('modelo', centralStock.modelo)
                .eq('familia', centralStock.familia);

            if (updateMochilaErr) throw new Error(`Error actualizando mochila: ${updateMochilaErr.message}`);
        } else {
            // Insertar nueva fila clonando
            const { data: insertRes, error: insertMochilaErr } = await supabase
                .from('inventario')
                .insert({
                    bodega_id: bodegaDestinoId,
                    modelo: centralStock.modelo,
                    familia: centralStock.familia,
                    es_serializado: centralStock.es_serializado,
                    estado: 'Disponible',
                    cantidad: cantidad
                })
                .select('id')
                .single();

            if (insertMochilaErr) throw new Error(`Error insertando en mochila: ${insertMochilaErr.message}`);
            targetInventarioId = insertRes.id;
        }

        // 4. Registro de Auditoría
        const { error: moveErr } = await supabase
            .from('movimientos_inventario')
            .insert({
                inventario_id: targetInventarioId,
                bodega_origen_id: centralStock.bodega_id,
                bodega_destino_id: bodegaDestinoId,
                cantidad: cantidad,
                tipo_movimiento: 'ASIGNACION',
                realizado_por: user.id
            });

        if (moveErr) throw new Error(`Error registrando movimiento: ${moveErr.message}`);

        return { success: true };

    } catch (e: any) {
        return { success: false, error: e.message || 'Error interno del servidor finalizando transferencia.' };
    }
}

export async function returnFromMochilaAction(inventarioId: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) throw new Error('Usuario no autorizado o sesión expirada.');

        // 1. Get current backpack stock
        const { data: mochilaStock, error: fetchMochilaErr } = await supabase
            .from('inventario')
            .select('*')
            .eq('id', inventarioId)
            .maybeSingle();

        if (fetchMochilaErr) throw new Error(`Error verificando inventario en mochila: ${fetchMochilaErr.message}`);
        if (!mochilaStock || mochilaStock.cantidad <= 0) throw new Error('No hay registro válido o cantidad para devolver');

        // 2. Get Central Bodega
        const { data: centralBodega, error: fetchCentralErr } = await supabase
            .from('bodegas')
            .select('id')
            .ilike('tipo', 'central')
            .limit(1)
            .maybeSingle();
            
        if (fetchCentralErr) throw new Error(`Error encontrando bodega central: ${fetchCentralErr.message}`);
        if (!centralBodega) throw new Error('No se encontró Bodega Central configurada en el sistema.');

        let logInventarioId = inventarioId;

        if (mochilaStock.es_serializado) {
            // Bypass math logic for serialization
            const { error: moveErr } = await supabase.from('inventario')
                .update({ bodega_id: centralBodega.id })
                .eq('id', mochilaStock.id);
            if (moveErr) throw new Error(`Fallo devolviendo equipo serializado a central: ${moveErr.message}`);
        } else {
            // 3. Add to Central
            const { data: centralStock, error: centralFindErr } = await supabase
                .from('inventario')
                .select('id, cantidad')
                .eq('bodega_id', centralBodega.id)
                .eq('modelo', mochilaStock.modelo)
                .eq('familia', mochilaStock.familia)
                .limit(1)
                .maybeSingle();

            if (centralFindErr) throw new Error(`Error buscando stock cruzado en central: ${centralFindErr.message}`);

            if (centralStock) {
                const { error: updateCentralErr } = await supabase
                    .from('inventario')
                    .update({ cantidad: centralStock.cantidad + mochilaStock.cantidad })
                    .eq('bodega_id', centralBodega.id)
                    .eq('modelo', mochilaStock.modelo)
                    .eq('familia', mochilaStock.familia);
                if (updateCentralErr) throw new Error(`Error retornando cantidad a central: ${updateCentralErr.message}`);
                logInventarioId = centralStock.id;
            } else {
                const cloneData: any = {
                    bodega_id: centralBodega.id,
                    modelo: mochilaStock.modelo,
                    familia: mochilaStock.familia,
                    es_serializado: mochilaStock.es_serializado,
                    numero_serie: mochilaStock.numero_serie || null,
                    estado: 'Disponible',
                    cantidad: mochilaStock.cantidad
                };
                
                if (mochilaStock.tipo !== undefined) cloneData.tipo = mochilaStock.tipo;
                if (mochilaStock.descripcion !== undefined) cloneData.descripcion = mochilaStock.descripcion;

                const { data: insertRes, error: insertCentralErr } = await supabase
                    .from('inventario')
                    .insert(cloneData)
                    .select('id')
                    .single();
                if (insertCentralErr) throw new Error(`Error recreando inventario en central: ${insertCentralErr.message}`);
                logInventarioId = insertRes.id;
            }

            // 4. Subtract from Backpack completely
            const { error: updateMochilaErr } = await supabase
                .from('inventario')
                .update({ cantidad: 0 })
                .eq('id', inventarioId);

            if (updateMochilaErr) throw new Error(`Error vaciando cantidad en mochila local: ${updateMochilaErr.message}`);
        }

        // 5. Create Movement record
        const { error: moveErr } = await supabase
            .from('movimientos_inventario')
            .insert({
                inventario_id: logInventarioId,
                bodega_origen_id: mochilaStock.bodega_id,
                bodega_destino_id: centralBodega.id,
                cantidad: mochilaStock.cantidad,
                tipo_movimiento: 'DEVOLUCION',
                realizado_por: user.id
            });
            
        if (moveErr) throw new Error(`Fallo registrando log de devolución: ${moveErr.message}`);

        return { success: true };

    } catch (e: any) {
        return { success: false, error: e.message || 'Error interno durante la devolución del material.' };
    }
}
