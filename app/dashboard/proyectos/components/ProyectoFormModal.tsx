'use client';

// REGLA DE DISEÑO: NUNCA usar <select> nativo de HTML.
// Siempre usar CustomSelect o dropdowns visualmente enriquecidos para mantener la consistencia.

import { useActionState, useEffect, useRef, useState } from 'react';
import { X, Plus, Loader2, Clock, Calendar, Briefcase, UserCheck } from 'lucide-react';
import { crearProyecto, editarProyecto } from '../actions';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';

interface Empresa    { id: string; nombre_fantasia: string }
interface Sucursal   { id: string; nombre_restaurante: string; sigla: string; cliente_id: string | null }
interface Coordinador { id: string; full_name: string | null }

export interface ProyectoParaEditar {
    id: string;
    nombre: string;
    descripcion: string | null;
    cliente_id: string | null;
    coordinador_id: string | null;
    fecha_inicio: string | null;
    fecha_fin_estimada: string | null;
}

interface Props {
    empresas:      Empresa[];
    sucursales:    Sucursal[];
    coordinadores: Coordinador[];
    proyectoToEdit?: ProyectoParaEditar | null;
    isOpen?:         boolean;
    onClose?:        () => void;
}

const initialState = { error: null as string | null };

export function ProyectoFormModal({
    empresas,
    sucursales,
    coordinadores,
    proyectoToEdit,
    isOpen: externalIsOpen,
    onClose,
}: Props) {
    const dialogRef  = useRef<HTMLDialogElement>(null);
    const isEditMode = !!proyectoToEdit;

    // Action states
    const [createState, createAction, isCreatePending] = useActionState(crearProyecto, initialState);
    const [editState,   editAction,   isEditPending]   = useActionState(editarProyecto, initialState);

    const currentState   = isEditMode ? editState   : createState;
    const currentAction  = isEditMode ? editAction  : createAction;
    const isPending      = isEditMode ? isEditPending : isCreatePending;

    // ── Stepper Wizard State ─────────────────────────────────────────────
    const [currentStep, setCurrentStep] = useState(1);

    // ── Controlled Form States ───────────────────────────────────────────
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFinEstimada, setFechaFinEstimada] = useState('');
    const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
    const [selectedSucursalId, setSelectedSucursalId] = useState('');
    const [coordinadorId, setCoordinadorId] = useState('');

    // Coordinador custom dropdown visibility state
    const [showCoordinadorDropdown, setShowCoordinadorDropdown] = useState(false);

    const sucursalesFiltradas = sucursales.filter(s => s.cliente_id === selectedEmpresaId);

    // Pre-fill cuando cambia el proyecto a editar
    useEffect(() => {
        if (proyectoToEdit) {
            const sucursal = sucursales.find(s => s.id === proyectoToEdit.cliente_id);
            setSelectedEmpresaId(sucursal?.cliente_id ?? '');
            setSelectedSucursalId(proyectoToEdit.cliente_id ?? '');
            setCoordinadorId(proyectoToEdit.coordinador_id ?? '');
            setNombre(proyectoToEdit.nombre ?? '');
            setDescripcion(proyectoToEdit.descripcion ?? '');
            setFechaInicio(proyectoToEdit.fecha_inicio ?? '');
            setFechaFinEstimada(proyectoToEdit.fecha_fin_estimada ?? '');
        } else {
            setSelectedEmpresaId('');
            setSelectedSucursalId('');
            setCoordinadorId('');
            setNombre('');
            setDescripcion('');
            setFechaInicio('');
            setFechaFinEstimada('');
        }
        setCurrentStep(1);
    }, [proyectoToEdit, sucursales]);

    // Sincronizar apertura externa
    useEffect(() => {
        if (externalIsOpen === undefined) return;
        if (externalIsOpen) dialogRef.current?.showModal();
        else                dialogRef.current?.close();
    }, [externalIsOpen]);

    // Cerrar y resetear al terminar con éxito
    useEffect(() => {
        if (!isPending && currentState.error === null) {
            const wasOpen = dialogRef.current?.open;
            if (wasOpen) {
                dialogRef.current?.close();
                onClose?.();
                resetForm();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPending, currentState.error]);

    function resetForm() {
        setSelectedEmpresaId('');
        setSelectedSucursalId('');
        setCoordinadorId('');
        setNombre('');
        setDescripcion('');
        setFechaInicio('');
        setFechaFinEstimada('');
        setCurrentStep(1);
        setShowCoordinadorDropdown(false);
    }

    function handleClose() {
        dialogRef.current?.close();
        onClose?.();
        resetForm();
    }

    // ── Helper to calculate initials ──────────────────────────────────────
    function getInitials(name: string) {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    // ── Options para CustomSelect ─────────────────────────────
    const empresaOptions = empresas.map(e => ({ value: e.id, label: e.nombre_fantasia }));

    const sucursalOptions = selectedEmpresaId
        ? sucursalesFiltradas.map(s => ({ value: s.id, label: `[${s.sigla}] ${s.nombre_restaurante}` }))
        : [];

    const selectedCoordinador = coordinadores.find(c => c.id === coordinadorId);

    // Form validation checks per step
    const isStep1Valid = nombre.trim().length > 0;
    const isStep2Valid = selectedEmpresaId !== '' && selectedSucursalId !== '';

    return (
        <>
            {/* Botón de creación (solo en modo create sin control externo) */}
            {externalIsOpen === undefined && !isEditMode && (
                <button
                    onClick={() => dialogRef.current?.showModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
                >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                    Nuevo Proyecto
                </button>
            )}

            <dialog
                ref={dialogRef}
                className="fixed inset-0 m-auto w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 bg-white border border-slate-100 shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
                onClose={handleClose}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-black text-slate-900">
                            {isEditMode ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {isEditMode ? 'Actualiza los parámetros del local' : 'Configura un nuevo local en terreno'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4 text-slate-500" />
                    </button>
                </div>

                {/* Progress bar Stepper */}
                <div className="px-6 pt-5 pb-1">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        <span>Paso {currentStep} de 3</span>
                        <span>{currentStep === 1 ? 'Detalles Básicos' : currentStep === 2 ? 'Cliente y Ubicación' : 'Fechas y Asignación'}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-slate-900 transition-all duration-300 rounded-full"
                            style={{ width: `${((currentStep) / 3) * 100}%` }}
                        />
                    </div>
                </div>

                <form
                    key={proyectoToEdit?.id ?? 'new'}
                    action={currentAction}
                    onKeyDown={(e) => {
                        // Prevent Enter key from submitting form (essential for multi-step)
                        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                            e.preventDefault();
                        }
                    }}
                    className="px-6 py-5 space-y-6"
                >
                    {/* ID oculto en modo edición */}
                    {isEditMode && (
                        <input type="hidden" name="proyecto_id" value={proyectoToEdit.id} />
                    )}

                    {/* ── PASO 1: Detalles Básicos ──────────────────────────────── */}
                    <div className={`space-y-4 transition-all duration-300 ${currentStep === 1 ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                        {/* Nombre del Proyecto */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                Nombre del Proyecto *
                            </label>
                            <input
                                name="nombre"
                                required
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                placeholder="Ej: Apertura Sucursal Las Condes"
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all shadow-sm bg-white"
                            />
                        </div>

                        {/* Descripción */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                Descripción
                            </label>
                            <textarea
                                name="descripcion"
                                rows={4}
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                                placeholder="Alcance, objetivos o notas iniciales..."
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all shadow-sm bg-white"
                            />
                        </div>
                    </div>

                    {/* ── PASO 2: Cliente y Ubicación ────────────────────────────── */}
                    <div className={`space-y-4 transition-all duration-300 ${currentStep === 2 ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                        {/* Empresa / Cliente */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                Empresa / Cliente *
                            </label>
                            <CustomSelect
                                id="empresa-select"
                                value={selectedEmpresaId}
                                onChange={v => { setSelectedEmpresaId(v); setSelectedSucursalId(''); }}
                                options={empresaOptions}
                                placeholder="— Selecciona una empresa —"
                                strategy="fixed"
                            />
                        </div>

                        {/* Sucursal / Local */}
                        <div className="space-y-1.5">
                            <label className={`block text-xs font-black uppercase tracking-widest transition-colors ${selectedEmpresaId ? 'text-slate-500' : 'text-slate-300'}`}>
                                Sucursal / Local *
                                {!selectedEmpresaId && (
                                    <span className="ml-1 normal-case font-normal text-[10px] text-slate-400 tracking-normal">
                                        (selecciona una empresa primero)
                                    </span>
                                )}
                            </label>
                            <CustomSelect
                                id="sucursal-select"
                                name="cliente_id"
                                value={selectedSucursalId}
                                onChange={setSelectedSucursalId}
                                options={sucursalOptions}
                                placeholder={
                                    !selectedEmpresaId
                                        ? '— Esperando empresa... —'
                                        : sucursalOptions.length === 0
                                            ? '— Sin sucursales registradas —'
                                            : '— Selecciona una sucursal —'
                                }
                                disabled={!selectedEmpresaId}
                                strategy="fixed"
                            />
                        </div>
                    </div>

                    {/* ── PASO 3: Fechas y Coordinación ──────────────────────────── */}
                    <div className={`space-y-4 transition-all duration-300 ${currentStep === 3 ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                        {/* Coordinador Responsable (Custom Dropdown con Avatares) */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                Coordinador Responsable <span className="ml-1 normal-case font-normal text-[10px] text-slate-405 tracking-normal">(opcional)</span>
                            </label>
                            
                            <div className="relative">
                                <input type="hidden" name="coordinador_id" value={coordinadorId} />
                                <button
                                    type="button"
                                    onClick={() => setShowCoordinadorDropdown(v => !v)}
                                    className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-800 transition-all flex items-center justify-between shadow-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:outline-none cursor-pointer"
                                >
                                    {selectedCoordinador ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-850 text-[10px] font-black text-white flex items-center justify-center shrink-0 uppercase">
                                                {getInitials(selectedCoordinador.full_name ?? 'C')}
                                            </div>
                                            <span className="font-bold text-slate-850">{selectedCoordinador.full_name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 font-medium">Sin coordinador asignado</span>
                                    )}
                                    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showCoordinadorDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {showCoordinadorDropdown && (
                                    <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto py-1 divide-y divide-slate-50">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCoordinadorId('');
                                                setShowCoordinadorDropdown(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] shrink-0 font-black text-slate-505">—</div>
                                            Sin coordinador asignado
                                        </button>
                                        {coordinadores.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    setCoordinadorId(c.id);
                                                    setShowCoordinadorDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 font-medium text-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
                                            >
                                                <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-650 flex items-center justify-center shrink-0 uppercase">
                                                    {getInitials(c.full_name ?? 'C')}
                                                </div>
                                                <span className="font-bold text-slate-800">{c.full_name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Fechas */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                    Fecha Inicio
                                </label>
                                <input
                                    type="date"
                                    name="fecha_inicio"
                                    value={fechaInicio}
                                    onChange={e => setFechaInicio(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all shadow-sm bg-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                    Fecha Estimada Fin
                                </label>
                                <input
                                    type="date"
                                    name="fecha_fin_estimada"
                                    value={fechaFinEstimada}
                                    onChange={e => setFechaFinEstimada(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all shadow-sm bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Error ───────────────────────────────────────── */}
                    {currentState.error && (
                        <p className="text-xs font-semibold text-red-650 bg-red-50 border border-red-105 rounded-xl px-4 py-3">
                            {currentState.error}
                        </p>
                    )}

                    {/* ── Footer / Stepper Navigation Buttons ──────────── */}
                    <div className="flex gap-3 pt-3 border-t border-slate-100">
                        {currentStep > 1 ? (
                            <button
                                key="back-btn"
                                type="button"
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="flex-1 py-3 border border-slate-200 text-slate-650 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all uppercase tracking-wider cursor-pointer"
                            >
                                Atrás
                            </button>
                        ) : (
                            <button
                                key="cancel-btn"
                                type="button"
                                onClick={handleClose}
                                className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all uppercase tracking-wider cursor-pointer"
                            >
                                Cancelar
                            </button>
                        )}

                        {/* Separate Next and Submit buttons in the DOM with unique keys to prevent mouseup click recycling */}
                        <button
                            key="next-btn"
                            type="button"
                            onClick={() => {
                                if (currentStep === 1 && !isStep1Valid) return;
                                if (currentStep === 2 && !isStep2Valid) return;
                                setCurrentStep(prev => prev + 1);
                            }}
                            disabled={
                                (currentStep === 1 && !isStep1Valid) ||
                                (currentStep === 2 && !isStep2Valid)
                            }
                            className={`flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-all uppercase tracking-wider cursor-pointer ${currentStep < 3 ? 'block' : 'hidden'}`}
                        >
                            Siguiente
                        </button>

                        <button
                            key="submit-btn"
                            type="submit"
                            disabled={isPending}
                            className={`flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-60 transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${currentStep === 3 ? 'block' : 'hidden'}`}
                        >
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {isPending
                                ? (isEditMode ? 'Guardando...' : 'Creando...')
                                : (isEditMode ? 'Guardar Cambios' : 'Crear Proyecto')}
                        </button>
                    </div>
                </form>
            </dialog>
        </>
    );
}
