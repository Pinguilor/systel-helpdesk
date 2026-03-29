'use client';

import { useState } from 'react';
import { X, DollarSign, Loader2 } from 'lucide-react';
import { asignarViaticoAction } from '../actions';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
}

export function AsignarViaticoModal({ isOpen, onClose, ticket }: Props) {
    const [montoDisplay, setMontoDisplay] = useState('');
    const [montoRaw, setMontoRaw] = useState(0);
    const [comentario, setComentario] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const restaurante = ticket.restaurantes?.nombre_restaurante ?? '—';
    const tecnico = ticket.agente?.full_name ?? '—';
    const numeroTicket = ticket.numero_ticket;

    const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        const num = parseInt(raw, 10) || 0;
        setMontoRaw(num);
        setMontoDisplay(num > 0 ? num.toLocaleString('es-CL') : '');
    };

    const handleSubmit = async () => {
        setError(null);
        if (!montoRaw || montoRaw <= 0) {
            setError('Ingresa un monto válido mayor a 0.');
            return;
        }
        if (!comentario.trim()) {
            setError('El comentario es requerido.');
            return;
        }

        setLoading(true);
        const result = await asignarViaticoAction(ticket.id, montoRaw, comentario.trim());
        setLoading(false);

        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setMontoDisplay('');
                setMontoRaw(0);
                setComentario('');
                onClose();
            }, 1500);
        }
    };

    const handleClose = () => {
        if (loading) return;
        setError(null);
        setSuccess(false);
        setMontoDisplay('');
        setMontoRaw(0);
        setComentario('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 rounded-lg">
                            <DollarSign className="w-4 h-4 text-emerald-600" />
                        </div>
                        <h2 className="text-base font-semibold text-gray-900">Asignar Viático</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Info automática */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Ticket</span>
                            <span className="font-medium text-gray-800">#{numeroTicket}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Restaurante</span>
                            <span className="font-medium text-gray-800">{restaurante}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Técnico</span>
                            <span className="font-medium text-gray-800">{tecnico}</span>
                        </div>
                    </div>

                    {/* Monto */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Monto <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={montoDisplay}
                                onChange={handleMontoChange}
                                placeholder="0"
                                disabled={loading || success}
                                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                            />
                        </div>
                    </div>

                    {/* Comentario */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Comentario interno <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            rows={3}
                            value={comentario}
                            onChange={e => setComentario(e.target.value)}
                            placeholder="Ej: Traslado a zona norte, combustible..."
                            disabled={loading || success}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none disabled:opacity-50"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                            {error}
                        </div>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
                            Viático asignado correctamente.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || success}
                        className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loading ? 'Enviando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
