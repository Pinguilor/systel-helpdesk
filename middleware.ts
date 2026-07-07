import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
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

    // getSession() valida el JWT localmente desde la cookie — sin round-trip a la BD.
    // Las páginas y Server Actions siguen usando getUser() (validación remota completa).
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null

    const url = request.nextUrl.clone()

    const redirect = (destination: URL) => {
        const res = NextResponse.redirect(destination)
        supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value))
        return res
    }

    // Redirigir a login si intenta acceder al dashboard sin sesión
    if ((url.pathname.startsWith('/dashboard') || url.pathname === '/') && !user) {
        url.pathname = '/login'
        return redirect(url)
    }

    if (user) {
        // El rol viene del JWT (user_metadata) — sin query a la BD.
        // Si el rol cambia en BD, toma efecto en el próximo refresh del token (~1h) o re-login.
        const rawRol = (user.user_metadata?.rol ?? '') as string
        const rol = rawRol.toLowerCase()

        // Redirigir al home de cada rol desde rutas de entrada genéricas
        if (url.pathname === '/login' || url.pathname === '/' || url.pathname === '/dashboard') {
            if (rol === 'tecnico')                         url.pathname = '/dashboard/tecnico'
            else if (rol === 'admin' || rol === 'coordinador') url.pathname = '/dashboard/admin'
            else if (rol === 'admin_bodega')               url.pathname = '/dashboard/admin/bodegas'
            else                                           url.pathname = '/dashboard/usuario'
            return redirect(url)
        }

        // Rutas compartidas — ningún role boundary aplica aquí
        const BYPASS_PREFIXES = [
            '/api/',
            '/dashboard/ticket/',
            '/force-password',
            '/auth/',
            '/dashboard/analiticas',
            '/dashboard/perfil',
            '/dashboard/trazabilidad-materiales',
            '/dashboard/proyectos',
            '/dashboard/configuracion',
        ]
        if (BYPASS_PREFIXES.some(p => url.pathname.startsWith(p))) {
            return supabaseResponse
        }

        // Límites de rol
        if (rol === 'coordinador') {
            if (url.pathname.startsWith('/dashboard/admin/bodegas') || !url.pathname.startsWith('/dashboard/admin')) {
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
         * Excluye explícitamente todos los recursos estáticos para que el middleware
         * NO se ejecute en ellos y no genere conexiones a Supabase innecesarias.
         */
        '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|woff2?|ttf|eot|map)$).*)',
    ],
}
