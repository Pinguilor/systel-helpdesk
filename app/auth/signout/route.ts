import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = await createClient()

    // Check if a user's logged in
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (user) {
        await supabase.auth.signOut()
    }

    revalidatePath('/', 'layout')

    // Retornar 200 en lugar de redirect:
    // NextResponse.redirect crea un objeto de respuesta nuevo que NO hereda los
    // headers Set-Cookie de limpieza que supabase.auth.signOut() escribió via
    // next/headers cookies(). Al devolver 200, esos headers viajan correctamente
    // al navegador, y el cliente navega a /login con window.location.href.
    return new NextResponse(null, { status: 200 })
}
