'use client';

// REGLA DE DISEÑO: NUNCA usar <select> nativo ni alert/confirm/prompt nativos.

import { useMemo, useState } from 'react';
import { Check, ClipboardPaste, Search, X } from 'lucide-react';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import type { LocalMasivo } from '../actions';

interface Empresa { id: string; nombre_fantasia: string }

interface Props {
    locales:   LocalMasivo[];
    empresas:  Empresa[];
    seleccion: Set<string>;
    onChange:  (s: Set<string>) => void;
    /** Alto máximo de la lista (clase Tailwind). */
    alturaLista?: string;
}

interface ResultadoPegado {
    agregadas: number;
    yaSeleccionadas: number;
    noEncontradas: string[];
}

const norm = (v: string | null | undefined) =>
    (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Selector múltiple de locales: búsqueda, filtro por empresa y pegado masivo de siglas. */
export function LocalesPicker({ locales, empresas, seleccion, onChange, alturaLista = 'max-h-[420px]' }: Props) {
    const [busqueda, setBusqueda] = useState('');
    const [empresaFiltro, setEmpresaFiltro] = useState('');
    const [mostrarPegado, setMostrarPegado] = useState(false);
    const [textoPegado, setTextoPegado] = useState('');
    const [resultadoPegado, setResultadoPegado] = useState<ResultadoPegado | null>(null);

    const empresaPorId = useMemo(() => new Map(empresas.map(e => [e.id, e.nombre_fantasia])), [empresas]);
    const opcionesEmpresa = [{ value: '', label: 'Todas las empresas' }, ...empresas.map(e => ({ value: e.id, label: e.nombre_fantasia }))];

    const localesFiltrados = useMemo(() => {
        const q = norm(busqueda.trim());
        return locales.filter(l => {
            if (empresaFiltro && l.cliente_id !== empresaFiltro) return false;
            if (!q) return true;
            return norm(l.sigla).includes(q) || norm(l.nombre_restaurante).includes(q);
        });
    }, [locales, busqueda, empresaFiltro]);

    const conActivos = locales.filter(l => l.proyectos_activos.length > 0).length;

    function alternar(id: string) {
        const n = new Set(seleccion);
        if (n.has(id)) n.delete(id); else n.add(id);
        onChange(n);
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
        const res: ResultadoPegado = { agregadas: 0, yaSeleccionadas: 0, noEncontradas: [] };
        for (const s of siglas) {
            const coincidencias = porSigla.get(norm(s));
            if (!coincidencias) { res.noEncontradas.push(s); continue; }
            for (const l of coincidencias) {
                if (seleccion.has(l.id)) res.yaSeleccionadas++;
                else { agregar.push(l.id); res.agregadas++; }
            }
        }
        onChange(new Set([...seleccion, ...agregar]));
        setResultadoPegado(res);
        if (res.noEncontradas.length === 0) setTextoPegado('');
    }

    return (
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
                    <CustomSelect id="picker-empresa" value={empresaFiltro} onChange={setEmpresaFiltro}
                        options={opcionesEmpresa} placeholder="Todas las empresas" strategy="fixed" />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onChange(new Set([...seleccion, ...localesFiltrados.map(l => l.id)]))}
                    disabled={localesFiltrados.length === 0}
                    className="px-3 py-1.5 rounded-full text-[11px] font-black border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer">
                    Seleccionar visibles ({localesFiltrados.length})
                </button>
                <button type="button" onClick={() => onChange(new Set())} disabled={seleccion.size === 0}
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
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold font-mono resize-y focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all shadow-sm bg-white"
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

            {conActivos > 0 && (
                <p className="text-[11px] font-semibold text-slate-400">
                    {conActivos} local{conActivos === 1 ? '' : 'es'} ya {conActivos === 1 ? 'tiene' : 'tienen'} proyectos activos; igual puedes crear uno nuevo en paralelo.
                </p>
            )}

            <div className={`border border-slate-200 rounded-2xl ${alturaLista} overflow-y-auto divide-y divide-slate-100`}>
                {localesFiltrados.length === 0 ? (
                    <p className="text-center text-sm font-bold text-slate-400 py-10">Ningún local coincide con la búsqueda</p>
                ) : localesFiltrados.map(l => {
                    const marcado = seleccion.has(l.id);
                    const nActivos = l.proyectos_activos.length;
                    return (
                        <button
                            key={l.id}
                            type="button"
                            onClick={() => alternar(l.id)}
                            aria-pressed={marcado}
                            className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                                marcado ? 'bg-indigo-50/60 hover:bg-indigo-50' : 'hover:bg-slate-50'
                            }`}
                        >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                marcado ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'
                            }`}>
                                {marcado && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="text-xs font-black text-slate-800">[{l.sigla}]</span>{' '}
                                <span className="text-xs font-semibold text-slate-600">{l.nombre_restaurante}</span>
                                {l.cliente_id && empresaPorId.get(l.cliente_id) && (
                                    <span className="block text-[10px] font-semibold text-slate-400">{empresaPorId.get(l.cliente_id)}</span>
                                )}
                            </span>
                            {nActivos > 0 && (
                                <span title={l.proyectos_activos.join(', ')}
                                    className="text-[10px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 shrink-0">
                                    {nActivos} proyecto{nActivos === 1 ? '' : 's'} activo{nActivos === 1 ? '' : 's'}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
