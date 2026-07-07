import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // getSession() valida el JWT localmente desde la cookie — sin round-trip a Supabase Auth.
    // Las páginas y Server Actions usan getUser() para validación remota completa.
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null

    const url = request.nextUrl.clone()

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
        // Rol desde el JWT (user_metadata) — sin query a la BD.
        // Cambios de rol toman efecto en el próximo refresh del token (~1h) o re-login.
        const rawRol = user.user_metadata?.rol
        const rol = typeof rawRol === 'string' ? rawRol.toLowerCase() : '';

        if (url.pathname === '/login' || url.pathname === '/' || url.pathname === '/dashboard') {
            if (rol === 'tecnico') url.pathname = '/dashboard/tecnico'
            else if (rol === 'admin' || rol === 'coordinador') url.pathname = '/dashboard/admin'
            else if (rol === 'admin_bodega') url.pathname = '/dashboard/admin/bodegas'
            else url.pathname = '/dashboard/usuario'
            return redirect(url)
        }

        // Bypass: rutas /api/** nunca deben ser redirigidas por el middleware de rol
        if (url.pathname.startsWith('/api/')) {
            return supabaseResponse;
        }

        // Shared route bypass: All Roles can access generic /dashboard/ticket/[id]
        if (url.pathname.startsWith('/dashboard/ticket/')) {
            return supabaseResponse;
        }

        // Shared route bypass: Cambio obligatorio de contraseña (primer login)
        if (url.pathname.startsWith('/force-password')) {
            return supabaseResponse;
        }

        // Shared route bypass: Rutas de autenticación (signout, callbacks, etc.)
        if (url.pathname.startsWith('/auth/')) {
            return supabaseResponse;
        }

        // Shared route bypass: Permitir acceso a Analíticas y Perfil a cualquier usuario autenticado
        if (url.pathname.startsWith('/dashboard/analiticas') || url.pathname.startsWith('/dashboard/perfil')) {
            return supabaseResponse;
        }

        // Shared route bypass: Trazabilidad de Materiales (accesible para admin, coordinador, admin_bodega)
        if (url.pathname.startsWith('/dashboard/trazabilidad-materiales')) {
            return supabaseResponse;
        }

        // Shared route bypass: Proyectos (admin y coordinador)
        if (url.pathname.startsWith('/dashboard/proyectos')) {
            return supabaseResponse;
        }

        // Shared route bypass: Configuración (admin-only, validado dentro de la página)
        if (url.pathname.startsWith('/dashboard/configuracion')) {
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
         * Excluye recursos estáticos para evitar conexiones a Supabase innecesarias:
         * _next/static, _next/image, favicon, imágenes, fuentes, CSS, mapas de source.
         */
        '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|woff2?|ttf|eot|map)$).*)',
    ],
}
