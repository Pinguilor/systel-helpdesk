import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AnalyticsCharts from './components/AnalyticsCharts';
import { AreaChart, Sparkles } from 'lucide-react';

export default async function AnaliticasPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol, full_name')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile) redirect('/login');

    const userRole = profile?.rol?.toUpperCase() || '';

    let ticketQuery = supabase.from('tickets').select(`
        *,
        agente:agente_asignado_id(full_name),
        restaurantes(nombre_restaurante, sigla),
        categoria:ticket_categorias!categoria_id(nombre),
        tipo_servicio:ticket_tipos_servicio!tipo_servicio_id(nombre)
    `);

    if (userRole === 'USUARIO') {
        ticketQuery = ticketQuery.eq('creado_por', user.id);
    }

    const { data: tickets, error } = await ticketQuery.order('fecha_creacion', { ascending: false });

    if (error) console.error('Error cargando tickets para analíticas:', error);

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-md text-white shrink-0">
                    <AreaChart className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                        Análisis y Reportes <Sparkles className="w-5 h-5 text-amber-400" />
                    </h1>
                    <p className="text-sm text-slate-400 font-medium mt-0.5">
                        {userRole !== 'USUARIO'
                            ? 'Visión global de todas las solicitudes en la plataforma.'
                            : 'Métricas y estadísticas sobre tus solicitudes.'}
                    </p>
                </div>
            </div>

            <AnalyticsCharts tickets={tickets || []} isStaff={userRole !== 'USUARIO'} />
        </div>
    );
}
