import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDatosNuevoMasivo } from '../actions';
import { MasivoWizard } from '../components/MasivoWizard';

export default async function NuevoProyectoMasivoPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
    const rol = profile?.rol?.toUpperCase();
    if (rol !== 'ADMIN' && rol !== 'COORDINADOR') redirect('/dashboard/proyectos');

    const datos = await getDatosNuevoMasivo();

    return (
        <div className="relative min-h-screen bg-slate-50/30">
            <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <Link
                    href="/dashboard/proyectos?tab=rollouts"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors font-sans"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Volver a Rollouts
                </Link>

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md">
                        <Layers className="w-5 h-5 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="font-sans">
                        <h1 className="text-xl font-black text-slate-900">Nuevo Rollout</h1>
                        <p className="text-xs text-slate-400 mt-0.5">Crea un Rollout: un proyecto por cada local, agrupados bajo un mismo proyecto</p>
                    </div>
                </div>

                <MasivoWizard
                    empresas={datos.empresas}
                    coordinadores={datos.coordinadores}
                    locales={datos.locales}
                    plantillasChecklist={datos.plantillasChecklist.map((p: any) => ({ id: p.id, nombre: p.nombre }))}
                    recetasBOM={datos.recetasBOM.map((r: any) => ({ id: r.id, nombre: r.nombre }))}
                />
            </div>
        </div>
    );
}
