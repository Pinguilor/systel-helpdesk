import { getBitacoraEntradas } from './actions';
import { NuevaEntradaForm } from './components/NuevaEntradaForm';
import { BitacoraTimeline } from './components/BitacoraTimeline';
import { BookOpen } from 'lucide-react';

export default async function BitacoraPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const entradas = await getBitacoraEntradas(id);

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4.5 h-4.5 text-white" strokeWidth={1.75} />
                </div>
                <div>
                    <h2 className="text-base font-black text-slate-900">Bitácora de Terreno</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {entradas.length === 0
                            ? 'Sin entradas aún'
                            : `${entradas.length} entrada${entradas.length !== 1 ? 's' : ''} registrada${entradas.length !== 1 ? 's' : ''}`
                        }
                    </p>
                </div>
            </div>

            {/* Formulario de nueva entrada */}
            <NuevaEntradaForm proyectoId={id} />

            {/* Timeline */}
            <BitacoraTimeline entradas={entradas as any} />
        </div>
    );
}
