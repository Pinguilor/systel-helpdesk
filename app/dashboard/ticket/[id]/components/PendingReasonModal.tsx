'use client';

import { useState } from 'react';
import { Clock, X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (motivo: string) => Promise<void>;
}

export function PendingReasonModal({ isOpen, onClose, onConfirm }: Props) {
    const [motivo, setMotivo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!motivo.trim()) {
            setError('El motivo es obligatorio.');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await onConfirm(motivo.trim());
            setMotivo('');
            onClose();
        } catch {
            setError('Ocurrió un error. Inténtalo nuevamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-gray-100">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Clock className="w-4 h-4 text-orange-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Ticket en Estado Pendiente</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Se notificará al cliente con el motivo indicado</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                Motivo por el cual el ticket quedará en estado Pendiente
                                <span className="text-red-500 ml-1">*</span>
                            </label>
                            <textarea
                                value={motivo}
                                onChange={e => { setMotivo(e.target.value); setError(''); }}
                                placeholder="Ej: Se requiere adquisición de repuesto, estimado de llegada 3 días hábiles..."
                                rows={4}
                                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                                autoFocus
                            />
                            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !motivo.trim()}
                                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Clock className="w-4 h-4" />
                                {isSubmitting ? 'Guardando...' : 'Confirmar Pendiente'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
