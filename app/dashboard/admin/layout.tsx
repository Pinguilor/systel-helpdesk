import { createClient } from '@/lib/supabase/server';
import { AdminSegmentedNav } from './components/AdminSegmentedNav';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let rol = '';
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).maybeSingle();
        rol = profile?.rol?.toUpperCase() || '';
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="sticky top-[80px] z-30">
                <AdminSegmentedNav rol={rol} />
            </div>
            {children}
        </div>
    );
}
