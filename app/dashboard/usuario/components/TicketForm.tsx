'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createTicketAction } from '../actions';
import { Loader2, Paperclip, Ticket } from 'lucide-react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Restaurante, CatalogoServicio, Zona } from '@/types/database.types';
import { CustomSelect } from '../../components/CustomSelect';
import 'react-quill-new/dist/quill.snow.css';
import imageCompression from 'browser-image-compression';

// Dynamic import of ReactQuill to prevent document hydration errors in Next.js
const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-32 w-full bg-gray-50 rounded-md animate-pulse border border-gray-200"></div>
});

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

interface Props {
    onClose?: () => void;
}

export function TicketForm({ onClose }: Props) {
    const router = useRouter();
    const [files, setFiles] = useState<File[]>([]);
    const [descripcion, setDescripcion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Restaurant Autocomplete State
    const [searchQuery, setSearchQuery] = useState('');
    const [restaurants, setRestaurants] = useState<Restaurante[]>([]);
    const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurante | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Relational Catalog & Zone State (4 Niveles)
    const [tiposServicio, setTiposServicio] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [subcategorias, setSubcategorias] = useState<any[]>([]);
    const [acciones, setAcciones] = useState<any[]>([]);
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

    // Cascading selection state
    const [selectedTipoServicioId, setSelectedTipoServicioId] = useState<string>('');
    const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('');
    const [selectedSubcategoriaId, setSelectedSubcategoriaId] = useState<string>('');
    const [selectedAccionId, setSelectedAccionId] = useState<string>('');

    // Priority state
    const [prioridad, setPrioridad] = useState<string>('media');

    // Fetch master data on mount
    useEffect(() => {
        async function fetchMasterData() {
            setIsLoadingCatalog(true);
            const supabase = createClient();

            try {
                const [ts, zs] = await Promise.all([
                    supabase.from('ticket_tipos_servicio').select('id, nombre').eq('activo', true).order('nombre'),
                    supabase.from('zonas').select('*').eq('activo', true)
                ]);

                if (ts.data) setTiposServicio(ts.data);
                if (zs.data) setZonas(zs.data);
            } catch (error) {
                console.error('Error fetching catalog data:', error);
            } finally {
                setIsLoadingCatalog(false);
            }
        }

        fetchMasterData();
    }, []);

    // Reactive fetch for Categorías based on selected Tipo de Servicio
    useEffect(() => {
        if (!selectedTipoServicioId) {
            setCategorias([]);
            return;
        }

        async function fetchCategorias() {
            const supabase = createClient();
            const { data } = await supabase
                .from('ticket_categorias')
                .select('id, nombre')
                .eq('tipo_servicio_id', selectedTipoServicioId)
                .eq('activo', true)
                .order('nombre');
                
            if (data) setCategorias(data);
        }

        fetchCategorias();
    }, [selectedTipoServicioId]);

    // Reactive fetch for Subcategories based on selected Category
    useEffect(() => {
        if (!selectedCategoriaId) {
            setSubcategorias([]);
            return;
        }

        async function fetchSubcategorias() {
            const supabase = createClient();
            const { data } = await supabase
                .from('ticket_subcategorias')
                .select('id, nombre')
                .eq('categoria_id', selectedCategoriaId)
                .eq('activo', true)
                .order('nombre');
                
            if (data) setSubcategorias(data);
        }

        fetchSubcategorias();
    }, [selectedCategoriaId]);

    // Reactive fetch for Actions based on selected Subcategory
    useEffect(() => {
        if (!selectedSubcategoriaId) {
            setAcciones([]);
            return;
        }

        async function fetchAcciones() {
            const supabase = createClient();
            const { data } = await supabase
                .from('ticket_acciones')
                .select('id, nombre')
                .eq('subcategoria_id', selectedSubcategoriaId)
                .eq('activo', true)
                .order('nombre');
                
            if (data) setAcciones(data);
        }

        fetchAcciones();
    }, [selectedSubcategoriaId]);

    // Debounce and Search Logic
    useEffect(() => {
        const fetchRestaurants = async () => {
            if (!searchQuery.trim()) {
                setRestaurants([]);
                setShowDropdown(false);
                return;
            }

            setIsSearching(true);
            const supabase = createClient();
            const { data, error } = await supabase
                .from('restaurantes')
                .select('*')
                .or(`sigla.ilike.%${searchQuery}%,nombre_restaurante.ilike.%${searchQuery}%`)
                .limit(5);

            if (!error && data) {
                setRestaurants(data);
                setShowDropdown(true);
            }
            setIsSearching(false);
        };

        const timeoutId = setTimeout(() => {
            // Only search if we haven't just selected a restaurant
            if (!selectedRestaurant || `${selectedRestaurant.sigla} - ${selectedRestaurant.nombre_restaurante}` !== searchQuery) {
                fetchRestaurants();
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, selectedRestaurant]);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);

        // Validate number of files
        if (files.length + selectedFiles.length > MAX_FILES) {
            setMessage({ type: 'error', text: `Puedes subir un máximo de ${MAX_FILES} archivos.` });
            return;
        }

        // Validate each file
        const validFiles = selectedFiles.filter(file => {
            if (file.size > MAX_FILE_SIZE) {
                setMessage({ type: 'error', text: `El archivo ${file.name} supera el límite de 5MB.` });
                return false;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                setMessage({ type: 'error', text: `El archivo ${file.name} no tiene un formato permitido (.pdf, .jpg, .png, .xlsx, .docx).` });
                return false;
            }
            return true;
        });

        if (validFiles.length > 0) {
            const processedFiles = await Promise.all(validFiles.map(async (file) => {
                if (file.type.startsWith('image/')) {
                    try {
                        return await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true });
                    } catch (error) {
                        console.error('Error compressing image', error);
                        return file;
                    }
                }
                return file;
            }));
            setFiles(prev => [...prev, ...processedFiles]);
            setMessage(null);
        }

        // Reset file input so the same files can be selected again if removed
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Ensure Quill isn't empty (or just containing empty HTML tags)
        const strippedDesc = descripcion.replace(/(<([^>]+)>)/gi, "").trim();
        if (!strippedDesc) {
            setMessage({ type: 'error', text: 'La descripción no puede estar vacía.' });
            return;
        }

        if (!selectedRestaurant) {
            setMessage({ type: 'error', text: 'Por favor, selecciona un restaurante válido de la lista.' });
            return;
        }

        if (!selectedTipoServicioId || !selectedCategoriaId || !selectedSubcategoriaId || !selectedAccionId) {
            setMessage({ type: 'error', text: 'Por favor, completa todas las selecciones de clasificación.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        const formData = new FormData(e.currentTarget);

        // Append relational IDs manually
        formData.append('tipo_servicio_id', selectedTipoServicioId);
        formData.append('categoria_id', selectedCategoriaId);
        formData.append('subcategoria_id', selectedSubcategoriaId);
        formData.append('accion_id', selectedAccionId);

        // Append ReactQuill content manually since it's not a native input
        formData.append('descripcion', descripcion);

        // Append files manually
        files.forEach((file) => {
            formData.append('adjuntos', file);
        });

        try {
            const result = await createTicketAction(formData);

            if (result.error) {
                setMessage({ type: 'error', text: result.error });
            } else if (result.id) {
                setMessage({ type: 'success', text: 'Ticket creado exitosamente. Redirigiendo...' });
                // Reset states
                setFiles([]);
                setDescripcion('');

                // Route directly to the new interactive ticket details view
                router.push(`/dashboard/ticket/${result.id}`);
                onClose?.();
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Ocurrió un error inesperado al crear el ticket.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-8 pt-6 pb-4 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                <div className="bg-blue-50 p-2 rounded-lg">
                    <Ticket className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Nueva solicitud</h2>
            </div>

            {message && (
                <div className={`p-4 mb-6 rounded-xl border ${message.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                    <span className="font-semibold text-sm">{message.text}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className={`space-y-6 ${isSubmitting ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}`}>

                {/* 1. Restaurant Autocomplete */}
                <div className="relative" ref={dropdownRef}>
                    <label htmlFor="restaurante_search" className="block text-sm font-bold text-slate-700 mb-1">Restaurante</label>
                    <input
                        type="text"
                        id="restaurante_search"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (selectedRestaurant) setSelectedRestaurant(null);
                        }}
                        onFocus={() => { if (restaurants.length > 0) setShowDropdown(true); }}
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm text-slate-900 transition-all placeholder-gray-400"
                        placeholder="Buscar restaurante por sigla o nombre..."
                        autoComplete="off"
                    />
                    {isSearching && (
                        <div className="absolute right-4 top-10 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    {showDropdown && restaurants.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <ul className="py-1">
                                {restaurants.map((rest) => (
                                    <li
                                        key={rest.id}
                                        onClick={() => {
                                            setSelectedRestaurant(rest);
                                            setSearchQuery(`${rest.sigla} - ${rest.nombre_restaurante}`);
                                            setShowDropdown(false);
                                        }}
                                        className="px-4 py-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors"
                                    >
                                        <div>
                                            <span className="font-bold text-slate-800 block">{rest.sigla}</span>
                                            <span className="text-sm text-slate-500">{rest.nombre_restaurante}</span>
                                        </div>
                                        <div className="text-xs font-mono text-slate-400">CC: {rest.centro_costo}</div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* Hidden input to pass UUID to Server Action natively */}
                    <input type="hidden" name="restaurante_id" value={selectedRestaurant?.id || ''} required />
                </div>

                {/* --- 2. Operational Catalog (Cascading Selects) --- */}
                {isLoadingCatalog ? (
                    <div className="flex animate-pulse space-x-4 mb-6">
                        <div className="flex-1 h-12 bg-slate-200 rounded-xl"></div>
                        <div className="flex-1 h-12 bg-slate-200 rounded-xl"></div>
                    </div>
                ) : (
                    <div className="space-y-5 bg-slate-50 p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="border-b border-gray-200 pb-4 mb-5">
                            <h4 className="font-bold text-slate-800">Clasificación del Ticket</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            
                            {/* A. Tipo de Servicio */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tipo de Servicio</label>
                                <CustomSelect
                                    id="tipo_servicio_id"
                                    required
                                    value={selectedTipoServicioId}
                                    onChange={(val) => {
                                        setSelectedTipoServicioId(val);
                                        setSelectedCategoriaId(''); // Cascada: Nivel 2 Reset
                                        setSelectedSubcategoriaId(''); // Cascada: Nivel 3 Reset
                                        setSelectedAccionId(''); // Cascada: Nivel 4 Reset
                                    }}
                                    options={tiposServicio.map(t => ({ value: t.id, label: t.nombre }))}
                                    placeholder="Seleccione el tipo general..."
                                />
                            </div>

                            {/* B. Categoria */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Categoría Principal</label>
                                <CustomSelect
                                    id="cat_select"
                                    required
                                    disabled={!selectedTipoServicioId}
                                    value={selectedCategoriaId}
                                    onChange={(val) => {
                                        setSelectedCategoriaId(val);
                                        setSelectedSubcategoriaId(''); // Cascada: Nivel 3 Reset
                                        setSelectedAccionId(''); // Cascada: Nivel 4 Reset
                                    }}
                                    options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
                                    placeholder="Seleccione categoría..."
                                />
                            </div>

                            {/* C. Subcategoria (Equipo) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Equipo / Subcategoría</label>
                                <CustomSelect
                                    id="subcat_select"
                                    required
                                    disabled={!selectedCategoriaId}
                                    value={selectedSubcategoriaId}
                                    onChange={(val) => {
                                        setSelectedSubcategoriaId(val);
                                        setSelectedAccionId(''); // Cascada: Nivel 3 Reset
                                    }}
                                    options={subcategorias.map(s => ({ value: s.id, label: s.nombre }))}
                                    placeholder="Seleccione equipo..."
                                />
                            </div>

                            {/* D. Acción (Falla) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Acción / Falla</label>
                                <CustomSelect
                                    id="element_select"
                                    required
                                    disabled={!selectedSubcategoriaId}
                                    value={selectedAccionId}
                                    onChange={(val) => setSelectedAccionId(val)}
                                    options={acciones.map(a => ({ value: a.id, label: a.nombre }))}
                                    placeholder="Indique la falla..."
                                />
                            </div>

                            {/* E. Priority */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Prioridad</label>
                                <CustomSelect
                                    id="prioridad"
                                    name="prioridad"
                                    required
                                    value={prioridad}
                                    onChange={(val) => setPrioridad(val)}
                                    options={[
                                        { value: 'baja', label: 'Baja' },
                                        { value: 'media', label: 'Media' },
                                        { value: 'alta', label: 'Alta' },
                                        { value: 'crítica', label: 'Crítica' }
                                    ]}
                                    placeholder="Seleccione la prioridad"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-5">
                    {/* 3. Título */}
                    <div>
                        <label htmlFor="titulo" className="block text-sm font-bold text-slate-700 mb-1">Título de la Solicitud</label>
                        <input
                            type="text"
                            id="titulo"
                            name="titulo"
                            required
                            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm text-slate-900 transition-all placeholder-gray-400"
                            placeholder="Ej: Problema con la impresora de recursos humanos"
                        />
                    </div>

                    <div className="pb-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Descripción</label>

                        {/* Unified Editor Wrapper */}
                        <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white flex flex-col shadow-sm">
                            <ReactQuill
                                theme="snow"
                                value={descripcion}
                                onChange={setDescripcion}
                                className="text-slate-900 flex-1 [&_.ql-editor]:min-h-[200px] [&_.ql-container]:!border-0 [&_.ql-toolbar]:!border-0 [&_.ql-toolbar]:!border-b [&_.ql-toolbar]:!border-slate-200 [&_.ql-toolbar]:bg-slate-50/50 [&_.ql-editor]:focus:!ring-0 [&_.ql-editor]:focus:!outline-none [&_.ql-editor]:!border-transparent"
                            />

                            {/* Attachment Zone Inside Wrapper */}
                            <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-col gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <label className="relative cursor-pointer flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-gray-500 hover:text-indigo-600 hover:bg-gray-200/50 rounded-lg transition-colors focus:outline-none">
                                        <Paperclip className="w-4 h-4" />
                                        <span>Adjuntar archivo</span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            multiple
                                            onChange={handleFileChange}
                                            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
                                            disabled={files.length >= MAX_FILES}
                                        />
                                    </label>
                                    <span className="text-xs text-slate-400 font-medium">Máx {MAX_FILES} archivos (5MB c/u)</span>
                                </div>

                                {/* File list */}
                                {files.length > 0 && (
                                    <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm">
                                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {files.map((file, index) => (
                                                <li key={`${file.name}-${index}`} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="flex flex-col truncate pr-4">
                                                        <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(index)}
                                                        className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors focus:outline-none flex-shrink-0"
                                                        title="Eliminar archivo"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-gray-100 mt-8">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full sm:w-auto inline-flex justify-center items-center py-3 px-8 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Creando solicitud...
                            </>
                        ) : 'Crear solicitud'}
                    </button>
                </div>
            </form>
        </div>
    );
}
