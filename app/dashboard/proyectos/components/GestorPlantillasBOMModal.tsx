'use client';

import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { X, Settings, Plus, Trash2, Box, Loader2, Edit2, Search } from 'lucide-react';
import { crearPlantillaBOMAction, editarPlantillaBOMAction, eliminarPlantillaBOMAction } from '../actions';

interface CatalogItem {
    id: string;
    familia: string;
    modelo: string;
    es_serializado: boolean;
}

interface PlantillaBOM {
    id: string;
    nombre: string;
    items: Array<{
        modelo_id: string;
        nombre_modelo: string;
        cantidad: number;
        tipo: string;
        familia: string;
        es_serializado: boolean;
    }>;
    created_at: string;
}

interface Props {
    plantillas: PlantillaBOM[];
    catalogo: CatalogItem[];
}

export function GestorPlantillasBOMModal({ plantillas, catalogo }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Form states
    const [nombre, setNombre] = useState('');
    const [tempItems, setTempItems] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Combobox/Catalog states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
    const [cantidadInput, setCantidadInput] = useState<number>(1);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function handleClose() {
        setIsOpen(false);
        setNombre('');
        setTempItems([]);
        setSearchQuery('');
        setSelectedItem(null);
        setCantidadInput(1);
        setIsDropdownOpen(false);
        setEditingId(null);
        setError(null);
    }

    // Filter catalog based on search input
    const filteredCatalog = useMemo(() => {
        if (!searchQuery.trim()) return catalogo.slice(0, 30); // show first 30 items initially
        const query = searchQuery.toLowerCase();
        return catalogo.filter(
            item =>
                item.modelo.toLowerCase().includes(query) ||
                item.familia.toLowerCase().includes(query)
        );
    }, [catalogo, searchQuery]);

    function handleAddItem() {
        if (!selectedItem) {
            setError('Debes seleccionar un equipo del catálogo.');
            return;
        }
        if (cantidadInput <= 0) {
            setError('La cantidad debe ser mayor a cero.');
            return;
        }
        
        // Check if already added
        if (tempItems.some(i => i.modelo_id === selectedItem.id)) {
            setError('Este equipo ya está en la receta.');
            return;
        }

        setError(null);
        setTempItems([
            ...tempItems,
            {
                modelo_id: selectedItem.id,
                nombre_modelo: selectedItem.modelo,
                cantidad: cantidadInput,
                tipo: selectedItem.es_serializado ? 'Serializado' : 'Genérico',
                familia: selectedItem.familia,
                es_serializado: selectedItem.es_serializado,
            },
        ]);
        
        // Reset adder inputs
        setSelectedItem(null);
        setSearchQuery('');
        setCantidadInput(1);
    }

    function handleRemoveItem(modeloId: string) {
        setTempItems(tempItems.filter(i => i.modelo_id !== modeloId));
    }

    function handleLoadEdit(p: PlantillaBOM) {
        setEditingId(p.id);
        setNombre(p.nombre);
        setTempItems(p.items || []);
        setError(null);
    }

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El nombre de la receta es obligatorio.');
            return;
        }
        if (tempItems.length === 0) {
            setError('Debes agregar al menos un material a la receta.');
            return;
        }

        setError(null);
        startTransition(async () => {
            let res;
            if (editingId) {
                res = await editarPlantillaBOMAction(editingId, nombre.trim(), tempItems);
            } else {
                res = await crearPlantillaBOMAction(nombre.trim(), tempItems);
            }

            if (res.error) {
                setError(res.error);
            } else {
                setNombre('');
                setTempItems([]);
                setEditingId(null);
            }
        });
    }

    function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta receta?')) return;
        setError(null);
        startTransition(async () => {
            const res = await eliminarPlantillaBOMAction(id);
            if (res.error) {
                setError(res.error);
            }
        });
    }

    return (
        <>
            {/* Cog Button Trigger */}
            <button
                onClick={() => setIsOpen(true)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                title="Gestionar Recetas de Hardware"
            >
                <Box className="w-4 h-4" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm font-sans select-none">
                    <div
                        className="relative w-full max-w-4xl mx-4 bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center shrink-0 shadow-md">
                                    <Box className="w-5 h-5 text-white" strokeWidth={1.75} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Recetas de Hardware</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Definición de recetas estándar de hardware para locales</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>

                        {/* Body - Grid Layout */}
                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                            
                            {/* Left Panel: Form to Create/Edit */}
                            <div className="flex flex-col gap-4 border-r border-slate-100 pr-0 md:pr-6">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                    {editingId ? 'Editar Receta Maestra' : 'Crear Nueva Receta'}
                                </h4>

                                <form onSubmit={handleSave} className="space-y-4 flex flex-col flex-1">
                                    {/* Template Name */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nombre de Receta</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: Setup 1 POS + 3 KVS Standard"
                                            value={nombre}
                                            onChange={e => setNombre(e.target.value)}
                                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400 bg-slate-50"
                                        />
                                    </div>

                                    {/* Equipment Custom Combobox Selector */}
                                    <div className="grid grid-cols-3 gap-2 items-end">
                                        <div className="col-span-2 space-y-1 relative" ref={dropdownRef}>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Buscar en Catálogo</label>
                                            
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder={selectedItem ? selectedItem.modelo : "Escribe modelo o familia..."}
                                                    value={searchQuery}
                                                    onChange={e => {
                                                        setSearchQuery(e.target.value);
                                                        setIsDropdownOpen(true);
                                                        if (selectedItem) setSelectedItem(null); // Reset selection if user keeps typing
                                                    }}
                                                    onFocus={() => setIsDropdownOpen(true)}
                                                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-450 bg-slate-50"
                                                />
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                                            </div>

                                            {/* Dropdown Options */}
                                            {isDropdownOpen && (
                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-40 overflow-y-auto py-1">
                                                    {filteredCatalog.length === 0 ? (
                                                        <p className="text-[10px] text-slate-400 text-center py-3 font-medium">No se encontraron resultados</p>
                                                    ) : (
                                                        filteredCatalog.map(item => (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedItem(item);
                                                                    setSearchQuery('');
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 text-slate-700 flex flex-col gap-0.5 border-b border-slate-50/50 last:border-0 cursor-pointer font-sans"
                                                            >
                                                                <span className="font-bold">{item.modelo}</span>
                                                                <span className="text-[9px] font-bold uppercase text-slate-400">
                                                                    {item.familia} · {item.es_serializado ? 'Serializado' : 'Genérico'}
                                                                </span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Cantidad Input */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Cantidad</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    required
                                                    value={cantidadInput}
                                                    onChange={e => setCantidadInput(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-slate-50 text-center"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddItem}
                                                    className="px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center cursor-pointer shrink-0 shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Added Items List */}
                                    <div className="flex-1 border border-slate-200/80 rounded-2xl bg-slate-50/40 p-4 min-h-[180px] max-h-[260px] overflow-y-auto flex flex-col gap-2">
                                        {tempItems.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                                                <Box className="w-7 h-7 text-slate-200 mb-2" />
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lista vacía</p>
                                                <p className="text-[9px] text-slate-350 mt-0.5">Agrega hardware desde el buscador para conformar el kit</p>
                                            </div>
                                        ) : (
                                            tempItems.map(item => (
                                                <div key={item.modelo_id} className="flex justify-between items-center gap-3 bg-white border border-slate-150/40 px-3.5 py-2.5 rounded-xl shadow-sm group">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-slate-800 truncate">{item.nombre_modelo}</p>
                                                        <p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">
                                                            {item.familia} · {item.tipo}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="text-xs font-black text-slate-700 bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded-lg">
                                                            x{item.cantidad}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(item.modelo_id)}
                                                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        {editingId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setNombre('');
                                                    setTempItems([]);
                                                }}
                                                className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={isPending || !nombre.trim() || tempItems.length === 0}
                                            className="flex-1 py-2.5 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                                        >
                                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            {editingId ? 'Guardar Cambios' : 'Guardar Receta'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Right Panel: List of Saved Recipes */}
                            <div className="flex flex-col gap-4">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                    Recetas Guardadas ({plantillas.length})
                                </h4>

                                <div className="flex-1 border border-slate-200/80 rounded-3xl bg-slate-50/20 p-4 overflow-y-auto max-h-[460px] flex flex-col gap-3 min-h-[220px]">
                                    {plantillas.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                                            <Box className="w-10 h-10 text-slate-200 mb-3" />
                                            <p className="text-slate-400 font-bold text-sm">Sin recetas aún</p>
                                            <p className="text-slate-350 text-xs mt-1">Crea la primera completando el formulario de la izquierda</p>
                                        </div>
                                    ) : (
                                        plantillas.map(p => (
                                            <div
                                                key={p.id}
                                                className={`bg-white border p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-all duration-200 ${
                                                    editingId === p.id ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-slate-200/80'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="min-w-0">
                                                        <h5 className="font-bold text-slate-800 text-sm leading-snug">{p.nombre}</h5>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider">
                                                            {p.items?.length || 0} Modelos definidos
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Row controls */}
                                                    <div className="flex gap-1.5 shrink-0">
                                                        <button
                                                            onClick={() => handleLoadEdit(p)}
                                                            className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                                                            title="Editar receta"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(p.id)}
                                                            className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-650 flex items-center justify-center transition-colors cursor-pointer"
                                                            title="Eliminar receta"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Mini Items list preview */}
                                                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pb-1">
                                                    {(p.items || []).slice(0, 4).map((item, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-block px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-slate-500 font-semibold max-w-[170px] truncate"
                                                        >
                                                            x{item.cantidad} {item.nombre_modelo}
                                                        </span>
                                                    ))}
                                                    {p.items?.length > 4 && (
                                                        <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-150 text-[10px] text-slate-450 font-black">
                                                            +{p.items.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Error and Alert display */}
                        {error && (
                            <div className="bg-red-50 border-t border-red-200 px-6 py-3 text-red-700 text-xs font-semibold flex items-center justify-between shrink-0 font-sans">
                                <span>{error}</span>
                                <button onClick={() => setError(null)} className="shrink-0 cursor-pointer">
                                    <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
