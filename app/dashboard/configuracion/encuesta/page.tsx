import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import { ArrowLeft }    from 'lucide-react';
import Link             from 'next/link';
import { getRespuestasEncuestaAdmin } from '../../encuesta/actions';

const ENCUESTA_ID = 'encuesta_1100_tickets_030826';
import { ModuloRespuestasEncuestas }                from './ModuloRespuestasEncuestas';

export const metadata = {
    title: 'Encuesta 1.100 Tickets — Systel Loop',
};

export const dynamic = 'force-dynamic';

export default async function EncuestaAdminPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'ADMIN') redirect('/dashboard/configuracion');

    const { data: respuestas, error } = await getRespuestasEncuestaAdmin(ENCUESTA_ID);

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

            {/* Breadcrumb */}
            <Link
                href="/dashboard/configuracion"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver a Configuración
            </Link>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    Error al cargar respuestas: {error}
                </div>
            )}

            <ModuloRespuestasEncuestas
                encuestaLabel="Encuesta 03/08/26 — Celebración 1.100 Tickets"
                respuestas={respuestas ?? []}
            />
        </div>
    );
}
