'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Package, User, ChevronRight, Plus, ArrowLeftRight, Loader2, PackagePlus, History, Clock, X } from 'lucide-react';
import { assignToMochilaAction, returnFromMochilaAction, createMochilaAction } from './mochilasActions';
import { CustomSelect } from './CustomSelect';
import { LoopLoader } from '@/components/LoopLoader';

interface Bodega {
    id: string;
    nombre: string;
    tipo: string;
    tecnico_id?: string;
}

export function MochilasManager() {
    const [bodegas, setBodegas] = useState<Bodega[]>([]);
    const [selectedBodega, setSelectedBodega] = useState<Bodega | null>(null);
    const [loading, setLoading] = useState(true);

    const [stock, setStock] = useState<any[]>([]);
    const [loadingStock, setLoadingStock] = useState(false);

    const [centralStockRaw, setCentralStockRaw] = useState<any[]>([]);
    const [centralStockGroups, setCentralStockGroups] = useState<any[]>([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedCatalogoId, setSelectedCatalogoId] = useState('');
    const [assignAmount, setAssignAmount] = useState(1);
    const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([]);
    const [assigning, setAssigning] = useState(false);

    // Hitstorial
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Initializer State
    const [showInitModal, setShowInitModal] = useState(false);
    const [eligibleTechnicians, setEligibleTechnicians] = useState<any[]>([]);
    const [selectedTechId, setSelectedTechId] = useState('');
    const [initializing, setInitializing] = useState(false);
    const [fetchingTechs, setFetchingTechs] = useState(false);

    const supabase = createClient();

    const fetchBodegas = async () => {
        setLoading(true);
        const { data } = await supabase.from('bodegas').select('*').eq('tipo', 'MOCHILA').order('nombre');
        if (data) {
            setBodegas(data as Bodega[]);
        }
        setLoading(false);
    };

    const fetchStock = async (bodegaId: string) => {
        setLoadingStock(true);
        const { data } = await supabase
            .from('inventario')
            .select('*')
            .eq('bodega_id', bodegaId)
            .gt('cantidad', 0);
        if (data) setStock(data);
        setLoadingStock(false);
    };

    const fetchInventarioCentral = async () => {
        const { data: allBodegas } = await supabase.from('bodegas').select('id, tipo');
        const centralBodega = allBodegas?.find(b => b.tipo?.toUpperCase() === 'CENTRAL');

        if (centralBodega) {
            const { data } = await supabase
                .from('inventario')
                .select('*')
                .eq('bodega_id', centralBodega.id)
                .gt('cantidad', 0);
            
            if (data) {
                setCentralStockRaw(data);
                const agrupados = new Map();
                data.forEach(item => {
                    const groupId = `${item.modelo}|${item.familia}`;
                    if (!agrupados.has(groupId)) {
                        agrupados.set(groupId, { 
                            id: item.id, 
                            modelo: item.modelo, 
                            familia: item.familia, 
                            es_serializado: item.es_serializado,
                            total: 0 
                        });
                    }
                    agrupados.get(groupId).total += item.cantidad;
                });
                setCentralStockGroups(Array.from(agrupados.values()));
            }
        }
    };

    useEffect(() => {
        fetchBodegas();
        fetchInventarioCentral();
    }, []);

    const fetchHistory = async (bodegaId: string) => {
        setLoadingHistory(true);
        const { data, error } = await supabase
            .from('movimientos_inventario')
            .select(`
                *,
                inventario:inventario_id (
                    modelo,
                    familia,
                    numero_serie
                )
            `)
            .or(`bodega_destino_id.eq.${bodegaId},bodega_origen_id.eq.${bodegaId}`)
            .order('fecha_movimiento', { ascending: false });
            
        if (error) {
            console.error('Error fetching history:', error);
        }
            
        if (data) {
            setAssignmentHistory(data);
        }
        setLoadingHistory(false);
    };

    const handleSelectBodega = (b: Bodega) => {
        setSelectedBodega(b);
        setSelectedCatalogoId('');
        setSelectedSerialIds([]);
        fetchStock(b.id);
        fetchHistory(b.id);
    };

    const handleOpenInitModal = async () => {
        setShowInitModal(true);
        setFetchingTechs(true);
        
        // Paso 1: Fetch Técnicos ultra-flexible
        const { data: techs } = await supabase.from('profiles').select('id, full_name, rol').eq('rol', 'tecnico');
        
        if (techs) {
            // Paso 2: Fetch Mochilas Existentes
            const { data: asignadas } = await supabase
                .from('bodegas')
                .select('tecnico_id')
                .eq('tipo', 'MOCHILA')
                .not('tecnico_id', 'is', null);
                
            // Paso 3: Filtro Mágico en JS
            const mochilasIds = (asignadas || []).map(b => b.tecnico_id);
            const tecnicosDisponibles = techs.filter(t => !mochilasIds.includes(t.id));
            
            setEligibleTechnicians(tecnicosDisponibles);
        } else {
            setEligibleTechnicians([]);
        }
        setFetchingTechs(false);
    };

    const handleInitMochila = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTechId) return;
        
        const selectedTech = eligibleTechnicians.find(t => t.id === selectedTechId);
        if (!selectedTech) return;

        setInitializing(true);
        const res = await createMochilaAction(selectedTech.id, selectedTech.full_name || 'Desconocido');
        setInitializing(false);

        if (res.error) {
            alert(res.error);
        } else {
            setShowInitModal(false);
            setSelectedTechId('');
            fetchBodegas(); // Refrescar lista de bodegas
        }
    };

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBodega || !selectedCatalogoId) return;
        
        const selectedGroup = centralStockGroups.find(c => c.id === selectedCatalogoId);
        if (!selectedGroup) return;

        if (selectedGroup.es_serializado && selectedSerialIds.length === 0) return;
        if (!selectedGroup.es_serializado && assignAmount <= 0) return;

        setAssigning(true);
        const res = await assignToMochilaAction(
            selectedBodega.id, 
            selectedCatalogoId, 
            assignAmount, 
            selectedGroup.es_serializado ? selectedSerialIds : undefined
        );
        setAssigning(false);

        if (res.error) {
            alert(res.error);
        } else {
            setShowAssignModal(false);
            setSelectedCatalogoId('');
            setAssignAmount(1);
            setSelectedSerialIds([]);
            fetchStock(selectedBodega.id); // refresh
            fetchInventarioCentral(); // refresh origen
            fetchHistory(selectedBodega.id); // refresh history
        }
    };

    const handleReturn = async (inventarioId: string) => {
        if (!confirm('¿Estás seguro de devolver este inventario a la bodega central?')) return;
        const res = await returnFromMochilaAction(inventarioId);
        if (res.error) alert(res.error);
        else {
            fetchStock(selectedBodega!.id);
            fetchInventarioCentral();
        }
    };

    if (loading) return <LoopLoader text="Cargando Mochilas..." />;

    if (!selectedBodega) {
        return (
            <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden bg-slate-50/50">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">Mochilas Virtuales</h2>
                        <p className="text-sm text-slate-500 font-medium tracking-tight mt-0.5">Gestión de inventario asignado a técnicos de campo.</p>
                    </div>
                    <button 
                        onClick={handleOpenInitModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 text-[13px] tracking-wide"
                    >
                        <PackagePlus className="w-4 h-4" />
                        Inicializar Mochila
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bodegas.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-slate-200 border-dashed">
                                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
                                    <Package className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 mb-1">El inventario móvil está vacío</h3>
                                <p className="text-sm text-slate-500 font-medium text-center max-w-sm mb-6">
                                    No tienes mochilas virtuales activas. Inicializa una mochila para que tu equipo técnico pueda almacenar y transportar repuestos asignados desde la bodega central.
                                </p>
                                <button 
                                    onClick={handleOpenInitModal}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95"
                                >
                                    <PackagePlus className="w-5 h-5" />
                                    Agregar Primer Mochila
                                </button>
                            </div>
                        ) : (
                            bodegas.map(b => (
                                <button
                                    key={b.id}
                                    onClick={() => handleSelectBodega(b)}
                                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-500/50 transition-all text-left group flex items-center gap-4 active:scale-[0.98]"
                                >
                                    <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                        <Package className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800 text-lg mb-0.5 group-hover:text-amber-600 transition-colors truncate">{b.nombre}</h3>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-1">
                                            <User className="w-3.5 h-3.5" /> TÉCNICO DE CAMPO
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* MODAL PARA INICIALIZAR MOCHILA */}
                {showInitModal && (
                    <div className="fixed inset-0 z-[120] overflow-y-auto flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity" onClick={() => !initializing && setShowInitModal(false)} />
                        <div className="relative bg-white rounded-3xl w-full max-w-md p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200/50 animate-in zoom-in-95 duration-300 text-left">
                            <div className="mb-8 flex items-start gap-4">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                                    <PackagePlus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Crear Mochila</h3>
                                    <p className="text-sm text-slate-500 font-medium mt-0.5">Asignación virtual para Técnicos de Campo</p>
                                </div>
                            </div>
                            <form onSubmit={handleInitMochila} className="space-y-5">
                                <div>
                                    <label htmlFor="techId" className="block text-xs font-black text-slate-500 uppercase tracking-[0.15em] mb-2">Seleccionar Técnico</label>
                                    <CustomSelect
                                        id="techId"
                                        value={selectedTechId}
                                        onChange={setSelectedTechId}
                                        disabled={fetchingTechs || eligibleTechnicians.length === 0}
                                        options={eligibleTechnicians.map(t => ({ value: t.id, label: String(t.full_name) }))}
                                        placeholder={fetchingTechs ? 'Buscando técnicos elegibles...' : eligibleTechnicians.length === 0 ? 'Todos los técnicos tienen mochila.' : 'Seleccione personal disponible...'}
                                        required
                                    />
                                </div>
                                
                                <div className="mt-8 pt-6 border-t border-slate-100 flex gap-3">
                                    <button type="button" onClick={() => setShowInitModal(false)} disabled={initializing} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 shadow-sm">Cancelar</button>
                                    <button 
                                        type="submit" 
                                        disabled={initializing || eligibleTechnicians.length === 0 || !selectedTechId} 
                                        className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex justify-center items-center active:scale-95 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {initializing ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Inicializar Mochila'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 animate-in slide-in-from-right-4 duration-300">
            {/* BREADCRUMB HEADER */}
            <div className="flex items-center flex-wrap gap-2 text-[12px] font-black uppercase text-slate-400 tracking-widest bg-slate-50 px-5 py-3 rounded-xl border border-slate-200 mb-6 shrink-0 shadow-sm">
                <button onClick={() => setSelectedBodega(null)} className="hover:text-amber-500 transition-colors uppercase tracking-widest flex items-center gap-1.5">
                    <Package className="w-4 h-4" /> MOCHILAS
                </button>
                <ChevronRight className="w-4 h-4 text-slate-300" />
                <span className="text-amber-500 truncate max-w-[200px] flex items-center" title={selectedBodega.nombre}>
                    {selectedBodega.nombre}
                </span>
            </div>

            <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Interior de Mochila</h3>
                <div className="flex gap-2">
                    <button onClick={() => setShowHistoryModal(true)} className="bg-white border border-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-[13px] tracking-wide">
                        <History className="w-4 h-4"/> Ver Historial
                    </button>
                    <button onClick={() => setShowAssignModal(true)} className="bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-95 text-[13px] tracking-wide">
                        <Plus className="w-4 h-4"/> Asignar Material
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-y-auto shadow-sm flex flex-col">
                <table className="min-w-full divide-y divide-slate-200 relative">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <tr>
                            <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest w-full">Repuesto / Modelo</th>
                            <th className="px-6 py-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Cantidad</th>
                            <th className="px-6 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {loadingStock ? (
                            <tr><td colSpan={3} className="text-center py-16 text-slate-400"><Loader2 className="animate-spin w-8 h-8 mx-auto text-amber-500/50"/></td></tr>
                        ) : stock.length === 0 ? (
                            <tr><td colSpan={3} className="text-center py-16 text-slate-500 font-medium">La mochila está vacía. No tiene stock asignado.</td></tr>
                        ) : (
                            stock.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 text-[15px]">{item.modelo || 'Elemento Desconocido'}</div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400 mt-1 font-mono tracking-wider bg-slate-100 border border-slate-200 inline-flex px-2 py-0.5 rounded-md">
                                            FAMILIA: {item.familia}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-700 font-black text-sm border border-amber-200 shadow-inner group-hover:scale-110 transition-transform">
                                            {item.cantidad}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end">
                                            <button 
                                                onClick={() => handleReturn(item.id)}
                                                className="text-amber-500 hover:text-white bg-amber-50 hover:bg-amber-500 p-2.5 rounded-xl transition-all inline-flex justify-center items-center active:scale-95 border border-amber-100/50 hover:border-amber-600 shadow-sm"
                                                title="Devolver a Central"
                                            >
                                                <ArrowLeftRight className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Asignación */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[120] overflow-y-auto flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity" onClick={() => !assigning && setShowAssignModal(false)} />
                    <div className="relative bg-white rounded-3xl w-full max-w-lg p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200/50 animate-in zoom-in-95 duration-300 text-left">
                        <div className="mb-8 flex items-start gap-4">
                            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                                <Plus className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Asignar a Mochila</h3>
                                <p className="text-sm text-slate-500 font-medium mt-0.5">Extrayendo repuestos de Central hacia {selectedBodega.nombre}</p>
                            </div>
                        </div>
                        <form onSubmit={handleAssign} className="space-y-5">
                            <div>
                                <label htmlFor="catalogoId" className="block text-xs font-black text-slate-500 uppercase tracking-[0.15em] mb-2">Repuesto del Catálogo</label>
                                <CustomSelect
                                    id="catalogoId"
                                    name="catalogoId"
                                    value={selectedCatalogoId}
                                    onChange={(val) => {
                                        setSelectedCatalogoId(val);
                                        setAssignAmount(1);
                                        setSelectedSerialIds([]);
                                    }}
                                    options={centralStockGroups.map(c => ({ 
                                        value: c.id, 
                                        label: `${c.modelo} (${c.familia}) - ${c.total} disponible${c.total !== 1 ? 's' : ''}`
                                    }))}
                                    placeholder={centralStockGroups.length === 0 ? 'Central sin repuestos' : 'Seleccione repuesto en stock...'}
                                    disabled={centralStockGroups.length === 0}
                                    required
                                />
                            </div>
                            
                            {selectedCatalogoId && centralStockGroups.find(c => c.id === selectedCatalogoId)?.es_serializado ? (
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.15em]">Seleccionar Series</label>
                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{selectedSerialIds.length} seleccionados</span>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2 custom-scrollbar shadow-inner mt-2">
                                        {centralStockRaw
                                            .filter(item => {
                                                const group = centralStockGroups.find(c => c.id === selectedCatalogoId);
                                                return group && item.modelo === group.modelo && item.familia === group.familia && item.cantidad > 0 && item.es_serializado;
                                            })
                                            .map(item => (
                                                <label key={item.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 rounded-lg cursor-pointer transition-colors shadow-sm active:scale-[0.99] group">
                                                    <input 
                                                        type="checkbox"
                                                        checked={selectedSerialIds.includes(item.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedSerialIds(prev => [...prev, item.id]);
                                                            else setSelectedSerialIds(prev => prev.filter(id => id !== item.id));
                                                        }}
                                                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 accent-indigo-600 focus:ring-offset-0 transition-all cursor-pointer"
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-900 transition-colors">SN: {item.numero_serie || 'N/A'}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        {centralStockRaw.filter(item => {
                                            const group = centralStockGroups.find(c => c.id === selectedCatalogoId);
                                            return group && item.modelo === group.modelo && item.familia === group.familia && item.cantidad > 0 && item.es_serializado;
                                        }).length === 0 && (
                                            <p className="text-sm text-slate-500 text-center py-4 font-medium">No hay series disponibles para este modelo.</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label htmlFor="cantidadAsignar" className="block text-xs font-black text-slate-500 uppercase tracking-[0.15em] mb-2">Cantidad a Asignar</label>
                                    <div className="relative">
                                        <input 
                                            id="cantidadAsignar"
                                            name="cantidadAsignar"
                                            aria-label="Cantidad"
                                            type="number" 
                                            min="1" 
                                            max={centralStockGroups.find(c => c.id === selectedCatalogoId)?.total || 1}
                                            required 
                                            value={assignAmount} 
                                            onChange={(e) => setAssignAmount(parseInt(e.target.value))}
                                            className="w-full border border-slate-300 rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-500 transition-all text-slate-800 font-black text-lg bg-slate-50/50"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ammt</span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="mt-8 pt-6 border-t border-slate-100 flex gap-3">
                                <button type="button" onClick={() => setShowAssignModal(false)} disabled={assigning} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 shadow-sm">Cancelar</button>
                                <button 
                                    type="submit" 
                                    disabled={
                                        assigning || 
                                        (centralStockGroups.find(c => c.id === selectedCatalogoId)?.es_serializado && selectedSerialIds.length === 0)
                                    } 
                                    className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all flex justify-center items-center active:scale-95 shadow-md shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {assigning ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Finalizar Transferencia'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Historial (Drawer Lateral) */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-[120] overflow-hidden flex justify-end">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowHistoryModal(false)} />
                    <div className="relative bg-white w-full sm:w-[650px] sm:max-w-2xl h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <History className="w-5 h-5 text-indigo-500" />
                                    Historial de Asignaciones
                                </h3>
                                <p className="text-[11px] font-bold text-slate-500 tracking-wide mt-1 uppercase">Mochila de {selectedBodega.nombre.replace(/^MOCHILA\s*-\s*/i, '')}</p>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-20 text-indigo-500">
                                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600/50" />
                                    <span className="text-sm font-bold text-slate-600">Revisando bitácoras...</span>
                                </div>
                            ) : assignmentHistory.length === 0 ? (
                                <div className="text-center py-20 px-4">
                                    <div className="w-16 h-16 bg-white border border-slate-200 shadow-sm text-slate-300 rounded-2xl flex items-center justify-center mb-4 mx-auto rotate-3">
                                        <Clock className="w-8 h-8" />
                                    </div>
                                    <h4 className="text-sm font-black text-slate-700">Historial Vacío</h4>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Nunca se han asignado materiales al técnico.</p>
                                </div>
                            ) : (
                                <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                    {assignmentHistory.map((mov, index) => {
                                        const date = new Date(mov.fecha_movimiento);
                                        const now = new Date();
                                        const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                                        const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                                        const dateLabel = isToday ? `Hoy, ${timeStr}` : `${date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} ${timeStr}`;
                                        
                                        const inv = mov.inventario || mov.inventario_id;
                                        const itemName = inv?.modelo || inv?.descripcion || 'Material Desconocido';
                                        const sn = inv?.numero_serie;
                                        const familia = inv?.familia;
                                        
                                        const isIngreso = mov.bodega_destino_id === selectedBodega.id;
                                        
                                        return (
                                            <div key={mov.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-6">
                                                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-transform group-hover:scale-110 ${isIngreso ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                    <PackagePlus className="w-4 h-4" />
                                                </div>
                                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start gap-2 mb-2">
                                                        <div className="font-black text-slate-800 text-[13px] leading-tight flex-1">
                                                            {dateLabel} - {mov.cantidad}x {itemName}
                                                        </div>
                                                        {sn && (
                                                            <span className="font-bold font-mono text-indigo-600 text-[10px] bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 whitespace-nowrap">
                                                                SN: {sn}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="text-xs text-slate-500 font-medium">
                                                            Familia: <span className="font-bold text-slate-700">{familia || 'N/A'}</span>
                                                        </div>
                                                        <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-inner ${isIngreso ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                                                            {isIngreso ? `INGRESO` : `SALIDA`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
