'use client';

import { useMemo } from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    Ticket as TicketIcon, TrendingUp, CheckCircle2,
    AlertCircle, Target, Trophy, Building2, Tag, Zap,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface EnrichedTicket {
    id: string;
    numero_ticket: number;
    titulo: string;
    estado: string;
    prioridad: string;
    fecha_creacion: string;
    fecha_resolucion?: string | null;
    agente_asignado_id?: string | null;
    restaurante_id?: string | null;
    agente?: { full_name: string | null } | null;
    restaurantes?: { nombre_restaurante: string; sigla: string } | null;
    categoria?: { nombre: string } | null;
    tipo_servicio?: { nombre: string } | null;
    [key: string]: any;
}

interface Props {
    tickets: EnrichedTicket[];
    isStaff?: boolean;
}

// ─── Palettes ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string }> = {
    abierto:          { label: 'Abierto',       color: '#3b82f6' },
    en_progreso:      { label: 'En Progreso',   color: '#8b5cf6' },
    pendiente:        { label: 'Pendiente',     color: '#f59e0b' },
    programado:       { label: 'Programado',    color: '#a855f7' },
    esperando_agente: { label: 'Sin Asignar',   color: '#94a3b8' },
    resuelto:         { label: 'Resuelto',      color: '#10b981' },
    cerrado:          { label: 'Cerrado',       color: '#1e293b' },
    anulado:          { label: 'Anulado',       color: '#ef4444' },
};

const PRIORITY_META: Record<string, { color: string; label: string }> = {
    crítica: { color: '#ef4444', label: 'Crítica' },
    alta:    { color: '#f97316', label: 'Alta'    },
    media:   { color: '#f59e0b', label: 'Media'   },
    baja:    { color: '#3b82f6', label: 'Baja'    },
};

const PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#a855f7'];
const ACTIVE_STATES = ['abierto', 'en_progreso', 'pendiente', 'programado', 'esperando_agente'];

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 text-white rounded-xl px-4 py-3 shadow-2xl text-sm border border-slate-800">
            {label && <p className="text-slate-400 font-semibold text-xs mb-1.5">{label}</p>}
            {payload.map((entry: any, i: number) => (
                <p key={i} className="flex items-center gap-2 font-bold">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color || entry.fill }} />
                    <span className="text-slate-300">{entry.name}:</span>
                    <span className="text-white">{entry.value}</span>
                </p>
            ))}
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function KPICard({ icon, bg, label, value, sub }: {
    icon: React.ReactNode; bg: string; label: string; value: string | number; sub: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 duration-200">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                {icon}
            </div>
            <div>
                <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{value}</p>
                <p className="text-xs font-bold text-slate-600 mt-1.5">{label}</p>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">{sub}</p>
        </div>
    );
}

function ChartCard({ title, icon, bg, subtitle, children, className = '' }: {
    title: string; icon: React.ReactNode; bg: string;
    subtitle?: string; children: React.ReactNode; className?: string;
}) {
    return (
        <div className={`bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 ${className}`}>
            <div className="flex items-start gap-3 mb-5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                    {icon}
                </div>
                <div>
                    <h3 className="text-sm font-black text-slate-800 leading-tight">{title}</h3>
                    {subtitle && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AnalyticsCharts({ tickets, isStaff = true }: Props) {

    // ── KPIs ────────────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const total       = tickets.length;
        const active      = tickets.filter(t => ACTIVE_STATES.includes(t.estado)).length;
        const resolved    = tickets.filter(t => ['resuelto', 'cerrado'].includes(t.estado)).length;
        const rate        = total > 0 ? Math.round((resolved / total) * 100) : 0;
        const criticos    = tickets.filter(t => t.prioridad === 'crítica' && ACTIVE_STATES.includes(t.estado)).length;

        return { total, active, resolved, rate, criticos };
    }, [tickets]);

    // ── Status donut ────────────────────────────────────────────────────────────
    const statusData = useMemo(() => {
        const counts: Record<string, number> = {};
        tickets.forEach(t => { counts[t.estado] = (counts[t.estado] || 0) + 1; });
        return Object.entries(counts)
            .map(([estado, value]) => ({
                name:  STATUS_META[estado]?.label  ?? estado,
                value,
                color: STATUS_META[estado]?.color  ?? '#94a3b8',
            }))
            .sort((a, b) => b.value - a.value);
    }, [tickets]);

    // ── Monthly trend (last 6 months) ───────────────────────────────────────────
    const monthlyData = useMemo(() => {
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - (5 - i));
            const lbl = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
            return { label: lbl.charAt(0).toUpperCase() + lbl.slice(1), month: d.getMonth(), year: d.getFullYear(), creados: 0, resueltos: 0 };
        });
        tickets.forEach(t => {
            const dc = new Date(t.fecha_creacion);
            const m  = months.find(x => x.month === dc.getMonth() && x.year === dc.getFullYear());
            if (m) m.creados++;
            if (t.fecha_resolucion) {
                const dr = new Date(t.fecha_resolucion);
                const mr = months.find(x => x.month === dr.getMonth() && x.year === dr.getFullYear());
                if (mr) mr.resueltos++;
            }
        });
        return months;
    }, [tickets]);

    // ── Top categories ──────────────────────────────────────────────────────────
    const topCategories = useMemo(() => {
        const counts: Record<string, number> = {};
        tickets.forEach(t => {
            const cat = t.categoria?.nombre || t.tipo_servicio?.nombre || 'Sin Clasificar';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [tickets]);

    // ── Agent leaderboard ───────────────────────────────────────────────────────
    const agentStats = useMemo(() => {
        const map: Record<string, { name: string; total: number; resueltos: number }> = {};
        tickets.forEach(t => {
            const id = t.agente_asignado_id;
            if (!id) return;
            if (!map[id]) map[id] = { name: t.agente?.full_name || 'Técnico', total: 0, resueltos: 0 };
            map[id].total++;
            if (['resuelto', 'cerrado'].includes(t.estado)) map[id].resueltos++;
        });
        return Object.values(map).sort((a, b) => b.resueltos - a.resueltos).slice(0, 5);
    }, [tickets]);

    // ── Top restaurants ─────────────────────────────────────────────────────────
    const topRestaurants = useMemo(() => {
        const map: Record<string, { name: string; sigla: string; value: number }> = {};
        tickets.forEach(t => {
            const id = t.restaurante_id;
            if (!id) return;
            if (!map[id]) map[id] = {
                name:  t.restaurantes?.nombre_restaurante || 'Restaurante',
                sigla: t.restaurantes?.sigla || '—',
                value: 0,
            };
            map[id].value++;
        });
        return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8);
    }, [tickets]);

    const maxCat  = topCategories[0]?.value  || 1;
    const maxRest = topRestaurants[0]?.value || 1;
    const MEDALS  = ['🥇', '🥈', '🥉'];

    if (tickets.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                <TicketIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-semibold">No hay datos suficientes para mostrar analíticas.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">

            {/* ── ROW 1: KPI CARDS ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPICard
                    icon={<TicketIcon className="w-4 h-4 text-indigo-600" />}
                    bg="bg-indigo-50"
                    label="Total Solicitudes"
                    value={kpis.total}
                    sub="Historial completo"
                />
                <KPICard
                    icon={<Zap className="w-4 h-4 text-amber-600" />}
                    bg="bg-amber-50"
                    label="En Curso"
                    value={kpis.active}
                    sub="Requieren atención"
                />
                <KPICard
                    icon={<Target className="w-4 h-4 text-emerald-600" />}
                    bg="bg-emerald-50"
                    label="Tasa de Resolución"
                    value={`${kpis.rate}%`}
                    sub={`${kpis.resolved} tickets cerrados`}
                />
            </div>

            {/* ── ROW 2: STATUS DONUT + PRIORITY BARS ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Status Donut */}
                <ChartCard title="Estado de Tickets" icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} bg="bg-emerald-50">
                    <div className="flex items-center gap-6">
                        {/* Donut */}
                        <div className="relative w-44 h-44 shrink-0">
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                <span className="text-4xl font-black text-slate-800 leading-none">{tickets.length}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%" cy="50%"
                                        innerRadius="68%" outerRadius="100%"
                                        paddingAngle={3} dataKey="value"
                                        cornerRadius={5} stroke="none"
                                        isAnimationActive
                                    >
                                        {statusData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<DarkTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                            {statusData.map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                                    <span className="text-[11px] font-semibold text-slate-600 flex-1 truncate">{item.name}</span>
                                    <span className="text-xs font-black text-slate-800 tabular-nums">{item.value}</span>
                                    <span className="text-[10px] text-slate-400 font-medium tabular-nums w-8 text-right">
                                        {Math.round((item.value / tickets.length) * 100)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </ChartCard>

                {/* Priority Bars */}
                <ChartCard title="Distribución por Prioridad" icon={<AlertCircle className="w-4 h-4 text-rose-500" />} bg="bg-rose-50">
                    <div className="flex flex-col gap-5 mt-1">
                        {Object.entries(PRIORITY_META).map(([key, meta]) => {
                            const count = tickets.filter(t => t.prioridad === key).length;
                            const pct   = tickets.length > 0 ? (count / tickets.length) * 100 : 0;
                            return (
                                <div key={key}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold text-slate-600">{meta.label}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-800">{count}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">{Math.round(pct)}%</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${pct}%`, background: meta.color }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {kpis.criticos > 0 && (
                        <div className="mt-5 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span className="text-xs font-bold text-red-700">
                                {kpis.criticos} crítico{kpis.criticos > 1 ? 's' : ''} activo{kpis.criticos > 1 ? 's' : ''}
                            </span>
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* ── ROW 3: MONTHLY TREND ─────────────────────────────────────────── */}
            <ChartCard
                title="Tendencia Mensual"
                icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
                bg="bg-indigo-50"
                subtitle="Tickets creados vs resueltos — Últimos 6 meses"
            >
                <div className="h-60 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gCreados" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                                </linearGradient>
                                <linearGradient id="gResueltos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={8} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dx={-4} allowDecimals={false} />
                            <Tooltip content={<DarkTooltip />} />
                            <Area type="monotone" dataKey="creados"   name="Creados"   stroke="#6366f1" strokeWidth={2.5} fill="url(#gCreados)"   dot={{ fill: '#6366f1', strokeWidth: 0, r: 4 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                            <Area type="monotone" dataKey="resueltos" name="Resueltos" stroke="#10b981" strokeWidth={2.5} fill="url(#gResueltos)" dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-5 mt-3 px-1">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 rounded-full bg-indigo-500" /><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span className="text-xs font-semibold text-slate-500">Creados</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 rounded-full bg-emerald-500" /><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-xs font-semibold text-slate-500">Resueltos</span>
                    </div>
                </div>
            </ChartCard>

            {/* ── ROW 4: TOP CATEGORIES + AGENT LEADERBOARD ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Top Categories */}
                <ChartCard title="Top Categorías de Servicio" icon={<Tag className="w-4 h-4 text-violet-600" />} bg="bg-violet-50">
                    <div className="flex flex-col gap-4 mt-1">
                        {topCategories.map((cat, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 w-4 shrink-0 tabular-nums">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold text-slate-700 truncate pr-2">{cat.name}</span>
                                        <span className="text-xs font-black text-slate-800 shrink-0 tabular-nums">{cat.value}</span>
                                    </div>
                                    <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${(cat.value / maxCat) * 100}%`, background: PALETTE[i % PALETTE.length] }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ChartCard>

                {/* Agent Leaderboard */}
                {isStaff && (
                    <ChartCard title="Rendimiento por Técnico" icon={<Trophy className="w-4 h-4 text-amber-500" />} bg="bg-amber-50">
                        {agentStats.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">Sin técnicos asignados</p>
                        ) : (
                            <div className="flex flex-col gap-1 mt-1">
                                {agentStats.map((agent, i) => {
                                    const rate = agent.total > 0 ? Math.round((agent.resueltos / agent.total) * 100) : 0;
                                    return (
                                        <div key={i} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                                            <span className="text-base w-6 text-center shrink-0 leading-none">
                                                {MEDALS[i] ?? <span className="text-xs font-black text-slate-400">#{i + 1}</span>}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate leading-tight">{agent.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                    {agent.total} asignados · {agent.resueltos} resueltos
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className={`text-sm font-black ${rate >= 70 ? 'text-emerald-600' : rate >= 40 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                    {rate}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ChartCard>
                )}

                {/* If not staff, show priority breakdown chart in place of leaderboard */}
                {!isStaff && topRestaurants.length > 0 && (
                    <ChartCard title="Mis Locales Más Activos" icon={<Building2 className="w-4 h-4 text-blue-600" />} bg="bg-blue-50">
                        <div className="flex flex-col gap-3 mt-1">
                            {topRestaurants.slice(0, 5).map((r, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-slate-400 w-4 shrink-0 tabular-nums">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-slate-700 truncate pr-2">{r.name}</span>
                                            <span className="text-xs font-black text-slate-800 shrink-0 tabular-nums">{r.value}</span>
                                        </div>
                                        <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${(r.value / maxRest) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ChartCard>
                )}
            </div>

            {/* ── ROW 5: TOP RESTAURANTS (staff only) ──────────────────────────── */}
            {isStaff && topRestaurants.length > 0 && (
                <ChartCard
                    title="Locales con Más Solicitudes"
                    icon={<Building2 className="w-4 h-4 text-blue-600" />}
                    bg="bg-blue-50"
                    subtitle="Top 8 locales por volumen de tickets"
                >
                    <div className="h-52 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={topRestaurants}
                                layout="vertical"
                                margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                            >
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis
                                    type="number" axisLine={false} tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                    allowDecimals={false}
                                />
                                <YAxis
                                    type="category" dataKey="sigla" axisLine={false} tickLine={false}
                                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} width={38}
                                />
                                <Tooltip content={<DarkTooltip />} cursor={{ fill: '#f8fafc' }} />
                                <Bar dataKey="value" name="Tickets" radius={[0, 6, 6, 0]} barSize={16} isAnimationActive>
                                    {topRestaurants.map((_, i) => (
                                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            )}

        </div>
    );
}
