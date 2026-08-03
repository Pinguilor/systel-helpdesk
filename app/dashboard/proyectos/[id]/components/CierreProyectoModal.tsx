'use client';

import React, { useRef, useState, useEffect, useTransition } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { computeSHA256 } from '@/lib/sha256';
import {
    X, Loader2, AlertTriangle, CheckCircle2, ClipboardList,
    Package, DollarSign, Calendar, PenLine, Eraser, Lock, ShieldCheck, PackageMinus
} from 'lucide-react';
import {
    validarYPrepararCierreProyecto,
    completarYFirmarProyecto,
    generarDevolucionMasivaCierre,
    type ValidacionCierre
} from '../actions';

interface CierreProyectoModalProps {
    proyectoId:     string;
    proyectoNombre: string;
    onClose:        () => void;
    onSuccess:      () => void;
}

type Fase = 'validando' | 'bloqueado' | 'listo' | 'firmando' | 'exito';

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
    return (
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-black text-slate-900 leading-tight">{value}</p>
                {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

export function CierreProyectoModal({
    proyectoId,
    proyectoNombre,
    onClose,
    onSuccess,
}: CierreProyectoModalProps) {
    const [fase,          setFase]          = useState<Fase>('validando');
    const [validacion,    setValidacion]    = useState<ValidacionCierre | null>(null);
    const [submitError,   setSubmitError]   = useState<string | null>(null);
    const [isPending,     startTransition]  = useTransition();

    // Firma
    const sigRef           = useRef<SignatureCanvas>(null);
    const [firmanteNombre, setFirmanteNombre] = useState('');
    const [firmanteCargo,  setFirmanteCargo]  = useState('');
    const [sigEmpty,       setSigEmpty]       = useState(true);
    const [firmaError,     setFirmaError]     = useState<string | null>(null);

    // Devolución masiva
    const [isDevolucionPending, setIsDevolucionPending] = useState(false);
    const [devolucionError,     setDevolucionError]     = useState<string | null>(null);
    const [devolucionMsg,       setDevolucionMsg]       = useState<string | null>(null);

    // ── Validar al abrir (incluye resumen de stats) ──────────────────────
    useEffect(() => {
        startTransition(async () => {
            const result = await validarYPrepararCierreProyecto(proyectoId);
            setValidacion(result);
            setFase(result.error ? 'bloqueado' : result.puedesCerrar ? 'listo' : 'bloqueado');
        });
    }, [proyectoId]);

    // ── Enviar firma y cerrar ────────────────────────────────────────────
    async function handleFirmarYCerrar() {
        if (sigEmpty) { setFirmaError('Dibuja la firma antes de continuar.'); return; }
        if (!firmanteNombre.trim()) { setFirmaError('El nombre del firmante es obligatorio.'); return; }

        setFirmaError(null);
        setFase('firmando');

        try {
            const dataUrl  = sigRef.current!.getTrimmedCanvas().toDataURL('image/png');
            const response = await fetch(dataUrl);
            const blob     = await response.blob();
            const hash     = await computeSHA256(blob);

            const fd = new FormData();
            fd.append('proyecto_id',     proyectoId);
            fd.append('firma',           blob, 'cierre.png');
            fd.append('firmante_nombre', firmanteNombre.trim());
            fd.append('firmante_cargo',  firmanteCargo.trim());
            fd.append('sha256_hash',     hash);

            const result = await completarYFirmarProyecto(fd);

            if (result.error) {
                setSubmitError(result.error);
                setFase('listo');
            } else {
                setFase('exito');
                setTimeout(() => { onSuccess(); onClose(); }, 1800);
            }
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Error inesperado.');
            setFase('listo');
        }
    }

    // ── Devolución masiva de materiales sobrantes ────────────────────────
    async function handleDevolucionMasiva() {
        // Solo aplica a ítems con saldo libre (no en tránsito — esos son handshake pendiente)
        const ajustables = validacion?.materialesPendientes.filter(m => !m.en_transito && m.saldo > 0) ?? [];
        if (!ajustables.length) return;

        setIsDevolucionPending(true);
        setDevolucionError(null);
        setDevolucionMsg(null);

        const result = await generarDevolucionMasivaCierre(
            proyectoId,
            ajustables.map(m => ({
                id:                m.id,
                modelo:            m.modelo,
                cantidad_instalada: m.cantidad_instalada,
                saldo:             m.saldo,
            }))
        );

        if (result.error) {
            setDevolucionError(result.error);
            setIsDevolucionPending(false);
            return;
        }

        const msg = result.solicitudesCreadas > 0
            ? `${result.ajustados} ítem(s) ajustados · ${result.solicitudesCreadas} solicitud(es) de devolución creadas`
            : `${result.ajustados} ítem(s) ajustados — las devoluciones físicas se gestionarán manualmente`;

        setDevolucionMsg(msg);
        setIsDevolucionPending(false);

        // Re-validar para reflejar los ajustes y avanzar al paso de firma si ya está limpio
        setFase('validando');
        startTransition(async () => {
            const nueva = await validarYPrepararCierreProyecto(proyectoId);
            setValidacion(nueva);
            setFase(nueva.error ? 'bloqueado' : nueva.puedesCerrar ? 'listo' : 'bloqueado');
        });
    }

    const resumen = validacion?.resumen;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200/50 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

                {/* ── Header ───────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
                            <Lock className="w-4.5 h-4.5 text-white" strokeWidth={1.75} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900">Cierre de Proyecto</h2>
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">{proyectoNombre}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={fase === 'firmando'}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Body ─────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto">

                    {/* Validando */}
                    {fase === 'validando' && (
                        <div className="flex flex-col items-center justify-center gap-3 py-16">
                            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                            <p className="text-sm text-slate-500 font-medium">Verificando estado del proyecto...</p>
                        </div>
                    )}

                    {/* Bloqueado — pendientes */}
                    {fase === 'bloqueado' && validacion && (
                        <div className="p-6 space-y-4">
                            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-black text-red-800">El proyecto no puede cerrarse aún</p>
                                    <p className="text-xs text-red-600 mt-0.5">
                                        Existen ítems pendientes que deben resolverse antes del cierre oficial.
                                    </p>
                                </div>
                            </div>

                            {validacion.tareasPendientes.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <ClipboardList className="w-3.5 h-3.5" />
                                        Tareas sin completar ({validacion.tareasPendientes.length})
                                    </p>
                                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                                        {validacion.tareasPendientes.map(t => (
                                            <div key={t.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-white">
                                                <div className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                                                <span className="text-xs text-slate-700 font-medium">{t.titulo}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {validacion.materialesPendientes.length > 0 && (() => {
                                const enTransito  = validacion.materialesPendientes.filter(m => m.en_transito);
                                const sinDeclararItems = validacion.materialesPendientes.filter(m => !m.en_transito && m.saldo > 0);
                                return (
                                    <div className="space-y-3">
                                        {/* Ítems sin declarar → devolución masiva */}
                                        {sinDeclararItems.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Package className="w-3.5 h-3.5" />
                                                    Materiales sin declarar ({sinDeclararItems.length})
                                                </p>
                                                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                                                    {sinDeclararItems.map(m => (
                                                        <div key={m.id} className="flex items-center justify-between px-3 py-2.5 bg-white">
                                                            <span className="text-xs text-slate-700 font-medium">{m.modelo}</span>
                                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                                                {m.saldo} u. pendientes
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Acción rápida: devolución masiva */}
                                                <div className="pt-1 space-y-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleDevolucionMasiva}
                                                        disabled={isDevolucionPending}
                                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-300 text-amber-800 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                                                    >
                                                        {isDevolucionPending ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <PackageMinus className="w-3.5 h-3.5" />
                                                        )}
                                                        {isDevolucionPending ? 'Procesando ajuste...' : 'Generar Devolución por Pendientes'}
                                                    </button>
                                                    <p className="text-[10px] text-slate-400 text-center leading-snug">
                                                        Reconcilia el BOM ajustando a las unidades instaladas y genera solicitudes de devolución al inventario.
                                                    </p>
                                                    {devolucionError && (
                                                        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                                                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                                            <p className="text-xs text-red-700">{devolucionError}</p>
                                                        </div>
                                                    )}
                                                    {devolucionMsg && (
                                                        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                            <p className="text-xs text-emerald-700">{devolucionMsg}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Ítems en tránsito → requieren handshake de logística */}
                                        {enTransito.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Package className="w-3.5 h-3.5 text-blue-500" />
                                                    En tránsito — handshake pendiente ({enTransito.length})
                                                </p>
                                                <div className="divide-y divide-slate-100 border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30">
                                                    {enTransito.map(m => (
                                                        <div key={m.id} className="flex items-center justify-between px-3 py-2.5">
                                                            <span className="text-xs text-slate-700 font-medium">{m.modelo}</span>
                                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                                                {m.cantidad_en_transito} u. en tránsito
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 leading-relaxed">
                                                    El encargado de Logística debe confirmar la recepción de estos materiales en el <strong>Panel de Custodia</strong> del proyecto antes de poder cerrar.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {validacion.error && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                                    {validacion.error}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Listo para cerrar — Acta de Entrega */}
                    {(fase === 'listo' || fase === 'firmando') && resumen && (
                        <div className="p-6 space-y-6">

                            {/* Resumen de cierre */}
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                                    Resumen del Proyecto
                                </p>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <StatCard
                                        icon={<Calendar className="w-4 h-4 text-slate-500" />}
                                        label="Días de proyecto"
                                        value={resumen.diasProyecto ? `${resumen.diasProyecto} días` : '—'}
                                        sub={resumen.fechaInicioStr ? `Desde ${resumen.fechaInicioStr}` : undefined}
                                    />
                                    <StatCard
                                        icon={<ClipboardList className="w-4 h-4 text-emerald-500" />}
                                        label="Checklist"
                                        value={`${resumen.pctChecklist}% completado`}
                                        sub={`${resumen.completadas} / ${resumen.totalTareas} tareas`}
                                    />
                                    <StatCard
                                        icon={<Package className="w-4 h-4 text-blue-500" />}
                                        label="Materiales"
                                        value={`${resumen.totalEntregado} u. entregadas`}
                                        sub={`de ${resumen.totalRequerido} requeridas`}
                                    />
                                    <StatCard
                                        icon={<DollarSign className="w-4 h-4 text-violet-500" />}
                                        label="Viáticos totales"
                                        value={`$${resumen.totalViaticos.toLocaleString('es-CL')}`}
                                        sub="Gastos registrados"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-100" />

                            {/* Panel de firma */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    Firma de Conformidad — Acta de Entrega
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                            Nombre del firmante *
                                        </label>
                                        <input
                                            value={firmanteNombre}
                                            onChange={e => setFirmanteNombre(e.target.value)}
                                            placeholder="Ej: Carlos Pérez"
                                            disabled={fase === 'firmando'}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                            Cargo <span className="font-normal text-slate-400 normal-case">(opcional)</span>
                                        </label>
                                        <input
                                            value={firmanteCargo}
                                            onChange={e => setFirmanteCargo(e.target.value)}
                                            placeholder="Ej: Gerente de Local"
                                            disabled={fase === 'firmando'}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <PenLine className="w-3.5 h-3.5" />
                                            Firma digital *
                                        </label>
                                        <button
                                            type="button"
                                            disabled={fase === 'firmando'}
                                            onClick={() => { sigRef.current?.clear(); setSigEmpty(true); }}
                                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors font-medium disabled:opacity-40"
                                        >
                                            <Eraser className="w-3 h-3" />
                                            Limpiar
                                        </button>
                                    </div>
                                    <div className={`border-2 rounded-xl overflow-hidden transition-colors touch-none ${sigEmpty ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-300 bg-white'}`}>
                                        <SignatureCanvas
                                            ref={sigRef}
                                            penColor="#0f172a"
                                            canvasProps={{
                                                className: 'w-full block',
                                                style: { height: '160px', display: 'block', width: '100%' },
                                            }}
                                            backgroundColor="transparent"
                                            onBegin={() => setSigEmpty(false)}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5">
                                        Hash SHA-256 calculado al firmar — garantiza inmutabilidad del acta.
                                    </p>
                                </div>

                                {(firmaError || submitError) && (
                                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-700">{firmaError || submitError}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Éxito */}
                    {fase === 'exito' && (
                        <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                                <ShieldCheck className="w-8 h-8 text-emerald-500" strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-base font-black text-slate-900">¡Proyecto Cerrado!</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    El acta de entrega ha sido firmada y el proyecto ha cambiado a estado <span className="font-bold text-emerald-600">Completado</span>.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center gap-3">
                    {fase !== 'exito' && (
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={fase === 'firmando'}
                            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-40"
                        >
                            Cancelar
                        </button>
                    )}

                    {fase === 'listo' && (
                        <button
                            type="button"
                            onClick={handleFirmarYCerrar}
                            disabled={sigEmpty || !firmanteNombre.trim()}
                            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Firmar y Cerrar Proyecto
                        </button>
                    )}

                    {fase === 'firmando' && (
                        <button disabled className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold opacity-70 flex items-center justify-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Procesando cierre...
                        </button>
                    )}

                    {fase === 'bloqueado' && (
                        <button
                            type="button"
                            disabled
                            className="flex-1 py-2.5 bg-red-100 text-red-400 rounded-xl text-xs font-bold cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Lock className="w-3.5 h-3.5" />
                            Cierre bloqueado — hay ítems pendientes
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
