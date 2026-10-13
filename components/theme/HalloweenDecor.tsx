import { isHalloween } from '@/lib/theme';

/* Decoraciones de Halloween. Todas son puramente visuales:
   aria-hidden, pointer-events: none y sin cambiar el layout.
   Con el tema apagado devuelven null. */

const bat = (
    <>
        <path d="M60 20L63 9 66 18C72 17 80 18 88 12 98 6 108 6 118 14 110 14 106 18 105 25 100 21 96 21 92 26 90 22 85 22 82 27 79 23 74 25 72 31 69 37 65 45 60 53z" />
        <path d="M60 20L63 9 66 18C72 17 80 18 88 12 98 6 108 6 118 14 110 14 106 18 105 25 100 21 96 21 92 26 90 22 85 22 82 27 79 23 74 25 72 31 69 37 65 45 60 53z" transform="matrix(-1 0 0 1 120 0)" />
    </>
);

/** Capa fija de fondo: murciélagos, neblina y telarañas grandes en las esquinas de la pantalla. */
export function HalloweenBackdrop() {
    if (!isHalloween) return null;
    return (
        <div className="hw-backdrop" aria-hidden="true">
            <span className="hw-fog hw-fog-l" />
            <span className="hw-fog hw-fog-r" />
            {[1, 2, 3, 4, 5].map((n) => (
                <svg key={n} className={`hw-bat hw-bat-${n}`} viewBox="0 0 120 60" fill="currentColor">{bat}</svg>
            ))}
            <span className="hw-screen-web hw-screen-web-tl" />
            <span className="hw-screen-web hw-screen-web-tr" />
            <span className="hw-screen-web hw-screen-web-bl" />
            <span className="hw-screen-web hw-screen-web-br" />
        </div>
    );
}

/* ---- Calabazas y hojas (SVG): gomos con sombreado, tallo con zarcillo, cara encendida ---- */
const LOBES: [number, number, number][] = [
    [-33, 17, 33], [33, 17, 33], [-17, 21, 38], [17, 21, 38], [0, 22, 40],
];

function Pumpkin3D({ face = false, id, uid }: { face?: boolean; id: string; uid: string }) {
    const clip = `hwClip${uid}`;
    return (
        <g>
            {/* sombra de contacto + charco de luz de la vela en el suelo */}
            <ellipse cx="4" cy="41" rx="52" ry="8" fill="#000" opacity=".6" filter="url(#hwShadow)" />
            {face && <ellipse cx="0" cy="42" rx="64" ry="10" fill="#ff7a00" opacity=".28" filter="url(#hwPool)" />}
            <clipPath id={clip}>
                {LOBES.map(([cx, rx, ry], i) => <ellipse key={i} cx={cx} cy="2" rx={rx} ry={ry} />)}
            </clipPath>
            {LOBES.map(([cx, rx, ry], i) => (
                <ellipse key={i} cx={cx} cy="2" rx={rx} ry={ry} fill={`url(#hwPk${i < 2 ? 'Dark' : i < 4 ? 'Mid' : 'Lite'})`} stroke="#7a2c00" strokeOpacity=".7" strokeWidth="1.3" />
            ))}
            {/* volumen: oscurece bordes y base, luz suave arriba a la izquierda */}
            <g clipPath={`url(#${clip})`}>
                <rect x="-60" y="-50" width="120" height="100" fill="url(#hwEdge)" />
                <rect x="-60" y="-50" width="120" height="100" fill="url(#hwBase)" />
                {face && <rect x="-60" y="-50" width="120" height="100" fill="url(#hwInner)" />}
                <ellipse cx="-14" cy="-18" rx="8" ry="17" fill="#fff" opacity=".2" transform="rotate(14 -14 -18)" filter="url(#hwBlurB)" />
                {/* sombras entre gomos */}
                <path d="M-17 -34Q-23 2 -17 38M17 -34Q23 2 17 38M-33 -28Q-40 2 -33 32M33 -28Q40 2 33 32" stroke="#4a1700" strokeOpacity=".35" strokeWidth="2.4" fill="none" filter="url(#hwBlurB)" />
            </g>
            {/* sombra del tallo sobre la calabaza */}
            <ellipse cx="2" cy="-31" rx="9" ry="3.5" fill="#2a0d00" opacity=".45" filter="url(#hwBlurB)" />
            <path d="M-4 -37c-1-7 0-11 3-14l7 1c-1 4-1 9 0 13z" fill="#5b3a12" stroke="#3a2408" strokeWidth="1" />
            <path d="M5 -45c10-4 18 0 16 8-1 4-6 5-8 2" fill="none" stroke="#5aa616" strokeWidth="2.2" strokeLinecap="round" />
            {face && (
                <g>
                    <g fill="#ffb300" opacity=".75" filter={`url(#${id})`}>
                        <path d="M-28 -6L-11 -10 -19 -24z" /><path d="M28 -6L11 -10 19 -24z" /><path d="M0 -1L-7 11 7 11z" />
                        <path d="M-31 14Q0 42 31 14L25 11 19 20 11 12 0 22-11 12-19 20-25 11z" />
                    </g>
                    <g fill="url(#hwFace)" stroke="#5a1f00" strokeWidth="1.2" strokeLinejoin="round">
                        <path d="M-28 -6L-11 -10 -19 -24z" /><path d="M28 -6L11 -10 19 -24z" /><path d="M0 -1L-7 11 7 11z" />
                        <path d="M-31 14Q0 42 31 14L25 11 19 20 11 12 0 22-11 12-19 20-25 11z" />
                    </g>
                </g>
            )}
        </g>
    );
}

const LEAF = 'M0-21L4-11 13-15 9-5 20-4 11 4 17 13 6 10 3 21 0 15-3 21-6 10-17 13-11 4-20-4-9-5-13-15-4-11z';

function Leaf({ x, y, r, s = 1, c }: { x: number; y: number; r: number; s?: number; c: 'Red' | 'Amber' | 'Gold' }) {
    return (
        <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} filter="url(#hwLeafShadow)">
            <path d={LEAF} fill={`url(#hwLeaf${c})`} stroke="#5c1d02" strokeOpacity=".55" strokeWidth=".9" strokeLinejoin="round" />
            <path d="M0 22V-14M0 4L-9 -4M0 4L9 -4M0 -5L-6 -10M0 -5L6 -10" stroke="#5c1d02" strokeOpacity=".5" strokeWidth=".8" strokeLinecap="round" fill="none" />
        </g>
    );
}

/** Grupo de calabazas con hojas de otoño, apoyado sobre el borde superior del panel (posición absoluta). */
export function PumpkinPatch({ className = '' }: { className?: string }) {
    if (!isHalloween) return null;
    return (
        <svg className={`hw-patch ${className}`} viewBox="0 0 260 120" aria-hidden="true">
            <defs>
                <radialGradient id="hwPkLite" cx="45%" cy="35%" r="75%"><stop offset="0" stopColor="#ffb347" /><stop offset=".55" stopColor="#ff7a00" /><stop offset="1" stopColor="#b84300" /></radialGradient>
                <radialGradient id="hwPkMid" cx="45%" cy="35%" r="75%"><stop offset="0" stopColor="#ff9d2e" /><stop offset=".55" stopColor="#f06400" /><stop offset="1" stopColor="#9c3700" /></radialGradient>
                <radialGradient id="hwPkDark" cx="45%" cy="35%" r="75%"><stop offset="0" stopColor="#f58a1f" /><stop offset=".55" stopColor="#d65500" /><stop offset="1" stopColor="#7a2c00" /></radialGradient>
                <radialGradient id="hwFace" cx="50%" cy="45%" r="70%"><stop offset="0" stopColor="#fff6b8" /><stop offset=".6" stopColor="#ffc933" /><stop offset="1" stopColor="#ff8a00" /></radialGradient>
                <linearGradient id="hwLeafRed" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#8f1d0a" /><stop offset="1" stopColor="#e8420f" /></linearGradient>
                <linearGradient id="hwLeafAmber" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#b8470a" /><stop offset="1" stopColor="#ff9a1f" /></linearGradient>
                <linearGradient id="hwLeafGold" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#c27a0a" /><stop offset="1" stopColor="#ffd23f" /></linearGradient>
                <linearGradient id="hwEdge" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#3a1000" stopOpacity=".6" /><stop offset=".22" stopColor="#3a1000" stopOpacity="0" />
                    <stop offset=".72" stopColor="#3a1000" stopOpacity="0" /><stop offset="1" stopColor="#2a0a00" stopOpacity=".7" />
                </linearGradient>
                <linearGradient id="hwBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset=".55" stopColor="#2a0a00" stopOpacity="0" /><stop offset="1" stopColor="#2a0a00" stopOpacity=".55" />
                </linearGradient>
                <radialGradient id="hwInner" cx="50%" cy="48%" r="45%"><stop offset="0" stopColor="#ffd060" stopOpacity=".38" /><stop offset="1" stopColor="#ff8a00" stopOpacity="0" /></radialGradient>
                <filter id="hwShadow" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="4" /></filter>
                <filter id="hwPool" x="-30%" y="-150%" width="160%" height="400%"><feGaussianBlur stdDeviation="6" /></filter>
                <filter id="hwLeafShadow" x="-40%" y="-40%" width="190%" height="190%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" floodColor="#000" floodOpacity=".55" /></filter>
                <filter id="hwBlurA" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" /></filter>
                <filter id="hwBlurB" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5" /></filter>
            </defs>
            {/* hojas al fondo */}
            <Leaf x={22} y={100} r={-38} s={1.1} c="Red" />
            <Leaf x={56} y={108} r={14} s={.9} c="Gold" />
            <Leaf x={236} y={102} r={40} s={1.1} c="Amber" />
            {/* calabaza izquierda */}
            <g transform="translate(70 76) scale(.62)"><Pumpkin3D face id="hwBlurB" uid="L" /></g>
            {/* calabaza derecha */}
            <g transform="translate(200 90) scale(.5) rotate(8)"><Pumpkin3D id="hwBlurB" uid="R" /></g>
            {/* calabaza central */}
            {/* sombra que proyecta la calabaza grande sobre las vecinas */}
            <ellipse cx="132" cy="70" rx="58" ry="34" fill="#1a0600" opacity=".55" filter="url(#hwShadow)" />
            <g transform="translate(132 64) scale(.95)"><Pumpkin3D face id="hwBlurA" uid="C" /></g>
            {/* hojas al frente */}
            <Leaf x={104} y={110} r={-20} s={.9} c="Amber" />
            <Leaf x={166} y={110} r={26} s={.85} c="Red" />
            <Leaf x={36} y={114} r={64} s={.7} c="Amber" />
            <Leaf x={222} y={114} r={-50} s={.7} c="Gold" />
        </svg>
    );
}

/** Sombrero de bruja para la campana (posición absoluta; el padre debe ser `relative`). */
export function WitchHat({ className = '' }: { className?: string }) {
    if (!isHalloween) return null;
    return (
        <svg className={`hw-witchhat ${className}`} viewBox="0 0 40 36" aria-hidden="true">
            <path d="M8 26c4-2 8-3 12-3s9 1 13 3c-2 4-7 6-13 6S10 30 8 26z" fill="#4c1d95" stroke="#9d4edd" strokeWidth="1" />
            <path d="M14 24c2-8 4-16 9-22 1 8 2 16 4 22-5 2-9 2-13 0z" fill="#3b0f7a" stroke="#9d4edd" strokeWidth="1" />
            <path d="M14.5 21c4 2 8 2 12 0l.6 3c-4 2-9 2-13.2 0z" fill="#ff6d00" />
            <path d="M23 2c2-1 5 0 6 3" stroke="#9d4edd" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
    );
}

/** Jack-o'-lantern pequeña (posición absoluta; el padre debe ser `relative`). */
export function Pumpkin({ className = '' }: { className?: string }) {
    if (!isHalloween) return null;
    return (
        <svg className={`hw-pumpkin ${className}`} viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 6c0-2 1-3.5 3-4" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" fill="none" />
            <ellipse cx="10" cy="19" rx="8" ry="10" fill="#e85d04" />
            <ellipse cx="22" cy="19" rx="8" ry="10" fill="#e85d04" />
            <ellipse cx="16" cy="19" rx="7" ry="11" fill="#ff6d00" />
            <path className="hw-pumpkin-face" d="M9 15l4 4-8 0zM23 15l4 4-8 0zM10 24l3 2 3-2 3 2 3-2 0 2-3 3-3-2-3 2-3-3z" fill="#2b1000" transform="translate(-1 0) scale(1.03)" />
        </svg>
    );
}

/** Araña colgando de un hilo (posición absoluta; el padre debe ser `relative`). */
export function HangingSpider({ className = '' }: { className?: string }) {
    if (!isHalloween) return null;
    return (
        <svg className={`hw-spider-hang ${className}`} viewBox="0 0 24 44" aria-hidden="true">
            <line x1="12" y1="0" x2="12" y2="28" stroke="#b9a3e3" strokeOpacity=".55" strokeWidth="1" />
            <g stroke="#cbb8f2" strokeWidth="1.2" strokeLinecap="round" fill="none">
                <path d="M9 32l-6-4M9 34l-7 1M9 37l-6 5M15 32l6-4M15 34l7 1M15 37l6 5" />
            </g>
            <ellipse cx="12" cy="33" rx="4.2" ry="5" fill="#2a1747" stroke="#9d4edd" strokeWidth="1" />
            <circle cx="10.6" cy="31.6" r=".9" fill="#ff6d00" />
            <circle cx="13.4" cy="31.6" r=".9" fill="#ff6d00" />
        </svg>
    );
}

/** Araña diminuta para la tarjeta "Pendientes". */
export function TinySpider({ className = '' }: { className?: string }) {
    if (!isHalloween) return null;
    return (
        <svg className={`hw-spider-tiny ${className}`} viewBox="0 0 24 24" aria-hidden="true">
            <g stroke="#ffb27a" strokeWidth="1.3" strokeLinecap="round" fill="none">
                <path d="M9 11l-6-5M9 13l-7 0M9 15l-6 5M15 11l6-5M15 13l7 0M15 15l6 5" />
            </g>
            <ellipse cx="12" cy="14" rx="4" ry="4.8" fill="#2a1747" stroke="#ff6d00" strokeWidth="1.2" />
            <circle cx="12" cy="8.8" r="2.4" fill="#2a1747" stroke="#ff6d00" strokeWidth="1.2" />
        </svg>
    );
}
