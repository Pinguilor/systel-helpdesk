'use client';

import { Ticket } from '@/types/database.types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, RadialBarChart, RadialBar, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AlertCircle, CheckCircle2, LayoutDashboard } from 'lucide-react';

interface Props {
    tickets: Ticket[];
}

export default function AnalyticsCharts({ tickets }: Props) {
    // 1. Data processing for Priority Chart
    const countByPriority = { crítica: 0, alta: 0, media: 0, baja: 0 };
    tickets.forEach(ticket => {
        if (ticket.prioridad === 'crítica') countByPriority.crítica++;
        if (ticket.prioridad === 'alta') countByPriority.alta++;
        if (ticket.prioridad === 'media') countByPriority.media++;
        if (ticket.prioridad === 'baja') countByPriority.baja++;
    });

    const priorityData = [
        { name: 'Crítica', value: countByPriority.crítica, fill: '#ff0f5b' }, // Neon Red
        { name: 'Alta', value: countByPriority.alta, fill: '#ff7300' }, // Vibrant Orange
        { name: 'Media', value: countByPriority.media, fill: '#14f195' }, // Neon Green
        { name: 'Baja', value: countByPriority.baja, fill: '#00d4ff' }, // Electric Turquoise
    ].filter(item => item.value > 0);

    // 2. Data processing for Status Chart
    const statusCounts: Record<string, number> = {};
    tickets.forEach(ticket => {
        const estado = ticket.estado || 'desconocido';
        const label = estado.replace('_', ' ');
        statusCounts[label] = (statusCounts[label] || 0) + 1;
    });

    const statusColors: Record<string, string> = {
        'abierto': '#facc15', // Vibrant Yellow/Gold
        'esperando tecnico': '#facc15', // Vibrant Yellow/Gold
        'en progreso': '#8a2be2', // Deep Violet
        'resuelto': '#00e676', // Spring Green
        'cerrado': '#0f172a', // Dark Graphite
    };

    const statusData = Object.keys(statusCounts).map(status => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: statusCounts[status],
        color: statusColors[status] || '#94a3b8'
    }));

    if (tickets.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <p className="text-slate-500 font-medium">No hay suficientes datos para generar gráficos analíticos.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
            {/* First Row: Radial & Donut */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Priority Radial Chart */}
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                    <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                        <div className="p-2 bg-rose-50 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-rose-500" />
                        </div>
                        Distribución por Prioridad
                    </h3>
                    <div className="h-72 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                                cx="50%"
                                cy="50%"
                                innerRadius="30%"
                                outerRadius="100%"
                                barSize={20}
                                data={priorityData}
                            >
                                <RadialBar
                                    background={{ fill: '#f8fafc' }}
                                    dataKey="value"
                                    cornerRadius={12}
                                    label={false}
                                    isAnimationActive={true}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px 20px' }}
                                    itemStyle={{ color: '#0f172a', fontWeight: 'bold', padding: 0 }}
                                />
                            </RadialBarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Priority Legend */}
                    <div className="mt-8 grid grid-cols-2 gap-4 px-4">
                        {priorityData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: item.fill }} />
                                <span className="text-sm font-semibold text-slate-600 flex-1">{item.name}</span>
                                <span className="text-sm font-black text-slate-900">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Status Donut Chart */}
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                    <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        Estado de Tickets
                    </h3>
                    <div className="h-72 relative flex items-center justify-center">
                        {/* Floating Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-5xl font-black text-slate-800 tracking-tight">{tickets.length}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Total</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="75%"
                                    outerRadius="100%"
                                    paddingAngle={6}
                                    dataKey="value"
                                    cornerRadius={16}
                                    stroke="none"
                                    isAnimationActive={true}
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px 20px' }}
                                    itemStyle={{ color: '#0f172a', fontWeight: 'bold', padding: 0 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Status Legend */}
                    <div className="mt-8 grid grid-cols-2 gap-4 px-4">
                        {statusData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: item.color }} />
                                <span className="text-sm font-semibold text-slate-600 flex-1 truncate">{item.name}</span>
                                <span className="text-sm font-black text-slate-900">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Second Row: Monthly Backlog Bar Chart */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] col-span-full">
                <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <LayoutDashboard className="w-5 h-5 text-blue-500" />
                    </div>
                    Solicitudes (Backlog) por Mes <span className="text-sm font-medium text-slate-400 ml-2">(Últimos 12 meses)</span>
                </h3>
                <div className="h-80 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(() => {
                            const months: { label: string; month: number; year: number; tickets: number; }[] = [];
                            for (let i = 11; i >= 0; i--) {
                                const d = new Date();
                                d.setMonth(d.getMonth() - i);
                                let label = d.toLocaleDateString('es-ES', { month: 'short' });
                                label = label.charAt(0).toUpperCase() + label.slice(1);
                                months.push({
                                    label: `${label} ${d.getFullYear().toString().slice(2)}`,
                                    month: d.getMonth(),
                                    year: d.getFullYear(),
                                    tickets: 0
                                });
                            }
                            tickets.forEach(t => {
                                const d = new Date(t.fecha_creacion);
                                const target = months.find(item => item.month === d.getMonth() && item.year === d.getFullYear());
                                if (target) target.tickets++;
                            });
                            return months;
                        })()} margin={{ top: 20, right: 10, left: -20, bottom: 25 }}>
                            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#f1f5f9" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                                dy={16}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                                dx={-8}
                            />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px 20px' }}
                                itemStyle={{ color: '#0f172a', fontWeight: 'bold', padding: 0 }}
                            />
                            <Bar
                                dataKey="tickets"
                                fill="#3b82f6"
                                radius={[12, 12, 0, 0]}
                                barSize={48}
                                isAnimationActive={true}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
