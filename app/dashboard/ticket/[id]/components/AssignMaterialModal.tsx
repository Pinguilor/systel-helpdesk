'use client';

import { useState, useMemo, useEffect } from 'react';
import { PackageSearch, X, Server, Package } from 'lucide-react';
import { assignMaterialAction } from '../actions';

interface AssignMaterialModalProps {
    ticketId: string;
    onClose: () => void;
    inventarioCentral: any[]; // Data from Bodega Central
}

export function AssignMaterialModal({ ticketId, onClose, inventarioCentral }: AssignMaterialModalProps) {
    const [selectedFamilia, setSelectedFamilia] = useState('');
    const [selectedModelo, setSelectedModelo] = useState('');
    const [selectedSerie, setSelectedSerie] = useState('');
    const [cantidad, setCantidad] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get unique familias
    const familias = useMemo(() => {
        const unique = new Set(inventarioCentral.map(item => item.catalogo_equipos?.familia).filter(Boolean));
        return Array.from(unique);
    }, [inventarioCentral]);

    // Get modelos for selected familia
    const modelos = useMemo(() => {
        if (!selectedFamilia) return [];
        const filtered = inventarioCentral.filter(item => item.catalogo_equipos?.familia === selectedFamilia);
        const unique = new Map();
        filtered.forEach(item => {
            if (item.catalogo_equipos) {
                unique.set(item.catalogo_equipos.id, item.catalogo_equipos);
            }
        });
        return Array.from(unique.values());
    }, [selectedFamilia, inventarioCentral]);

    const hardwareActivo = modelos.find(m => m.modelo === selectedModelo);
    const esSerializado = hardwareActivo?.es_serializado || false;

    // Get items for selected modelo
    const itemsDisponibles = useMemo(() => {
        if (!selectedModelo) return [];
        return inventarioCentral.filter(item => item.catalogo_equipos?.modelo === selectedModelo && item.estado?.toLowerCase() === 'disponible' && item.cantidad > 0);
    }, [selectedModelo, inventarioCentral]);

    const maxGenericQuantity = useMemo(() => {
        if (esSerializado || itemsDisponibles.length === 0) return 0;
        return itemsDisponibles[0].cantidad;
    }, [esSerializado, itemsDisponibles]);

    useEffect(() => {
        if (!modelos.find(m => m.modelo === selectedModelo)) {
            setSelectedModelo('');
            setSelectedSerie('');
            setCantidad(1);
        }
    }, [selectedFamilia, modelos]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedModelo) return;
        
        let inventarioId = '';
        if (esSerializado) {
            if (!selectedSerie) return alert('Debes seleccionar un número de serie.');
            const item = itemsDisponibles.find(i => i.numero_serie === selectedSerie);
            if (!item) return;
            inventarioId = item.id;
        } else {
            if (itemsDisponibles.length === 0) return alert('No hay stock disponible.');
            inventarioId = itemsDisponibles[0].id;
        }

        setIsSubmitting(true);
        const res = await assignMaterialAction(ticketId, inventarioId, esSerializado ? 1 : cantidad);
        setIsSubmitting(false);

        if (res.error) {
            alert(res.error);
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <PackageSearch className="w-5 h-5 text-indigo-600" />
                        Asignar Material
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar">
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Familia de Hardware</label>
                        <select 
                            value={selectedFamilia} 
                            onChange={e => setSelectedFamilia(e.target.value)}
                            className="w-full text-sm font-bold text-slate-700 border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        >
                            <option value="" disabled>Seleccionar Familia...</option>
                            {familias.map(f => <option key={String(f)} value={String(f)}>{String(f)}</option>)}
                        </select>
                    </div>

                    {selectedFamilia && (
                        <div>
                            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Modelo Específico</label>
                            <select 
                                value={selectedModelo} 
                                onChange={e => { setSelectedModelo(e.target.value); setSelectedSerie(''); setCantidad(1); }}
                                className="w-full text-sm font-bold text-slate-700 border border-slate-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                required
                            >
                                <option value="" disabled>Seleccionar Modelo...</option>
                                {modelos.map(m => <option key={m.id} value={m.modelo}>{m.modelo} (Stock: {inventarioCentral.filter(i => i.catalogo_equipos?.modelo === m.modelo && i.estado?.toLowerCase() === 'disponible').reduce((acc, curr) => acc + curr.cantidad, 0)})</option>)}
                            </select>
                        </div>
                    )}

                    {selectedModelo && hardwareActivo && (
                        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                            {esSerializado ? (
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-indigo-400 mb-1.5 tracking-wider flex items-center gap-1"><Server className="w-3.5 h-3.5" /> Número de Serie</label>
                                    <select 
                                        value={selectedSerie} 
                                        onChange={e => setSelectedSerie(e.target.value)}
                                        className="w-full text-sm font-bold text-indigo-900 border border-indigo-200 bg-white rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        required
                                    >
                                        <option value="" disabled>Seleccionar Serie...</option>
                                        {itemsDisponibles.map(item => <option key={item.id} value={item.numero_serie || ''}>{item.numero_serie}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-indigo-400 mb-1.5 tracking-wider flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Cantidad a Asignar</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max={maxGenericQuantity}
                                            value={cantidad} 
                                            onChange={e => setCantidad(Number(e.target.value))}
                                            className="w-24 text-center text-sm font-black text-indigo-900 border border-indigo-200 bg-white rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            required
                                        />
                                        <span className="text-xs font-bold text-indigo-400">/ max {maxGenericQuantity} disponbles</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-auto pt-6 flex justify-end gap-3 pb-2 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                        <button type="submit" disabled={isSubmitting || !selectedModelo || (esSerializado ? !selectedSerie : cantidad < 1 || cantidad > maxGenericQuantity)} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors shadow-sm">
                            Guardar Asignación
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
