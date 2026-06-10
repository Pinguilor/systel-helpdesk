import { getProyectoById, getTecnicosDisponibles } from './actions';
import { getBitacoraEntradas } from './bitacora/actions';
import { getBomConItems, getCatalogoEquipos } from './bom/actions';
import { getPlantillasChecklist, getPlantillasBOM } from '../actions';
import { NuevaEntradaForm } from './bitacora/components/NuevaEntradaForm';
import { BitacoraTimeline } from './bitacora/components/BitacoraTimeline';
import { ProyectoWidgets } from './components/ProyectoWidgets';
import { BookOpen, Lock, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ProyectoWorkspacePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // Load all required data in parallel
    const [proyecto, entradas, bom, catalogo, tecnicos, plantillas, recetasBOM] = await Promise.all([
        getProyectoById(id),
        getBitacoraEntradas(id),
        getBomConItems(id),
        getCatalogoEquipos(),
        getTecnicosDisponibles(),
        getPlantillasChecklist(),
        getPlantillasBOM(),
    ]);

    const participantes = (proyecto as any)?.participantes ?? [];
    const bomItems = (bom?.items ?? []) as any[];

    // --- ACCESSIBILITY AND SECURITY LAYER ---
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let currentUserRol = 'tecnico';
    let currentUserId = user?.id || '';

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', user.id)
            .single();
        if (profile?.rol) {
            currentUserRol = profile.rol;
        }
    }

    // Validation for "tecnico" role
    if (currentUserRol === 'tecnico') {
        const isParticipant = participantes.some((p: any) => p.perfil?.id === currentUserId && p.activo);
        
        if (!isParticipant) {
            return (
                <div className="max-w-3xl mx-auto mt-12 px-4 sm:px-6">
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-8 md:p-12 text-center shadow-sm">
                        <div className="w-16 h-16 mx-auto bg-red-50 rounded-2xl flex items-center justify-center mb-6 border border-red-100">
                            <Lock className="w-8 h-8 text-red-500" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Acceso Denegado</h2>
                        <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
                            No tienes permisos para visualizar este proyecto. Si crees que es un error, solicita a un Administrador o Coordinador que te asigne como participante.
                        </p>
                        <Link 
                            href="/dashboard/proyectos"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Volver a mis proyectos
                        </Link>
                    </div>
                </div>
            );
        }
    }
    // --- END SECURITY LAYER ---

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                
                {/* ── Left Column (Main Content - 70%) ──────────────────────── */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Timeline Header */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 shadow-sm">
                            <BookOpen className="w-4.5 h-4.5 text-white" strokeWidth={1.75} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-900">Bitácora de Terreno</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {entradas.length === 0
                                    ? 'Sin entradas registradas aún'
                                    : `${entradas.length} entrada${entradas.length !== 1 ? 's' : ''} en el historial`
                                }
                            </p>
                        </div>
                    </div>

                    {/* Nueva entrada form */}
                    <NuevaEntradaForm proyectoId={id} />

                    {/* Chronological Timeline */}
                    <BitacoraTimeline entradas={entradas as any} />
                </div>

                {/* ── Right Column (Sidebar widgets - 30%) ─────────────────── */}
                <div className="lg:col-span-3 space-y-6 lg:border-l lg:border-slate-200/60 lg:pl-6">
                    <ProyectoWidgets
                        proyectoId={id}
                        participantes={participantes}
                        tecnicosDisponibles={tecnicos}
                        bomItems={bomItems}
                        catalogo={catalogo}
                        entradas={entradas as any}
                        plantillas={plantillas as any}
                        recetasBOM={recetasBOM as any}
                        currentUserRol={currentUserRol}
                        currentUserId={currentUserId}
                    />
                </div>

            </div>
        </div>
    );
}
