'use client';

import { useState } from 'react';
import { updateTicketPropertiesAction, assignTicketToMeAction, updateChildTicketDescription, setPendingWithReasonAction } from '../actions';
import Link from 'next/link';
import { AlertCircle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronRight, Activity, Flag, UserPlus, Calendar, Plus, Layers, Pencil, Banknote } from 'lucide-react';
import { TicketStatus } from '@/types/database.types';
import { AssignMaterialModal } from './AssignMaterialModal';
import { AddChildTicketModal } from './AddChildTicketModal';
import { CloseTicketModal } from './CloseTicketModal';
import { AsignarViaticoModal } from './AsignarViaticoModal';
import { PendingReasonModal } from './PendingReasonModal';
import { closeTicketWithActaAction } from '../actions';

interface PackingItem {
    modelo: string;
    familia: string;
    solicitado: number;
    utilizado: number;
}

interface Props {
    ticket: any;
    isAgent: boolean;
    isAdmin?: boolean;
    userRole?: string;
    currentUserId?: string;
    agents?: any[];
    ayudantesInfo?: { id: string; full_name: string }[];
    inventarioCentral?: any[];
    packingList?: PackingItem[];
    inventarioTicket?: any[];
    childTickets?: any[];
}

export default function TicketSidebar({ ticket, isAgent, isAdmin, userRole = 'usuario', currentUserId, agents = [], ayudantesInfo = [], inventarioCentral = [], packingList = [], inventarioTicket = [], childTickets = [] }: Props) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [showChildTicketModal, setShowChildTicketModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showViaticoModal, setShowViaticoModal] = useState(false);
    const [childrenOpen, setChildrenOpen] = useState(false);
    const [packingOpen, setPackingOpen] = useState(false);
    const [viaticoOpen, setViaticoOpen] = useState(false);
    const [editingChildId, setEditingChildId] = useState<string | null>(null);
    const [editingDescription, setEditingDescription] = useState('');
    const [isSavingDesc, setIsSavingDesc] = useState(false);
    const [agentToConfirm, setAgentToConfirm] = useState<any>(null);

    const isSystemelStaff = ['admin', 'tecnico', 'coordinador', 'admin_bodega'].includes(userRole);

    const isTerminal = ['cerrado', 'resuelto', 'anulado'].includes(ticket.estado);

    // Hardcode possible states to make rendering easier
    const statuses: { id: TicketStatus, label: string, color: string, icon: any }[] = [
        { id: 'esperando_agente', label: 'Sin Asignar', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: AlertCircle },
        { id: 'abierto', label: 'Abierto', color: 'bg-sky-100 text-sky-700 border-sky-200', icon: AlertCircle },
        { id: 'pendiente', label: 'Pendiente', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
        { id: 'programado', label: 'Programado', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Calendar },
        { id: 'en_progreso', label: 'En Progreso', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Activity },
        { id: 'resuelto', label: 'Resuelto', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
        { id: 'cerrado', label: 'Cerrado', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
        { id: 'anulado', label: 'Anulado', color: 'bg-red-100 text-red-700 border-red-200 shadow-sm ring-1 ring-red-300', icon: XCircle }
    ];

    const priorities = [
        { id: 'baja', label: 'Baja', color: 'text-blue-600' },
        { id: 'media', label: 'Media', color: 'text-amber-500' },
        { id: 'alta', label: 'Alta', color: 'text-red-600' },
        { id: 'crítica', label: 'Crítica', color: 'text-purple-700' }
    ];

    const currentStatusMenu = statuses.find(s => s.id === ticket.estado) || statuses[0];
    const StatusIcon = currentStatusMenu.icon;

    const [statusOpen, setStatusOpen] = useState(false);
    const [agentOpen, setAgentOpen] = useState(false);

    const handleUpdate = async (field: 'estado' | 'prioridad', value: string) => {
        setIsUpdating(true);
        setStatusOpen(false);
        try {
            const updates = { [field]: value };
            const result = await updateTicketPropertiesAction(ticket.id, updates);
            if (result.error) {
                alert(result.error);
            }
        } catch (error) {
            console.error('Update failed', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleStatusClick = (statusId: string) => {
        setStatusOpen(false);
        if (statusId === 'pendiente') {
            setShowPendingModal(true);
        } else {
            handleUpdate('estado', statusId);
        }
    };

    const handleAssignAgent = (agent: any) => {
        setAgentToConfirm(agent);
        setAgentOpen(false);
    };

    const confirmAgentAssignment = async () => {
        if (!agentToConfirm) return;
        setIsUpdating(true);
        try {
            const updates = { agente_asignado_id: agentToConfirm.id, estado: 'abierto' } as any;
            const result = await updateTicketPropertiesAction(ticket.id, updates);
            if (result.error) alert(result.error);
        } catch (error) {
            console.error(error);
        } finally {
            setIsUpdating(false);
            setAgentToConfirm(null);
        }
    };

    const startEditing = (child: any, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingChildId(child.id);
        setEditingDescription(child.descripcion || '');
    };

    const cancelEditing = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingChildId(null);
        setEditingDescription('');
    };

    const saveEditing = async (childId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!editingDescription.trim()) return;
        
        setIsSavingDesc(true);
        const result = await updateChildTicketDescription(childId, editingDescription);
        setIsSavingDesc(false);
        
        if (result?.error || result?.success === false) {
            alert(result.error || 'Error al actualizar descripción');
        } else {
            setEditingChildId(null);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 sticky top-8 flex flex-col max-h-[calc(100vh-6rem)]">
            <div className="bg-gray-50/50 p-4 border-b border-gray-200 rounded-t-2xl shrink-0">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    Propiedades
                </h3>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar">
                {/* ASSIGNMENT SECTION */}
                {(ticket.agente_asignado_id || isAdmin) && (
                    <div className="p-5 border-b border-gray-50 flex flex-col gap-3">
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Agente a cargo</span>
                        
                        {isAdmin && !isTerminal ? (
                            <div className="relative">
                                <button
                                    onClick={() => { setAgentOpen(!agentOpen); setStatusOpen(false); }}
                                    disabled={isUpdating}
                                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 font-bold text-sm transition-all shadow-sm hover:bg-indigo-50/80 text-indigo-900"
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        <UserPlus className="w-4 h-4 text-indigo-500" />
                                        {ticket.agente?.full_name || 'Sin Asignar'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-indigo-400" />
                                </button>
                                {agentOpen && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setAgentOpen(false)}></div>
                                        <div className="absolute z-40 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1.5 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
                                            {agents.map(a => (
                                                <button
                                                    key={a.id}
                                                    onClick={() => handleAssignAgent(a)}
                                                    className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors truncate"
                                                >
                                                    <span className={ticket.agente_asignado_id === a.id ? 'text-indigo-900 font-bold' : 'text-gray-700'}>
                                                        {a.full_name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className={`flex items-center justify-between p-3 rounded-xl border ${isTerminal ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50/30 border-indigo-100/50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white ${isTerminal ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>
                                        {ticket.agente?.full_name?.charAt(0).toUpperCase() || (ticket.agente_asignado_id ? 'A' : '?')}
                                    </div>
                                    <span className={`font-bold text-sm truncate ${isTerminal ? 'text-slate-700' : 'text-gray-900'}`}>{ticket.agente?.full_name || 'Sin Asignar'}</span>
                                </div>
                                {isTerminal && <span title="Asignación congelada para auditoría" className="text-slate-400">🔒</span>}
                            </div>
                        )}

                        {/* Técnicos Ayudantes (solo cuando está cerrado/resuelto y hay ayudantes) */}
                        {isTerminal && ayudantesInfo.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Técnicos Ayudantes</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {ayudantesInfo.map(a => (
                                        <span key={a.id} className="inline-flex items-center bg-violet-100 text-violet-800 border border-violet-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                                            {a.full_name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isAgent && !isTerminal && (
                            <button
                                onClick={() => setShowMaterialModal(true)}
                                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-black tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                + ASIGNAR MATERIAL
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                onClick={() => setShowViaticoModal(true)}
                                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-700 text-xs font-black tracking-widest hover:bg-emerald-50 transition-colors shadow-sm"
                            >
                                $ ASIGNAR VIÁTICO
                            </button>
                        )}
                    </div>
                )}

                {/* STATUS SECTION */}
                <div className="p-5 border-b border-gray-50">
                    {isAgent && ticket.estado !== 'cerrado' && ticket.estado !== 'resuelto' && ticket.estado !== 'anulado' && (
                        <>
                            <button
                                onClick={() => setShowCloseModal(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all mb-4"
                            >
                                <CheckCircle2 className="w-5 h-5" /> Generar Acta y Cerrar
                            </button>
                            <CloseTicketModal
                                isOpen={showCloseModal}
                                onClose={() => setShowCloseModal(false)}
                                ticket={ticket}
                                materiales={inventarioTicket}
                                agents={agents}
                                currentUserId={currentUserId}
                                onConfirm={async (notas, firmaCliente, firmaTecnico, receptorNombre, latitud, longitud, ayudantes) => {
                                    setIsUpdating(true);
                                    const result = await closeTicketWithActaAction(ticket.id, notas, firmaCliente, firmaTecnico, receptorNombre, latitud, longitud, ayudantes);
                                    setIsUpdating(false);
                                    if (result.error) alert(result.error);
                                    else setShowCloseModal(false);
                                }}
                            />
                        </>
                    )}

                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Estado del Ticket</span>

                    {((isAgent || isAdmin) && ticket.estado !== 'cerrado' && ticket.estado !== 'resuelto' && ticket.estado !== 'anulado') ? (
                        <div className="relative">
                            <button
                                onClick={() => setStatusOpen(!statusOpen)}
                                disabled={isUpdating}
                                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border font-bold text-sm transition-all shadow-sm ${currentStatusMenu.color} ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-95 cursor-pointer'}`}
                            >
                                <span className="flex items-center gap-2">
                                    <StatusIcon className="w-4 h-4" />
                                    {currentStatusMenu.label}
                                </span>
                                <ChevronDown className="w-4 h-4 opacity-70" />
                            </button>

                            {statusOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setStatusOpen(false)}></div>
                                    <div className="absolute z-40 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1.5 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                                        {statuses.filter(s => {
                                            if (s.id === 'cerrado') return false;
                                            if (isAgent && !isAdmin && ['anulado', 'esperando_agente', 'programado', 'resuelto'].includes(s.id)) return false;
                                            return true;
                                        }).map(s => {
                                            const Icon = s.icon;
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => handleStatusClick(s.id)}
                                                    className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                                >
                                                    <div className={`p-1.5 rounded-lg border ${s.color}`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <span className={s.id === ticket.estado ? 'text-indigo-900 font-bold' : 'text-gray-700'}>
                                                        {s.label}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className={`inline-flex items-center px-4 py-2 rounded-xl border font-bold text-sm shadow-sm ${currentStatusMenu.color}`}>
                            <StatusIcon className="w-4 h-4 mr-2" />
                            {currentStatusMenu.label}
                        </div>
                    )}
                </div>

                <div className="p-5 border-b border-gray-50">
                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Prioridad</span>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="p-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                            <Flag className={`w-4 h-4 ${priorities.find(p => p.id === ticket.prioridad)?.color}`} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Prioridad del caso</span>
                            <span className="text-sm font-bold text-gray-900 capitalize">{ticket.prioridad}</span>
                        </div>
                    </div>
                </div>

                {/* PACKING LIST SECTION — solo personal Systel */}
                {isSystemelStaff && packingList.length > 0 && (
                    <div className="border-b border-gray-50">
                        <button
                            onClick={() => setPackingOpen(o => !o)}
                            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Lista de Empaque</span>
                                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                                    {packingList.length}
                                </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${packingOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <div className={`grid transition-all duration-300 ease-in-out ${packingOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                            <div className="overflow-hidden">
                                <div className="px-4 pb-5 space-y-2">
                                    {/* Encabezado de columnas */}
                                    <div className="flex items-center justify-between px-2 mb-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Producto</span>
                                        <div className="flex gap-3">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 w-16 text-center">Solicitado</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 w-16 text-center">Utilizado</span>
                                        </div>
                                    </div>

                                    {packingList.map((item, i) => {
                                        const delta = item.utilizado - item.solicitado;
                                        return (
                                            <div key={i} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-indigo-200 hover:bg-indigo-50/20 transition-colors">
                                                {/* Producto */}
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-[13px] font-bold text-slate-800 truncate leading-tight">{item.modelo}</span>
                                                    <span className="text-[10px] font-semibold text-slate-400 capitalize leading-tight">{item.familia}</span>
                                                </div>

                                                {/* Métricas */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* Solicitado */}
                                                    <div className="flex flex-col items-center w-14 bg-amber-50 border border-amber-100 rounded-lg py-1 px-1.5">
                                                        <span className="text-[8px] font-black uppercase text-amber-500 leading-none tracking-wide">Solicit.</span>
                                                        <span className="text-base font-black text-amber-700 leading-tight">{item.solicitado}</span>
                                                    </div>

                                                    {/* Utilizado */}
                                                    <div className={`flex flex-col items-center w-14 rounded-lg py-1 px-1.5 border ${
                                                        item.utilizado === 0
                                                            ? 'bg-slate-50 border-slate-200'
                                                            : item.utilizado < item.solicitado
                                                            ? 'bg-emerald-50 border-emerald-200'
                                                            : 'bg-emerald-100 border-emerald-300'
                                                    }`}>
                                                        <span className={`text-[8px] font-black uppercase leading-none tracking-wide ${item.utilizado === 0 ? 'text-slate-400' : 'text-emerald-600'}`}>Utiliz.</span>
                                                        <span className={`text-base font-black leading-tight ${item.utilizado === 0 ? 'text-slate-400' : 'text-emerald-700'}`}>{item.utilizado}</span>
                                                    </div>

                                                    {/* Delta badge */}
                                                    {item.solicitado > 0 && (
                                                        <div className={`text-[9px] font-black w-8 text-center rounded-md py-1 leading-tight ${
                                                            delta === 0 && item.utilizado > 0
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : delta < 0
                                                                ? 'bg-orange-50 text-orange-600'
                                                                : 'bg-slate-100 text-slate-400'
                                                        }`}>
                                                            {delta === 0 && item.utilizado > 0 ? '✓' : delta < 0 ? `${delta}` : '—'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIÁTICOS ASIGNADOS — solo admin/coordinador */}
                {(() => {
                    if (!isAdmin) return null;
                    const viaticos = (ticket.ticket_messages || []).filter((m: any) =>
                        m.es_sistema && /Viático de \$\d+ asignado/.test(m.mensaje || '')
                    );
                    if (viaticos.length === 0) return null;
                    const total = viaticos.reduce((acc: number, m: any) => {
                        const match = m.mensaje?.match(/Viático de \$(\d+) asignado/);
                        return acc + (match ? parseInt(match[1], 10) : 0);
                    }, 0);
                    const totalFmt = total.toLocaleString('es-CL');
                    return (
                        <div className="border-b border-gray-50">
                            <button
                                onClick={() => setViaticoOpen(o => !o)}
                                className="w-full flex items-center justify-between p-5 hover:bg-emerald-50/30 transition-colors group"
                            >
                                <div className="flex items-center gap-2">
                                    <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Viáticos Asignados</span>
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                        {viaticos.length}
                                    </span>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${viaticoOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <div className={`grid transition-all duration-300 ease-in-out ${viaticoOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                <div className="overflow-hidden">
                                    <div className="px-5 pb-5 space-y-3">
                                        {/* Total acumulado */}
                                        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Total acumulado</span>
                                            <span className="text-base font-black text-emerald-800">${totalFmt}</span>
                                        </div>
                                        {/* Detalle por registro */}
                                        {viaticos.map((m: any) => {
                                            const match = m.mensaje?.match(/Viático de \$(\d+) asignado\. Comentario: (.*)/);
                                            if (!match) return null;
                                            const monto = parseInt(match[1], 10).toLocaleString('es-CL');
                                            const comentario = match[2];
                                            return (
                                                <div key={m.id} className="flex justify-between items-start gap-2 p-2.5 bg-white border border-emerald-100 rounded-xl">
                                                    <p className="text-[11px] text-slate-500 italic truncate flex-1">"{comentario}"</p>
                                                    <span className="text-sm font-black text-emerald-700 shrink-0">${monto}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* RESTAURANT INFO SECTION (LIMPIA Y RESTAURADA) */}
                {ticket.restaurantes && (
                    <div className="p-5 bg-gray-50/30 rounded-b-2xl">
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                            Información de Sucursal
                        </span>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sucursal</span>
                                <span className="text-[15px] font-bold text-slate-900">
                                    {ticket.restaurantes.sigla} - {ticket.restaurantes.nombre_restaurante}
                                </span>
                                {ticket.restaurantes.razon_social && (
                                    <span className="text-sm text-muted-foreground text-slate-400 font-medium">
                                        {ticket.restaurantes.razon_social}
                                    </span>
                                )}
                            </div>



                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dirección</span>
                                <span className="text-[15px] font-bold text-slate-900">
                                    {ticket.restaurantes.direccion || 'No especificada'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* TICKETS ADICIONALES (HIJOS) SECTION */}
                {childTickets.length > 0 && (
                    <div className="border-b border-gray-50 flex flex-col">
                        <button 
                            onClick={() => setChildrenOpen(!childrenOpen)}
                            className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-500" />
                                <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Tickets Adicionales ({childTickets.length})</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${childrenOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {childrenOpen && (
                            <div className="px-5 pb-5 pt-0 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {childTickets.map((child: any) => {
                                    const cStatus = statuses.find(s => s.id === child.estado) || statuses[0];
                                    const StatusIcon = cStatus.icon;
                                    return (
                                        <div 
                                            key={child.id} 
                                            className="block p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-white transition-colors group"
                                        >
                                            <div className="flex justify-between items-start mb-1.5">
                                                <Link href={`/dashboard/ticket/${child.id}`} className="text-xs font-black text-indigo-700 uppercase tracking-widest hover:underline">
                                                    NC-{child.numero_ticket}
                                                </Link>
                                                <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${cStatus.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {cStatus.label}
                                                </div>
                                            </div>
                                            <Link href={`/dashboard/ticket/${child.id}`} className="text-sm font-semibold text-slate-700 line-clamp-2 leading-tight hover:text-indigo-900 transition-colors block mb-2">
                                                {child.titulo}
                                            </Link>

                                            {editingChildId === child.id ? (
                                                <div className="mt-3 flex flex-col gap-2">
                                                    <textarea 
                                                        value={editingDescription}
                                                        onChange={e => setEditingDescription(e.target.value)}
                                                        className="w-full text-xs p-2.5 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] text-slate-600 bg-white"
                                                        placeholder="Modifica la descripción del ticket..."
                                                        title="Editar Descripción"
                                                    />
                                                    <div className="flex gap-2 justify-end">
                                                        <button 
                                                            onClick={cancelEditing} 
                                                            disabled={isSavingDesc}
                                                            className="px-3 py-1.5 text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button 
                                                            onClick={(e) => saveEditing(child.id, e)} 
                                                            disabled={isSavingDesc}
                                                            className="px-3 py-1.5 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm"
                                                        >
                                                            {isSavingDesc ? 'Guardando...' : 'Guardar'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-xs text-slate-500 relative">
                                                    <p className="whitespace-pre-wrap">{child.descripcion}</p>
                                                    
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50 min-h-[24px]">
                                                        <div className="flex-1">
                                                            {child.descripcion_editada === true && (
                                                                <span className="italic text-[10px] text-slate-400 font-medium tracking-wide">(Corregido por Técnico)</span>
                                                            )}
                                                        </div>
                                                        {isAgent && !isTerminal && (
                                                            <button 
                                                                onClick={(e) => startEditing(child, e)}
                                                                className="opacity-0 group-hover:opacity-100 p-1.5 bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-md transition-all ml-auto focus:opacity-100 shadow-sm"
                                                                title="Corregir descripción"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ACTION SECTION - ADD CHILD TICKET */}
            {isAgent && (
                <div className="p-4 bg-white border-t border-slate-200">
                    <button 
                        onClick={() => setShowChildTicketModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-bold shadow-sm hover:bg-indigo-100 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Sumar Ticket Adicional
                    </button>
                </div>
            )}

            <PendingReasonModal
                isOpen={showPendingModal}
                onClose={() => setShowPendingModal(false)}
                onConfirm={async (motivo) => {
                    setIsUpdating(true);
                    const result = await setPendingWithReasonAction(ticket.id, motivo);
                    setIsUpdating(false);
                    if (result.error) throw new Error(result.error);
                }}
            />

            {showMaterialModal && (isAgent || isAdmin) && (
                <AssignMaterialModal 
                    ticketId={ticket.id} 
                    onClose={() => setShowMaterialModal(false)} 
                />
            )}

            {showChildTicketModal && isAgent && (
                <AddChildTicketModal
                    ticketPadreId={ticket.id}
                    clienteId={(ticket.profiles as any)?.cliente_id ?? null}
                    onClose={() => setShowChildTicketModal(false)}
                />
            )}

            {isAdmin && (
                <AsignarViaticoModal
                    isOpen={showViaticoModal}
                    onClose={() => setShowViaticoModal(false)}
                    ticket={ticket}
                />
            )}

            {/* CUSTOM AGENT CONFIRMATION MODAL */}
            {agentToConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in" 
                        onClick={() => !isUpdating && setAgentToConfirm(null)}
                    />
                    
                    {/* Modal Card */}
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4 text-indigo-600">
                                <UserPlus className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-2 tracking-tight">
                                Confirmar Asignación
                            </h3>
                            <p className="text-sm text-slate-500 font-medium">
                                ¿Estás seguro de que deseas asignar este ticket al agente <strong className="text-slate-800">{agentToConfirm.full_name}</strong>?
                            </p>
                        </div>
                        
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={() => setAgentToConfirm(null)}
                                disabled={isUpdating}
                                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-white transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAgentAssignment}
                                disabled={isUpdating}
                                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                            >
                                {isUpdating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Asignando...</span>
                                    </>
                                ) : (
                                    <span>Asignar</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}