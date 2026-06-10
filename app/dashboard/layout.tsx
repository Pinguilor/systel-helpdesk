import { createClient } from '@/lib/supabase/server';
import TopNav from './components/TopNav';
import { redirect } from 'next/navigation';
import { AdminSegmentedNav } from './admin/components/AdminSegmentedNav';
import { UserSegmentedNav } from './usuario/components/UserSegmentedNav';
import { TecnicoSegmentedNav } from './tecnico/components/TecnicoSegmentedNav';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    // Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect('/login');
    }

    // Get User Profile for the Navbar (incluye debe_cambiar_password para el route guard)
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, rol, debe_cambiar_password')
        .eq('id', user.id)
        .maybeSingle();

    // Route guard: forzar cambio de contraseña antes de acceder al dashboard
    if (profile?.debe_cambiar_password) {
        redirect('/force-password');
    }

    const rolUpper = profile?.rol?.toUpperCase() || '';
    const isStaff = ['ADMIN', 'COORDINADOR', 'ADMIN_BODEGA'].includes(rolUpper);
    const isUsuario = rolUpper === 'USUARIO';
    const isTecnico = rolUpper === 'TECNICO';

    let tecnicoHasProjects = false;
    if (isTecnico) {
        const { count } = await supabase
            .from('proyecto_participantes')
            .select('*', { count: 'exact', head: true })
            .eq('perfil_id', user.id);
        tecnicoHasProjects = (count ?? 0) > 0;
    }

    return (
        <div className="min-h-screen bg-brand-bg-base text-slate-900 font-sans pb-10">
            <TopNav
                userFullName={profile?.full_name || null}
                userRole={profile?.rol || null}
            />
            {isStaff && (
                <div className="sticky top-[80px] z-40 -mt-2">
                    <AdminSegmentedNav rol={rolUpper} />
                </div>
            )}
            {isUsuario && (
                <div className="sticky top-[80px] z-40 -mt-2">
                    <UserSegmentedNav />
                </div>
            )}
            {isTecnico && tecnicoHasProjects && (
                <div className="sticky top-[80px] z-40 -mt-2">
                    <TecnicoSegmentedNav />
                </div>
            )}
            {/* The main container limits width globally to match the navbar */}
            <main>
                {children}
            </main>
        </div>
    );
}

