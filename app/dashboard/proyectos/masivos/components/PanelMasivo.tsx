'use client';

// REGLA DE DISEÑO: NUNCA usar <select> nativo ni alert/confirm/prompt nativos.

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Plus, UserMinus, X } from 'lucide-react';
import type { PanelMasivo as Panel } from '../gestion-actions';
import { quitarLocalesMasivoAction } from '../gestion-actions';
import { alertasLocal, pct, requiereAtencion } from '../avance';
import { AvanceTab } from './AvanceTab';
import { ExcepcionesTab } from './ExcepcionesTab';
import { MaterialesTab } from './MaterialesTab';
import { AgregarLocalesModal } from './AgregarLocalesModal';
import { InformeMenu } from './InformeMenu';
import { faltante } from '../avance';

type Tab = 'avance' | 'excepciones' | 'materiales';

function Kpi({ titulo, valor, detalle, tono = 'normal' }: { titulo: string; valor: string; detalle?: string; tono?: 'normal' | 'alerta' | 'ok' }) {
    const tonos = {
        normal: 'bg-white border-slate-200/80 text-slate-800',
        alerta: 'bg-amber-50/60 border-amber-200 text-amber-800',
        ok:     'bg-emerald-50/60 border-emerald-200 text-emerald-800',
    };
    return (
        <div className={`border rounded-2xl p-4 shadow-sm ${tonos[tono]}`}>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{titulo}</p>
            <p className="text-xl md:text-2xl font-black mt-1">{valor}</p>
            {detalle && <p className="text-[11px] font-semibold text-slate-500 truncate">{detalle}</p>}
        </div>
    );
}

export function PanelMasivo({ panel }: { panel: Panel }) {
    const router = useRouter();
    const { padre, locales, excepciones, materiales } = panel;

    const [tab, setTab] = useState<Tab>('avance');
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
    const [agregando, setAgregando] = useState(false);
    const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
    const [errorQuitar, setErrorQuitar] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    // Si el servidor devuelve menos locales (por ejemplo tras quitar), se descartan selecciones obsoletas
    useEffect(() => {
        setSeleccion(prev => {
            const vigentes = new Set(locales.map(l => l.proyecto_id));
            const n = new Set([...prev].filter(id => vigentes.has(id)));
            return n.size === prev.size ? prev : n;
        });
    }, [locales]);

    const kpis = useMemo(() => {
        const alertas = locales.map(alertasLocal);
        const completados = locales.filter(l => l.estado === 'completado').length;
        const tareas = locales.reduce((s, l) => s + l.tareas_total, 0);
        const tareasOk = locales.reduce((s, l) => s + l.tareas_completadas, 0);
        const req = locales.reduce((s, l) => s + l.mat_requerido, 0);
        const ent = locales.reduce((s, l) => s + l.mat_entregado, 0);
        return {
            total: locales.length,
            completados,
            pctCompletados: pct(completados, locales.length),
            tareas, tareasOk, pctTareas: pct(tareasOk, tareas),
            req, ent, pctMat: pct(ent, req),
            atencion: alertas.filter(requiereAtencion).length,
        };
    }, [locales]);

    const modelosConFaltante = materiales.filter(m => (faltante(m.por_retirar, m.stock_disponible) ?? 0) > 0).length;

    function confirmarQuitar() {
        setErrorQuitar(null);
        startTransition(async () => {
            const res = await quitarLocalesMasivoAction(padre.id, [...seleccion]);
            if (res.error) { setErrorQuitar(res.error); return; }
            setConfirmandoQuitar(false);
            setSeleccion(new Set());
            router.refresh();
        });
    }

    const TABS: { id: Tab; label: string; badge?: number; alerta?: boolean }[] = [
        { id: 'avance',      label: 'Avance por local' },
        { id: 'excepciones', label: 'Pendientes', badge: excepciones.length, alerta: excepciones.length > 0 },
        { id: 'materiales',  label: 'Materiales', badge: modelosConFaltante, alerta: modelosConFaltante > 0 },
    ];

    return (
        <div className="space-y-6 font-sans">
            {/* ── Encabezado ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Rollout</p>
                    <h1 className="text-xl font-black text-slate-900 truncate">{padre.nombre}</h1>
                    {padre.descripcion && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{padre.descripcion}</p>}
                    <p className="text-[11px] font-semibold text-slate-400 mt-1">
                        {padre.coordinador ? `Coordinador: ${padre.coordinador}` : 'Sin coordinador'}
                        {padre.fecha_fin_estimada && ` · Término estimado: ${padre.fecha_fin_estimada}`}
                    </p>
                </div>
                <div className="shrink-0 flex flex-wrap items-center gap-3">
                    <InformeMenu padreId={padre.id} />
                    <button type="button" onClick={() => setAgregando(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors shadow-sm cursor-pointer">
                        <Plus className="w-4 h-4" strokeWidth={1.75} />
                        Agregar locales
                    </button>
                </div>
            </div>

            {/* ── KPIs ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi titulo="Locales completados" valor={`${kpis.completados}/${kpis.total}`} detalle={`${kpis.pctCompletados}%`} />
                <Kpi titulo="Checklist global" valor={`${kpis.pctTareas}%`} detalle={`${kpis.tareasOk} de ${kpis.tareas} tareas`} />
                <Kpi titulo="Materiales entregados" valor={`${kpis.pctMat}%`} detalle={`${kpis.ent} de ${kpis.req} unidades`} />
                <Kpi titulo="Requieren atención" valor={String(kpis.atencion)}
                    detalle={kpis.atencion > 0 ? 'Con pendientes o sin avance' : 'Todo al día'}
                    tono={kpis.atencion > 0 ? 'alerta' : 'ok'} />
            </div>

            {/* ── Tabs ───────────────────────────────────────────────── */}
            <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 w-fit shadow-inner overflow-x-auto max-w-full">
                {TABS.map(t => (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                            tab === t.id ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20' : 'text-slate-400 hover:text-slate-600'
                        }`}>
                        {t.label}
                        {!!t.badge && (
                            <span className={`px-1.5 py-px rounded-full text-[10px] font-black ${t.alerta ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                                {t.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {tab === 'avance' && (
                <AvanceTab locales={locales} seleccion={seleccion} onSeleccion={setSeleccion}
                    onQuitar={() => { setErrorQuitar(null); setConfirmandoQuitar(true); }} />
            )}
            {tab === 'excepciones' && <ExcepcionesTab excepciones={excepciones} />}
            {tab === 'materiales' && <MaterialesTab materiales={materiales} nombreProyecto={padre.nombre} />}

            {agregando && (
                <AgregarLocalesModal padreId={padre.id} nombreProyecto={padre.nombre} onClose={() => setAgregando(false)} />
            )}

            {/* ── Confirmar quitar ───────────────────────────────────── */}
            {confirmandoQuitar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
                    onClick={(e) => { if (e.target === e.currentTarget && !isPending) setConfirmandoQuitar(false); }}>
                    <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 flex flex-col gap-4">
                        <button onClick={() => setConfirmandoQuitar(false)} disabled={isPending}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 disabled:opacity-50 transition-colors cursor-pointer">
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                        <div className="flex items-start gap-3 pr-6">
                            <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mt-0.5">
                                <UserMinus className="w-5 h-5 text-amber-600" strokeWidth={2} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900">
                                    Quitar {seleccion.size} local{seleccion.size === 1 ? '' : 'es'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Del Rollout «{padre.nombre}».</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            No se borra nada: cada proyecto se desvincula y sigue existiendo como proyecto normal,
                            con su bitácora, materiales e historial intactos.
                        </p>
                        {errorQuitar && (
                            <div className="flex items-start gap-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> <span>{errorQuitar}</span>
                            </div>
                        )}
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => setConfirmandoQuitar(false)} disabled={isPending}
                                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer">
                                Cancelar
                            </button>
                            <button type="button" onClick={confirmarQuitar} disabled={isPending}
                                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {isPending ? 'Quitando...' : 'Sí, quitar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
