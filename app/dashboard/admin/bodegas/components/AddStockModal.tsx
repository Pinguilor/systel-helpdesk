'use client';

import { useState, useMemo } from 'react';
import { PackagePlus, X, Box, Server, Check, Edit3, PlusCircle } from 'lucide-react';
import { addStockAction } from '../actions';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';

export function AddStockModal({ bodegas, inventario, familias }: { bodegas: any[], inventario: any[], familias: any[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    
    // Controlled Smart Fields
    const [bodegaId, setBodegaId] = useState('');
    const [esSerializado, setEsSerializado] = useState(false);
    
    // Controlled Selection for Existing Stock
    const [selectedEquipoId, setSelectedEquipoId] = useState('');
    const [nuevoSerie, setNuevoSerie] = useState('');
    
    // Additional Custom Dropdown States
    const [familia, setFamilia] = useState('');

    // Derived Data para Stock Existente
    const equiposExistentes = useMemo(() => {
        if (!bodegaId) return [];
        // Traer los equipos de la bodega, deduplicados por modelo/familia
        const enBodega = inventario.filter(i => i.bodega_id === bodegaId);
        const unicos = [];
        const seen = new Set();
        for (const item of enBodega) {
            const key = `${item.modelo}-${item.familia}`;
            if (!seen.has(key)) {
                seen.add(key);
                unicos.push(item);
            }
        }
        return unicos;
    }, [inventario, bodegaId]);

    const selectedEquipo = useMemo(() => {
        return equiposExistentes.find(e => e.id === selectedEquipoId);
    }, [equiposExistentes, selectedEquipoId]);

    const isSelectedSerializado = selectedEquipo?.es_serializado || false;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!bodegaId) {
            alert('Por favor, seleccione una Bodega de Ingreso.');
            return;
        }

        if (mode === 'existing' && !selectedEquipoId) {
            alert('Por favor, seleccione un Equipo de Catálogo primero.');
            return;
        }

        if (mode === 'new' && !familia) {
            alert('Por favor, seleccione una Familia de Hardware.');
            return;
        }

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        formData.set('es_serializado', esSerializado ? 'true' : 'false');
        formData.set('mode', mode);

        const result = await addStockAction(formData);
        setIsSubmitting(false);

        if (result?.error) {
            alert(result.error);
        } else {
            setIsOpen(false);
            setEsSerializado(false);
            setBodegaId('');
            setSelectedEquipoId('');
            setNuevoSerie('');
            setFamilia('');
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
            >
                <PackagePlus className="w-5 h-5" />
                <span>Ingreso de Stock</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl shrink-0">
                            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
                                <Box className="w-6 h-6 text-indigo-600" />
                                Ingreso Centralizado
                            </h3>
                            <button onClick={() => setIsOpen(false)} title="Cerrar modal" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* TABS */}
                        <div className="flex px-6 pt-5 gap-4 shrink-0">
                            <button
                                type="button"
                                onClick={() => setMode('existing')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all flex justify-center items-center gap-2 ${mode === 'existing' ? 'border-indigo-600 text-indigo-600' : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
                            >
                                <Edit3 className="w-4 h-4" />
                                Stock Existente
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('new')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all flex justify-center items-center gap-2 ${mode === 'new' ? 'border-indigo-600 text-indigo-600' : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
                            >
                                <PlusCircle className="w-4 h-4" />
                                Nuevo Equipo
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                            
                            {/* BODEGA DESTINO (SHARED) */}
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Bodega de Ingreso</label>
                                <CustomSelect 
                                    id="bodega_id"
                                    name="bodega_id"
                                    value={bodegaId}
                                    onChange={(val) => {
                                        setBodegaId(val);
                                        setSelectedEquipoId('');
                                        setNuevoSerie('');
                                    }}
                                    options={bodegas.map(b => ({
                                        value: b.id,
                                        label: `${b.tipo?.toUpperCase() === 'CENTRAL' ? '🏢' : '🔌'} ${b.nombre} (${b.tipo})`
                                    }))}
                                    placeholder="Seleccione bodega destino..."
                                    required
                                />
                            </div>

                            <hr className="border-slate-100 my-2" />

                            {mode === 'existing' ? (
                                // ==== TAB: STOCK EXISTENTE ====
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Equipo de Catálogo</label>
                                        <CustomSelect 
                                            id="inventario_id"
                                            name="inventario_id"
                                            value={selectedEquipoId}
                                            onChange={(val) => {
                                                setSelectedEquipoId(val);
                                                setNuevoSerie('');
                                            }}
                                            options={equiposExistentes.map(eq => ({
                                                value: eq.id,
                                                label: `${eq.modelo} (${eq.familia}) ${eq.es_serializado ? '- Serializado' : `- Actual: ${eq.cantidad} u.`}`
                                            }))}
                                            placeholder={!bodegaId ? 'Primero seleccione una bodega...' : equiposExistentes.length === 0 ? 'No hay equipos en esta bodega' : 'Seleccione el equipo a actualizar...'}
                                            disabled={!bodegaId}
                                            required={mode === 'existing'}
                                        />
                                    </div>

                                    {isSelectedSerializado ? (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="block text-xs font-black uppercase text-indigo-400 mb-2 tracking-wider flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> Nuevo Número de Serie</label>
                                            <input 
                                                type="text" 
                                                name="nuevo_numero_serie" 
                                                required 
                                                minLength={5}
                                                value={nuevoSerie}
                                                onChange={(e) => setNuevoSerie(e.target.value)}
                                                placeholder="N/S del nuevo equipo" 
                                                className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-lg py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:font-medium placeholder:text-slate-400" 
                                            />
                                            {nuevoSerie.length > 0 && nuevoSerie.trim().length < 5 && (
                                                <p className="text-red-500 text-sm mt-1">El número de serie debe tener al menos 5 caracteres.</p>
                                            )}
                                            <p className="text-xs text-slate-400 text-center italic mt-4">Al ser un equipo serializado, esta acción creará un <b>NUEVO REGISTRO</b> de Inventario con cantidad 1.</p>
                                        </div>
                                    ) : (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Cantidad a Sumar</label>
                                            <input type="number" name="cantidad" min="1" defaultValue="1" required className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-lg py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" />
                                            <p className="text-xs text-slate-400 text-center italic mt-4">Esta acción añadirá un UPDATE matemático al registro existente de la bodega seleccionada.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // ==== TAB: NUEVO EQUIPO ====
                                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Nombre de Equipo / Modelo</label>
                                        <input 
                                            type="text" 
                                            name="modelo" 
                                            placeholder="Ej: Router Cisco Meraki MX68" 
                                            required 
                                            className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-lg py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:font-medium placeholder:text-slate-400" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Familia de Hardware</label>
                                        <CustomSelect 
                                            id="familia"
                                            name="familia"
                                            value={familia}
                                            onChange={setFamilia}
                                            options={familias.map(f => ({
                                                value: f.nombre,
                                                label: f.nombre
                                            }))}
                                            placeholder="Seleccione la familia..."
                                            required={mode === 'new'}
                                        />
                                    </div>
                                    <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${esSerializado ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'}`}>
                                            {esSerializado && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <input type="checkbox" title="Es Serializado" className="hidden" checked={esSerializado} onChange={e => setEsSerializado(e.target.checked)} />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-800">El equipo requiere Número de Serie</span>
                                            <span className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">Activar para enrutadores, tablets o equipos trackeables individualmente.</span>
                                        </div>
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">Cantidad Inicial</label>
                                            <input type="number" name="cantidad" min="1" defaultValue="1" required className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-lg py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-xs font-black uppercase text-indigo-400 mb-2 tracking-wider flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> Número de Serie (Opc)</label>
                                            <input type="text" name="numero_serie" placeholder="Obligatorio si es serial" className="w-full text-sm font-bold text-slate-800 border-2 border-slate-200 rounded-lg py-3 px-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:font-medium placeholder:text-slate-400" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 text-center italic mt-4">Esta acción insertará un nuevo registro de catálogo en la base de datos de inventario.</p>
                                </div>
                            )}

                            <div className="mt-4 pt-6 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsOpen(false)} title="Cancelar y cerrar" className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isSubmitting} title="Guardar cambios de stock" className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">
                                    {isSubmitting ? 'Procediendo...' : mode === 'existing' ? 'Actualizar Stock' : 'Registrar Nuevo Equipo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
