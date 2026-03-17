import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
    const { supabaseResponse, user, supabase } = await updateSession(request)

    const url = request.nextUrl.clone()

    // Define redirect helper to preserve cookies
    const redirect = (destination: URL) => {
        const redirectResponse = NextResponse.redirect(destination)
        supabaseResponse.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie.name, cookie.value)
        })
        return redirectResponse
    }

    if ((url.pathname.startsWith('/dashboard') || url.pathname === '/') && !user) {
        url.pathname = '/login'
        return redirect(url)
    }

    if (user) {
        // Query the database directly for the real rol
        const { data: profile, error: dbError } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', user.id)
            .maybeSingle()

        // Fallback to metadata if profile is not found for some reason, 
        // but prefer database source of truth.
        const rawRol = profile?.rol || user.user_metadata?.rol;
        const rol = typeof rawRol === 'string' ? rawRol.toLowerCase() : '';

        console.log('-----------------------------------');
        console.log('MID-WARE ERROR DB:', dbError?.message);
        console.log('MID-WARE ROL EN BD:', profile?.rol);
        console.log('MID-WARE ROL EN METADATA:', user.user_metadata?.rol);
        console.log('MID-WARE ROL DECIDIDO:', rol);
        console.log('MID-WARE URL INTENTO:', url.pathname);
        console.log('-----------------------------------');

        if (url.pathname === '/login' || url.pathname === '/' || url.pathname === '/dashboard') {
            if (rol === 'tecnico') url.pathname = '/dashboard/tecnico'
            else if (rol === 'admin' || rol === 'coordinador') url.pathname = '/dashboard/admin'
            else if (rol === 'admin_bodega') url.pathname = '/dashboard/admin/bodegas'
            else url.pathname = '/dashboard/usuario'
            return redirect(url)
        }

        // Shared route bypass: All Roles can access generic /dashboard/ticket/[id]
        if (url.pathname.startsWith('/dashboard/ticket/')) {
            return supabaseResponse;
        }

        // Role Boundaries
        if (rol === 'coordinador') {
            if (url.pathname.startsWith('/dashboard/admin/bodegas')) {
                url.pathname = '/dashboard/admin'
                return redirect(url)
            }
            if (!url.pathname.startsWith('/dashboard/admin')) {
                url.pathname = '/dashboard/admin'
                return redirect(url)
            }
        } else if (rol === 'admin') {
            if (!url.pathname.startsWith('/dashboard/admin')) {
                url.pathname = '/dashboard/admin'
                return redirect(url)
            }
        } else if (rol === 'admin_bodega') {
            if (!url.pathname.startsWith('/dashboard/admin/bodegas')) {
                url.pathname = '/dashboard/admin/bodegas'
                return redirect(url)
            }
        } else if (rol === 'tecnico') {
            if (!url.pathname.startsWith('/dashboard/tecnico')) {
                url.pathname = '/dashboard/tecnico'
                return redirect(url)
            }
        } else {
            // Usuario rol por defecto
            if (!url.pathname.startsWith('/dashboard/usuario')) {
                url.pathname = '/dashboard/usuario'
                return redirect(url)
            }
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
