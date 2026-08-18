import { createClient }   from '@/lib/supabase/server';
import { redirect }        from 'next/navigation';
import Link                from 'next/link';
import { ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { getProveedoresAdminAction } from './actions';
import { ProveedoresClient }         from './components/ProveedoresClient';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Proveedores — Systel Loop',
};

export default async function ProveedoresPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle();
    const rol = profile?.rol?.toUpperCase();
    if (rol !== 'ADMIN' && rol !== 'ADMIN_BODEGA') redirect('/dashboard');

    const { data, total } = await getProveedoresAdminAction(0, 25);

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 relative select-none">
            {/* Fondo decorativo */}
            <div className="absolute top-10 right-20 w-96 h-96 bg-violet-200/20 rounded-full filter blur-3xl pointer-events-none -z-10" />

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <Link
                    href="/dashboard/admin/inventario/guias"
                    className="inline-flex items-center gap-1 hover:text-violet-600 active:scale-95 transition-all"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Guías de Ingreso
                </Link>
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <span className="text-indigo-950 font-black">Proveedores</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 via-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-600/20">
                    <Building2 className="w-8 h-8 text-white" strokeWidth={1.5} />
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        ERP Loop × Systel
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                        Gestión de Proveedores
                    </h1>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                        Catálogo centralizado de proveedores. Auditá, corregí y enriquecé la información de contacto.
                    </p>
                </div>
            </div>

            <ProveedoresClient
                proveedoresIniciales={data}
                total={total}
            />
        </div>
    );
}
