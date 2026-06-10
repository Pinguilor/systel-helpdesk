'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { MessageSquare, Camera, PenLine, Flag, User, Clock, ShieldCheck, FileText, Coins, Activity, ChevronDown } from 'lucide-react';

// ── Tipos locales (reflejo del query Supabase) ─────────────────────────────
type FirmaRow = {
    id: string;
    firmante_nombre: string;
    firmante_cargo: string | null;
    storage_url: string;
    sha256_hash: string;
    signed_at: string;
};

type EntradaRow = {
    id: string;
    tipo: 'nota' | 'foto' | 'firma' | 'hito';
    contenido: string | null;
    adjuntos: string[];
    created_at: string;
    autor: { full_name: string | null } | null;
    firma: FirmaRow[] | null;      // PostgREST retorna array (0 ó 1 elemento)
};

interface Props {
    entradas: EntradaRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRelativa(dateStr: string): string {
    const now  = new Date();
    const date = new Date(dateStr);
    const mins = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (mins < 1)   return 'hace un momento';
    if (mins < 60)  return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ayer';
    if (days < 7)   return `hace ${days} días`;
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Configuración visual por tipo ─────────────────────────────────────────

const TIPO_CONFIG = {
    nota: {
        Icon: MessageSquare,
        dotBg: 'bg-slate-200',
        iconColor: 'text-slate-500',
        label: 'Nota',
    },
    foto: {
        Icon: Camera,
        dotBg: 'bg-blue-100',
        iconColor: 'text-blue-500',
        label: 'Foto',
    },
    firma: {
        Icon: PenLine,
        dotBg: 'bg-green-100',
        iconColor: 'text-green-600',
        label: 'Firma',
    },
    hito: {
        Icon: Flag,
        dotBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        label: 'Hito',
    },
} as const;

// ── Componente de entrada individual ──────────────────────────────────────

function EntradaCard({ entrada }: { entrada: EntradaRow }) {
    const isPlano = entrada.tipo === 'foto' && (entrada.contenido?.includes('[PLANO]') ?? false);
    const isViatico = entrada.tipo === 'hito' && (entrada.contenido?.startsWith('[VIATICO]') ?? false);
    const isSistema = entrada.tipo === 'hito' && (entrada.contenido?.startsWith('[SISTEMA]') ?? false);
    
    const contenidoLimpio = isPlano 
        ? entrada.contenido?.replace('[PLANO]', '').trim() 
        : entrada.contenido;

    const sistemaTextoLimpio = isSistema
        ? entrada.contenido?.replace('[SISTEMA]', '').trim()
        : '';

    // Handle isSistema separately for a ultra-clean, minimal inline row
    if (isSistema) {
        return (
            <div className="flex gap-4 group">
                {/* Dot de la línea de tiempo más compacto */}
                <div className="flex flex-col items-center shrink-0">
                    <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center shrink-0 mt-0.5">
                        <Activity className="w-3 h-3 text-slate-400" />
                    </div>
                    {/* Línea vertical */}
                    <div className="w-px flex-1 bg-slate-100 mt-2 group-last:hidden" />
                </div>

                {/* Contenido en una sola línea minimalista */}
                <div className="flex-1 min-w-0 pb-4 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-650">{entrada.autor?.full_name || 'Sistema'}</span>
                        <span className="text-slate-300 font-light">•</span>
                        <span className="text-slate-500 font-medium">{sistemaTextoLimpio}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap flex items-center gap-1 shrink-0 font-medium">
                        <Clock className="w-3 h-3 text-slate-350" />
                        {formatRelativa(entrada.created_at)}
                    </span>
                </div>
            </div>
        );
    }

    let viaticoMonto = '';
    let viaticoConcepto = '';
    let viaticoTecnico = '';
    if (isViatico) {
        const payload = entrada.adjuntos?.[0] as any;
        if (payload && typeof payload === 'object' && 'monto' in payload) {
            viaticoMonto = `$${(payload.monto || 0).toLocaleString('es-CL')}`;
            viaticoConcepto = payload.concepto || 'Gasto';
            viaticoTecnico = payload.tecnico_nombre || 'Técnico';
        } else {
            const raw = entrada.contenido || '';
            const cleanRaw = raw.replace('[VIATICO]', '').trim();
            const dashIdx = cleanRaw.indexOf('-');
            const assocIdx = cleanRaw.indexOf('(Asociado a:');
            if (dashIdx !== -1 && assocIdx !== -1) {
                viaticoConcepto = cleanRaw.substring(0, dashIdx).trim();
                viaticoMonto = cleanRaw.substring(dashIdx + 1, assocIdx).trim();
                viaticoTecnico = cleanRaw.substring(assocIdx + 12, cleanRaw.length - 1).trim();
            } else {
                viaticoConcepto = cleanRaw;
            }
        }
    }

    let cfg: {
        Icon: any;
        dotBg: string;
        iconColor: string;
        label: string;
    } = TIPO_CONFIG[entrada.tipo] ?? TIPO_CONFIG.nota;
    
    if (isPlano) {
        cfg = {
            Icon: FileText,
            dotBg: 'bg-rose-100',
            iconColor: 'text-rose-500',
            label: 'Plano / Documento',
        };
    } else if (isViatico) {
        cfg = {
            Icon: Coins,
            dotBg: 'bg-emerald-100',
            iconColor: 'text-emerald-600',
            label: 'Viático / Gasto',
        };
    }

    const Icon  = cfg.Icon;
    const firma = entrada.firma?.[0] ?? null;

    return (
        <div className="flex gap-4 group">
            {/* Dot de la línea de tiempo */}
            <div className="flex flex-col items-center shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.dotBg}`}>
                    <Icon className={`w-4 h-4 ${cfg.iconColor}`} strokeWidth={1.75} />
                </div>
                {/* Línea vertical (excepto último elemento) */}
                <div className="w-px flex-1 bg-slate-100 mt-2 group-last:hidden" />
            </div>

            {/* Contenido de la entrada */}
            <div className="flex-1 min-w-0 pb-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                            {cfg.label}
                        </span>
                        {entrada.autor?.full_name && (
                            <span className="text-xs text-slate-400 ml-2 flex items-center gap-1 inline-flex">
                                <User className="w-3 h-3" />
                                {entrada.autor.full_name}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatRelativa(entrada.created_at)}
                    </span>
                </div>

                {/* ── NOTA / HITO: texto ────────────────────────── */}
                {(entrada.tipo === 'nota' || entrada.tipo === 'hito') && entrada.contenido && !isViatico && (
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                        {entrada.contenido}
                    </p>
                )}

                {/* ── VIÁTICO (Caso especial) ────────────────────── */}
                {isViatico && (
                    <div className="flex items-center justify-between bg-emerald-500/[0.02] border border-emerald-500/15 rounded-2xl p-4 max-w-lg shadow-sm hover:bg-emerald-500/[0.04] transition-all">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                                <Coins className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-700 truncate" title={viaticoConcepto}>
                                    {viaticoConcepto}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    Rendido por: <span className="font-semibold text-slate-500">{viaticoTecnico}</span>
                                </p>
                            </div>
                        </div>
                        <div className="text-right shrink-0 pl-4 border-l border-slate-100">
                            <p className="text-sm font-black text-emerald-700">{viaticoMonto}</p>
                            <span className="inline-block text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 border border-emerald-100/50 uppercase tracking-wider">
                                Rendido
                            </span>
                        </div>
                    </div>
                )}


                {/* ── PLANO / DOCUMENTO (Caso especial) ─────────── */}
                {isPlano ? (
                    <div className="space-y-2">
                        {entrada.adjuntos?.length > 0 && (
                            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 max-w-md">
                                <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                                    <FileText className="w-5 h-5 text-rose-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-700 truncate" title={contenidoLimpio || ''}>
                                        {contenidoLimpio || 'Plano / Documento Adjunto'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Archivo de referencia</p>
                                </div>
                                <a
                                    href={entrada.adjuntos[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-indigo-650 bg-indigo-50 border border-indigo-150/40 hover:bg-indigo-100/60 rounded-xl transition-all shadow-sm uppercase tracking-wider cursor-pointer"
                                >
                                    Ver Documento Adjunto
                                </a>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── FOTO: imagen(es) ──────────────────────────── */
                    entrada.tipo === 'foto' && (
                        <div className="space-y-2">
                            {entrada.contenido && (
                                <p className="text-sm text-slate-600 italic">{entrada.contenido}</p>
                            )}
                            {entrada.adjuntos?.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {entrada.adjuntos.map((url, idx) => (
                                        <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity block bg-slate-100"
                                        >
                                            <Image
                                                src={url}
                                                alt={`Foto ${idx + 1}`}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 640px) 50vw, 33vw"
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                )}

                {/* ── FIRMA: imagen + info + hash ───────────────── */}
                {entrada.tipo === 'firma' && firma && (
                    <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
                        {/* Info del firmante */}
                        <div>
                            <p className="font-black text-slate-900 text-sm">{firma.firmante_nombre}</p>
                            {firma.firmante_cargo && (
                                <p className="text-xs text-slate-500">{firma.firmante_cargo}</p>
                            )}
                        </div>

                        {/* Observaciones del documento (si existen) */}
                        {entrada.contenido && (
                            <p className="text-sm text-slate-700 italic border-l-2 border-green-300 pl-3">
                                {entrada.contenido}
                            </p>
                        )}

                        {/* Imagen de la firma */}
                        <div className="bg-white border border-green-200 rounded-lg p-2">
                            <img
                                src={firma.storage_url}
                                alt={`Firma de ${firma.firmante_nombre}`}
                                className="max-h-24 w-auto mx-auto block"
                            />
                        </div>

                        {/* SHA-256 chip (inmutabilidad) */}
                        <div className="flex items-start gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                            <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" strokeWidth={2} />
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide">
                                    SHA-256 · Inmutable
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono break-all mt-0.5">
                                    {firma.sha256_hash}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Timeline principal ────────────────────────────────────────────────────

export function BitacoraTimeline({ entradas }: Props) {
    const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => {
        // Inicializar 'Hoy' como expandido por defecto
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return { [todayKey]: true };
    });

    const { grouped, sortedDates, startDay } = useMemo(() => {
        const filtered = entradas.filter(e => !(e.tipo === 'hito' && e.contenido?.startsWith('[CHECKLIST]')));
        
        if (filtered.length === 0) return { grouped: {}, sortedDates: [], startDay: 0 };

        // Determinar el "Día 1" (fecha de la primera entrada del proyecto)
        const times = filtered.map(e => new Date(e.created_at).getTime());
        const minTime = Math.min(...times);
        const startDate = new Date(minTime);
        startDate.setHours(0, 0, 0, 0);
        
        const startDayTime = startDate.getTime();

        const groups: Record<string, typeof filtered> = {};
        
        filtered.forEach(e => {
            const d = new Date(e.created_at);
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(e);
        });

        // Ordenar fechas descendente (más reciente primero)
        const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
        
        return { grouped: groups, sortedDates: sortedKeys, startDay: startDayTime };
    }, [entradas]);

    const toggleDay = (dateKey: string) => {
        setExpandedDays(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
    };

    if (sortedDates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <MessageSquare className="w-8 h-8 text-slate-300 mb-3" strokeWidth={1.5} />
                <p className="text-slate-500 font-bold text-sm">Sin registros en la bitácora</p>
                <p className="text-slate-400 text-xs mt-1">Las notas, fotos y firmas aparecerán aquí.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {sortedDates.map(dateKey => {
                const dayEntries = grouped[dateKey];
                const [year, month, day] = dateKey.split('-').map(Number);
                const currentDayDate = new Date(year, month - 1, day);
                currentDayDate.setHours(0, 0, 0, 0);
                
                // Calcular "Día X"
                const diffTime = currentDayDate.getTime() - startDay;
                const diaRelativo = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                
                const fechaFormateada = currentDayDate.toLocaleDateString('es-CL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });

                const isExpanded = expandedDays[dateKey];

                return (
                    <div key={dateKey} className="border border-slate-200/75 rounded-2xl overflow-hidden bg-white shadow-sm">
                        {/* Header del Acordeón */}
                        <button
                            type="button"
                            onClick={() => toggleDay(dateKey)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/70 transition-colors cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                    <ChevronDown className="w-4 h-4 text-slate-500" strokeWidth={2.5} />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-sm font-black text-slate-800">
                                        Día {diaRelativo} <span className="text-slate-400 font-semibold ml-1 capitalize">· {fechaFormateada}</span>
                                    </h4>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                    {dayEntries.length} {dayEntries.length === 1 ? 'registro' : 'registros'}
                                </span>
                            </div>
                        </button>

                        {/* Cuerpo del Acordeón */}
                        {isExpanded && (
                            <div className="p-4 sm:p-5 space-y-0 border-t border-slate-100/80">
                                {dayEntries.map(entrada => (
                                    <EntradaCard key={entrada.id} entrada={entrada} />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
