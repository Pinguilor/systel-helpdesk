import { PackageCheck, CalendarClock, UserCheck, UserX, Hash, Layers, History, XCircle, AlertTriangle } from 'lucide-react';
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
    const aprobados  = despachos.filter(d => d.estado === 'aprobada');
    const rechazados = despachos.filter(d => d.estado === 'rechazada');
    const totalUnidades = aprobados.reduce((acc, d) => acc + d.totalUnidades, 0);

    return (
        <div className="space-y-4">
            {/* Cabecera de la sección */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-slate-200 rounded-2xl shadow-sm gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <History className="w-4.5 h-4.5 text-emerald-600" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900">Historial de Solicitudes</h3>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                            Despachos y rechazos de Bodega
                        </p>
                    </div>
                </div>
                {despachos.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {aprobados.length > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                                {aprobados.length} aprobada{aprobados.length !== 1 ? 's' : ''} · {totalUnidades} unid.
                            </span>
                        )}
                        {rechazados.length > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg">
                                {rechazados.length} rechazada{rechazados.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Lista de solicitudes */}
            {despachos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <PackageCheck className="w-8 h-8 text-slate-300 mb-3" strokeWidth={1.5} />
                    <p className="text-slate-500 font-bold text-sm">Sin solicitudes aún</p>
                    <p className="text-slate-400 text-xs mt-1">
                        Aquí aparecerán las solicitudes que Bodega apruebe o rechace para este proyecto.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {despachos.map((d) => {
                        const esAprobado = d.estado === 'aprobada';
                        return (
                            <div
                                key={d.id}
                                className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${
                                    esAprobado ? 'border-slate-200' : 'border-red-200'
                                }`}
                            >
                                {/* Cabecera: fecha + bodeguero + estado */}
                                <div className={`px-5 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                    esAprobado
                                        ? 'bg-slate-50 border-slate-100'
                                        : 'bg-red-50/60 border-red-100'
                                }`}>
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                        <CalendarClock className="w-4 h-4 text-slate-400 shrink-0" />
                                        {formatFecha(d.aprobadoEn)}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                        {esAprobado ? (
                                            <>
                                                <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                Aprobado por
                                            </>
                                        ) : (
                                            <>
                                                <UserX className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                                Rechazado por
                                            </>
                                        )}
                                        <span className="font-black text-slate-700">{d.bodegueroNombre ?? 'Bodega'}</span>
                                        {!esAprobado && (
                                            <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-black uppercase tracking-wide">
                                                Rechazada
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Banner de rechazo con motivo */}
                                {!esAprobado && d.motivoRechazo && (
                                    <div className="px-5 py-2.5 bg-red-50 border-b border-red-100 flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-700 font-semibold">{d.motivoRechazo}</p>
                                    </div>
                                )}

                                {/* Ítems de la solicitud */}
                                <div className={`divide-y ${esAprobado ? 'divide-slate-100' : 'divide-red-50'}`}>
                                    {d.items.map((it, idx) => (
                                        <div key={idx} className={`px-5 py-3 flex items-center justify-between gap-3 ${!esAprobado ? 'opacity-60' : ''}`}>
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
                                            <span className={`text-sm font-black shrink-0 ${esAprobado ? 'text-slate-800' : 'text-red-400 line-through'}`}>
                                                x{it.cantidad}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
