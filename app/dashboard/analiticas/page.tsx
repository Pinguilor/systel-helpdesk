import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AnalyticsCharts from './components/AnalyticsCharts';
import { AreaChart, Sparkles } from 'lucide-react';

export default async function AnaliticasPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Get user profile to determine their rol and data access scope
    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile) {
        redirect('/login');
    }

    // Fetch tickets based on rol
    let ticketQuery = supabase.from('tickets').select('*');

    // For requester, only show their own tickets. For agents, show all.
    if (profile?.rol?.toUpperCase() !== 'tecnico') {
        ticketQuery = ticketQuery.eq('creado_por', user.id);
    }

    const { data: tickets, error } = await ticketQuery;

    if (error) {
        console.error("Error cargando tickets para analíticas:", error);
    }

    return (
        <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-10">
            {/* Header with elegant typography */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-brand-primary rounded-xl shadow-md text-white">
                        <AreaChart className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
                            Análisis y Reportes <Sparkles className="w-5 h-5 text-amber-500" />
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 font-medium">
                            {profile.rol === 'tecnico'
                                ? 'Visión global de todas las solicitudes en la plataforma.'
                                : 'Métricas y estadísticas sobre tus solicitudes.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Area populated with Charts */}
            <div className="pt-2">
                <AnalyticsCharts tickets={tickets || []} />
            </div>
        </div>
    );
}
