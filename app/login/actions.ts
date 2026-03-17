'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()

    // type-casting here for convenience
    // in practice, use a schema validator like Zod
    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    const { error, data: authData } = await supabase.auth.signInWithPassword(data)

    if (error) {
        redirect(`/login?error=${encodeURIComponent(error.message)}`)
    }

    const rol = authData.user?.user_metadata?.rol

    revalidatePath('/', 'layout')
    if (rol === 'TECNICO') {
        redirect('/dashboard/tecnico')
    } else {
        redirect('/dashboard/usuario')
    }
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    const { error, data: authData } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: {
                rol: 'usuario', // default rol
            },
        },
    })

    if (error) {
        redirect(`/login?error=${encodeURIComponent(error.message)}`)
    }

    // Assuming email confirmations are turned off for smooth local development
    revalidatePath('/', 'layout')
    redirect('/dashboard/usuario')
}
