import { getProyectos, getFormData, getPlantillasChecklist, getPlantillasBOM } from './actions';
import { getCatalogoEquipos } from './[id]/bom/actions';
import { ProyectosDashboardView } from './components/ProyectosDashboardView';
import { ProyectoFormModal } from './components/ProyectoFormModal';
import { GestorPlantillasModal } from './components/GestorPlantillasModal';
import { GestorPlantillasBOMModal } from './components/GestorPlantillasBOMModal';
import { FolderKanban } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function ProyectosPage() {
    const [proyectos, { empresas, sucursales, coordinadores }, plantillas, recetasBOM, catalogo] = await Promise.all([
        getProyectos(),
        getFormData(),
        getPlantillasChecklist(),
        getPlantillasBOM(),
        getCatalogoEquipos(),
    ]);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let currentUserRol = '';
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
        currentUserRol = profile?.rol?.toUpperCase() || '';
    }

    return (
        <div className="relative min-h-screen bg-slate-50/30">
            {/* Background glowing blurred orbs for visual excellence */}
            <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-500/[0.03] rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-500/[0.02] rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md font-sans">
                            <FolderKanban className="w-5 h-5 text-white" strokeWidth={1.75} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 font-sans">Proyectos</h1>
                            <p className="text-xs text-slate-400 mt-0.5 font-sans">Gestión de instalaciones y aperturas de locales</p>
                        </div>
                    </div>
                    {currentUserRol !== 'TECNICO' && (
                        <div className="flex items-center gap-3 shrink-0">
                            <GestorPlantillasBOMModal plantillas={recetasBOM as any} catalogo={catalogo} />
                            <GestorPlantillasModal plantillas={plantillas as any} />
                            <ProyectoFormModal
                                empresas={empresas}
                                sucursales={sucursales}
                                coordinadores={coordinadores}
                            />
                        </div>
                    )}
                </div>

                {/* ── Main View Container (Metrics, Switcher, List/Board) ──── */}
                <ProyectosDashboardView
                    proyectos={proyectos as any}
                    empresas={empresas}
                    sucursales={sucursales}
                    coordinadores={coordinadores}
                />
            </div>
        </div>
    );
}
