'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { addTicketMessageAction, approveResolutionAction, rejectResolutionAction, scheduleVisitAction } from '../actions';
import { User as UserIcon, Paperclip, FileText, Image as ImageIcon, FileSpreadsheet, File, CheckCircle2, XCircle, Star, ChevronDown, MessageSquare, ChevronsRight, Calendar } from 'lucide-react';
import dynamic from 'next/dynamic';
import { SmartCloseModal } from './SmartCloseModal';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-24 w-full bg-gray-50 rounded-md animate-pulse border border-gray-200"></div>
});

const timeAgo = (dateStr: string) => {
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const diff = (new Date(dateStr).getTime() - new Date().getTime()) / 1000;
    const absDiff = Math.abs(diff);

    if (absDiff < 60) return rtf.format(Math.round(diff), 'second');
    if (absDiff < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (absDiff < 8400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
};

interface Props {
    ticket: any;
    messages: any[];
    currentUserId: string;
    isAgent?: boolean;
    packingList?: any[];
}

export default function TicketTimeline({ ticket, messages, currentUserId, isAgent, packingList = [] }: Props) {
    const router = useRouter();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [newMessage, setNewMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSplitOpen, setIsSplitOpen] = useState(false);
    const [showVisitPopover, setShowVisitPopover] = useState(false);
    const [visitDate, setVisitDate] = useState('');
    const [copied, setCopied] = useState(false);
    
    // Smart Close logic
    const [showSmartClose, setShowSmartClose] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');

    const handleSendMessage = async (e: React.FormEvent, resolveTicket: boolean = false) => {
        e.preventDefault();
        const rawText = newMessage.replace(/(<([^>]+)>)/gi, "").trim();
        if ((!rawText && selectedFiles.length === 0) || isSubmitting) return;

        setIsSubmitting(true);
        setIsSplitOpen(false);
        try {
            const formData = new FormData();
            formData.append('ticketId', ticket.id);
            formData.append('message', newMessage);
            formData.append('resolveTicket', resolveTicket ? 'true' : 'false');
            selectedFiles.forEach(file => {
                formData.append('adjuntos', file);
            });

            const result = await addTicketMessageAction(formData);
            if (result.error) {
                alert(result.error);
            } else {
                setNewMessage('');
                setSelectedFiles([]);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Error inesperado al enviar el mensaje.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleScheduleVisit = async () => {
        if (!visitDate) return;
        setIsSubmitting(true);
        setShowVisitPopover(false);
        try {
            const rawText = newMessage.replace(/(<([^>]+)>)/gi, "").trim();
            const noteContent = rawText ? newMessage : '';

            const result = await scheduleVisitAction(ticket.id, visitDate, noteContent);
            if (result.error) {
                alert(result.error);
            } else {
                setNewMessage('');
                setVisitDate('');
                router.refresh();
            }
        } catch (error) {
            console.error('Failed to schedule visit:', error);
            alert('Error inesperado al programar visita.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApprove = async () => {
        if (rating === 0) { alert('Por favor selecciona una calificación de 1 a 5 estrellas.'); return; }
        setIsSubmitting(true);
        const res = await approveResolutionAction(ticket.id, rating, feedback);
        setIsSubmitting(false);
        if (res.error) alert(res.error);
        else {
            setShowApproveModal(false);
            router.refresh();
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) { alert('Por favor detalla el motivo del rechazo.'); return; }
        setIsSubmitting(true);
        const res = await rejectResolutionAction(ticket.id, rejectReason);
        setIsSubmitting(false);
        if (res.error) alert(res.error);
        else {
            setShowRejectModal(false);
            setRejectReason('');
            router.refresh();
        }
    };

    const getFileIcon = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || '';
        if (ext.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
        if (ext.includes('jpg') || ext.includes('jpeg') || ext.includes('png')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
        if (ext.includes('xlsx') || ext.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
        return <File className="w-5 h-5 text-gray-500" />;
    };

    return (
        <div className="bg-white rounded-2xl shadow-md border border-slate-300 flex flex-col mb-8 overflow-hidden">
            <div className="flex-1 flex flex-col">

                {/* HEADER OPTIMIZADO PARA MÓVIL Y DESCRIPCIÓN */}
                <div className="p-4 sm:p-6 border-b border-gray-100 bg-white">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0 shadow-sm border border-indigo-200">
                                {ticket.profiles?.full_name?.charAt(0).toUpperCase() || <UserIcon className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl font-extrabold text-slate-900 leading-tight truncate">{ticket.titulo}</h2>
                                <p className="text-[11px] sm:text-sm text-slate-500 font-medium">
                                    Por <span className="text-slate-800 font-bold">{ticket.profiles?.full_name}</span> • {new Date(ticket.fecha_creacion).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                navigator.clipboard.writeText(`NC-${ticket.numero_ticket}`);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 transition-all text-white text-xs font-black tracking-widest shadow-lg active:scale-95"
                        >
                            {copied ? '¡COPIADO!' : `NC-${ticket.numero_ticket}`}
                        </button>
                    </div>

                    {ticket.restaurantes && (
                        <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] w-full sm:w-auto mb-1 sm:mb-0">Ubicación</span>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1">📍 {ticket.restaurantes.nombre_restaurante}</span>
                                {ticket.catalogo_servicios && (
                                    <>
                                        <ChevronsRight className="w-3.5 h-3.5 text-slate-300" />
                                        <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">{ticket.catalogo_servicios.categoria}</span>
                                        <ChevronsRight className="w-3.5 h-3.5 text-slate-300" />
                                        <span className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg shadow-md">{ticket.catalogo_servicios.elemento}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="relative mt-6">
                        <span className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-black text-indigo-600 uppercase tracking-[0.15em] z-10">
                            Detalles de la Solicitud
                        </span>
                        <div
                            className="prose prose-sm max-w-none text-slate-700 bg-indigo-50/30 p-5 pt-7 rounded-2xl border border-indigo-100/50 shadow-inner italic leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: ticket.descripcion }}
                        />
                    </div>

                    {ticket.adjuntos && ticket.adjuntos.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-gray-100">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                <Paperclip className="w-3.5 h-3.5" /> Adjuntos ({ticket.adjuntos.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {ticket.adjuntos.map((url: string, index: number) => (
                                    <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm text-xs font-medium text-slate-600">
                                        {getFileIcon(url)}
                                        <span className="truncate max-w-[120px]">{url.split('/').pop()?.split('_').slice(1).join('_') || `Archivo ${index + 1}`}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* CAJA DE RESPUESTA */}
                <div className="p-4 bg-slate-50 border-b border-t border-slate-200 shrink-0">
                    {ticket.estado === 'cerrado' ? (
                        <div className="bg-gray-50 text-center py-4 rounded-xl border border-gray-200 text-slate-500 font-medium text-sm">
                            Este ticket ha sido cerrado. Ya no admite respuestas.
                        </div>
                    ) : (
                        <form onSubmit={(e) => handleSendMessage(e, false)} className="relative flex flex-col gap-2">
                            {selectedFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100 mb-1">
                                    {selectedFiles.map((f, i) => (
                                        <span key={i} className="text-xs bg-indigo-100 text-indigo-800 font-medium px-2 py-1 rounded-md border border-indigo-200 flex items-center gap-2">
                                            <Paperclip className="w-3 h-3" />
                                            <span className="truncate max-w-[150px]">{f.name}</span>
                                            <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500 ml-1 font-bold">
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white flex flex-col shadow-sm">
                                <ReactQuill
                                    theme="snow"
                                    value={newMessage}
                                    onChange={setNewMessage}
                                    placeholder="Escribe tu mensaje..."
                                    className="text-slate-900 flex-1 [&_.ql-editor]:min-h-[100px] [&_.ql-container]:!border-0 [&_.ql-toolbar]:!border-0 [&_.ql-toolbar]:!border-b [&_.ql-toolbar]:!border-slate-200 [&_.ql-toolbar]:bg-slate-50/50"
                                />

                                <input
                                    type="file"
                                    multiple
                                    ref={fileInputRef}
                                    onChange={(e) => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)); }}
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.docx"
                                />

                                <div className="flex justify-between items-center bg-slate-50 p-2 border-t border-slate-200 h-16 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="ml-4 flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300 bg-gray-100"
                                    >
                                        <Paperclip className="w-4 h-4" />
                                        <span className="hidden sm:inline">Adjuntar</span>
                                    </button>

                                    <div className="mr-4 flex items-center h-10 relative">
                                        <button
                                            type="submit"
                                            disabled={(!newMessage.replace(/(<([^>]+)>)/gi, "").trim() && selectedFiles.length === 0) || isSubmitting}
                                            className={`h-full px-6 bg-brand-primary text-white font-bold text-sm hover:bg-brand-secondary disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center ${isAgent && ticket.estado !== 'resuelto' ? 'rounded-l-lg border-r border-brand-secondary' : 'rounded-lg'}`}
                                        >
                                            Responder
                                        </button>

                                        {isAgent && ticket.estado !== 'resuelto' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsSplitOpen(!isSplitOpen)}
                                                    className="h-full px-3 bg-brand-primary text-white rounded-r-lg hover:bg-brand-secondary transition-colors shadow-sm flex items-center justify-center border-l border-white/20"
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>

                                                {isSplitOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-30" onClick={() => setIsSplitOpen(false)}></div>
                                                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1 z-40">
                                                            <button 
                                                                type="button" 
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setIsSplitOpen(false);
                                                                    setShowSmartClose(true);
                                                                }} 
                                                                className="w-full text-left px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors border-b border-gray-100"
                                                            >
                                                                <CheckCircle2 className="w-5 h-5" /> Cierre Inteligente
                                                            </button>
                                                            <button type="button" onClick={() => { setIsSplitOpen(false); setShowVisitPopover(true); }} className="w-full text-left px-4 py-3 text-sm font-bold text-sky-700 hover:bg-sky-50 flex items-center gap-2 transition-colors">
                                                                <Calendar className="w-5 h-5" /> Responder y Programar Visita
                                                            </button>
                                                        </div>
                                                    </>
                                                )}

                                                {showVisitPopover && (
                                                    <>
                                                        <div className="fixed inset-0 z-30" onClick={() => setShowVisitPopover(false)}></div>
                                                        <div className="absolute right-0 bottom-full mb-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-40">
                                                            <h4 className="text-sm font-bold text-gray-900 mb-2">Programar Visita</h4>
                                                            <input type="date" required value={visitDate} onChange={e => setVisitDate(e.target.value)} className="w-full text-sm font-medium border border-gray-300 rounded-lg py-2 px-3 mb-3 focus:ring-2 focus:ring-indigo-500" />
                                                            <div className="flex gap-2 justify-end">
                                                                <button type="button" onClick={() => setShowVisitPopover(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
                                                                <button type="button" onClick={handleScheduleVisit} disabled={isSubmitting || !visitDate} className="px-3 py-1.5 text-xs font-bold text-white bg-brand-primary hover:bg-brand-secondary rounded-lg">Confirmar</button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* FLUJO DE CONVERSACIÓN */}
                <div className="p-6 bg-gray-50/50 space-y-6 pb-10 rounded-b-2xl flex-1">
                    {messages.length === 0 ? (
                        <div className="text-center py-10">
                            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-sm font-medium text-gray-900">No hay mensajes aún</h3>
                        </div>
                    ) : (
                        (() => {
                            let commentCounter = 0;
                            return messages.map((msg) => {
                                const isMe = msg.sender_id === currentUserId;
                                const isAgentMsg = msg.profiles?.rol === 'TECNICO';

                                if (msg.tipo_evento === 'visita_programada') {
                                    let cleanMessage = msg.mensaje || '';
                                    cleanMessage = cleanMessage.replace(/^Nota del agente:\s*/i, '');
                                    return (
                                        <div key={msg.id} className="flex justify-center my-8 w-full px-4">
                                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl shadow-sm flex flex-col items-center text-center w-full max-w-2xl overflow-hidden">
                                                <div className="bg-indigo-600 w-full py-3 px-6 flex items-center justify-between text-white">
                                                    <div className="flex items-center gap-3">
                                                        <Calendar className="w-5 h-5 text-white" />
                                                        <div className="flex flex-col text-left">
                                                            <span className="font-bold text-sm tracking-wide">Visita Programada</span>
                                                        </div>
                                                    </div>
                                                    <div className="font-semibold text-sm bg-indigo-700/50 px-3 py-1 rounded-full border border-indigo-500/50">
                                                        {ticket.fecha_programada ? new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(ticket.fecha_programada)) : 'Fecha pendiente'}
                                                    </div>
                                                </div>
                                                {cleanMessage && cleanMessage.trim() !== '' && (
                                                    <div className="w-full p-5">
                                                        <div className="bg-white border border-indigo-100 rounded-xl p-4 text-left shadow-sm relative mt-2">
                                                            <span className="absolute -top-2.5 left-4 bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Nota del agente</span>
                                                            <div className="prose prose-sm prose-indigo max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: cleanMessage }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                if (msg.es_sistema) {
                                    return (
                                        <div key={msg.id} className="flex justify-center my-4 w-full">
                                            <div className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-xs font-medium italic border border-slate-200">
                                                {msg.mensaje}
                                            </div>
                                        </div>
                                    );
                                }

                                commentCounter++;
                                return (
                                    <div key={msg.id} className="flex gap-4 w-full">
                                        <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${isAgentMsg ? 'bg-orange-100 text-orange-700 ring-2 ring-white' : 'bg-indigo-100 text-indigo-700 ring-2 ring-white'}`}>
                                            {msg.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                        <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative">
                                            <div className="absolute top-4 right-4 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">#{commentCounter}</div>
                                            <div className="flex justify-between items-center mb-3 pr-12">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-900 text-sm">{msg.profiles?.full_name || 'Usuario desconocido'}</span>
                                                    {isAgentMsg && <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[10px] uppercase font-bold tracking-wider">Agente</span>}
                                                    {isMe && !isAgentMsg && <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] uppercase font-bold tracking-wider">Tú</span>}
                                                </div>
                                                <span className="text-xs text-gray-400 font-medium">{timeAgo(msg.creado_en)}</span>
                                            </div>
                                            <div className="prose prose-sm max-w-none text-slate-700 max-h-[350px] overflow-y-auto pb-2 custom-scrollbar" dangerouslySetInnerHTML={{ __html: msg.mensaje }} />
                                            {msg.adjuntos && msg.adjuntos.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-3">
                                                    {msg.adjuntos.map((url: string, idx: number) => {
                                                        const ext = url.split('.').pop()?.toLowerCase();
                                                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
                                                        return isImage ? (
                                                            <a key={idx} href={url} target="_blank" rel="noreferrer" className="block w-48 h-32 overflow-hidden rounded-lg border border-gray-200 hover:opacity-90 transition-opacity">
                                                                <img src={url} alt="Adjunto" className="w-full h-full object-cover" />
                                                            </a>
                                                        ) : (
                                                            <a key={idx} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 shadow-sm text-sm hover:bg-gray-50 bg-white group transition-colors">
                                                                {getFileIcon(url)}
                                                                <span className="truncate max-w-[200px] font-medium text-gray-700 group-hover:text-indigo-600">{url.split('/').pop()?.split('_').slice(1).join('_') || `Adjunto ${idx + 1}`}</span>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }).reverse();
                        })()
                    )}

                    {ticket.estado === 'cerrado' && (
                        <div className="mt-8 p-6 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col items-center text-center">
                            <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-3" />
                            <h3 className="text-xl font-bold text-gray-900 mb-1">Resolución Aceptada</h3>
                            <p className="text-sm text-gray-600">El ticket ha sido finalizado con éxito.</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {ticket.estado === 'resuelto' && currentUserId === ticket.creado_por && (
                    <div className="p-5 mx-6 mb-6 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
                        <div className="flex gap-4 items-start">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-900 mb-1">Solución Propuesta</h4>
                                <p className="text-sm text-gray-600 mb-4">Por favor revisa y aprueba si el problema fue resuelto.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setShowApproveModal(true)} className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors">Aceptar Solución</button>
                                    <button onClick={() => setShowRejectModal(true)} className="px-5 py-2.5 bg-white text-gray-700 font-bold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Rechazar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALES DE RESOLUCIÓN */}
            {showApproveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Califica el servicio</h3>
                        <div className="flex justify-center gap-2 mb-6 mt-4">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button key={star} onClick={() => setRating(star)} className="focus:outline-none">
                                    <Star className={`w-10 h-10 transition-colors ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                                </button>
                            ))}
                        </div>
                        <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Comentario adicional (Opcional)..." className="w-full p-3 border rounded-lg text-sm mb-6 focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowApproveModal(false)} className="px-5 py-2 text-gray-600 font-semibold">Cancelar</button>
                            <button disabled={isSubmitting || rating === 0} onClick={handleApprove} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg disabled:opacity-50">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
                        <div className="flex items-center gap-3 mb-4 text-red-600">
                            <XCircle className="w-6 h-6" />
                            <h3 className="text-xl font-bold text-slate-900">Rechazar Resolución</h3>
                        </div>
                        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="¿Por qué no se ha solucionado?..." className="w-full p-3 border rounded-lg text-sm mb-6 focus:ring-2 focus:ring-red-500 outline-none" rows={4} />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowRejectModal(false)} className="px-5 py-2 text-gray-600 font-semibold">Cancelar</button>
                            <button disabled={isSubmitting || !rejectReason.trim()} onClick={handleReject} className="px-5 py-2 bg-red-600 text-white font-bold rounded-lg disabled:opacity-50">Enviar Rechazo</button>
                        </div>
                    </div>
                </div>
            )}

            {showSmartClose && (
                <SmartCloseModal 
                    ticketId={ticket.id} 
                    onClose={() => setShowSmartClose(false)} 
                    packingList={packingList} 
                />
            )}
        </div>
    );
}