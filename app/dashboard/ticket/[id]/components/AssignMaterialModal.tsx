'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PackageSearch, X, Server, Package, Loader2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { assignMaterialAction } from '../actions';
import { useRouter } from 'next/navigation';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';

interface AssignMaterialModalProps {
    ticketId: string;
    onClose: () => void;
}

export function AssignMaterialModal({ ticketId, onClose }: AssignMaterialModalProps) {
    const [stockMochila, setStockMochila] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mochilaNotFound, setMochilaNotFound] = useState(false);

    const [selectedFamilia, setSelectedFamilia] = useState('');
    const [selectedInventarioId, setSelectedInventarioId] = useState('');
    const [cantidad, setCantidad] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);
    
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        async function fetchMochilaStock() {
            setLoading(true);
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                setLoading(false);
                return;
            }

            // Conseguir la bodega (mochila) del usuario actual
            const { data: mochila, error: bgeError } = await supabase
                .from('bodegas')
                .select('id')
                .eq('tipo', 'MOCHILA')
                .eq('tecnico_id', user.id)
                .maybeSingle();

            if (!mochila) {
                setMochilaNotFound(true);
                setLoading(false);
                return;
            }

            // Conseguir el inventario disponible de su mochila sin uniones rotas
            const { data: inventory } = await supabase
                .from('inventario')
                .select('*')
                .eq('bodega_id', mochila.id)
                .eq('estado', 'Disponible')
                .gt('cantidad', 0);

            if (inventory) {
                setStockMochila(inventory);
            }
            setLoading(false);
        }

        fetchMochilaStock();
    }, []);

    // Extraer Familias únicas del stock de la Mochila
    const familias = useMemo(() => {
        const unique = new Set(stockMochila.map(item => item.familia).filter(Boolean));
        return Array.from(unique);
    }, [stockMochila]);

    const inventariosDisponibles = useMemo(() => {
        if (!selectedFamilia) return [];
        const filtered = stockMochila.filter(item => item.familia === selectedFamilia);
        const unique = new Map();
        
        filtered.forEach(item => {
             if (item.es_serializado) {
                 unique.set(item.id, {
                     id: item.id,
                     label: `${item.modelo} (SN: ${item.numero_serie || 'N/A'})`,
                     es_serializado: true,
                     max: 1
                 });
             } else {
                 const key = `${item.modelo}|${item.familia}`;
                 if (!unique.has(key)) {
                     unique.set(key, { 
                         id: item.id,
                         label: item.modelo,
                         es_serializado: false,
                         max: 0
                     });
                 }
                 unique.get(key).max += item.cantidad;
             }
        });
        
        return Array.from(unique.values()).map(m => {
             if (!m.es_serializado) m.label = `${m.label} (${m.max} disponibles)`;
             return m;
        });
    }, [selectedFamilia, stockMochila]);

    const objSeleccionado = inventariosDisponibles.find(m => m.id === selectedInventarioId);
    const maxQuantity = objSeleccionado?.max || 1;
    const esSerializado = objSeleccionado?.es_serializado || false;

    useEffect(() => {
        if (!inventariosDisponibles.find(m => m.id === selectedInventarioId)) {
            setSelectedInventarioId('');
            setCantidad(1);
        }
    }, [selectedFamilia, inventariosDisponibles]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInventarioId) return;

        setIsSubmitting(true);
        const res = await assignMaterialAction(ticketId, selectedInventarioId, esSerializado ? 1 : cantidad);
        setIsSubmitting(false);

        if (res.error) {
            alert(res.error);
        } else {
            router.refresh();
            onClose();
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end bg-slate-900/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <PackageSearch className="w-5 h-5 text-indigo-600" />
                            Consumo de Mochila
                        </h3>
                        <p className="text-[11px] font-bold text-slate-500 tracking-wide mt-1 uppercase">Inventario asignado al Ticket</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent shadow-sm">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                        <span className="text-sm font-bold text-slate-600">Escaneando tu mochila virtual...</span>
                    </div>
                ) : mochilaNotFound ? (
                    <div className="flex-1 flex flex-col justify-center p-8 space-y-4">
                        <div className="bg-red-50 text-red-500 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-black text-center text-slate-900">Mochila no configurada</h4>
                        <p className="text-sm text-center text-slate-500 font-medium">
                            Tu cuenta no tiene una "Mochila Virtual" asignada en el sistema, o está vacía. Contacta con coordinación para que te asignen tu bodega predeterminada (tecnico_id).
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar">
                        <div>
                            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Familia de Hardware (Tu Stock)</label>
                            <CustomSelect 
                                id="familia-select"
                                value={selectedFamilia} 
                                onChange={setSelectedFamilia}
                                options={familias.map(f => ({ value: String(f), label: String(f) }))}
                                placeholder="Seleccionar Familia..."
                                required
                            />
                            {familias.length === 0 && <span className="text-xs text-amber-500 font-bold mt-2 inline-block shadow-sm">Tu mochila está físicamente vacía. Pide material a central.</span>}
                        </div>

                        {selectedFamilia && (
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Repuesto Específico</label>
                                <CustomSelect 
                                    id="modelo-select"
                                    value={selectedInventarioId} 
                                    onChange={val => { setSelectedInventarioId(val); setCantidad(1); }}
                                    options={inventariosDisponibles.map(m => ({ value: m.id, label: m.label }))}
                                    placeholder="Elegir Repuesto..."
                                    required
                                />
                            </div>
                        )}

                        {selectedInventarioId && objSeleccionado && !esSerializado && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 shadow-inner">
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-600 mb-1.5 tracking-wider flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Cantidad a Extraer</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max={maxQuantity}
                                            value={cantidad} 
                                            onChange={e => setCantidad(Number(e.target.value))}
                                            className="w-24 text-center text-lg font-black text-indigo-900 border border-indigo-200 bg-white rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                            required
                                        />
                                        <span className="text-xs font-black text-indigo-400 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-widest">LÍMITE MÁXIMO: {maxQuantity}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* FOOTER */}
                        <div className="pt-6 mt-auto shrink-0 flex gap-3">
                            <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 shadow-sm">Cancelar</button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting || !!mochilaNotFound || stockMochila.length === 0 || cantidad <= 0 || !selectedInventarioId} 
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex justify-center items-center active:scale-95 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Confirmar Consumo'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
}
