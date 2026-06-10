import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getProyectoById } from './actions';
import { ProyectoHeader } from './components/ProyectoHeader';
import { createClient } from '@/lib/supabase/server';

export default async function ProyectoLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    let proyecto;
    try {
        proyecto = await getProyectoById(id);
    } catch {
        notFound();
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let currentUserRol = '';
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
        currentUserRol = profile?.rol?.toUpperCase() || '';
    }

    return (
        <div className="pb-12">
            {/* Breadcrumb */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                <Link
                    href="/dashboard/proyectos"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors font-medium"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Todos los proyectos
                </Link>
            </div>

            {/* Header del proyecto (nombre, estado, metadatos) */}
            <ProyectoHeader proyecto={proyecto as any} currentUserRol={currentUserRol} />

            {/* Contenido de cada sub-ruta */}
            {children}
        </div>
    );
}
