'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit2, Save, X, ToggleLeft, ToggleRight, Loader2, RefreshCw, ListTree, Trash2 } from 'lucide-react';

interface RowData {
    id: string;
    nombre?: string;
    activo?: boolean;
    rol?: string;
    [key: string]: any;
}

interface CatalogCrudTableProps {
    tableName: string;
    labelName: string;
    baseFilter?: { column: string, value: string };
    onDrillDown?: (item: RowData) => void;
    readOnlySettings?: boolean; // For users or profiles that shouldn't be fully editable here
    allowDelete?: boolean;
}

export function CatalogCrudTable({ tableName, labelName, baseFilter, onDrillDown, readOnlySettings = false, allowDelete = false }: CatalogCrudTableProps) {
    const [data, setData] = useState<RowData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RowData | null>(null);
    const [formNombre, setFormNombre] = useState('');
    const [formActivo, setFormActivo] = useState(true);

    const [itemToDelete, setItemToDelete] = useState<RowData | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const supabase = createClient();

    const fetchData = async () => {
        setLoading(true);
        let query = supabase.from(tableName).select('*');
        
        // Sorting fallback (profiles don't always have 'nombre', they might have 'full_name')
        if (tableName === 'profiles') {
            query = query.order('full_name', { ascending: true });
        } else {
            query = query.order('nombre', { ascending: true });
        }

        if (baseFilter) {
            query = query.eq(baseFilter.column, baseFilter.value);
        }
        
        const { data: dbData, error } = await query;
        if (!error && dbData) {
            setData(dbData as RowData[]);
        }
        setLoading(false);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);
        const { error } = await supabase.from(tableName).delete().eq('id', itemToDelete.id);
        setIsDeleting(false);
        if (!error) {
            setItemToDelete(null);
            fetchData();
        } else {
            console.error(error);
            alert("Error al eliminar el registro. Puede que esté en uso en otros tickets o configuraciones.");
        }
    };

    useEffect(() => {
        fetchData();
    }, [tableName, baseFilter?.value]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnlySettings) return;

        setIsSaving(true);
        
        const payload: any = {
            nombre: formNombre.trim(),
            activo: formActivo
        };

        let error;

        if (editingItem) {
            // Update
            const { error: err } = await supabase
                .from(tableName)
                .update(payload)
                .eq('id', editingItem.id);
            error = err;
        } else {
            // Insert
            if (baseFilter) {
                payload[baseFilter.column] = baseFilter.value;
            }
            const { error: err } = await supabase
                .from(tableName)
                .insert(payload);
            error = err;
        }

        if (!error) {
            await fetchData();
            setIsFormOpen(false);
        } else {
            console.error(error);
            alert("Error al guardar: " + error.message);
        }
        setIsSaving(false);
    };

    const toggleStatus = async (item: RowData) => {
        if (readOnlySettings || item.activo === undefined) return;
        
        const { error } = await supabase
            .from(tableName)
            .update({ activo: !item.activo })
            .eq('id', item.id);
        
        if (!error) {
            setData(prev => prev.map(d => d.id === item.id ? { ...d, activo: !d.activo } : d));
        } else {
            alert("Error al cambiar estado");
        }
    };

    const openCreateForm = () => {
        setEditingItem(null);
        setFormNombre('');
        setFormActivo(true);
        setIsFormOpen(true);
    };

    const openEditForm = (item: RowData) => {
        setEditingItem(item);
        setFormNombre(item.nombre || item.full_name || '');
        setFormActivo(item.activo ?? true);
        setIsFormOpen(true);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{labelName}</h2>
                    <p className="text-sm text-slate-500 font-medium tracking-tight mt-0.5">
                        {baseFilter ? `Gestión específica filtrada.` : `Gestión global del catálogo.`}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={fetchData}
                        className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center"
                        title="Actualizar"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                    {!readOnlySettings && (
                        <button 
                            onClick={openCreateForm}
                            className="bg-brand-primary text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 hover:bg-brand-primary/90 transition-all shadow-md active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            Añadir Nuevo
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="min-w-full divide-y divide-slate-200 relative">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest w-full">Nombre / Referencia</th>
                                <th scope="col" className="px-6 py-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Estado</th>
                                <th scope="col" className="px-6 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="w-8 h-8 animate-spin text-brand-primary/50" />
                                            <span className="font-medium text-sm">Cargando catálogo...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-medium">
                                        No hay registros configurados en {labelName.toLowerCase()}.
                                    </td>
                                </tr>
                            ) : (
                                data.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-slate-800 text-[15px]">{item.nombre || item.full_name || 'Sin Nombre'}</span>
                                            {item.rol && <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{item.rol}</div>}
                                        </td>
                                        
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {item.activo !== undefined ? (
                                                <button 
                                                    onClick={() => toggleStatus(item)}
                                                    disabled={readOnlySettings}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[10px] tracking-widest transition-all border ${
                                                        item.activo 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                                    } ${readOnlySettings && 'opacity-70 cursor-not-allowed'}`}
                                                >
                                                    {item.activo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                                    {item.activo ? 'ACTIVO' : 'INACTIVO'}
                                                </button>
                                            ) : (
                                                <span className="text-slate-300 text-xs">--</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2 items-center">
                                                {onDrillDown && (
                                                    <button 
                                                        onClick={() => onDrillDown(item)}
                                                        className="text-white hover:text-white bg-slate-800 hover:bg-slate-900 px-3.5 py-1.5 rounded-lg transition-all inline-flex justify-center items-center gap-2 font-bold shadow-sm active:scale-95"
                                                        title="Ver Subcategorías"
                                                    >
                                                        <ListTree className="h-4 w-4" /> Subcategorías
                                                    </button>
                                                )}
                                                {!readOnlySettings && (
                                                    <button 
                                                        onClick={() => openEditForm(item)}
                                                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors inline-flex justify-center items-center active:scale-95"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {allowDelete && !readOnlySettings && (
                                                    <button 
                                                        onClick={() => setItemToDelete(item)}
                                                        className="text-red-500 hover:text-white bg-red-50 hover:bg-red-500 p-2 rounded-lg transition-colors inline-flex justify-center items-center active:scale-95"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* FORM MODAL INTERNO */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[120] overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4">
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsFormOpen(false)} />
                        
                        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all w-full max-w-lg border border-slate-100 p-6">
                            <div className="absolute right-0 top-0 pr-4 pt-4">
                                <button onClick={() => setIsFormOpen(false)} className="rounded-full bg-slate-50 p-1.5 text-slate-400 hover:text-slate-700 transition-colors" title="Cerrar formulario">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            
                            <h3 className="text-xl font-black text-slate-900 mb-6 tracking-tight">
                                {editingItem ? 'Editar Registro' : 'Nuevo Registro'}
                            </h3>

                            <form onSubmit={handleSave} className="space-y-5">
                                <div>
                                    <label htmlFor="nombre" className="block text-sm font-bold text-slate-700 mb-1.5 tracking-tight">Nombre del Elemento</label>
                                    <input
                                        type="text"
                                        id="nombre"
                                        required
                                        value={formNombre}
                                        onChange={e => setFormNombre(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-colors text-slate-800 font-medium"
                                        placeholder={`Ej: ${labelName}...`}
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center gap-4 cursor-pointer mt-4 p-4 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                                        <input
                                            type="checkbox"
                                            checked={formActivo}
                                            onChange={e => setFormActivo(e.target.checked)}
                                            className="w-5 h-5 text-brand-primary rounded focus:ring-brand-primary border-slate-300 transition-all"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-800 tracking-tight group-hover:text-brand-primary transition-colors">Estado del Registro: {formActivo ? 'ACTIVO' : 'INACTIVO'}</span>
                                            <span className="text-xs text-slate-500 font-medium mt-0.5">Permite que este elemento sea visible y elegible operativamente.</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsFormOpen(false)}
                                        className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="px-6 py-2.5 rounded-xl font-bold text-white bg-brand-primary hover:bg-brand-primary/90 transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        Guardar Registro
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {itemToDelete && (
                <div className="fixed inset-0 z-[130] overflow-y-auto w-screen h-screen">
                    <div className="flex min-h-screen items-center justify-center p-4">
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => !isDeleting && setItemToDelete(null)} />
                        
                        <div className="relative transform overflow-hidden rounded-2xl bg-white text-center shadow-2xl transition-all w-full max-w-sm border border-slate-100 p-6 sm:p-8 animate-in zoom-in-95 duration-200">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">¿Eliminar registro?</h3>
                            <p className="text-sm text-slate-500 font-medium mb-6">
                                Estás a punto de borrar <span className="text-slate-900 font-bold">"{itemToDelete.nombre || itemToDelete.full_name || 'este elemento'}"</span>. Esta acción es irreversible. ¿Deseas continuar?
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setItemToDelete(null)}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 border border-transparent flex items-center justify-center transition-all disabled:opacity-50"
                                >
                                    {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sí, eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
