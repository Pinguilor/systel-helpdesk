'use client';

import { useState } from 'react';
import { updateTicketPropertiesAction, assignTicketToMeAction, updateChildTicketDescription } from '../actions';
import Link from 'next/link';
import { AlertCircle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronRight, Activity, Flag, UserPlus, Calendar, Plus, Layers, Pencil } from 'lucide-react';
import { TicketStatus } from '@/types/database.types';
import SlaTimer from '@/components/SlaTimer';
import { AssignMaterialModal } from './AssignMaterialModal';
import { AddChildTicketModal } from './AddChildTicketModal';
import { CloseTicketModal } from './CloseTicketModal';
import { closeTicketWithActaAction } from '../actions';

interface Props {
    ticket: any;
    isAgent: boolean;
    isAdmin?: boolean;
    agents?: any[];
    inventarioCentral?: any[];
    packingList?: any[];
    inventarioTicket?: any[];
    childTickets?: any[];
}

export default function TicketSidebar({ ticket, isAgent, isAdmin, agents = [], inventarioCentral = [], packingList = [], inventarioTicket = [], childTickets = [] }: Props) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [showChildTicketModal, setShowChildTicketModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [childrenOpen, setChildrenOpen] = useState(false);
    const [editingChildId, setEditingChildId] = useState<string | null>(null);
    const [editingDescription, setEditingDescription] = useState('');
    const [isSavingDesc, setIsSavingDesc] = useState(false);

    const isTerminal = ['cerrado', 'resuelto', 'anulado'].includes(ticket.estado);

    // Hardcode possible states to make rendering easier
    const statuses: { id: TicketStatus, label: string, color: string, icon: any }[] = [
        { id: 'esperando_agente', label: 'Sin Asignar', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: AlertCircle },
        { id: 'abierto', label: 'Abierto', color: 'bg-sky-100 text-sky-700 border-sky-200', icon: AlertCircle },
        { id: 'pendiente', label: 'Pendiente', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
        { id: 'programado', label: 'Programado', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Calendar },
        { id: 'en_progreso', label: 'En Progreso', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Activity },
        { id: 'resuelto', label: 'Resuelto', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
        { id: 'cerrado', label: 'Cerrado', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: XCircle },
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
    const [priorityOpen, setPriorityOpen] = useState(false);
    const [agentOpen, setAgentOpen] = useState(false);

    const handleUpdate = async (field: 'estado' | 'prioridad', value: string) => {
        setIsUpdating(true);
        setStatusOpen(false);
        setPriorityOpen(false);
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

    const handleAssignAgent = async (agent: any) => {
        if (!confirm(`¿Estás seguro de que deseas asignar este ticket al agente: ${agent.full_name}?`)) {
            setAgentOpen(false);
            return;
        }
        setIsUpdating(true);
        setAgentOpen(false);
        try {
            const updates = { agente_asignado_id: agent.id, estado: 'abierto' } as any;
            const result = await updateTicketPropertiesAction(ticket.id, updates);
            if (result.error) alert(result.error);
        } catch (error) {
            console.error(error);
        } finally {
            setIsUpdating(false);
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
                                    onClick={() => { setAgentOpen(!agentOpen); setStatusOpen(false); setPriorityOpen(false); }}
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

                        {(isAgent || isAdmin) && !isTerminal && (
                            <button 
                                onClick={() => setShowMaterialModal(true)}
                                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-black tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                + ASIGNAR MATERIAL
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
                                onConfirm={async (notas, firmaCliente, firmaTecnico, receptorNombre, latitud, longitud) => {
                                    setIsUpdating(true);
                                    const result = await closeTicketWithActaAction(ticket.id, notas, firmaCliente, firmaTecnico, receptorNombre, latitud, longitud);
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
                                onClick={() => { setStatusOpen(!statusOpen); setPriorityOpen(false); }}
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
                                                    onClick={() => handleUpdate('estado', s.id)}
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

                    {isAgent && ticket.estado !== 'cerrado' && ticket.estado !== 'anulado' ? (
                        <div className="relative">
                            <button
                                onClick={() => { setPriorityOpen(!priorityOpen); setStatusOpen(false); }}
                                disabled={isUpdating}
                                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 bg-white font-bold text-sm transition-all shadow-sm hover:bg-gray-50 text-gray-900"
                            >
                                <span className="flex items-center gap-2 capitalize">
                                    <Flag className={`w-4 h-4 ${priorities.find(p => p.id === ticket.prioridad)?.color}`} />
                                    {ticket.prioridad}
                                </span>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>

                            {priorityOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setPriorityOpen(false)}></div>
                                    <div className="absolute z-40 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1.5 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                                        {priorities.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleUpdate('prioridad', p.id)}
                                                className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                            >
                                                <Flag className={`w-4 h-4 ${ticket.prioridad === p.id ? p.color : 'text-gray-300'}`} />
                                                <span className={ticket.prioridad === p.id ? 'text-gray-900 font-bold' : 'text-gray-700 capitalize'}>
                                                    {p.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className={`p-2 rounded-lg bg-white border border-gray-200 shadow-sm`}>
                                <Flag className={`w-4 h-4 ${priorities.find(p => p.id === ticket.prioridad)?.color}`} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Prioridad del caso</span>
                                <span className="text-sm font-bold text-gray-900 capitalize">{ticket.prioridad}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* SLA SECTION */}
                {ticket.vencimiento_sla && (
                    <div className="p-5 border-b border-gray-50">
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tiempo de Respuesta</span>
                        {ticket.estado === 'anulado' ? (
                            <div className="flex items-center justify-center gap-2 bg-slate-100 text-slate-500 font-bold text-sm px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
                                ⏱️ Reloj Detenido (Anulado)
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-1">
                                <SlaTimer
                                    vencimientoSla={ticket.vencimiento_sla}
                                    estado={ticket.estado}
                                    actualizadoEn={ticket.actualizado_en}
                                    fechaResolucion={ticket.fecha_resolucion}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* PACKING LIST SECTION */}
                {packingList.length > 0 && (
                    <div className="p-5 border-b border-gray-50">
                        <span className="block text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-3">Lista de Empaque</span>
                        <div className="space-y-2">
                            {packingList.map((mov) => {
                                const inv = mov.inventario;
                                if (!inv) return null;
                                return (
                                    <div key={mov.id} className="flex justify-between items-start p-3 bg-indigo-50/30 border border-indigo-100/50 rounded-xl shadow-sm hover:bg-white hover:border-indigo-200 transition-colors group">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-bold text-slate-800">{inv.modelo}</span>
                                            <span className="text-[10px] font-bold text-slate-400 capitalize">{inv.familia}</span>
                                            {inv.es_serializado && (
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-100/50 py-0.5 px-1.5 rounded uppercase mt-1 inline-block w-max">
                                                    SN: {inv.numero_serie || 'N/A'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-indigo-600 text-white rounded-lg px-2 py-1 flex flex-col items-center justify-center shadow-sm">
                                            <span className="text-[10px] uppercase font-bold opacity-80 leading-tight">CANT</span>
                                            <span className="text-sm font-black leading-tight">{mov.cantidad}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

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

            {showMaterialModal && (isAgent || isAdmin) && (
                <AssignMaterialModal 
                    ticketId={ticket.id} 
                    onClose={() => setShowMaterialModal(false)} 
                />
            )}

            {showChildTicketModal && isAgent && (
                <AddChildTicketModal 
                    ticketPadreId={ticket.id}
                    onClose={() => setShowChildTicketModal(false)}
                />
            )}
        </div>
    );
}