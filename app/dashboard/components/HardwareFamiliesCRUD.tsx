'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit2, Save, X, Trash2, Box, Loader2 } from 'lucide-react';
import { FamiliaHardware } from '@/types/database.types';

export function HardwareFamiliesCRUD() {
    const [data, setData] = useState<FamiliaHardware[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FamiliaHardware | null>(null);
    const [formNombre, setFormNombre] = useState('');

    const [itemToDelete, setItemToDelete] = useState<FamiliaHardware | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const supabase = createClient();

    const fetchData = async () => {
        setLoading(true);
        const { data: dbData, error } = await supabase.from('familias_hardware').select('*').order('nombre', { ascending: true });
        if (!error && dbData) {
            setData(dbData as FamiliaHardware[]);
        }
        setLoading(false);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);
        const { error } = await supabase.from('familias_hardware').delete().eq('id', itemToDelete.id);
        setIsDeleting(false);
        if (!error) {
            setItemToDelete(null);
            fetchData();
        } else {
            console.error(error);
            alert("Error al eliminar el registro. Puede que esté en uso en el inventario o tickets.");
            setItemToDelete(null);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        const payload = {
            nombre: formNombre.trim()
        };

        let error;

        if (editingItem) {
            const { error: err } = await supabase
                .from('familias_hardware')
                .update(payload)
                .eq('id', editingItem.id);
            error = err;
        } else {
            const { error: err } = await supabase
                .from('familias_hardware')
                .insert([payload]);
            error = err;
        }

        setIsSaving(false);

        if (!error) {
            setIsFormOpen(false);
            setFormNombre('');
            setEditingItem(null);
            fetchData();
        } else {
            console.error(error);
            alert("Error al guardar: " + error.message);
        }
    };

    const openEdit = (item: FamiliaHardware) => {
        setEditingItem(item);
        setFormNombre(item.nombre || '');
        setIsFormOpen(true);
    };

    const openCreate = () => {
        setEditingItem(null);
        setFormNombre('');
        setIsFormOpen(true);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 relative">
            <div className="flex-shrink-0 p-6 bg-white border-b border-slate-200 shadow-sm z-10 sticky top-0 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <Box className="w-6 h-6 text-indigo-500" />
                        Familias de Hardware
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Diccionario maestro de categorización de equipos.</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                
                {/* INLINE FORM TOGGLE BUTTON */}
                {!isFormOpen && (
                    <div className="mb-6 flex justify-start">
                        <button
                            onClick={openCreate}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            Añadir Familia
                        </button>
                    </div>
                )}

                {/* INLINE FORM */}
                {isFormOpen && (
                    <div className="mb-6 bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-slate-800">
                                {editingItem ? 'Editar Familia' : 'Nueva Familia'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} title="Cancelar" className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="flex gap-4 items-end flex-wrap">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                    Nombre de Familia
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formNombre}
                                    onChange={(e) => setFormNombre(e.target.value)}
                                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:font-medium placeholder:text-slate-400"
                                    placeholder="Ej: LAPTOP, ROUTER..."
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="flex-1 sm:flex-none px-5 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving || !formNombre.trim()}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                        <p className="text-sm font-bold text-slate-400">Cargando Familias...</p>
                    </div>
                ) : data.length === 0 && !isFormOpen ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <Box className="w-16 h-16 text-slate-200 mb-4" />
                        <h3 className="text-lg font-black text-slate-700">No hay registros</h3>
                        <p className="text-sm text-slate-500 text-center max-w-sm mt-2">Crea la primera Familia de Hardware para comenzar a categorizar tu inventario global.</p>
                        <button
                            onClick={openCreate}
                            className="mt-6 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm"
                        >
                            <Plus className="w-5 h-5" />
                            Añadir Familia
                        </button>
                    </div>
                ) : data.length > 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <ul className="divide-y divide-slate-100">
                            {data.map(item => (
                                <li key={item.id} className="group hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center justify-between p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100/50">
                                                <Box className="w-5 h-5 text-indigo-500" />
                                            </div>
                                            <div className="font-bold text-slate-800 text-base">{item.nombre}</div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEdit(item)}
                                                title="Editar Familia"
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setItemToDelete(item)}
                                                title="Eliminar Familia"
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </div>

            {/* Delete Confirmation Modal */}
            {itemToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => !isDeleting && setItemToDelete(null)}></div>
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative z-10 animate-in zoom-in-95 duration-200">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mb-4">
                            <Trash2 className="h-7 w-7 text-red-600" />
                        </div>
                        <h3 className="text-xl font-black text-center text-slate-900 mb-2">¿Eliminar Familia?</h3>
                        <p className="text-sm text-center text-slate-500 mb-6 font-medium leading-relaxed">
                            Estás a punto de eliminar <strong>"{itemToDelete.nombre}"</strong>. Esta acción es irreversible y podría causar errores visuales si hay equipos asignados a esta familia.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setItemToDelete(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                disabled={isDeleting}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
