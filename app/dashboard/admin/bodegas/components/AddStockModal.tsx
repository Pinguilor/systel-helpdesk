'use client';

import { useState } from 'react';
import { PackagePlus, X, Box, Server, Check } from 'lucide-react';
import { addStockAction } from '../actions';

interface AddStockModalProps {
    bodegas: any[];
    catalogo: any[];
}

export function AddStockModal({ bodegas, catalogo }: AddStockModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [esSerializado, setEsSerializado] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        formData.append('mode', mode);
        
        // Ensure boolean is passed correctly
        if (mode === 'new') {
            formData.set('es_serializado', esSerializado ? 'true' : 'false');
        } else {
            const selectedCatId = formData.get('catalogo_id') as string;
            const cat = catalogo.find(c => c.id === selectedCatId);
            formData.set('es_serializado', cat?.es_serializado ? 'true' : 'false');
        }

        const result = await addStockAction(formData);
        setIsSubmitting(false);

        if (result?.error) {
            alert(result.error);
        } else {
            setIsOpen(false);
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
            >
                <PackagePlus className="w-5 h-5" />
                <span>Añadir Stock</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl shrink-0">
                            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
                                <Box className="w-6 h-6 text-indigo-600" />
                                Ingreso de Stock
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                            
                            {/* Mode Toggle */}
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button type="button" onClick={() => setMode('existing')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'existing' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Stock Existente</button>
                                <button type="button" onClick={() => setMode('new')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'new' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Nuevo Equipo</button>
                            </div>

                            {/* Bodega Destino */}
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Bodega de Ingreso</label>
                                <select name="bodega_id" required className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-xl py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all">
                                    <option value="" disabled selected>Seleccione bodega destino...</option>
                                    {bodegas.map(b => (
                                        <option key={b.id} value={b.id}>{b.nombre} ({b.tipo})</option>
                                    ))}
                                </select>
                            </div>

                            <hr className="border-slate-100" />

                            {mode === 'existing' ? (
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Equipo de Catálogo</label>
                                    <select name="catalogo_id" required className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-xl py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all">
                                        <option value="" disabled selected>Seleccione el modelo existente...</option>
                                        {catalogo.map(c => (
                                            <option key={c.id} value={c.id}>{c.familia} - {c.modelo} {c.es_serializado ? '(Serializado)' : ''}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Familia de Hardware</label>
                                        <input type="text" name="familia" placeholder="Ej: Router, Switch, Terminal" required className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-xl py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:font-medium placeholder:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Modelo Específico</label>
                                        <input type="text" name="modelo" placeholder="Ej: Cisco Meraki MX68" required className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-xl py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:font-medium placeholder:text-slate-400" />
                                    </div>
                                    <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${esSerializado ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'}`}>
                                            {esSerializado && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={esSerializado} onChange={e => setEsSerializado(e.target.checked)} />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-800">El equipo requiere Número de Serie</span>
                                            <span className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">Activar para enrutadores, tablets o equipos trackeables individualmente.</span>
                                        </div>
                                    </label>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Cantidad</label>
                                    <input type="number" name="cantidad" min="1" defaultValue="1" required className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-xl py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs font-black uppercase text-indigo-400 mb-2 tracking-wider flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> Número de Serie (Opc)</label>
                                    <input type="text" name="numero_serie" placeholder="Obligatorio si es serial" className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-xl py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:font-medium placeholder:text-slate-400" />
                                </div>
                            </div>

                            <div className="mt-4 pt-6 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">
                                    {isSubmitting ? 'Guardando...' : 'Confirmar Ingreso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
