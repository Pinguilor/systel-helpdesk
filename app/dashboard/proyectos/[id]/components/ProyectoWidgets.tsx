'use client';

import React, { useState, useMemo, useTransition, useOptimistic } from 'react';
import { 
    Users, UserPlus, Trash2, Package, X, 
    DollarSign, Plus, Eye, Loader2, AlertCircle,
    Map, FileDown, UploadCloud, CheckSquare, Check,
    Zap, Clipboard
} from 'lucide-react';
import { 
    agregarParticipanteAction, 
    eliminarParticipanteAction, 
    registrarViaticoAction,
    subirPlanimetriaAction,
    crearChecklistItemAction,
    toggleChecklistItemAction,
    eliminarChecklistItemAction,
    aplicarPlantillaChecklistAction,
    asignarResponsableChecklistAction
} from '../actions';
import { BomResumen } from '../bom/components/BomResumen';
import { BomTable } from '../bom/components/BomTable';
import { AgregarItemModal } from '../bom/components/AgregarItemModal';
import { aplicarRecetaBOMAction } from '../bom/actions';
import { HistorialRetirosProyecto } from '../equipamiento/components/HistorialRetirosProyecto';
import { HardwareLogisticaTabs } from '../equipamiento/components/HardwareLogisticaTabs';
import type { DespachoProyecto } from '../equipamiento/actions';
import { GestorTareasModal } from './GestorTareasModal';

interface Profile {
    id: string;
    full_name: string | null;
    rol: string | null;
}

interface Participante {
    id: string;
    rol_en_proyecto: string;
    activo: boolean;
    perfil: Profile | null;
}

interface ProyectoWidgetsProps {
    proyectoId: string;
    participantes: Participante[];
    tecnicosDisponibles: Profile[];
    bomItems: any[];
    catalogo: any[];
    entradas: any[];
    plantillas: any[];
    recetasBOM: any[];
    historialDespachos?: DespachoProyecto[];
    currentUserRol?: string;
    currentUserId?: string;
}

export function ProyectoWidgets({
    proyectoId,
    participantes,
    tecnicosDisponibles,
    bomItems,
    catalogo,
    entradas,
    plantillas,
    recetasBOM,
    historialDespachos = [],
    currentUserRol = 'tecnico',
    currentUserId = '',
}: ProyectoWidgetsProps) {
    const [isPending, startTransition] = useTransition();

    // ── BOM Modal State ──────────────────────────────────────────────────
    const [isBomModalOpen, setIsBomModalOpen] = useState(false);

    // ── Checklist Modal State ────────────────────────────────────────────
    const [isGestorTareasOpen, setIsGestorTareasOpen] = useState(false);

    // ── BOM Recipes Selector State ────────────────────────────────────────
    const [showRecipeSelector, setShowRecipeSelector] = useState(false);
    const [selectedRecipeToApply, setSelectedRecipeToApply] = useState<any | null>(null);

    function handleApplyRecipe() {
        if (!selectedRecipeToApply) return;
        const receta = selectedRecipeToApply;

        startTransition(async () => {
            const res = await aplicarRecetaBOMAction(proyectoId, receta.id);
            if (res.error) {
                alert(`Error al aplicar receta: ${res.error}`);
            } else {
                setShowRecipeSelector(false);
                setSelectedRecipeToApply(null);
            }
        });
    }

    // ── Planimetría Modal & Upload state ──────────────────────────────────
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [planTitle, setPlanTitle] = useState('');
    const [planFile, setPlanFile] = useState<File | null>(null);
    const [planError, setPlanError] = useState<string | null>(null);

    const planos = useMemo(() => {
        return entradas
            .filter(e => e.tipo === 'foto' && e.contenido?.startsWith('[PLANO]'))
            .map(e => {
                const url = e.adjuntos?.[0] || '#';
                const titulo = e.contenido.replace('[PLANO]', '').trim();
                return {
                    id: e.id,
                    titulo,
                    url,
                    fecha: new Date(e.created_at).toLocaleDateString('es-CL', {
                        day: 'numeric',
                        month: 'short',
                    }),
                };
            });
    }, [entradas]);

    function handleUploadPlan(e: React.FormEvent) {
        e.preventDefault();
        if (!planTitle.trim()) {
            setPlanError('El título es requerido.');
            return;
        }
        if (!planFile) {
            setPlanError('Selecciona un archivo.');
            return;
        }

        setPlanError(null);
        startTransition(async () => {
            const formData = new FormData();
            formData.append('proyecto_id', proyectoId);
            formData.append('titulo', planTitle.trim());
            formData.append('archivo', planFile);

            const res = await subirPlanimetriaAction({ error: null }, formData);
            if (res.error) {
                setPlanError(res.error);
            } else {
                setPlanTitle('');
                setPlanFile(null);
                setIsPlanModalOpen(false);
            }
        });
    }

    // ── Participants Selection dropdown state ────────────────────────────
    const [showAddTechDropdown, setShowAddTechDropdown] = useState(false);
    const [showAddTechList, setShowAddTechList] = useState(false);
    const [selectedTechToAdd, setSelectedTechToAdd] = useState<Profile | null>(null);
    const [participantsError, setParticipantsError] = useState<string | null>(null);

    // ── Viáticos Form states ─────────────────────────────────────────────
    const [montoViatico, setMontoViatico] = useState<string>('');
    const [conceptoViatico, setConceptoViatico] = useState<string>('');
    const [showTechForViaticoDropdown, setShowTechForViaticoDropdown] = useState(false);
    const [selectedTechForViatico, setSelectedTechForViatico] = useState<Participante | null>(null);
    const [viaticosError, setViaticosError] = useState<string | null>(null);

    // ── Derived participants list ────────────────────────────────────────
    const activeParticipantes = useMemo(() => {
        return participantes.filter(p => p.activo);
    }, [participantes]);

    // Filter available technicians that are not already active participants
    const addableTecnicos = useMemo(() => {
        const activeUserIds = new Set(activeParticipantes.map(p => p.perfil?.id).filter(Boolean));
        return tecnicosDisponibles.filter(t => !activeUserIds.has(t.id));
    }, [tecnicosDisponibles, activeParticipantes]);

    // ── Filter and Sum Viáticos from entrances ──────────────────────────
    const viaticos = useMemo(() => {
        return entradas
            .filter(e => e.tipo === 'hito' && e.contenido?.startsWith('[VIATICO]'))
            .map(e => {
                const payload = e.adjuntos?.[0] || {};
                return {
                    id: e.id,
                    monto: payload.monto || 0,
                    concepto: payload.concepto || 'Gastos',
                    tecnicoNombre: payload.tecnico_nombre || 'Técnico',
                    fecha: new Date(e.created_at).toLocaleDateString('es-CL', {
                        day: 'numeric',
                        month: 'short',
                    }),
                };
            });
    }, [entradas]);

    const totalViaticos = useMemo(() => {
        return viaticos.reduce((sum, v) => sum + v.monto, 0);
    }, [viaticos]);

    // ── Participant Actions ──────────────────────────────────────────────
    function handleAddParticipant() {
        if (!selectedTechToAdd) return;
        setParticipantsError(null);
        startTransition(async () => {
            const res = await agregarParticipanteAction(
                proyectoId, 
                selectedTechToAdd.id, 
                selectedTechToAdd.full_name ?? 'Técnico'
            );
            if (res.error) {
                setParticipantsError(res.error);
            } else {
                setSelectedTechToAdd(null);
                setShowAddTechDropdown(false);
            }
        });
    }

    function handleRemoveParticipant(id: string, name: string) {
        setParticipantsError(null);
        startTransition(async () => {
            const res = await eliminarParticipanteAction(id, proyectoId, name);
            if (res.error) {
                setParticipantsError(res.error);
            }
        });
    }

    // ── Viático Action ───────────────────────────────────────────────────
    function handleAddViatico(e: React.FormEvent) {
        e.preventDefault();
        const montoNum = parseInt(montoViatico);
        if (isNaN(montoNum) || montoNum <= 0) {
            setViaticosError('Monto inválido.');
            return;
        }
        if (!conceptoViatico.trim()) {
            setViaticosError('El concepto es requerido.');
            return;
        }
        if (!selectedTechForViatico) {
            setViaticosError('Selecciona un técnico asignado.');
            return;
        }

        setViaticosError(null);
        startTransition(async () => {
            const res = await registrarViaticoAction(
                proyectoId,
                montoNum,
                conceptoViatico.trim(),
                selectedTechForViatico.perfil?.id ?? '',
                selectedTechForViatico.perfil?.full_name ?? 'Técnico'
            );
            if (res.error) {
                setViaticosError(res.error);
            } else {
                setMontoViatico('');
                setConceptoViatico('');
                setSelectedTechForViatico(null);
            }
        });
    }

    // ── BOM Stats Calculations ──────────────────────────────────────────
    const bomStats = useMemo(() => {
        const total = bomItems.reduce((acc: number, item: any) => acc + (item.cantidad_total || 0), 0);
        const instalado = bomItems.reduce((acc: number, item: any) => acc + (item.cantidad_entregada || 0), 0);
        // Pendiente = saldo por entregar (cantidad_total − cantidad_entregada), nunca negativo.
        // Se reconcilia: total = instalado + pendiente.
        const pendiente = bomItems.reduce(
            (acc: number, item: any) => acc + Math.max(0, (item.cantidad_total || 0) - (item.cantidad_entregada || 0)),
            0,
        );
        return { total, instalado, pendiente };
    }, [bomItems]);

    return (
        <div className="space-y-6 select-none">

            {/* ── WIDGET 1: PARTICIPANTES ────────────────────────────────────── */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Técnicos Asignados</h3>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {activeParticipantes.length}
                    </span>
                </div>

                {/* Lista de técnicos */}
                {activeParticipantes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hay técnicos asignados al proyecto aún.</p>
                ) : (
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto space-y-2 pr-1">
                        {activeParticipantes.map(p => {
                            const name = p.perfil?.full_name ?? 'Sin nombre';
                            return (
                                <div key={p.id} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0 group">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-600 flex items-center justify-center shrink-0 uppercase">
                                            {name.slice(0, 2)}
                                        </div>
                                        <span className="text-xs font-semibold text-slate-800 truncate">{name}</span>
                                    </div>
                                    {currentUserRol !== 'tecnico' && (
                                        <button
                                            onClick={() => handleRemoveParticipant(p.id, name)}
                                            disabled={isPending}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Eliminar técnico"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Formulario / selector de técnicos (Dropdown Customizado) */}
                {currentUserRol !== 'tecnico' && (
                    <div className="relative pt-2 border-t border-slate-150/40">
                        {showAddTechDropdown ? (
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Seleccionar técnico</label>
                                
                                {/* Selector simulado */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowTechForViaticoDropdown(false);
                                            setShowAddTechList(v => !v);
                                        }}
                                        className="w-full text-left bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 transition-all flex items-center justify-between"
                                    >
                                        <span>{selectedTechToAdd?.full_name ?? 'Seleccionar de la lista...'}</span>
                                        <Plus className="w-3.5 h-3.5 text-slate-400" />
                                    </button>

                                    {/* Dropdown flotante */}
                                    {showAddTechList && (
                                        <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-40 overflow-y-auto py-1">
                                            {addableTecnicos.length === 0 ? (
                                                <p className="text-[10px] text-slate-400 text-center py-3">No hay más técnicos disponibles</p>
                                            ) : (
                                                addableTecnicos.map(t => (
                                                    <button
                                                        key={t.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedTechToAdd(t);
                                                            setShowAddTechList(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 font-medium text-slate-700"
                                                    >
                                                        {t.full_name}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddTechDropdown(false);
                                            setShowAddTechList(false);
                                            setSelectedTechToAdd(null);
                                        }}
                                        className="flex-1 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-[10px] font-black hover:bg-slate-50 uppercase tracking-wider"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isPending || !selectedTechToAdd}
                                        onClick={handleAddParticipant}
                                        className="flex-1 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black hover:bg-slate-800 disabled:opacity-50 uppercase tracking-wider flex items-center justify-center gap-1.5"
                                    >
                                        {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowAddTechDropdown(true)}
                                className="w-full py-2 bg-slate-50 border border-dashed border-slate-200 hover:border-slate-350 hover:bg-slate-100/50 rounded-xl text-[10px] font-black text-slate-600 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                            >
                                <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                                Asignar Técnico
                            </button>
                        )}
                    </div>
                )}

                {participantsError && (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-red-650 bg-red-50/60 p-2 rounded-lg border border-red-105/30">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{participantsError}</span>
                    </div>
                )}
            </div>

            {/* ── WIDGET: PLANIMETRÍA Y DOCUMENTOS ─────────────────────────── */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Map className="w-4 h-4 text-rose-500" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Planimetría y Planos</h3>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {planos.length}
                    </span>
                </div>

                {/* Lista de planos */}
                {planos.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hay planos o documentos subidos aún.</p>
                ) : (
                    <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto space-y-2 pr-1">
                        {planos.map(p => (
                            <div key={p.id} className="flex justify-between items-center py-1.5 first:pt-0 last:pb-0 gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 truncate" title={p.titulo}>{p.titulo}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">Subido: {p.fecha}</p>
                                </div>
                                <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-150/40 rounded-lg hover:bg-indigo-100/60 transition-colors uppercase tracking-wider"
                                >
                                    <FileDown className="w-3 h-3" />
                                    Ver
                                </a>
                            </div>
                        ))}
                    </div>
                )}

                {/* Botón para abrir modal de carga */}
                {currentUserRol !== 'tecnico' && (
                    <button
                        type="button"
                        onClick={() => setIsPlanModalOpen(true)}
                        className="w-full py-2 bg-slate-50 border border-dashed border-slate-200 hover:border-slate-350 hover:bg-slate-100/50 rounded-xl text-[10px] font-black text-slate-600 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                    >
                        <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                        Subir Plano
                    </button>
                )}
            </div>

            {/* ── WIDGET 2: LOGÍSTICA (BOM) ──────────────────────────────────── */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-emerald-500" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Hardware y Logística</h3>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {bomStats.total}
                    </span>
                </div>

                {/* Grid de contadores: se reconcilian (Requeridos = Instalados + Pendientes) */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 border border-slate-100/80 rounded-xl py-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requeridos</p>
                        <p className="text-lg font-black text-slate-800 mt-0.5">{bomStats.total}</p>
                    </div>
                    <div className="bg-amber-500/[0.04] border border-amber-200/20 rounded-xl py-2">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pendientes</p>
                        <p className="text-lg font-black text-amber-700 mt-0.5">{bomStats.pendiente}</p>
                    </div>
                    <div className="bg-emerald-500/[0.04] border border-emerald-200/20 rounded-xl py-2">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Instalados</p>
                        <p className="text-lg font-black text-emerald-700 mt-0.5">{bomStats.instalado}</p>
                    </div>
                </div>

                {/* Botón para abrir modal de administración */}
                <button
                    type="button"
                    onClick={() => setIsBomModalOpen(true)}
                    className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-sm hover:bg-slate-700 cursor-pointer"
                >
                    <Eye className="w-3.5 h-3.5" />
                    Gestionar Hardware y Logística
                </button>
            </div>

            {/* ── WIDGET 3: VIÁTICOS ─────────────────────────────────────────── */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-500" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Gastos de Instalación</h3>
                    </div>
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                        ${totalViaticos.toLocaleString('es-CL')}
                    </span>
                </div>

                {/* Lista de gastos registrados */}
                {viaticos.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No se han registrado viáticos aún.</p>
                ) : (
                    <div className="divide-y divide-slate-100 max-h-32 overflow-y-auto space-y-2 pr-1">
                        {viaticos.map(v => (
                            <div key={v.id} className="flex justify-between items-start py-1.5 first:pt-0 last:pb-0 gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 leading-tight">{v.concepto}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">{v.tecnicoNombre} · {v.fecha}</p>
                                </div>
                                <span className="text-xs font-black text-slate-800 shrink-0 font-mono">
                                    ${v.monto.toLocaleString('es-CL')}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Formulario de registro de gasto */}
                {currentUserRol !== 'tecnico' && (
                    activeParticipantes.length === 0 ? (
                        <p className="text-[10px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-150/40 text-center font-medium leading-relaxed">
                            Agrega técnicos al proyecto en el widget superior para poder asociar y registrar gastos.
                        </p>
                    ) : (
                        <form onSubmit={handleAddViatico} className="pt-3 border-t border-slate-150/40 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Concepto</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Peaje"
                                        value={conceptoViatico}
                                        onChange={e => setConceptoViatico(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-slate-200/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Monto (CLP)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="Ej: 15000"
                                        value={montoViatico}
                                        onChange={e => setMontoViatico(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-slate-200/80 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                    />
                                </div>
                            </div>

                            {/* Selección del técnico (Dropdown Customizado) */}
                            <div className="space-y-1 relative">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Asignado a</label>
                                
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddTechDropdown(false);
                                        setShowTechForViaticoDropdown(v => !v);
                                    }}
                                    className="w-full text-left bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 transition-all flex items-center justify-between"
                                >
                                    <span>{selectedTechForViatico?.perfil?.full_name ?? 'Seleccionar técnico...'}</span>
                                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                                </button>

                                {showTechForViaticoDropdown && (
                                    <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-32 overflow-y-auto py-1">
                                        {activeParticipantes.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedTechForViatico(p);
                                                    setShowTechForViaticoDropdown(false);
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 font-medium text-slate-700"
                                            >
                                                {p.perfil?.full_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isPending || !conceptoViatico || !montoViatico}
                                className="w-full py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                            >
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Registrar viático
                            </button>

                            {viaticosError && (
                                <div className="flex items-center gap-1.5 text-[10px] font-medium text-red-650 bg-red-50/60 p-2 rounded-lg border border-red-105/30">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{viaticosError}</span>
                                </div>
                            )}
                        </form>
                    )
                )}
            </div>

            {/* ── WIDGET 4: CHECKLIST DE TAREAS ─────────────────────────────── */}
            <WidgetChecklist 
                proyectoId={proyectoId} 
                entradas={entradas} 
                currentUserRol={currentUserRol} 
                currentUserId={currentUserId} 
                onOpenModal={() => setIsGestorTareasOpen(true)}
            />

            {/* ── MODAL COMPLETO: MOTOR LOGÍSTICO (BOM) ──────────────────────── */}
            {isBomModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl border border-slate-200/50 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 relative flex flex-col gap-6">
                        
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 shadow">
                                    <Package className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Hardware y Logística</h3>
                                    <p className="text-xs text-slate-400">
                                        {bomStats.total === 0 ? 'Sin ítems registrados' : `${bomStats.instalado} de ${bomStats.total} equipos entregados`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 relative">
                                {/* Recipe Selector Dropdown Container */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowRecipeSelector(!showRecipeSelector);
                                            setSelectedRecipeToApply(null);
                                        }}
                                        disabled={isPending}
                                        className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200/80 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 animate-pulse-slow"
                                        title="Cargar Receta de Hardware"
                                    >
                                        <Zap className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Cargar Receta</span>
                                    </button>

                                    {showRecipeSelector && (
                                        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 max-h-80 overflow-y-auto flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                                            <div className="flex justify-between items-center pb-1.5 border-b border-slate-100 shrink-0">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargar Receta de Hardware</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowRecipeSelector(false);
                                                        setSelectedRecipeToApply(null);
                                                    }}
                                                    className="text-slate-450 hover:text-slate-700 cursor-pointer"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {selectedRecipeToApply ? (
                                                /* Confirmation View */
                                                <div className="space-y-3 py-1 text-left">
                                                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                                                        ¿Estás seguro de inyectar <span className="font-black text-slate-800">{selectedRecipeToApply.items?.length || 0}</span> materiales de la receta <span className="font-black text-slate-800">"{selectedRecipeToApply.nombre}"</span> en estado <span className="font-black text-emerald-600 uppercase">REQUERIDO</span> a este proyecto?
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedRecipeToApply(null)}
                                                            className="flex-1 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-[10px] font-black hover:bg-slate-50 uppercase tracking-wider cursor-pointer"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isPending}
                                                            onClick={handleApplyRecipe}
                                                            className="flex-1 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black hover:bg-slate-700 disabled:opacity-50 uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                                                        >
                                                            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                                            Confirmar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* List View */
                                                <div className="flex flex-col gap-1">
                                                    {recetasBOM.length === 0 ? (
                                                        <p className="text-[10px] text-slate-400 text-center py-4 font-medium leading-relaxed">
                                                            No hay recetas de hardware disponibles.
                                                        </p>
                                                    ) : (
                                                        recetasBOM.map(r => (
                                                            <button
                                                                key={r.id}
                                                                type="button"
                                                                onClick={() => setSelectedRecipeToApply(r)}
                                                                className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-50 font-bold text-slate-700 rounded-xl flex flex-col gap-1 transition-colors border border-transparent hover:border-slate-100 cursor-pointer"
                                                            >
                                                                <div className="flex items-center justify-between gap-2 w-full">
                                                                    <span className="truncate">{r.nombre}</span>
                                                                    <span className="text-[9px] font-black text-slate-400 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                        {r.items?.length || 0} ítems
                                                                    </span>
                                                                </div>
                                                                {/* Item Preview */}
                                                                <div className="flex flex-wrap gap-0.5 max-h-8 overflow-hidden">
                                                                    {(r.items || []).slice(0, 3).map((item: any, idx: number) => (
                                                                        <span key={idx} className="text-[8px] font-medium text-slate-400 bg-slate-50 px-1 rounded truncate max-w-[80px]">
                                                                            {item.nombre_modelo}
                                                                        </span>
                                                                    ))}
                                                                    {r.items?.length > 3 && (
                                                                        <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-1 rounded">
                                                                            +{r.items.length - 3}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <AgregarItemModal proyectoId={proyectoId} catalogo={catalogo} />
                                <button
                                    onClick={() => {
                                        setIsBomModalOpen(false);
                                        setShowRecipeSelector(false);
                                        setSelectedRecipeToApply(null);
                                    }}
                                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                                >
                                    <X className="w-4 h-4 text-slate-500" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Modal Body: navegación por pestañas Receta Maestra / Historial de Despachos */}
                        <HardwareLogisticaTabs
                            totalDespachos={historialDespachos.length}
                            recetaContent={<BomTable items={bomItems} proyectoId={proyectoId} />}
                            historialContent={<HistorialRetirosProyecto despachos={historialDespachos} />}
                        />
                    </div>
                </div>
            )}

            {/* ── MODAL: SUBIR PLANO ────────────────────────────────────────── */}
            {isPlanModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <form onSubmit={handleUploadPlan} className="bg-white rounded-3xl border border-slate-200/50 shadow-2xl w-full max-w-sm p-6 relative space-y-4">
                        <button
                            type="button"
                            onClick={() => {
                                setIsPlanModalOpen(false);
                                setPlanTitle('');
                                setPlanFile(null);
                                setPlanError(null);
                            }}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                        
                        <div className="flex items-center gap-2">
                            <UploadCloud className="w-5 h-5 text-rose-500" />
                            <h3 className="text-base font-black text-slate-900">Subir Plano o Planimetría</h3>
                        </div>
                        
                        <div className="space-y-3 pt-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Título del Plano</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Layout Eléctrico v2"
                                    value={planTitle}
                                    onChange={e => setPlanTitle(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Archivo (PDF, Imagen)</label>
                                <input
                                    type="file"
                                    required
                                    accept="image/*,application/pdf"
                                    onChange={e => setPlanFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-all"
                                />
                            </div>
                        </div>

                        {planError && (
                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-red-650 bg-red-50/60 p-2 rounded-lg border border-red-105/30">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{planError}</span>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPlanModalOpen(false);
                                    setPlanTitle('');
                                    setPlanFile(null);
                                    setPlanError(null);
                                }}
                                className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isPending || !planTitle || !planFile}
                                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Subir
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── MODAL COMPLETO: GESTOR DE TAREAS (CHECKLIST) ──────────────── */}
            {isGestorTareasOpen && (
                <GestorTareasModal
                    proyectoId={proyectoId}
                    entradas={entradas}
                    plantillas={plantillas}
                    currentUserRol={currentUserRol}
                    currentUserId={currentUserId}
                    participantes={activeParticipantes}
                    onClose={() => setIsGestorTareasOpen(false)}
                />
            )}

        </div>
    );
}

// ── WIDGET: CHECKLIST DE TAREAS INTERACTIVAS (CON INTERFAZ OPTIMISTA) ────────
interface ChecklistTask {
    id: string;
    titulo: string;
    completado: boolean;
    completado_por: string | null;
    completado_en: string | null;
    asignado_a: { id: string; nombre: string; iniciales: string } | null;
}

export function WidgetChecklist({
    proyectoId,
    entradas,
    currentUserRol = 'tecnico',
    currentUserId = '',
    onOpenModal
}: {
    proyectoId: string;
    entradas: any[];
    currentUserRol?: string;
    currentUserId?: string;
    onOpenModal: () => void;
}) {
    const [isPending, startTransition] = useTransition();

    const tasks: ChecklistTask[] = useMemo(() => {
        return entradas
            .filter(e => e.tipo === 'hito' && e.contenido?.startsWith('[CHECKLIST]'))
            .map(e => {
                const titulo = e.contenido.replace('[CHECKLIST]', '').trim();
                const payload = e.adjuntos?.[0] || {};
                return {
                    id: e.id,
                    titulo,
                    completado: !!payload.completado,
                    completado_por: payload.completado_por || null,
                    completado_en: payload.completado_en ? new Date(payload.completado_en).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : null,
                    asignado_a: payload.asignado_a || null,
                };
            });
    }, [entradas]);

    const [optimisticTasks, setOptimisticTasks] = useOptimistic(
        tasks,
        (state, action: { type: 'toggle'; id: string; completado: boolean }) => {
            if (action.type === 'toggle') {
                return state.map(t =>
                    t.id === action.id ? { ...t, completado: action.completado, completado_por: action.completado ? 'Tú' : null, completado_en: action.completado ? 'ahora' : null } : t
                );
            }
            return state;
        }
    );

    function handleToggle(id: string, completado: boolean, titulo: string) {
        startTransition(async () => {
            setOptimisticTasks({ type: 'toggle', id, completado });
            const res = await toggleChecklistItemAction(proyectoId, id, completado, titulo);
            if (res.error) alert(`Error al actualizar tarea: ${res.error}`);
        });
    }

    const tareasVisiblesBase = useMemo(() => {
        return currentUserRol === 'tecnico' 
            ? optimisticTasks.filter(t => t.asignado_a?.id === currentUserId) 
            : optimisticTasks;
    }, [optimisticTasks, currentUserRol, currentUserId]);

    const filteredTasks = useMemo(() => {
        const pendientes = tareasVisiblesBase.filter(t => !t.completado);
        pendientes.sort((a, b) => {
            const aEsMio = a.asignado_a?.id === currentUserId ? -1 : 1;
            const bEsMio = b.asignado_a?.id === currentUserId ? -1 : 1;
            return aEsMio - bEsMio;
        });
        return pendientes;
    }, [tareasVisiblesBase, currentUserId]);

    const total = tareasVisiblesBase.length;
    const completed = tareasVisiblesBase.filter(t => t.completado).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const visibleTasks = filteredTasks.slice(0, 4);
    const hiddenCount = filteredTasks.length > 4 ? filteredTasks.length - 4 : 0;

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4 flex flex-col">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Resumen Checklist</h3>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {completed}/{total}
                </span>
            </div>

            {total > 0 && (
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Progreso</span>
                        <span>{percent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            )}

            {total === 0 ? (
                <p className="text-[11px] text-slate-400 font-medium py-2 text-center">No hay tareas registradas.</p>
            ) : (
                <div className="space-y-2.5">
                    {visibleTasks.map(task => (
                        <div key={task.id} className="flex items-start gap-2.5 group">
                            <button
                                type="button"
                                onClick={() => handleToggle(task.id, !task.completado, task.titulo)}
                                disabled={isPending}
                                className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                                    task.completado
                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-100'
                                        : 'border-slate-350 hover:border-slate-400 bg-slate-50'
                                }`}
                            >
                                {task.completado && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                            <div className="min-w-0 flex-1">
                                <p className={`text-[11px] font-semibold leading-normal truncate ${task.completado ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                    {task.titulo}
                                </p>
                            </div>
                        </div>
                    ))}
                    {hiddenCount > 0 && (
                        <p className="text-[10px] font-bold text-slate-400 pt-1 text-center">
                            + {hiddenCount} {hiddenCount === 1 ? 'tarea oculta' : 'tareas ocultas'}
                        </p>
                    )}
                </div>
            )}

            <button
                onClick={onOpenModal}
                className="w-full mt-2 py-2 bg-indigo-50/50 hover:bg-indigo-100/80 text-indigo-700 font-black text-xs rounded-xl transition-colors border border-indigo-200/50 uppercase tracking-wider"
            >
                Abrir Centro de Tareas
            </button>
        </div>
    );
}
