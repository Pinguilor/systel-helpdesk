import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {(rol === 'ADMIN' || rol === 'COORDINADOR') && (
                            <Link
                                href="/dashboard/admin"
                                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm inline-flex items-center group relative overflow-hidden"
                            >
                                Vista General
                            </Link>
                        )}
                        {(rol === 'ADMIN' || rol === 'ADMIN_BODEGA') && (
                            <Link
                                href="/dashboard/admin/bodegas"
                                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm inline-flex items-center group"
                            >
                                Bodegas (Inventario)
                            </Link>
                        )}
                    </nav>
                </div>
            </div>
            {children}
        </div>
    );
}
