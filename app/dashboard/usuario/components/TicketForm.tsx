'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createTicketAction } from '../actions';
import { Loader2, Paperclip, Ticket, ArrowLeft, ArrowRight, Building2, Check, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Restaurante, CatalogoServicio, Zona } from '@/types/database.types';
import { CustomSelect } from '../../components/CustomSelect';
import 'react-quill-new/dist/quill.snow.css';
import imageCompression from 'browser-image-compression';
import { motion, AnimatePresence } from 'framer-motion';

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

// --- NUEVO COMPONENTE DE VISTA PREVIA ---
function ImagePreviewItem({ file, onRemove }: { file: File; onRemove: () => void }) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!file || !file.type.startsWith('image/')) return;
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <motion.li
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow transition-shadow"
        >
            <div className="flex items-center gap-3 overflow-hidden">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt="Vista previa"
                        className="w-10 h-10 object-cover rounded-md border border-slate-200 shrink-0 shadow-sm"
                    />
                ) : (
                    <div className="w-10 h-10 bg-slate-50 flex items-center justify-center rounded-md border border-slate-200 text-slate-400 shrink-0 shadow-sm">
                        📄
                    </div>
                )}
                <div className="flex flex-col truncate pr-2">
                    <span className="text-xs font-bold text-slate-700 truncate">{file.name || 'Archivo adjunto'}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors focus:outline-none flex-shrink-0 cursor-pointer"
                title="Eliminar archivo"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </motion.li>
    );
}
// -----------------------------------------

interface Props {
    onClose?: () => void;
}

export function TicketForm({ onClose }: Props) {
    const router = useRouter();
    const [files, setFiles] = useState<File[]>([]);
    const [descripcion, setDescripcion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [currentStep, setCurrentStep] = useState(1);

    // Restaurant Autocomplete State
    const [searchQuery, setSearchQuery] = useState('');
    const [restaurants, setRestaurants] = useState<Restaurante[]>([]);
    const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurante | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Tenant isolation: cliente_id del usuario logueado
    const [clienteId, setClienteId] = useState<string | null>(null);

    // Relational Catalog & Zone State (4 Niveles)
    const [tiposServicio, setTiposServicio] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [subcategorias, setSubcategorias] = useState<any[]>([]);
    const [acciones, setAcciones] = useState<any[]>([]);
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
    const [isLoadingTipos, setIsLoadingTipos] = useState(false);

    // Cascading selection state
    const [selectedTipoServicioId, setSelectedTipoServicioId] = useState<string>('');
    const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('');
    const [selectedSubcategoriaId, setSelectedSubcategoriaId] = useState<string>('');
    const [selectedAccionId, setSelectedAccionId] = useState<string>('');

    // Priority state
    const [prioridad, setPrioridad] = useState<string>('media');

    // Fetch master data on mount: solo zonas y cliente_id del usuario.
    // ticket_tipos_servicio se carga al seleccionar restaurante (filtrado por cliente_id).
    useEffect(() => {
        async function fetchMasterData() {
            setIsLoadingCatalog(true);
            const supabase = createClient();

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('cliente_id')
                        .eq('id', user.id)
                        .maybeSingle();
                    setClienteId((profile as any)?.cliente_id ?? null);
                }

                const { data: zs } = await supabase
                    .from('zonas')
                    .select('*')
                    .eq('activo', true);

                if (zs) setZonas(zs);
            } catch (error) {
                console.error('Error fetching master data:', error);
            } finally {
                setIsLoadingCatalog(false);
            }
        }

        fetchMasterData();
    }, []);

    // Cuando cambia el restaurante seleccionado, recargar los tipos de servicio
    // filtrados por el cliente_id del restaurante. Reset completo de la cascada.
    useEffect(() => {
        console.log("TicketForm: selectedRestaurant changed:", selectedRestaurant);
        setTiposServicio([]);
        setCategorias([]);
        setSubcategorias([]);
        setAcciones([]);
        setSelectedTipoServicioId('');
        setSelectedCategoriaId('');
        setSelectedSubcategoriaId('');
        setSelectedAccionId('');

        if (!selectedRestaurant) {
            console.log("TicketForm: No selectedRestaurant, returning");
            return;
        }

        const clienteIdRestaurante = (selectedRestaurant as any).cliente_id;
        console.log("TicketForm: clienteIdRestaurante is:", clienteIdRestaurante);
        if (!clienteIdRestaurante) {
            console.warn("TicketForm: clienteIdRestaurante is missing/falsy!");
            return;
        }

        async function fetchTiposServicio() {
            setIsLoadingTipos(true);
            const supabase = createClient();
            console.log("TicketForm: Querying ticket_tipos_servicio for client:", clienteIdRestaurante);
            const { data, error } = await supabase
                .from('ticket_tipos_servicio')
                .select('id, nombre')
                .eq('cliente_id', clienteIdRestaurante)
                .eq('activo', true)
                .order('nombre');

            console.log("TicketForm: Query result:", { data, error });
            if (error) {
                console.error("TicketForm: Error fetching tipos servicio:", error);
            }
            if (data) {
                console.log("TicketForm: Setting tiposServicio to:", data);
                setTiposServicio(data);
            }
            setIsLoadingTipos(false);
        }

        fetchTiposServicio();
    }, [selectedRestaurant]);

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
            let query = supabase
                .from('restaurantes')
                .select('*')
                .or(`sigla.ilike.%${searchQuery}%,nombre_restaurante.ilike.%${searchQuery}%`);

            if (clienteId) {
                query = query.eq('cliente_id', clienteId);
            }

            // Fetch a larger limit so we can prioritize matches in memory
            const { data, error } = await query.limit(25);

            if (!error && data) {
                const queryLower = searchQuery.toLowerCase();
                
                const sorted = [...data].sort((a, b) => {
                    const aSigla = (a.sigla || '').toLowerCase();
                    const bSigla = (b.sigla || '').toLowerCase();
                    const aName = (a.nombre_restaurante || '').toLowerCase();
                    const bName = (b.nombre_restaurante || '').toLowerCase();

                    // 1. Exact sigla match (highest priority)
                    const aExactSigla = aSigla === queryLower;
                    const bExactSigla = bSigla === queryLower;
                    if (aExactSigla && !bExactSigla) return -1;
                    if (!aExactSigla && bExactSigla) return 1;

                    // 2. Sigla starts with query
                    const aStartsSigla = aSigla.startsWith(queryLower);
                    const bStartsSigla = bSigla.startsWith(queryLower);
                    if (aStartsSigla && !bStartsSigla) return -1;
                    if (!aStartsSigla && bStartsSigla) return 1;

                    // 3. Name starts with query
                    const aStartsName = aName.startsWith(queryLower);
                    const bStartsName = bName.startsWith(queryLower);
                    if (aStartsName && !bStartsName) return -1;
                    if (!aStartsName && bStartsName) return 1;

                    // Default alphabetical sort by name
                    return aName.localeCompare(bName);
                });

                setRestaurants(sorted.slice(0, 10)); // Display the top 10 best matches
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
    }, [searchQuery, selectedRestaurant, clienteId]);

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

        // Synchronous guard — prevents race condition where fast clicks fire
        // before React re-renders with isSubmitting=true (state updates are async)
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        // Ensure Quill isn't empty (or just containing empty HTML tags)
        const strippedDesc = descripcion.replace(/(<([^>]+)>)/gi, "").trim();
        if (!strippedDesc) {
            isSubmittingRef.current = false;
            setMessage({ type: 'error', text: 'La descripción no puede estar vacía.' });
            return;
        }

        if (!selectedRestaurant) {
            isSubmittingRef.current = false;
            setMessage({ type: 'error', text: 'Por favor, selecciona un restaurante válido de la lista.' });
            return;
        }

        if (!selectedTipoServicioId || !selectedCategoriaId || !selectedSubcategoriaId || !selectedAccionId) {
            isSubmittingRef.current = false;
            setMessage({ type: 'error', text: 'Por favor, completa todas las selecciones de clasificación.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        const formData = new FormData(e.currentTarget);

        // Append relational IDs manually
        if (selectedRestaurant?.id) {
            formData.append('restaurante_id', selectedRestaurant.id);
        }
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
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    // Definición de niveles de prioridad corporativos
    const priorities = [
        {
            value: 'baja',
            label: 'Baja',
            color: 'border-slate-200 text-slate-600 bg-white hover:border-emerald-300 hover:bg-emerald-50/10 focus:ring-emerald-500/20',
            activeColor: 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-1 ring-emerald-500 shadow-sm',
            dotBg: 'bg-emerald-500'
        },
        {
            value: 'media',
            label: 'Media',
            color: 'border-slate-200 text-slate-600 bg-white hover:border-blue-300 hover:bg-blue-50/10 focus:ring-blue-500/20',
            activeColor: 'bg-blue-50 text-blue-800 border-blue-500 ring-1 ring-blue-500 shadow-sm',
            dotBg: 'bg-blue-500'
        },
        {
            value: 'alta',
            label: 'Alta',
            color: 'border-slate-200 text-slate-600 bg-white hover:border-amber-300 hover:bg-amber-50/10 focus:ring-amber-500/20',
            activeColor: 'bg-amber-50 text-amber-800 border-amber-500 ring-1 ring-amber-500 shadow-sm',
            dotBg: 'bg-amber-500'
        },
        {
            value: 'crítica',
            label: 'Crítica',
            color: 'border-slate-200 text-slate-600 bg-white hover:border-rose-300 hover:bg-rose-50/10 focus:ring-rose-500/20',
            activeColor: 'bg-rose-50 text-rose-800 border-rose-500 ring-1 ring-rose-500 shadow-sm',
            dotBg: 'bg-rose-500'
        }
    ];

    const isStep1Complete = !!selectedRestaurant && !!selectedTipoServicioId && !!selectedCategoriaId && !!selectedSubcategoriaId && !!selectedAccionId;

    return (
        <div className="p-6 sm:p-8 pt-5 pb-4 max-w-3xl mx-auto">
            {/* Header con Icono */}
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="bg-[#0e3187]/10 p-2 rounded-xl text-[#0e3187]">
                    <Ticket className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Nueva solicitud</h2>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Ingresa los datos para registrar un nuevo ticket</p>
                </div>
            </div>

            {/* Barra de Progreso del Asistente */}
            <div className="mb-8 relative flex items-center justify-between px-2">
                {/* Línea de fondo */}
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[3px] bg-slate-100 rounded-full z-0" />
                {/* Línea activa */}
                <motion.div 
                    className="absolute left-6 top-1/2 -translate-y-1/2 h-[3px] bg-[#0e3187] rounded-full z-0"
                    initial={{ width: '0%' }}
                    animate={{ width: currentStep === 1 ? '0%' : 'calc(100% - 48px)' }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
                
                {/* Paso 1 Selector */}
                <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className={`relative z-10 flex items-center gap-2.5 px-4.5 py-2 rounded-full border-2 transition-all duration-300 font-bold focus:outline-none cursor-pointer ${currentStep === 1 ? 'bg-[#0e3187] border-[#0e3187] text-white shadow-md shadow-[#0e3187]/10' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-black ${currentStep === 1 ? 'bg-white text-[#0e3187]' : 'bg-slate-100 text-slate-600'}`}>1</span>
                    <span className="text-xs uppercase tracking-wider">Clasificación</span>
                </button>

                {/* Paso 2 Selector */}
                <button
                    type="button"
                    disabled={!isStep1Complete}
                    onClick={() => { if (isStep1Complete) setCurrentStep(2); }}
                    className={`relative z-10 flex items-center gap-2.5 px-4.5 py-2 rounded-full border-2 transition-all duration-300 font-bold focus:outline-none ${currentStep === 2 ? 'bg-[#0e3187] border-[#0e3187] text-white shadow-md shadow-[#0e3187]/10 cursor-pointer' : isStep1Complete ? 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 cursor-pointer' : 'bg-slate-50 border-slate-100 text-slate-350 cursor-not-allowed'}`}
                >
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-black ${currentStep === 2 ? 'bg-white text-[#0e3187]' : 'bg-slate-100 text-slate-400'}`}>2</span>
                    <span className="text-xs uppercase tracking-wider">Detalles</span>
                </button>
            </div>

            {message && (
                <div className={`p-4 mb-6 rounded-2xl border ${message.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                    <span className="font-semibold text-sm flex items-center gap-2">
                        {message.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-600 shrink-0" /> : <Check className="w-5 h-5 text-emerald-600 shrink-0" />}
                        {message.text}
                    </span>
                </div>
            )}

            <form onSubmit={handleSubmit} className={`space-y-6 ${isSubmitting ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}`}>
                {/* Campo oculto para pasar la prioridad */}
                <input type="hidden" name="prioridad" value={prioridad} />

                <AnimatePresence mode="wait">
                    {currentStep === 1 ? (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* 1. Restaurant Autocomplete o Tarjeta de Seleccionado */}
                            <div className="relative" ref={dropdownRef}>
                                <AnimatePresence mode="wait">
                                    {selectedRestaurant ? (
                                        <motion.div 
                                            key="selected-restaurant-card"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="p-4.5 bg-gradient-to-br from-slate-50 to-indigo-50/20 border border-slate-200/60 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group"
                                        >
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                                            <div className="flex items-center gap-4 z-10">
                                                <div className="bg-[#0e3187]/10 p-3 rounded-xl text-[#0e3187] shrink-0">
                                                    <Building2 className="w-6 h-6" strokeWidth={1.75} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[10px] font-black uppercase bg-[#0e3187] text-white px-2 py-0.5 rounded-md tracking-wider">
                                                            {selectedRestaurant.sigla}
                                                        </span>
                                                        <span className="text-xs text-slate-400 font-bold">CC: {selectedRestaurant.centro_costo}</span>
                                                    </div>
                                                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800 mt-1 leading-tight truncate">
                                                        {selectedRestaurant.nombre_restaurante}
                                                    </h3>
                                                </div>
                                            </div>
                                            <motion.button
                                                type="button"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => {
                                                    setSelectedRestaurant(null);
                                                    setSearchQuery('');
                                                }}
                                                className="text-xs font-black text-[#0e3187] bg-white border border-slate-200 hover:border-[#0e3187]/30 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors shadow-sm z-10 cursor-pointer"
                                            >
                                                Cambiar
                                            </motion.button>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="search-restaurant-input"
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                        >
                                            <label htmlFor="restaurante_search" className="block text-sm font-bold text-slate-700 mb-2">Restaurante</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0e3187] transition-colors">
                                                    <Building2 className="w-5 h-5" strokeWidth={1.75} />
                                                </div>
                                                <input
                                                    type="text"
                                                    id="restaurante_search"
                                                    value={searchQuery}
                                                    onChange={(e) => {
                                                        setSearchQuery(e.target.value);
                                                        if (selectedRestaurant) setSelectedRestaurant(null);
                                                    }}
                                                    onFocus={() => { if (restaurants.length > 0) setShowDropdown(true); }}
                                                    className="mt-1 block w-full pl-11 pr-10 py-3.5 border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-[#0e3187]/10 focus:border-[#0e3187] sm:text-sm text-slate-900 transition-all placeholder-slate-400 font-semibold bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                                                    placeholder="Buscar restaurante por sigla o nombre..."
                                                    autoComplete="off"
                                                />
                                                {isSearching && (
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                                                        <Loader2 className="w-5 h-5 text-[#0e3187] animate-spin" />
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {showDropdown && restaurants.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="absolute z-30 w-full mt-2 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl max-h-60 overflow-y-auto"
                                    >
                                        <ul className="py-1.5 divide-y divide-slate-100">
                                            {restaurants.map((rest) => (
                                                <li
                                                    key={rest.id}
                                                    onClick={() => {
                                                        setSelectedRestaurant(rest);
                                                        setSearchQuery(`${rest.sigla} - ${rest.nombre_restaurante}`);
                                                        setShowDropdown(false);
                                                    }}
                                                    className="px-5 py-3 hover:bg-indigo-50/50 cursor-pointer flex justify-between items-center transition-colors group"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-slate-800 group-hover:text-[#0e3187] transition-colors">{rest.sigla}</span>
                                                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">CC: {rest.centro_costo}</span>
                                                        </div>
                                                        <span className="text-xs text-slate-500 block mt-0.5">{rest.nombre_restaurante}</span>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-[#0e3187] transition-all -translate-x-2 group-hover:translate-x-0" />
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
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
                                <AnimatePresence>
                                    {selectedRestaurant && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -15 }}
                                            transition={{ duration: 0.3 }}
                                            className="relative z-10 space-y-6 bg-slate-50/40 backdrop-blur-sm p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm"
                                        >
                                            <div className="border-b border-slate-200/60 pb-3 mb-4 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-[#0e3187] animate-pulse" />
                                                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Clasificación del Ticket</h4>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-bold">Jerárquica obligatoria</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                                {/* A. Tipo de Servicio — bloqueado hasta elegir restaurante */}
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tipo de Servicio</label>
                                                    <CustomSelect
                                                        id="tipo_servicio_id"
                                                        required
                                                        disabled={!selectedRestaurant || isLoadingTipos}
                                                        value={selectedTipoServicioId}
                                                        strategy="absolute"
                                                        onChange={(val) => {
                                                            setSelectedTipoServicioId(val);
                                                            setSelectedCategoriaId('');
                                                            setSelectedSubcategoriaId('');
                                                            setSelectedAccionId('');
                                                        }}
                                                        options={tiposServicio.map(t => ({ value: t.id, label: t.nombre }))}
                                                        placeholder={
                                                            isLoadingTipos
                                                                ? 'Cargando catálogo...'
                                                                : !selectedRestaurant
                                                                    ? 'Seleccione restaurante primero'
                                                                    : 'Seleccione tipo general...'
                                                        }
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
                                                        strategy="absolute"
                                                        onChange={(val) => {
                                                            setSelectedCategoriaId(val);
                                                            setSelectedSubcategoriaId('');
                                                            setSelectedAccionId('');
                                                        }}
                                                        options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
                                                        placeholder={!selectedTipoServicioId ? 'Esperando Tipo de Servicio...' : 'Seleccione categoría...'}
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
                                                        strategy="absolute"
                                                        onChange={(val) => {
                                                            setSelectedSubcategoriaId(val);
                                                            setSelectedAccionId('');
                                                        }}
                                                        options={subcategorias.map(s => ({ value: s.id, label: s.nombre }))}
                                                        placeholder={!selectedCategoriaId ? 'Esperando Categoría...' : 'Seleccione equipo...'}
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
                                                        strategy="absolute"
                                                        onChange={(val) => setSelectedAccionId(val)}
                                                        options={acciones.map(a => ({ value: a.id, label: a.nombre }))}
                                                        placeholder={!selectedSubcategoriaId ? 'Esperando Subcategoría...' : 'Indique la falla...'}
                                                    />
                                                </div>

                                                {/* E. Prioridad (Nueva Fila de Botones Premium) */}
                                                <div className="col-span-1 md:col-span-2">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">Prioridad de la Solicitud</label>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                                        {priorities.map((item) => {
                                                            const isSelected = prioridad === item.value;
                                                            return (
                                                                <button
                                                                    key={item.value}
                                                                    type="button"
                                                                    onClick={() => setPrioridad(item.value)}
                                                                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all text-center focus:outline-none cursor-pointer focus:ring-4 font-bold ${isSelected ? item.activeColor : item.color}`}
                                                                >
                                                                    <span className={`w-2.5 h-2.5 rounded-full ${item.dotBg}`} />
                                                                    <span className="text-xs sm:text-sm tracking-tight">{item.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            )}

                            {/* Navegación Paso 1 */}
                            <div className="flex justify-end pt-5 mt-6 border-t border-slate-100">
                                <motion.button
                                    type="button"
                                    disabled={!isStep1Complete}
                                    whileHover={isStep1Complete ? { scale: 1.02 } : {}}
                                    whileTap={isStep1Complete ? { scale: 0.98 } : {}}
                                    onClick={() => { if (isStep1Complete) setCurrentStep(2); }}
                                    className="w-full sm:w-auto inline-flex justify-center items-center py-3.5 px-8 border border-transparent shadow-md text-sm font-black rounded-2xl text-white bg-[#0e3187] hover:bg-[#1546be] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                                >
                                    Siguiente paso
                                    <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2} />
                                </motion.button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* 3. Título */}
                            <div>
                                <label htmlFor="titulo" className="block text-sm font-bold text-slate-700 mb-2">Título de la Solicitud</label>
                                <input
                                    type="text"
                                    id="titulo"
                                    name="titulo"
                                    required
                                    className="mt-1 block w-full px-4.5 py-3.5 border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-[#0e3187]/10 focus:border-[#0e3187] sm:text-sm text-slate-900 transition-all placeholder-slate-400 font-semibold bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                                    placeholder="Ej: Problema con la impresora de recursos humanos"
                                />
                            </div>

                            <div className="pb-2">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Descripción y Adjuntos</label>

                                {/* Unified Editor Wrapper */}
                                <div className="border border-slate-200 focus-within:border-[#0e3187] focus-within:ring-4 focus-within:ring-[#0e3187]/10 rounded-2xl overflow-hidden bg-white flex flex-col shadow-sm transition-all">
                                    <ReactQuill
                                        theme="snow"
                                        value={descripcion}
                                        onChange={setDescripcion}
                                        className="text-slate-900 flex-1 [&_.ql-editor]:min-h-[220px] [&_.ql-container]:!border-0 [&_.ql-toolbar]:!border-0 [&_.ql-toolbar]:!border-b [&_.ql-toolbar]:!border-slate-200/80 [&_.ql-toolbar]:bg-slate-50/50 [&_.ql-editor]:focus:!ring-0 [&_.ql-editor]:focus:!outline-none [&_.ql-editor]:!border-transparent"
                                    />

                                    {/* Attachment Zone Inside Wrapper */}
                                    <div className="bg-slate-50/80 border-t border-slate-100 p-4 flex flex-col gap-3">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <label className="relative cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:text-[#0e3187] hover:border-[#0e3187]/30 hover:bg-slate-50 rounded-xl transition-all shadow-sm focus:outline-none">
                                                <Paperclip className="w-4 h-4 text-[#0e3187]" />
                                                <span>Adjuntar archivos</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    multiple
                                                    onChange={handleFileChange}
                                                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
                                                    disabled={files.length >= MAX_FILES}
                                                />
                                            </label>
                                            <span className="text-[11px] text-slate-400 font-bold bg-slate-200/40 px-2.5 py-1 rounded-md">
                                                Archivos: {files.length} / {MAX_FILES} (Máx 5MB c/u)
                                            </span>
                                        </div>

                                        {/* File list */}
                                        {files.length > 0 && (
                                            <div className="bg-slate-100/40 rounded-2xl border border-slate-200/40 p-3 shadow-inner mt-1">
                                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <AnimatePresence>
                                                        {files.map((file, index) => (
                                                            <ImagePreviewItem
                                                                key={`${file.name}-${file.size}`}
                                                                file={file}
                                                                onRemove={() => removeFile(index)}
                                                            />
                                                        ))}
                                                    </AnimatePresence>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Navegación Paso 2 */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-6 border-t border-slate-100">
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setCurrentStep(1)}
                                    className="w-full sm:w-auto inline-flex justify-center items-center py-3.5 px-6 border border-slate-200 shadow-sm text-sm font-black rounded-2xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none transition-all duration-200 cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={2} />
                                    Atrás
                                </motion.button>

                                <motion.button
                                    type="submit"
                                    disabled={isSubmitting}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full sm:w-auto inline-flex justify-center items-center py-3.5 px-8 border border-transparent shadow-md text-sm font-black rounded-2xl text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Creando solicitud...
                                        </>
                                    ) : (
                                        <>
                                            <Ticket className="w-4 h-4 mr-2" />
                                            Crear solicitud
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </form>
        </div>
    );
}