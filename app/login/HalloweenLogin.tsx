'use client';

import Image from 'next/image';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { login } from './actions';

/* Login de temporada (Halloween): calavera guardiana y lápida. Lo usa page.tsx solo con el tema activo;
   el formulario envía al mismo server action `login` que el login normal. */

type Focus = 'none' | 'email' | 'password';
type Mood = 'idle' | 'email' | 'password' | 'error' | 'pending';

const LINES: Record<Mood, string> = {
    idle: 'Bienvenido a la cripta… ¿vienes por tus tickets?',
    email: 'Puedo sentir tu presencia… déjame ver quién eres.',
    password: 'Cierro los ojos… tu secreto está a salvo conmigo.',
    error: '¡Ese no es tu nombre, mortal!',
    pending: '¡Se abre la cripta!',
};

// Cuencas de los ojos (coordenadas locales de la calavera)
const EYE_L = 'M-35-14L-9-8C-4-6-3 1-7 6-11 11-21 11-28 6-35 1-38-7-35-14Z';
const EYE_R = 'M35-14L9-8C4-6 3 1 7 6 11 11 21 11 28 6 35 1 38-7 35-14Z';
const CRANIUM = 'M0-62C-30-62-46-42-46-16-46-3-42 5-38 10-38 19-34 26-30 29L-28 36C-26 40-22 41-18 41H18C22 41 26 40 28 36L30 29C34 26 38 19 38 10 42 5 46-3 46-16 46-42 30-62 0-62Z';
const JAW = 'M-27 36C-28 45-24 54-17 59-11 63-5 64 0 64S11 63 17 59C24 54 28 45 27 36L20 39H-20Z';

// Brasas que suben (posiciones fijas para que el render de servidor y cliente coincidan)
const EMBERS = [
    [6, 0, 9], [14, 3, 12], [22, 6, 10], [31, 1, 14], [39, 8, 11], [47, 4, 13], [55, 2, 9],
    [63, 7, 12], [70, 5, 15], [78, 1, 10], [86, 6, 13], [93, 3, 11], [10, 9, 16], [58, 10, 14],
];

function Skull({ mood, look }: { mood: Mood; look: { x: number; y: number } }) {
    const closed = mood === 'password';
    const angry = mood === 'error';
    const px = closed ? 0 : look.x * 5;
    const py = closed ? 0 : look.y * 3.2;
    const jawDrop = mood === 'pending' ? 10 : 0;
    const glow = angry ? 'url(#hwl-glow-red)' : 'url(#hwl-glow)';
    return (
        <svg className={`hwl-jack hwl-skull ${mood === 'pending' ? 'hwl-jack--lit' : ''} ${angry ? 'hwl-jack--sad' : ''}`} viewBox="-62 -68 124 140" aria-hidden="true">
            <defs>
                <radialGradient id="hwl-bone" cx="42%" cy="26%" r="82%">
                    <stop offset="0" stopColor="#e8dfc4" /><stop offset=".4" stopColor="#c7b890" /><stop offset=".75" stopColor="#857552" /><stop offset="1" stopColor="#3a3124" />
                </radialGradient>
                <radialGradient id="hwl-jawbone" cx="45%" cy="5%" r="95%">
                    <stop offset="0" stopColor="#bfae86" /><stop offset=".6" stopColor="#7d6e50" /><stop offset="1" stopColor="#2e271c" />
                </radialGradient>
                <linearGradient id="hwl-under" x1="0" y1="0" x2="0" y2="1">
                    <stop offset=".35" stopColor="#1a0f08" stopOpacity="0" /><stop offset="1" stopColor="#1a0f08" stopOpacity=".55" />
                </linearGradient>
                <radialGradient id="hwl-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0" stopColor="#fff1b8" /><stop offset=".25" stopColor="#ff9a1f" /><stop offset=".6" stopColor="#ff4d00" stopOpacity=".6" /><stop offset="1" stopColor="#ff3d00" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="hwl-glow-red" cx="50%" cy="50%" r="50%">
                    <stop offset="0" stopColor="#ffd6d6" /><stop offset=".25" stopColor="#ff2a2a" /><stop offset=".6" stopColor="#a30000" stopOpacity=".65" /><stop offset="1" stopColor="#5c0000" stopOpacity="0" />
                </radialGradient>
                <filter id="hwl-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
                <filter id="hwl-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" /></filter>
                <clipPath id="hwl-eye-l"><path d={EYE_L} /></clipPath>
                <clipPath id="hwl-eye-r"><path d={EYE_R} /></clipPath>
                <clipPath id="hwl-head"><path d={CRANIUM} /></clipPath>
            </defs>

            <ellipse cx="0" cy="68" rx="42" ry="5" fill="#000" opacity=".6" />

            {/* Mandíbula articulada, detrás del cráneo */}
            <g className="hwl-jaw" style={{ transform: `translateY(${jawDrop}px)` }}>
                <path d={JAW} fill="url(#hwl-jawbone)" stroke="#1c160f" strokeWidth=".8" />
                <path d="M-20 39H20L18 46H-18Z" fill="#0a0605" />
                <g fill="#d9cba6" stroke="#4a3f2e" strokeWidth=".5">
                    <path d="M-17.5 39h4.200l-.6 6.400h-3z" /><path d="M-12.6 39h4.400l-.4 8h-3.600z" /><path d="M-7.4 39h4.200l-.2 7.200h-3.800z" />
                    <path d="M3.4 39h4.400l-.4 8.200h-3.800z" /><path d="M8.6 39h4.200l-.6 6.800h-3.400z" /><path d="M13.6 39h4l-1.2 5.400h-2.400z" />
                    <path d="M-2.4 39h4.600l-1.6 4.400h-1.800z" />
                </g>
                <path d="M-22 48C-16 56-8 59 0 59S16 56 22 48" fill="none" stroke="#1c160f" strokeOpacity=".6" strokeWidth="1" />
            </g>

            {/* Cráneo con sombras: sienes hundidas, luz desde arriba y oscuridad hacia abajo */}
            <path d={CRANIUM} fill="url(#hwl-bone)" stroke="#1c160f" strokeWidth=".9" />
            <g clipPath="url(#hwl-head)">
                <path d={CRANIUM} fill="url(#hwl-under)" />
                <ellipse cx="-44" cy="0" rx="10" ry="20" fill="#1a0f08" opacity=".55" filter="url(#hwl-soft)" />
                <ellipse cx="44" cy="0" rx="10" ry="20" fill="#1a0f08" opacity=".55" filter="url(#hwl-soft)" />
                <ellipse cx="-14" cy="-44" rx="13" ry="6" fill="#fff6dc" opacity=".16" transform="rotate(-18 -14 -44)" />
                <path d={EYE_L} fill="none" stroke="#120a06" strokeWidth="9" opacity=".55" filter="url(#hwl-soft)" />
                <path d={EYE_R} fill="none" stroke="#120a06" strokeWidth="9" opacity=".55" filter="url(#hwl-soft)" />
                <path d="M-30 16C-24 22-16 24-9 21M30 16C24 22 16 24 9 21" fill="none" stroke="#2e2116" strokeOpacity=".55" strokeWidth="2.4" strokeLinecap="round" filter="url(#hwl-blur)" />
            </g>
            {/* Grietas */}
            <path d="M10-59L6-47 12-41 6-31 10-24M6-47L-1-44M12-41L19-38 22-31" fill="none" stroke="#1a120b" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M-40-26L-34-22-37-15-33-10" fill="none" stroke="#1a120b" strokeWidth=".8" strokeLinecap="round" />

            {/* Cuencas profundas con un brillo espectral diminuto que sigue el cursor */}
            <path d={EYE_L} fill="#050305" stroke="#120a06" strokeWidth="1" />
            <path d={EYE_R} fill="#050305" stroke="#120a06" strokeWidth="1" />
            {([['l', -19], ['r', 19]] as const).map(([side, cx]) => (
                <g key={side} clipPath={`url(#hwl-eye-${side})`}>
                    <g className="hwl-eyeglow" style={{ opacity: closed ? 0 : 1 }}>
                        <circle className="hwl-pupil" cx={cx + px} cy={-3 + py} r="8" fill={glow} filter="url(#hwl-blur)" />
                        <circle className="hwl-pupil" cx={cx + px} cy={-3 + py} r="2.2" fill={angry ? '#ff5050' : '#ffc24a'} />
                        <circle className="hwl-pupil" cx={cx + px} cy={-3 + py} r=".8" fill="#fffbe8" />
                    </g>
                    {/* Sombra que cae y apaga la mirada */}
                    <rect className="hwl-lid" x={cx - 18} y={-42} width="36" height="26" fill="#030203" style={{ transform: `translateY(${closed ? 26 : 0}px)` }} />
                </g>
            ))}

            {/* Cavidad nasal */}
            <path d="M0 9L-7.5 23Q-5 26.5-1.5 23.5L0 21 1.5 23.5Q5 26.5 7.5 23Z" fill="#050305" stroke="#1a120b" strokeWidth=".8" strokeLinejoin="round" />
            {/* Dientes superiores: largos, gastados, con uno que falta */}
            <path d="M-21 30H21V39.500H-21Z" fill="#0a0605" />
            <g fill="#e2d5b1" stroke="#4a3f2e" strokeWidth=".5">
                <path d="M-20 30h4.400l-.4 7.4-3.6-.8z" /><path d="M-15 30h4.600v9.800h-4.200z" /><path d="M-9.8 30h4.600l-.4 11h-3.800z" />
                <path d="M-4.6 30h4.400v10.200l-2 .8-2.2-1z" /><path d="M5.6 30h4.600l-.2 11.400h-4z" />
                <path d="M10.8 30h4.400l-.4 9.200h-4z" /><path d="M15.8 30h4.200l-.6 7.2-3.4.6z" />
            </g>
            <path d="M5.6 30l1.4 3" stroke="#4a3f2e" strokeWidth=".6" />
        </svg>
    );
}

function SubmitSpell({ onPending }: { onPending: (p: boolean) => void }) {
    const { pending } = useFormStatus();
    useEffect(() => { onPending(pending); }, [pending, onPending]);
    return (
        <button formAction={login} disabled={pending} className="hwl-btn">
            {pending ? <><Loader2 className="w-5 h-5 animate-spin" /> Conjurando…</> : <>Ingresar <span aria-hidden="true">💀</span></>}
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
                {/* La calavera guardiana */}
                <div className="hwl-guard" ref={jackRef}>
                    <p className="hwl-bubble" key={mood} role="status">{LINES[mood]}</p>
                    <Skull mood={mood} look={focus === 'email' ? formLook : look} />
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
