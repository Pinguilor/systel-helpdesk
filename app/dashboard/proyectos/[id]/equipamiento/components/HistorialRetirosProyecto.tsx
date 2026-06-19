import { PackageCheck, CalendarClock, UserCheck, Hash, Layers, History } from 'lucide-react';
import type { DespachoProyecto } from '../actions';

interface Props {
    despachos: DespachoProyecto[];
}

function formatFecha(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function HistorialRetirosProyecto({ despachos }: Props) {
    const totalDespachos = despachos.length;
    const totalUnidades = despachos.reduce((acc, d) => acc + d.totalUnidades, 0);

    return (
        <div className="space-y-4">
            {/* Cabecera de la sección */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-slate-200 rounded-2xl shadow-sm gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <History className="w-4.5 h-4.5 text-emerald-600" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900">Historial de Despachos</h3>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                            Entregas aprobadas por Bodega
                        </p>
                    </div>
                </div>
                {totalDespachos > 0 && (
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
                            {totalDespachos} despacho{totalDespachos !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-md">
                            {totalUnidades} unidades
                        </span>
                    </div>
                )}
            </div>

            {/* Lista de despachos */}
            {totalDespachos === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <PackageCheck className="w-8 h-8 text-slate-300 mb-3" strokeWidth={1.5} />
                    <p className="text-slate-500 font-bold text-sm">Sin despachos aún</p>
                    <p className="text-slate-400 text-xs mt-1">
                        Aquí aparecerán las entregas que Bodega apruebe para este proyecto.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {despachos.map((d) => (
                        <div
                            key={d.id}
                            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                        >
                            {/* Cabecera del despacho: fecha + bodeguero */}
                            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <CalendarClock className="w-4 h-4 text-slate-400 shrink-0" />
                                    {formatFecha(d.aprobadoEn)}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    Aprobado por
                                    <span className="font-black text-slate-700">{d.bodegueroNombre ?? 'Bodega'}</span>
                                </div>
                            </div>

                            {/* Ítems del despacho */}
                            <div className="divide-y divide-slate-100">
                                {d.items.map((it, idx) => (
                                    <div key={idx} className="px-5 py-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div
                                                className={`p-1.5 rounded-lg shrink-0 ${
                                                    it.es_serializado
                                                        ? 'bg-indigo-100 text-indigo-600'
                                                        : 'bg-amber-100 text-amber-600'
                                                }`}
                                            >
                                                {it.es_serializado ? (
                                                    <Hash className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Layers className="w-3.5 h-3.5" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">{it.modelo}</p>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                                    {it.familia}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-slate-800 shrink-0">
                                            x{it.cantidad}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
