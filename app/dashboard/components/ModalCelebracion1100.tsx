'use client';

import { useState, useEffect, useTransition } from 'react';
import { Loader2, CheckCircle2, Trophy } from 'lucide-react';
import { guardarRespuestaEncuesta } from '../encuesta/actions';

const LS_KEY    = 'encuesta_1100_enviada_v1';
const EMOJIS    = ['😡', '😕', '😐', '🙂', '🤩'] as const;
const LABELS    = ['Muy mal', 'Regular', 'Neutral', 'Bien', '¡Excelente!'];
const MIN_CHARS = 10;

// ── Confetti canvas (sin librerías externas) ──────────────────────────────────
function launchConfetti() {
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '9999', pointerEvents: 'none',
    });
    document.body.appendChild(canvas);
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d')!;

    const COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8', '#f06595', '#20c997'];

    interface Particle {
        x: number; y: number; w: number; h: number;
        color: string; rot: number;
        vx: number; vy: number; vr: number; opacity: number;
    }

    const pieces: Particle[] = Array.from({ length: 110 }, () => ({
        x:       Math.random() * canvas.width,
        y:       -30 - Math.random() * 220,
        w:       5 + Math.random() * 8,
        h:       3 + Math.random() * 5,
        color:   COLORS[Math.floor(Math.random() * COLORS.length)],
        rot:     Math.random() * 360,
        vx:      (Math.random() - 0.5) * 4,
        vy:      1.5 + Math.random() * 4,
        vr:      (Math.random() - 0.5) * 9,
        opacity: 1,
    }));

    let frame = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (const p of pieces) {
            p.x   += p.vx;
            p.y   += p.vy;
            p.vy  += 0.07;
            p.rot += p.vr;
            if (frame > 110) p.opacity = Math.max(0, p.opacity - 0.018);
            if (p.opacity > 0) alive = true;
            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rot * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        frame++;
        if (alive) requestAnimationFrame(draw);
        else canvas.remove();
    }
    requestAnimationFrame(draw);
}

// ── Componente principal ──────────────────────────────────────────────────────
export function ModalCelebracion1100() {
    const [visible,      setVisible]      = useState(false);
    const [satisfaccion, setSatisfaccion] = useState<number | null>(null);
    const [comentario,   setComentario]   = useState('');
    const [exito,        setExito]        = useState(false);
    const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
    const [isPending,    startTransition] = useTransition();

    const comentarioLen = comentario.trim().length;
    const puedeEnviar   = !!satisfaccion && comentarioLen >= MIN_CHARS && !isPending;
    const anySelected   = satisfaccion !== null;

    useEffect(() => {
        if (localStorage.getItem(LS_KEY)) return;
        const t = setTimeout(() => {
            setVisible(true);
            launchConfetti();
        }, 800);
        return () => clearTimeout(t);
    }, []);

    function handleSubmit() {
        if (!puedeEnviar) return;
        setErrorMsg(null);
        startTransition(async () => {
            const result = await guardarRespuestaEncuesta(satisfaccion!, comentario);
            if (result.error) {
                setErrorMsg(result.error);
                return;
            }
            localStorage.setItem(LS_KEY, '1');
            setExito(true);
            setTimeout(() => setVisible(false), 2400);
        });
    }

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">

                {/* Franja festiva */}
                <div className="h-1.5 w-full bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-500" />

                {/* Pantalla de éxito */}
                {exito ? (
                    <div className="p-10 flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-lg font-black text-slate-900">¡Gracias por tu opinión!</p>
                            <p className="text-sm text-slate-500 mt-1">
                                Tu comentario nos ayuda a seguir mejorando Systel HelpDesk.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header festivo con gradiente */}
                        <div className="bg-gradient-to-br from-amber-50 via-pink-50 to-indigo-50 px-6 pt-6 pb-5 border-b border-slate-100">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-2xl bg-white border border-yellow-200 shadow-sm flex items-center justify-center shrink-0">
                                    <Trophy className="w-5 h-5 text-yellow-500" />
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Hito Systel HelpDesk
                                </p>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 leading-tight">
                                🎉 ¡Celebramos{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                                    1.100 tickets
                                </span>{' '}
                                juntos!
                            </h2>
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                Queremos saber cómo mejorar para hacerte la vida más fácil.
                                Solo toma 30 segundos 🙌
                            </p>
                        </div>

                        {/* Body */}
                        <div className="px-6 pb-6 pt-5 space-y-5">

                            {/* Selector de satisfacción */}
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                                    ¿Cómo calificarías tu experiencia con Systel?
                                </p>
                                <div className="flex justify-between gap-1.5">
                                    {EMOJIS.map((emoji, idx) => {
                                        const valor   = idx + 1;
                                        const active  = satisfaccion === valor;
                                        const dimmed  = anySelected && !active;
                                        return (
                                            <button
                                                key={valor}
                                                type="button"
                                                onClick={() => setSatisfaccion(valor)}
                                                className={`group flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all duration-200 ${
                                                    active
                                                        ? 'border-indigo-400 bg-indigo-50 scale-105 shadow-md ring-2 ring-indigo-200 ring-offset-1'
                                                        : dimmed
                                                            ? 'border-transparent bg-slate-50 opacity-40 grayscale cursor-pointer'
                                                            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 hover:scale-105'
                                                }`}
                                                title={LABELS[idx]}
                                            >
                                                <span className={`text-3xl leading-none transition-transform duration-200 select-none ${
                                                    active ? 'scale-110' : 'group-hover:scale-125'
                                                }`}>
                                                    {emoji}
                                                </span>
                                                <span className={`text-[9px] font-bold leading-tight text-center transition-colors ${
                                                    active ? 'text-indigo-600' : 'text-slate-400'
                                                }`}>
                                                    {LABELS[idx]}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Comentario obligatorio */}
                            <div>
                                <label className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                                    ¿Qué agregarías o cambiarías en Systel HelpDesk?
                                    <span className="text-red-400 normal-case font-black">*</span>
                                </label>
                                <textarea
                                    value={comentario}
                                    onChange={e => setComentario(e.target.value)}
                                    placeholder="Cuéntanos tu experiencia, sugerencia o idea..."
                                    rows={3}
                                    maxLength={500}
                                    className={`w-full border rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 resize-none transition-colors ${
                                        comentarioLen > 0 && comentarioLen < MIN_CHARS
                                            ? 'border-amber-300 focus:ring-amber-200 focus:border-amber-400'
                                            : comentarioLen >= MIN_CHARS
                                                ? 'border-emerald-300 focus:ring-emerald-200 focus:border-emerald-400'
                                                : 'border-slate-200 focus:ring-indigo-200 focus:border-indigo-300'
                                    }`}
                                />
                                <div className="flex items-center justify-between mt-1">
                                    <span className={`text-[10px] font-semibold transition-colors ${
                                        comentarioLen === 0
                                            ? 'text-slate-300'
                                            : comentarioLen < MIN_CHARS
                                                ? 'text-amber-500'
                                                : 'text-emerald-500'
                                    }`}>
                                        {comentarioLen === 0
                                            ? `Mínimo ${MIN_CHARS} caracteres requeridos`
                                            : comentarioLen < MIN_CHARS
                                                ? `${MIN_CHARS - comentarioLen} caractere${MIN_CHARS - comentarioLen !== 1 ? 's' : ''} más`
                                                : '✓ Listo'}
                                    </span>
                                    <span className="text-[10px] text-slate-300">
                                        {comentario.length} / 500
                                    </span>
                                </div>
                            </div>

                            {errorMsg && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                                    {errorMsg}
                                </p>
                            )}

                            {/* Botón enviar */}
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!puedeEnviar}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black text-white transition-all duration-200 ${
                                    puedeEnviar
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98]'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                {isPending
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                                    : 'Enviar mi opinión 🚀'
                                }
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
