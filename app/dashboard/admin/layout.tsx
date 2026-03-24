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
            <div className="bg-white border-b border-gray-200 sticky top-16 z-30 shadow-sm">
                    <AdminSegmentedNav rol={rol} />
            </div>
            {children}
        </div>
    );
}
