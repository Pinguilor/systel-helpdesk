'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const RUTA = '/dashboard/configuracion/usuarios';

// ─── Admin Client (Service Role Key — bypasses RLS) ──────────
function getAdminClient() {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) throw new Error('Faltan variables de entorno de Supabase Admin.');
    return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ─── Guard: Solo ADMIN puede gestionar usuarios ───────────────
async function assertAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };

    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'ADMIN') {
        return { error: 'Solo el administrador puede gestionar usuarios.' };
    }
    return { user };
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR todos los usuarios (Auth users + profiles join)
// ─────────────────────────────────────────────────────────────────────────────
export async function getUsuariosAction() {
    try {
        const guard = await assertAdmin();
        if (guard.error) return { error: guard.error, data: [] };

        const adminSupabase = getAdminClient();

        // 1. Obtener todos los usuarios de auth.users (incluye email, created_at)
        //    listUsers devuelve paginado; traemos hasta 1000
        const { data: authData, error: authError } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 });
        if (authError) throw new Error(authError.message);

        // 2. Obtener todos los perfiles (rol, full_name) — usamos admin para bypass RLS
        const { data: profiles, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id, full_name, rol');
        if (profileError) throw new Error(profileError.message);

        // 3. Combinar: auth user (email, created_at) + profile (full_name, rol)
        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

        const usuarios = (authData.users ?? []).map(authUser => {
            const profile = profileMap.get(authUser.id);
            return {
                id:         authUser.id,
                email:      authUser.email ?? null,
                full_name:  profile?.full_name ?? authUser.user_metadata?.full_name ?? null,
                rol:        profile?.rol       ?? authUser.user_metadata?.rol       ?? null,
                created_at: authUser.created_at ?? null,
            };
        });

        // Ordenar: más reciente primero
        usuarios.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

        return { data: usuarios };
    } catch (e: any) {
        return { error: e.message, data: [] };
    }
}

// ─────────────────────────────────────────────────────────────
// CREAR usuario (Admin Auth API — no afecta la sesión actual)
// ─────────────────────────────────────────────────────────────
export async function crearUsuarioAction(formData: FormData) {
    try {
        const guard = await assertAdmin();
        if (guard.error) return { error: guard.error };

        const nombre     = (formData.get('nombre')     as string)?.trim();
        const email      = (formData.get('email')      as string)?.trim();
        const rol        = (formData.get('rol')        as string)?.trim().toLowerCase();
        const cliente_id = (formData.get('cliente_id') as string)?.trim() || null;

        if (!nombre || !email || !rol) {
            return { error: 'Nombre, correo y rol son obligatorios.' };
        }
        // Si el rol es 'usuario', debe tener empresa asignada
        if (rol === 'usuario' && !cliente_id) {
            return { error: 'Los usuarios externos deben tener una empresa asignada.' };
        }

        const PASSWORD_DEFAULT = 'SystelPassword';
        const adminSupabase    = getAdminClient();

        // 1. Crear usuario en Auth con contraseña por defecto
        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
            email,
            password:      PASSWORD_DEFAULT,
            email_confirm: true,
            user_metadata: { full_name: nombre, rol },
        });

        if (authError) throw new Error(authError.message);
        if (!authData.user) throw new Error('No se pudo crear el usuario en Auth.');

        const uid = authData.user.id;

        // 2. Upsert en public.profiles — marca debe_cambiar_password para forzar cambio en primer login
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .upsert({
                id:                    uid,
                full_name:             nombre,
                rol:                   rol,
                cliente_id:            rol === 'usuario' ? cliente_id : null,
                debe_cambiar_password: true,
            }, { onConflict: 'id' });

        if (profileError) {
            await adminSupabase.auth.admin.deleteUser(uid);
            throw new Error(`Error al crear el perfil: ${profileError.message}`);
        }

        revalidatePath(RUTA);
        return { success: true, defaultPassword: PASSWORD_DEFAULT };
    } catch (e: any) {
        return { error: e.message || 'Error interno al crear el usuario.' };
    }
}

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR nombre y rol de un usuario existente
// ─────────────────────────────────────────────────────────────
export async function actualizarUsuarioAction(formData: FormData) {
    try {
        const guard = await assertAdmin();
        if (guard.error) return { error: guard.error };

        const id         = (formData.get('id')         as string)?.trim();
        const nombre     = (formData.get('nombre')     as string)?.trim();
        const rol        = (formData.get('rol')        as string)?.trim().toLowerCase();
        const cliente_id = (formData.get('cliente_id') as string)?.trim() || null;

        if (!id || !nombre || !rol) {
            return { error: 'ID, nombre y rol son obligatorios.' };
        }
        if (rol === 'usuario' && !cliente_id) {
            return { error: 'Los usuarios externos deben tener una empresa asignada.' };
        }

        const adminSupabase = getAdminClient();

        // 1. Actualizar user_metadata en Auth
        const { error: authError } = await adminSupabase.auth.admin.updateUserById(id, {
            user_metadata: { full_name: nombre, rol },
        });
        if (authError) throw new Error(`Error Auth: ${authError.message}`);

        // 2. Actualizar public.profiles (incluyendo cliente_id)
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .update({
                full_name:  nombre,
                rol:        rol,
                cliente_id: rol === 'usuario' ? cliente_id : null,
            })
            .eq('id', id);

        if (profileError) throw new Error(`Error perfil: ${profileError.message}`);

        revalidatePath(RUTA);
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error interno al actualizar el usuario.' };
    }
}

// ─────────────────────────────────────────────────────────────
// BLANQUEAR contraseña: genera clave temporal y fuerza cambio
// ─────────────────────────────────────────────────────────────
export async function blanquearPasswordAction(userId: string) {
    try {
        const guard = await assertAdmin();
        if (guard.error) return { error: guard.error };

        // Generar contraseña temporal: 8 chars alfanuméricos + sufijo fijo para cumplir requisitos
        const tempPassword = Math.random().toString(36).slice(-8).toUpperCase() + 'a1!';

        const adminSupabase = getAdminClient();

        // 1. Actualizar contraseña en Auth
        const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
            password: tempPassword,
        });
        if (authError) throw new Error(`Error Auth: ${authError.message}`);

        // 2. Marcar que debe cambiar contraseña en el próximo login
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .update({ debe_cambiar_password: true })
            .eq('id', userId);
        if (profileError) throw new Error(`Error perfil: ${profileError.message}`);

        revalidatePath(RUTA);
        return { success: true, tempPassword };
    } catch (e: any) {
        return { error: e.message || 'Error interno al blanquear la contraseña.' };
    }
}

// ─────────────────────────────────────────────────────────────
// ELIMINAR usuario completamente (Auth + profiles)
// Limpia FK constraints antes de borrar para evitar errores de BD
// ─────────────────────────────────────────────────────────────
export async function eliminarUsuarioAction(userId: string) {
    try {
        const guard = await assertAdmin();
        if (guard.error) return { error: guard.error };

        // No se puede borrar a uno mismo
        if (guard.user?.id === userId) {
            return { error: 'No puedes eliminar tu propia cuenta de administrador.' };
        }

        const adminSupabase = getAdminClient();

        // ── Paso 1: Nullificar referencias en tablas que permiten NULL ──
        // tickets donde fue agente asignado (no borramos el ticket, solo desvinculamos)
        await adminSupabase.from('tickets')
            .update({ agente_asignado_id: null })
            .eq('agente_asignado_id', userId);

        // Solicitudes donde fue bodeguero
        await adminSupabase.from('solicitudes_materiales')
            .update({ bodeguero_id: null })
            .eq('bodeguero_id', userId);

        // Bodegas tipo MOCHILA asignadas al técnico
        await adminSupabase.from('bodegas')
            .update({ tecnico_id: null })
            .eq('tecnico_id', userId);

        // ── Paso 2: Borrar registros propiedad del usuario ──────────────
        // Notificaciones del usuario
        await adminSupabase.from('notifications')
            .delete()
            .eq('user_id', userId);

        // ── Paso 3: Borrar perfil explícitamente (antes que auth) ────────
        await adminSupabase.from('profiles')
            .delete()
            .eq('id', userId);

        // ── Paso 4: Borrar de auth.users (ahora sin FKs bloqueantes) ────
        const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);
        if (deleteError) throw new Error(deleteError.message);

        revalidatePath(RUTA);
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error interno al eliminar el usuario.' };
    }
}
