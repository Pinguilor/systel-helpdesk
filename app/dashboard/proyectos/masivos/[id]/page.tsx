import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getPanelMasivo } from '../gestion-actions';
import { PanelMasivo } from '../components/PanelMasivo';

export default async function PanelMasivoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
    const rol = profile?.rol?.toUpperCase();
    if (rol !== 'ADMIN' && rol !== 'COORDINADOR') redirect('/dashboard/proyectos');

    const panel = await getPanelMasivo(id);
    if (!panel) notFound();

    return (
        <div className="relative min-h-screen bg-slate-50/30">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <Link
                    href="/dashboard/proyectos?tab=rollouts"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors font-sans"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Volver a Rollouts
                </Link>

                <PanelMasivo panel={panel} />
            </div>
        </div>
    );
}
