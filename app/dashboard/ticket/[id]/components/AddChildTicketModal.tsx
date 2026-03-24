'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';
import { createChildTicketAction } from '../actions';
import { createClient } from '@/lib/supabase/client';
import { CatalogoServicio } from '@/types/database.types';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';

interface Props {
    ticketPadreId: string;
    onClose: () => void;
}

export function AddChildTicketModal({ ticketPadreId, onClose }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Catalog State
    const [catalogos, setCatalogos] = useState<CatalogoServicio[]>([]);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

    const [selectedCategoria, setSelectedCategoria] = useState<string>('');
    const [selectedSubcategoria, setSelectedSubcategoria] = useState<string>('');
    const [selectedCatalogoId, setSelectedCatalogoId] = useState<string>('');
    const [prioridad, setPrioridad] = useState('media');

    // Fetch master data on mount
    useEffect(() => {
        async function fetchCatalog() {
            setIsLoadingCatalog(true);
            const supabase = createClient();
            try {
                const { data } = await supabase.from('catalogo_servicios').select('*').eq('activo', true);
                if (data) setCatalogos(data);
            } finally {
                setIsLoadingCatalog(false);
            }
        }
        fetchCatalog();
    }, []);

    // Derived State for Cascading Drops
    const categoriasUnicas = Array.from(new Set(catalogos.map(c => c.categoria))).sort();
    const subcategoriasFiltradas = selectedCategoria
        ? Array.from(new Set(catalogos.filter(c => c.categoria === selectedCategoria).map(c => c.subcategoria))).sort()
        : [];
    const elementosFiltrados = (selectedCategoria && selectedSubcategoria)
        ? catalogos.filter(c => c.categoria === selectedCategoria && c.subcategoria === selectedSubcategoria).sort((a, b) => a.elemento.localeCompare(b.elemento))
        : [];

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!selectedCatalogoId) {
            setError('Por favor selecciona una tipología completa (Elemento incluido).');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        formData.append('ticketPadreId', ticketPadreId);
        formData.append('catalogo_servicio_id', selectedCatalogoId);
        formData.append('prioridad', prioridad);

        try {
            const result = await createChildTicketAction(formData);

            if (result.error) {
                setError(result.error);
            } else if (result.newTicketId) {
                // Navegar al nuevo ticket hijo o recargar la página actual
                router.push(`/dashboard/ticket/${result.newTicketId}`);
                onClose();
            }
        } catch (err) {
            setError('Ocurrió un error inesperado al crear el ticket adicional.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start pt-24 pb-8 justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-y-auto max-h-[calc(100vh-8rem)] flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200 custom-scrollbar">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-100 p-1.5 rounded-lg">
                            <Plus className="w-5 h-5 text-indigo-700" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">Sumar Ticket Adicional</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        title="Cerrar modal"
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
                    
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-xl">
                            {error}
                        </div>
                    )}

                    <div className="text-sm text-slate-500 mb-2">
                        El nuevo ticket heredará automáticamente el <span className="font-bold text-slate-700">restaurante</span> y el <span className="font-bold text-slate-700">cliente</span> del ticket actual, pero requiere tipificación.
                    </div>

                    {/* Fila: Categoría y Subcategoría */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">Categoría</label>
                            <CustomSelect
                                id="categoria"
                                value={selectedCategoria}
                                onChange={(val) => {
                                    setSelectedCategoria(val);
                                    setSelectedSubcategoria('');
                                    setSelectedCatalogoId('');
                                }}
                                options={categoriasUnicas.map(cat => ({ value: cat, label: cat }))}
                                placeholder="Selecciona Categoría..."
                                disabled={isLoadingCatalog}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">Subcategoría</label>
                            <CustomSelect
                                id="subcategoria"
                                value={selectedSubcategoria}
                                onChange={(val) => {
                                    setSelectedSubcategoria(val);
                                    setSelectedCatalogoId('');
                                }}
                                options={subcategoriasFiltradas.map(sub => ({ value: sub, label: sub }))}
                                placeholder="Selecciona Subcategoría..."
                                disabled={!selectedCategoria || isLoadingCatalog}
                                required
                            />
                        </div>
                    </div>

                    {/* Fila: Elemento (Catálogo ID) */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">Problema Específico (Elemento)</label>
                        <CustomSelect
                            id="elemento"
                            value={selectedCatalogoId}
                            onChange={setSelectedCatalogoId}
                            options={elementosFiltrados.map(item => ({ value: item.id, label: item.elemento }))}
                            placeholder="Selecciona Elemento..."
                            disabled={!selectedSubcategoria || isLoadingCatalog}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="titulo" className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">Asunto del Ticket</label>
                        <input
                            type="text"
                            id="titulo"
                            name="titulo"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal"
                            placeholder="Ej: Revisión adicional requerida"
                        />
                    </div>

                    <div>
                        <label htmlFor="descripcion" className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">Descripción de la Tarea</label>
                        <textarea
                            id="descripcion"
                            name="descripcion"
                            required
                            rows={4}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 placeholder:font-normal resize-none"
                            placeholder="Detalla lo que se necesita hacer en este ticket adicional..."
                        ></textarea>
                    </div>

                    <div>
                        <label htmlFor="prioridad" className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">Prioridad</label>
                        <CustomSelect
                            id="prioridad"
                            name="prioridad"
                            value={prioridad}
                            onChange={setPrioridad}
                            options={[
                                { value: 'baja', label: 'Baja' },
                                { value: 'media', label: 'Media' },
                                { value: 'alta', label: 'Alta' },
                                { value: 'crítica', label: 'Crítica' }
                            ]}
                            placeholder="Seleccionar Prioridad"
                            required
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 mt-2 border-t border-slate-100 flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 bg-white border border-slate-200 rounded-xl transition-all shadow-sm"
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm flex items-center gap-2 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                'Crear Ticket Adicional'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
