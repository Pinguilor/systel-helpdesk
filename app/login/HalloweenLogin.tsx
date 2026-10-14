'use client';

import Image from 'next/image';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { login } from './actions';

/* Login de temporada (Halloween): fantasmita guardián y lápida. Lo usa page.tsx solo con el tema activo;
   el formulario envía al mismo server action `login` que el login normal. */

type Focus = 'none' | 'email' | 'password';
type Mood = 'idle' | 'email' | 'password' | 'error' | 'pending';

const LINES: Record<Mood, string> = {
    idle: 'Buuu… ¡hola! ¿Vienes por tus tickets?',
    email: '¿Quién anda ahí? Déjame ver…',
    password: '¡No estoy mirando, lo prometo!',
    error: 'Buaaa… ese hechizo no funcionó.',
    pending: '¡Buuu! ¡Abriendo la puerta!',
};

// Cuerpo del fantasma con el borde inferior ondulado (coordenadas locales)
const GHOST_BODY = 'M-38 46V-14C-38-40-21-58 0-58S38-40 38-14V46C34 54 27 54 23 47 19 40 13 40 9 47 5 54-1 54-5 47-9 40-15 40-19 47-23 54-33 55-38 46Z';
const MOUTHS = {
    smile: 'M-6 6Q0 12 6 6',
    sad: 'M-6 11Q0 5 6 11',
    shout: 'M-7 6A7 8 0 1 0 7 6 7 8 0 1 0-7 6Z',
};

// Brasas que suben (posiciones fijas para que el render de servidor y cliente coincidan)
const EMBERS = [
    [6, 0, 9], [14, 3, 12], [22, 6, 10], [31, 1, 14], [39, 8, 11], [47, 4, 13], [55, 2, 9],
    [63, 7, 12], [70, 5, 15], [78, 1, 10], [86, 6, 13], [93, 3, 11], [10, 9, 16], [58, 10, 14],
];

function Ghost({ mood, look }: { mood: Mood; look: { x: number; y: number } }) {
    const covering = mood === 'password';
    const sad = mood === 'error';
    const happy = mood === 'pending';
    const px = covering ? 0 : look.x * 3.4;
    const py = covering ? 0 : look.y * 2.6;
    return (
        <svg className={`hwl-jack hwl-ghost ${happy ? 'hwl-jack--lit' : ''} ${sad ? 'hwl-jack--sad' : ''}`} viewBox="-60 -66 120 136" aria-hidden="true">
            <defs>
                <linearGradient id="hwl-sheet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#eef0ff" /><stop offset="1" stopColor="#c9c6f2" stopOpacity=".72" />
                </linearGradient>
                <radialGradient id="hwl-sheen" cx="35%" cy="22%" r="60%">
                    <stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="hwl-aura" cx="50%" cy="50%" r="50%">
                    <stop offset="0" stopColor="#b9a8ff" stopOpacity=".45" /><stop offset="1" stopColor="#7b5cff" stopOpacity="0" />
                </radialGradient>
            </defs>

            <ellipse cx="0" cy="64" rx="30" ry="4.5" fill="#000" opacity=".45" className="hwl-ghost-shadow" />
            <g className="hwl-ghost-body">
                <ellipse cx="0" cy="0" rx="58" ry="62" fill="url(#hwl-aura)" />
                <g className="hwl-ghost-tail">
                    <path d={GHOST_BODY} fill="url(#hwl-sheet)" stroke="#9f97d9" strokeOpacity=".55" strokeWidth="1" />
                </g>
                <ellipse cx="-14" cy="-38" rx="14" ry="10" fill="url(#hwl-sheen)" />

                {/* Ojos grandes con brillo: miran hacia el cursor */}
                <g className="hwl-ghost-eyes" style={{ transform: `translate(${px}px, ${py}px)` }}>
                    <ellipse cx="-13" cy="-14" rx={sad ? 6 : 7} ry={sad ? 7 : 9} fill="#1b1430" />
                    <ellipse cx="13" cy="-14" rx={sad ? 6 : 7} ry={sad ? 7 : 9} fill="#1b1430" />
                    <circle cx="-10.5" cy="-17.5" r="2.6" fill="#fff" /><circle cx="15.5" cy="-17.5" r="2.6" fill="#fff" />
                    <circle cx="-15" cy="-10" r="1.2" fill="#fff" opacity=".8" /><circle cx="11" cy="-10" r="1.2" fill="#fff" opacity=".8" />
                </g>
                {sad && (
                    <g className="hwl-tears">
                        <path d="M-17-4c-2 4-3 6-3 8a3 3 0 0 0 6 0c0-2-1-4-3-8z" fill="#7cc8ff" />
                        <path d="M17-4c-2 4-3 6-3 8a3 3 0 0 0 6 0c0-2-1-4-3-8z" fill="#7cc8ff" />
                    </g>
                )}
                {/* Mejillas */}
                <ellipse cx="-24" cy="-1" rx="6" ry="3.5" fill="#ff8fb3" opacity={sad ? .7 : .45} />
                <ellipse cx="24" cy="-1" rx="6" ry="3.5" fill="#ff8fb3" opacity={sad ? .7 : .45} />
                {/* Boca */}
                {happy
                    ? <path d={MOUTHS.shout} fill="#1b1430" />
                    : <path d={sad ? MOUTHS.sad : MOUTHS.smile} fill="none" stroke="#1b1430" strokeWidth="2.4" strokeLinecap="round" />}

                {/* Bracitos: al escribir la contraseña suben a taparse los ojos */}
                <ellipse className="hwl-arm hwl-arm-l" cx="-40" cy="14" rx="8" ry="11" fill="url(#hwl-sheet)" stroke="#9f97d9" strokeOpacity=".55" strokeWidth="1"
                    style={{ transform: covering ? 'translate(27px, -28px) rotate(-30deg)' : 'rotate(20deg)' }} />
                <ellipse className="hwl-arm hwl-arm-r" cx="40" cy="14" rx="8" ry="11" fill="url(#hwl-sheet)" stroke="#9f97d9" strokeOpacity=".55" strokeWidth="1"
                    style={{ transform: covering ? 'translate(-27px, -28px) rotate(30deg)' : 'rotate(-20deg)' }} />
            </g>
        </svg>
    );
}

function SubmitSpell({ onPending }: { onPending: (p: boolean) => void }) {
    const { pending } = useFormStatus();
    useEffect(() => { onPending(pending); }, [pending, onPending]);
    return (
        <button formAction={login} disabled={pending} className="hwl-btn">
            {pending ? <><Loader2 className="w-5 h-5 animate-spin" /> Conjurando…</> : <>Ingresar <span aria-hidden="true">👻</span></>}
        </button>
    );
}

function Scene() {
    const params = useSearchParams();
    const error = params?.get('error');
    const [focus, setFocus] = useState<Focus>('none');
    const [pending, setPending] = useState(false);
    const [look, setLook] = useState({ x: 0, y: 0 });
    const jackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            const r = jackRef.current?.getBoundingClientRect();
            if (!r) return;
            const dx = e.clientX - (r.left + r.width / 2);
            const dy = e.clientY - (r.top + r.height * 0.45);
            const d = Math.hypot(dx, dy) || 1;
            const k = Math.min(1, d / 260);
            setLook({ x: (dx / d) * k, y: (dy / d) * k });
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => window.removeEventListener('pointermove', onMove);
    }, []);

    // Al escribir el correo la calabaza mira hacia el formulario
    const formLook = { x: 0.9, y: 0.45 };
    const mood: Mood = pending ? 'pending' : focus === 'password' ? 'password' : error && focus === 'none' ? 'error' : focus === 'email' ? 'email' : 'idle';

    return (
        <div className="hwl-root">
            {/* Cielo: luna de cosecha, árbol, colinas y tumbas */}
            <div className="hwl-moon" aria-hidden="true" />
            <svg className="hwl-tree" viewBox="0 0 300 520" aria-hidden="true" preserveAspectRatio="xMaxYMax meet">
                <g fill="none" stroke="#06050b" strokeLinecap="round">
                    <path d="M232 520C226 430 238 360 222 300 210 250 186 214 150 186" strokeWidth="26" />
                    <path d="M224 330C250 280 286 262 300 252" strokeWidth="14" />
                    <path d="M196 236C160 226 118 238 86 222 60 210 40 186 18 182" strokeWidth="11" />
                    <path d="M150 186C140 150 150 112 132 80 122 62 104 52 92 34" strokeWidth="9" />
                    <path d="M132 80C150 60 176 54 190 30" strokeWidth="6" />
                    <path d="M86 222C70 236 46 240 28 256" strokeWidth="5" />
                    <path d="M118 232C112 254 92 268 78 290" strokeWidth="4" />
                    <path d="M60 206C52 192 36 186 22 160" strokeWidth="4" />
                    <path d="M266 266C272 244 268 222 278 200" strokeWidth="5" />
                    <path d="M104 52C96 40 98 24 86 10" strokeWidth="3" />
                    <path d="M176 54C186 46 200 46 212 36" strokeWidth="3" />
                </g>
                <g className="hwl-swing">
                    <line x1="98" y1="226" x2="98" y2="300" stroke="#b9a3e3" strokeOpacity=".35" strokeWidth="1" />
                    <g transform="translate(98 306)">
                        <path d="M-4-2l-8-6-3-7M-4 1l-9 0-3 4M-4 4l-7 6-2 6M4-2l8-6 3-7M4 1l9 0 3 4M4 4l7 6 2 6" stroke="#06050b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                        <ellipse cx="0" cy="2" rx="6" ry="7.5" fill="#06050b" />
                        <circle cx="0" cy="-6" r="4" fill="#06050b" />
                        <circle cx="-1.6" cy="-6.5" r=".9" fill="#ff6d00" /><circle cx="1.6" cy="-6.5" r=".9" fill="#ff6d00" />
                    </g>
                </g>
            </svg>
            <svg className="hwl-ground" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
                <path d="M0 170C180 120 330 150 520 132 720 112 880 160 1060 140 1230 122 1340 150 1440 136V320H0Z" fill="#1a1230" />
                <g fill="#120c22">
                    <path d="M150 168h22v-40a11 11 0 0 0-22 0z" /><path d="M1150 150h26v-46a13 13 0 0 0-26 0z" />
                    <path d="M1236 154h8v-30h12v-8h-12v-12h-8v12h-12v8h12z" /><path d="M86 176h7v-26h10v-7h-10v-10h-7v10h-10v7h10z" />
                    <path d="M1310 160h18v-30a9 9 0 0 0-18 0z" />
                </g>
                <path d="M0 230C220 190 420 214 640 200 860 186 1060 226 1260 210 1350 203 1400 208 1440 204V320H0Z" fill="#0c0818" />
                <path d="M0 268C260 246 520 262 760 252 1000 242 1240 266 1440 254V320H0Z" fill="#050309" />
            </svg>
            <div className="hwl-embers" aria-hidden="true">
                {EMBERS.map(([left, delay, dur], i) => (
                    <span key={i} style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />
                ))}
            </div>
            <div className="hwl-mist" aria-hidden="true" />

            <main className="hwl-stage">
                {/* El fantasmita guardián */}
                <div className="hwl-guard" ref={jackRef}>
                    <p className="hwl-bubble" key={mood} role="status">{LINES[mood]}</p>
                    <Ghost mood={mood} look={focus === 'email' ? formLook : look} />
                </div>

                {/* Lápida con el formulario */}
                <section className="hwl-stone" aria-label="Iniciar sesión">
                    <span className="hwl-rip" aria-hidden="true">R · I · P</span>
                    <Image src="/systeltldablanco.png" alt="Logo Systel" width={180} height={60} className="hwl-logo" priority />
                    <h1 className="hwl-title">Bienvenidos</h1>
                    <p className="hwl-epitaph">
                        {error ? 'Por favor, verifique los datos ingresados.' : 'Aquí descansan los tickets resueltos.\nIngresa para despertar a los pendientes.'}
                    </p>
                    {error && <p className="hwl-error">{error}</p>}

                    <form className="hwl-form">
                        <label className="sr-only" htmlFor="email">Correo</label>
                        <input
                            id="email" name="email" type="email" autoComplete="email" required
                            placeholder="Correo / Nombre de usuario"
                            onFocus={() => setFocus('email')} onBlur={() => setFocus('none')}
                        />
                        <label className="sr-only" htmlFor="password">Contraseña</label>
                        <input
                            id="password" name="password" type="password" autoComplete="current-password" required
                            placeholder="Contraseña"
                            onFocus={() => setFocus('password')} onBlur={() => setFocus('none')}
                        />
                        <SubmitSpell onPending={setPending} />
                    </form>
                    <svg className="hwl-moss" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M0 40V22c14-8 22 4 34-4s20-12 30-2 18 6 28-2 22-8 30 2 16 4 26-4 24-6 32 4 20 2 30-6 22-4 30 4 18 4 28-4 20-6 30 2 18 6 28-2 22-6 30 2 20 4 24 2V40Z" fill="#14240f" />
                        <path d="M0 40V30c20-6 30 2 46-2s26-10 40-2 30 4 44-2 30-6 46 2 26 4 42-2 30-6 46 2 30 2 46-4 26-2 40 4V40Z" fill="#0b1508" />
                    </svg>
                </section>
            </main>

            <footer className="hwl-foot">&copy; {new Date().getFullYear()} Creado por Loopdeskapp - Desarrollo de Software y soluciones a medida</footer>
        </div>
    );
}

export function HalloweenLogin() {
    return (
        <Suspense fallback={<div className="hwl-root" />}>
            <Scene />
        </Suspense>
    );
}
