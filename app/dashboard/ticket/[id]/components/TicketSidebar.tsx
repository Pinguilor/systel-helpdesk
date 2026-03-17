'use client';

import { useState } from 'react';
import { updateTicketPropertiesAction, assignTicketToMeAction } from '../actions';
import { AlertCircle, Clock, CheckCircle2, XCircle, ChevronDown, Activity, Flag, UserPlus, Calendar } from 'lucide-react';
import { TicketStatus } from '@/types/database.types';
import SlaTimer from '@/components/SlaTimer';
import { AssignMaterialModal } from './AssignMaterialModal';

interface Props {
    ticket: any;
    isAgent: boolean;
    isAdmin?: boolean;
    agents?: any[];
    inventarioCentral?: any[];
    packingList?: any[];
}

export default function TicketSidebar({ ticket, isAgent, isAdmin, agents = [], inventarioCentral = [], packingList = [] }: Props) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [showMaterialModal, setShowMaterialModal] = useState(false);

    // Hardcode possible states to make rendering easier
    const statuses: { id: TicketStatus, label: string, color: string, icon: any }[] = [
        { id: 'esperando_agente', label: 'Sin Asignar', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: AlertCircle },
        { id: 'abierto', label: 'Abierto', color: 'bg-sky-100 text-sky-700 border-sky-200', icon: AlertCircle },
        { id: 'pendiente', label: 'Pendiente', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
        { id: 'programado', label: 'Programado', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Calendar },
        { id: 'en_progreso', label: 'En Progreso', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Activity },
        { id: 'resuelto', label: 'Resuelto', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
        { id: 'cerrado', label: 'Cerrado', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: XCircle }
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
                        
                        {isAdmin ? (
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
                            ticket.agente_asignado_id && (
                                <div className="flex items-center gap-3 p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                                    <div className="h-9 w-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
                                        {ticket.agente?.full_name?.charAt(0).toUpperCase() || 'A'}
                                    </div>
                                    <span className="font-bold text-sm text-gray-900 truncate">{ticket.agente?.full_name}</span>
                                </div>
                            )
                        )}

                        {isAdmin && (
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
                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Estado del Ticket</span>

                    {isAgent && ticket.estado !== 'cerrado' ? (
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
                                        {statuses.filter(s => s.id !== 'cerrado').map(s => {
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

                {/* PRIORITY SECTION */}
                <div className="p-5 border-b border-gray-50">
                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Prioridad</span>

                    {isAgent && ticket.estado !== 'cerrado' ? (
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
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-1">
                            <SlaTimer
                                vencimientoSla={ticket.vencimiento_sla}
                                estado={ticket.estado}
                                actualizadoEn={ticket.actualizado_en}
                                fechaResolucion={ticket.fecha_resolucion}
                            />
                        </div>
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
                                            <span className="text-sm font-bold text-slate-800">{inv.catalogo_equipos?.modelo}</span>
                                            <span className="text-[10px] font-bold text-slate-400 capitalize">{inv.catalogo_equipos?.familia}</span>
                                            {inv.catalogo_equipos?.es_serializado && (
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-100/50 py-0.5 px-1.5 rounded uppercase mt-1 inline-block w-max">
                                                    SN: {inv.numero_serie}
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
            </div>

            {showMaterialModal && isAdmin && (
                <AssignMaterialModal 
                    ticketId={ticket.id} 
                    onClose={() => setShowMaterialModal(false)} 
                    inventarioCentral={inventarioCentral} 
                />
            )}
        </div>
    );
}