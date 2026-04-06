import { createClient } from '@/lib/supabase/server';
import { AdminSegmentedNav } from '@/app/dashboard/admin/components/AdminSegmentedNav';

const STAFF_ROLES = ['ADMIN', 'COORDINADOR', 'ADMIN_BODEGA'];

export default async function TrazabilidadLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let rol = '';
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', user.id)
            .maybeSingle();
        rol = profile?.rol?.toUpperCase() || '';
    }

    const esStaff = STAFF_ROLES.includes(rol);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* La barra de subnav solo se muestra para el personal de Systel */}
            {esStaff && (
                <div className="bg-white border-b border-gray-200 sticky top-16 z-30 shadow-sm">
                    <AdminSegmentedNav rol={rol} />
                </div>
            )}
            {children}
        </div>
    );
}
