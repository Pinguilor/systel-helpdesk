'use client';

// REGLA DE DISEÑO: NUNCA usar <select> nativo ni alert/confirm/prompt nativos.

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ClipboardPaste, Loader2, Lock, Search, X, AlertTriangle, Layers } from 'lucide-react';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import { crearProyectoMasivoAction, type LocalMasivo } from '../actions';

interface Empresa      { id: string; nombre_fantasia: string }
interface Coordinador  { id: string; full_name: string | null }
interface Opcion       { id: string; nombre: string }

interface Props {
    empresas:            Empresa[];
    coordinadores:       Coordinador[];
    locales:             LocalMasivo[];
    plantillasChecklist: Opcion[];
    recetasBOM:          Opcion[];
}

interface ResultadoPegado {
    agregadas: number;
    yaSeleccionadas: number;
    ocupadas: { sigla: string; proyecto: string }[];
    noEncontradas: string[];
}

const norm = (v: string | null | undefined) =>
    (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const INPUT_CLS =
    'w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all shadow-sm bg-white';
const LABEL_CLS = 'block text-xs font-black text-slate-500 uppercase tracking-widest';
const OPCIONAL = <span className="ml-1 normal-case font-normal text-[10px] text-slate-400 tracking-normal">(opcional)</span>;

const PASOS = ['Datos del proyecto', 'Locales', 'Confirmación'];

export function MasivoWizard({ empresas, coordinadores, locales, plantillasChecklist, recetasBOM }: Props) {
    const router = useRouter();
    const [paso, setPaso] = useState(1);

    // Paso 1
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [coordinadorId, setCoordinadorId] = useState('');
    const [plantillaId, setPlantillaId] = useState('');
    const [recetaId, setRecetaId] = useState('');

    // Paso 2
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
    const [busqueda, setBusqueda] = useState('');
    const [empresaFiltro, setEmpresaFiltro] = useState('');
    const [mostrarPegado, setMostrarPegado] = useState(false);
    const [textoPegado, setTextoPegado] = useState('');
    const [resultadoPegado, setResultadoPegado] = useState<ResultadoPegado | null>(null);

    // Envío. El ref bloquea de forma síncrona (antes de que React re-renderice) cualquier segundo clic.
    const [isPending, startTransition] = useTransition();
    const enviandoRef = useRef(false);
    const [creado, setCreado] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const bloqueado = isPending || creado;

    const localPorId = useMemo(() => new Map(locales.map(l => [l.id, l])), [locales]);
    const empresaPorId = useMemo(() => new Map(empresas.map(e => [e.id, e.nombre_fantasia])), [empresas]);

    const fechasInvalidas = !!fechaInicio && !!fechaFin && fechaFin < fechaInicio;
    const paso1Valido = nombre.trim().length > 0 && !fechasInvalidas;
    const paso2Valido = seleccion.size > 0;

    // ── Paso 2: filtrado ────────────────────────────────────────────────────
    const localesFiltrados = useMemo(() => {
        const q = norm(busqueda.trim());
        return locales.filter(l => {
            if (empresaFiltro && l.cliente_id !== empresaFiltro) return false;
            if (!q) return true;
            return norm(l.sigla).includes(q) || norm(l.nombre_restaurante).includes(q);
        });
    }, [locales, busqueda, empresaFiltro]);

    const libresVisibles = localesFiltrados.filter(l => !l.proyecto_activo);
    const totalOcupados = locales.filter(l => l.proyecto_activo).length;

    function alternar(id: string) {
        setSeleccion(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    }

    function seleccionarVisibles() {
        setSeleccion(prev => new Set([...prev, ...libresVisibles.map(l => l.id)]));
    }

    function procesarPegado() {
        const siglas = [...new Set(
            textoPegado.split(/[\n\r,;\t]+/).map(s => s.trim()).filter(Boolean),
        )];
        const porSigla = new Map<string, LocalMasivo[]>();
        for (const l of locales) {
            const k = norm(l.sigla);
            if (!k) continue;
            porSigla.set(k, [...(porSigla.get(k) ?? []), l]);
        }

        const agregar: string[] = [];
        const res: ResultadoPegado = { agregadas: 0, yaSeleccionadas: 0, ocupadas: [], noEncontradas: [] };
        for (const s of siglas) {
            const coincidencias = porSigla.get(norm(s));
            if (!coincidencias) { res.noEncontradas.push(s); continue; }
            for (const l of coincidencias) {
                if (l.proyecto_activo) res.ocupadas.push({ sigla: l.sigla, proyecto: l.proyecto_activo });
                else if (seleccion.has(l.id)) res.yaSeleccionadas++;
                else { agregar.push(l.id); res.agregadas++; }
            }
        }
        setSeleccion(prev => new Set([...prev, ...agregar]));
        setResultadoPegado(res);
        if (res.noEncontradas.length === 0 && res.ocupadas.length === 0) setTextoPegado('');
    }

    // ── Paso 3: resumen ─────────────────────────────────────────────────────
    const seleccionados = useMemo(
        () => [...seleccion].map(id => localPorId.get(id)).filter(Boolean) as LocalMasivo[],
        [seleccion, localPorId],
    );
    const coordinador = coordinadores.find(c => c.id === coordinadorId);
    const plantilla = plantillasChecklist.find(p => p.id === plantillaId);
    const receta = recetasBOM.find(r => r.id === recetaId);

    function confirmar() {
        if (enviandoRef.current || bloqueado) return;
        enviandoRef.current = true;
        setError(null);
        startTransition(async () => {
            try {
                const res = await crearProyectoMasivoAction({
                    nombre,
                    descripcion,
                    coordinadorId: coordinadorId || null,
                    fechaInicio: fechaInicio || null,
                    fechaFinEstimada: fechaFin || null,
                    localIds: [...seleccion],
                    plantillaChecklistId: plantillaId || null,
                    recetaBomId: recetaId || null,
                });
                if (res.error !== null) {
                    setError(res.error);
                    enviandoRef.current = false;
                    return;
                }
                // Se mantiene bloqueado hasta que la navegación termine
                setCreado(true);
                router.push('/dashboard/proyectos');
            } catch {
                setError('No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo.');
                enviandoRef.current = false;
            }
        });
    }

    const opcionesChecklist = [{ value: '', label: '— Sin plantilla —' }, ...plantillasChecklist.map(p => ({ value: p.id, label: p.nombre }))];
    const opcionesReceta    = [{ value: '', label: '— Sin receta —' },    ...recetasBOM.map(r => ({ value: r.id, label: r.nombre }))];
    const opcionesCoord     = [{ value: '', label: '— Sin coordinador —' }, ...coordinadores.map(c => ({ value: c.id, label: c.full_name ?? 'Sin nombre' }))];
    const opcionesEmpresa   = [{ value: '', label: 'Todas las empresas' }, ...empresas.map(e => ({ value: e.id, label: e.nombre_fantasia }))];

    return (
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm font-sans relative">
            {/* ── Stepper ───────────────────────────────────────────────── */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    {PASOS.map((titulo, i) => {
                        const n = i + 1;
                        const activo = paso === n;
                        const hecho = paso > n;
                        return (
                            <div key={titulo} className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-colors ${
                                    hecho ? 'bg-emerald-600 text-white' : activo ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                                }`}>
                                    {hecho ? <Check className="w-3.5 h-3.5" /> : n}
                                </div>
                                <span className={`text-[11px] font-black uppercase tracking-widest truncate ${activo ? 'text-slate-900' : 'text-slate-400'}`}>
                                    {titulo}
                                </span>
                                {n < PASOS.length && <div className="h-px bg-slate-200 flex-1 hidden sm:block" />}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="px-6 py-6 space-y-5">
                {/* ── PASO 1 ─────────────────────────────────────────────── */}
                {paso === 1 && (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className={LABEL_CLS}>Nombre del Proyecto Masivo *</label>
                            <input
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                placeholder="Ej: Proyecto BDAP"
                                className={INPUT_CLS}
                            />
                            <p className="text-[11px] text-slate-400 font-medium">
                                Cada local se creará como «{nombre.trim() || 'Nombre'} – SIGLA».
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <label className={LABEL_CLS}>Descripción {OPCIONAL}</label>
                            <textarea
                                rows={3}
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                                placeholder="Alcance, objetivos o notas del rollout..."
                                className={`${INPUT_CLS} resize-none`}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className={LABEL_CLS}>Fecha Inicio {OPCIONAL}</label>
                                <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={INPUT_CLS} />
                            </div>
                            <div className="space-y-1.5">
                                <label className={LABEL_CLS}>Fecha Estimada Fin {OPCIONAL}</label>
                                <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className={INPUT_CLS} />
                            </div>
                        </div>
                        {fechasInvalidas && (
                            <p className="text-xs font-semibold text-red-650 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                                La fecha de término no puede ser anterior a la de inicio.
                            </p>
                        )}

                        <div className="space-y-1.5">
                            <label className={LABEL_CLS}>Coordinador Responsable {OPCIONAL}</label>
                            <CustomSelect id="masivo-coordinador" value={coordinadorId} onChange={setCoordinadorId}
                                options={opcionesCoord} placeholder="— Sin coordinador —" strategy="fixed" />
                            <p className="text-[11px] text-slate-400 font-medium">Se asigna automáticamente a todos los proyectos hijos.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className={LABEL_CLS}>Plantilla de Checklist {OPCIONAL}</label>
                                <CustomSelect id="masivo-checklist" value={plantillaId} onChange={setPlantillaId}
                                    options={opcionesChecklist} placeholder="— Sin plantilla —" strategy="fixed" />
                            </div>
                            <div className="space-y-1.5">
                                <label className={LABEL_CLS}>Receta Maestra (materiales) {OPCIONAL}</label>
                                <CustomSelect id="masivo-receta" value={recetaId} onChange={setRecetaId}
                                    options={opcionesReceta} placeholder="— Sin receta —" strategy="fixed" />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">
                            Si eliges plantilla o receta, se aplicará a cada local al momento de crearlo.
                        </p>
                    </div>
                )}

                {/* ── PASO 2 ─────────────────────────────────────────────── */}
                {paso === 2 && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    placeholder="Buscar por sigla o nombre del local..."
                                    className="w-full pl-10 pr-9 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400 bg-white"
                                />
                                {busqueda && (
                                    <button type="button" onClick={() => setBusqueda('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="sm:w-56">
                                <CustomSelect id="masivo-empresa" value={empresaFiltro} onChange={setEmpresaFiltro}
                                    options={opcionesEmpresa} placeholder="Todas las empresas" strategy="fixed" />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={seleccionarVisibles} disabled={libresVisibles.length === 0}
                                className="px-3 py-1.5 rounded-full text-[11px] font-black border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer">
                                Seleccionar visibles libres ({libresVisibles.length})
                            </button>
                            <button type="button" onClick={() => setSeleccion(new Set())} disabled={seleccion.size === 0}
                                className="px-3 py-1.5 rounded-full text-[11px] font-black border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer">
                                Limpiar selección
                            </button>
                            <button type="button" onClick={() => setMostrarPegado(v => !v)}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-black border flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    mostrarPegado ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}>
                                <ClipboardPaste className="w-3.5 h-3.5" />
                                Pegar siglas
                            </button>
                            <span className="ml-auto text-xs font-black text-slate-800">
                                {seleccion.size} seleccionado{seleccion.size === 1 ? '' : 's'}
                            </span>
                        </div>

                        {mostrarPegado && (
                            <div className="border border-slate-200 rounded-2xl bg-slate-50/60 p-4 space-y-3">
                                <p className="text-[11px] font-semibold text-slate-500">
                                    Pega las siglas, una por línea (también se aceptan comas o punto y coma).
                                </p>
                                <textarea
                                    rows={5}
                                    value={textoPegado}
                                    onChange={e => setTextoPegado(e.target.value)}
                                    placeholder={'MCD01\nMCD02\nMCD03'}
                                    className={`${INPUT_CLS} font-mono resize-y`}
                                />
                                <div className="flex justify-end">
                                    <button type="button" onClick={procesarPegado} disabled={!textoPegado.trim()}
                                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer">
                                        Agregar a la selección
                                    </button>
                                </div>

                                {resultadoPegado && (
                                    <div className="space-y-2 text-xs font-semibold">
                                        <p className="text-emerald-700">
                                            ✓ {resultadoPegado.agregadas} agregada{resultadoPegado.agregadas === 1 ? '' : 's'}
                                            {resultadoPegado.yaSeleccionadas > 0 && ` · ${resultadoPegado.yaSeleccionadas} ya estaban seleccionadas`}
                                        </p>
                                        {resultadoPegado.ocupadas.length > 0 && (
                                            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2">
                                                <p className="font-black">Con proyecto activo (no se agregaron):</p>
                                                <p className="mt-0.5 break-words">
                                                    {resultadoPegado.ocupadas.map(o => `${o.sigla} (${o.proyecto})`).join(', ')}
                                                </p>
                                            </div>
                                        )}
                                        {resultadoPegado.noEncontradas.length > 0 && (
                                            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2">
                                                <p className="font-black">Siglas no encontradas:</p>
                                                <p className="mt-0.5 break-words">{resultadoPegado.noEncontradas.join(', ')}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {totalOcupados > 0 && (
                            <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                                <Lock className="w-3 h-3" />
                                {totalOcupados} local{totalOcupados === 1 ? '' : 'es'} con proyecto activo no se pueden seleccionar.
                            </p>
                        )}

                        <div className="border border-slate-200 rounded-2xl max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                            {localesFiltrados.length === 0 ? (
                                <p className="text-center text-sm font-bold text-slate-400 py-10">Ningún local coincide con la búsqueda</p>
                            ) : localesFiltrados.map(l => {
                                const ocupado = !!l.proyecto_activo;
                                const marcado = seleccion.has(l.id);
                                return (
                                    <button
                                        key={l.id}
                                        type="button"
                                        disabled={ocupado}
                                        onClick={() => alternar(l.id)}
                                        aria-pressed={marcado}
                                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                                            ocupado ? 'bg-slate-50 cursor-not-allowed' : marcado ? 'bg-indigo-50/60 hover:bg-indigo-50 cursor-pointer' : 'hover:bg-slate-50 cursor-pointer'
                                        }`}
                                    >
                                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                            ocupado ? 'border-slate-200 bg-slate-100' : marcado ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'
                                        }`}>
                                            {ocupado ? <Lock className="w-2.5 h-2.5 text-slate-400" /> : marcado && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                        </span>
                                        <span className={`min-w-0 flex-1 ${ocupado ? 'opacity-50' : ''}`}>
                                            <span className="text-xs font-black text-slate-800">[{l.sigla}]</span>{' '}
                                            <span className="text-xs font-semibold text-slate-600">{l.nombre_restaurante}</span>
                                            {l.cliente_id && empresaPorId.get(l.cliente_id) && (
                                                <span className="block text-[10px] font-semibold text-slate-400">{empresaPorId.get(l.cliente_id)}</span>
                                            )}
                                        </span>
                                        {ocupado && (
                                            <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 max-w-[45%] truncate shrink-0">
                                                En proyecto: {l.proyecto_activo}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── PASO 3 ─────────────────────────────────────────────── */}
                {paso === 3 && (
                    <div className="space-y-5">
                        <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                                <Layers className="w-5 h-5 text-indigo-300" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Se va a crear</p>
                                <p className="text-base font-black">1 Proyecto Masivo + {seleccionados.length} proyecto{seleccionados.length === 1 ? '' : 's'}</p>
                                <p className="text-xs text-slate-400 mt-0.5">«{nombre.trim()}»</p>
                            </div>
                        </div>

                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                            {([
                                ['Descripción', descripcion.trim() || '—'],
                                ['Coordinador', coordinador?.full_name ?? 'Sin coordinador'],
                                ['Inicio', fechaInicio || '—'],
                                ['Término estimado', fechaFin || '—'],
                                ['Plantilla de checklist', plantilla?.nombre ?? 'Ninguna'],
                                ['Receta maestra', receta?.nombre ?? 'Ninguna'],
                            ] as const).map(([k, v]) => (
                                <div key={k}>
                                    <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{k}</dt>
                                    <dd className="font-bold text-slate-800 mt-0.5 break-words">{v}</dd>
                                </div>
                            ))}
                        </dl>

                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                Locales ({seleccionados.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-2xl p-3">
                                {seleccionados.map(l => (
                                    <span key={l.id} title={l.nombre_restaurante}
                                        className="px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-black text-slate-700">
                                        {l.sigla || l.nombre_restaurante}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                            Todo se crea en una sola operación: si algo falla, no se crea nada.
                            Cada local seguirá funcionando como un proyecto independiente.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                        <span>{error}</span>
                    </div>
                )}

                {/* ── Navegación ─────────────────────────────────────────── */}
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                    {paso > 1 ? (
                        <button type="button" disabled={bloqueado} onClick={() => { setError(null); setPaso(p => p - 1); }}
                            className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-all uppercase tracking-wider cursor-pointer">
                            Atrás
                        </button>
                    ) : (
                        <button type="button" onClick={() => router.push('/dashboard/proyectos')}
                            className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all uppercase tracking-wider cursor-pointer">
                            Cancelar
                        </button>
                    )}

                    {paso < 3 ? (
                        <button type="button"
                            disabled={(paso === 1 && !paso1Valido) || (paso === 2 && !paso2Valido)}
                            onClick={() => setPaso(p => p + 1)}
                            className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-all uppercase tracking-wider cursor-pointer">
                            Siguiente
                        </button>
                    ) : (
                        <button type="button" onClick={confirmar} disabled={bloqueado}
                            className="flex-[2] py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer">
                            {bloqueado && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {bloqueado
                                ? `Creando ${seleccionados.length} proyecto${seleccionados.length === 1 ? '' : 's'}, por favor espera...`
                                : `Crear ${seleccionados.length} proyecto${seleccionados.length === 1 ? '' : 's'}`}
                        </button>
                    )}
                </div>
            </div>

            {/* Overlay: impide cualquier interacción mientras el RPC trabaja */}
            {bloqueado && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 px-6 py-5 flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
                        <div>
                            <p className="text-sm font-black text-slate-900">Creando proyectos...</p>
                            <p className="text-xs text-slate-500 font-medium">No cierres ni recargues esta página.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
