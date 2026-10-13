import { isHalloween } from '@/lib/theme';

/* Decoraciones de Halloween. Todas son puramente visuales:
   aria-hidden, pointer-events: none y sin cambiar el layout.
   Con el tema apagado devuelven null. */

const bat = (
    <path d="M60 14l-4-8-3 9c-8-6-20-9-33-6-10 2-17 7-20 13 7-3 13-2 17 2 3 3 4 7 3 11 5-5 11-6 16-3 4 2 6 6 6 10 4-5 9-7 14-5 2 1 3 3 4 6 1-3 2-5 4-6 5-2 10 0 14 5 0-4 2-8 6-10 5-3 11-2 16 3-1-4 0-8 3-11 4-4 10-5 17-2-3-6-10-11-20-13-13-3-25 0-33 6l-3-9z" />
);

/** Capa fija de fondo: neblina, bandada de murciélagos y telarañas en las esquinas de la pantalla. */
export function HalloweenBackdrop() {
    if (!isHalloween) return null;
    return (
        <div className="hw-backdrop" aria-hidden="true">
            <span className="hw-haze" />
            <span className="hw-mist" />
            <span className="hw-fog hw-fog-1" />
            <span className="hw-fog hw-fog-2" />
            <span className="hw-fog hw-fog-3" />
            <span className="hw-fog hw-fog-4" />
            {[1, 2, 3, 4, 5, 6].map((n) => (
                <span key={n} className={`hw-bat hw-bat-${n}`}>
                    <svg viewBox="0 0 120 60" fill="currentColor">{bat}</svg>
                </span>
            ))}
            <span className="hw-screen-web hw-screen-web-tl" />
            <span className="hw-screen-web hw-screen-web-tr" />
            <span className="hw-screen-web hw-screen-web-bl" />
            <span className="hw-screen-web hw-screen-web-br" />
        </div>
    );
}

/** Jack-o'-lantern pequeña en línea, para usar como icono de una pestaña. */
export function PumpkinIcon({ className = '' }: { className?: string }) {
    if (!isHalloween) return null;
    return (
        <svg className={`hw-pumpkin-ico ${className}`} viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 8c0-2.5 1-4.5 3.5-5" stroke="#5b8c2a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <ellipse cx="9.5" cy="19" rx="7.5" ry="10" fill="#e85d04" />
            <ellipse cx="22.5" cy="19" rx="7.5" ry="10" fill="#e85d04" />
            <ellipse cx="16" cy="19" rx="7" ry="11" fill="#ff7a1a" />
            <path d="M8 15l4.5 4h-7zM24 15l2.5 4h-7zM7 22l3 2 3-2 3 2 3-2 3 2 3-2-1 3-3 2.5-2-1.5-3 2-3-2-2 1.5-3-2.5z" fill="#ffe08a" />
        </svg>
    );
}

// Hoja de arce (punta hacia arriba, tallo en 0,20) y sus nervaduras
const mapleLeaf = "M0 20L-1.5 9C-6 12-11 13-15 12L-13 9-21 3-17 1.5-20-6-13-5-12-9-6-3-8-17-4-15 0-23 4-15 8-17 6-3 12-9 13-5 20-6 17 1.5 21 3 13 9 15 12C11 13 6 12 1.5 9Z";
const mapleVeins = "M0 12V-20M0 8L-17-4M0 8L17-4M0 10L-12 10M0 10L12 10M0 2L-7-14M0 2L7-14";

function Leaf({ x, y, s, r, tone }: { x: number; y: number; s: number; r: number; tone: 'amber' | 'orange' | 'red' }) {
    return (
        <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
            <path d={mapleLeaf} fill={`url(#hw-leaf-${tone})`} stroke="#431407" strokeOpacity=".45" strokeWidth=".8" strokeLinejoin="round" />
            <path d={mapleVeins} fill="none" stroke="#431407" strokeOpacity=".4" strokeWidth=".7" strokeLinecap="round" />
        </g>
    );
}

// Caras talladas (coordenadas locales de la calabaza). evenodd deja los dientes sin recortar.
const FACES = {
    wicked: "M-23-9L-8-4-11 5Q-19 4-23-9ZM23-9L8-4 11 5Q19 4 23-9ZM0-1L4 6H-4ZM-27 9Q-14 15-10 13L-7 18-3 14H3L7 18 10 13Q14 15 27 9 21 25 0 26-21 25-27 9ZM-15 23.500L-12 18-9 24.500ZM9 24.500L12 18 15 23.500Z",
    happy: "M-19-4L-8-4-13.5-14ZM19-4L8-4 13.5-14ZM0 0L3.5 5H-3.500ZM-22 8Q-12 13-8 12L-5 16-2 12H2L5 16 8 12Q12 13 22 8 16 24 0 24-16 24-22 8Z",
    spooked: "M-13-13A5.5 6.5 0 1 0-12.99-13ZM13-13A5.5 6.5 0 1 0 13.01-13ZM0 1L3 6H-3ZM-14 11Q0 6 14 11 10 25 0 25-10 25-14 11ZM-4 9.500L0 15 4 9.500Z",
};

function Jack({ x, y, s, face }: { x: number; y: number; s: number; face: keyof typeof FACES }) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
            <ellipse cx="0" cy="29" rx="40" ry="5.5" fill="#000" opacity=".5" />
            {/* Tallo y zarcillo */}
            <path d="M-5-22C-6-31-3-39 6-43L11-37C6-35 4-30 5-22Z" fill="url(#hw-pk-stem)" stroke="#2f3f12" strokeWidth=".8" />
            <path d="M-2-24C-3-31 0-37 6-40" fill="none" stroke="#a3c75a" strokeOpacity=".6" strokeWidth="1" strokeLinecap="round" />
            <path d="M5-31c8-3 14 1 12 6-2 4-8 2-6-2 1-2 4-2 5 0" fill="none" stroke="#5b8c2a" strokeWidth="1.3" strokeLinecap="round" />
            {/* Gajos: cada uno con su propio degradado para marcar los surcos */}
            <ellipse cx="-27" cy="4" rx="11.5" ry="20" fill="url(#hw-pk-outer)" />
            <ellipse cx="27" cy="4" rx="11.5" ry="20" fill="url(#hw-pk-outer)" />
            <ellipse cx="-15" cy="2" rx="14" ry="25" fill="url(#hw-pk-mid)" />
            <ellipse cx="15" cy="2" rx="14" ry="25" fill="url(#hw-pk-mid)" />
            <ellipse cx="0" cy="1.5" rx="12.5" ry="27" fill="url(#hw-pk-core)" />
            <ellipse cx="0" cy="-23.5" rx="8" ry="2.5" fill="#7c2d12" opacity=".6" />
            {/* Brillos */}
            <ellipse cx="-19" cy="-11" rx="2.6" ry="8" fill="#fff" opacity=".3" transform="rotate(16 -19 -11)" />
            <ellipse cx="-3.5" cy="-15" rx="1.8" ry="6" fill="#fff" opacity=".22" transform="rotate(6 -3.5 -15)" />
            <ellipse cx="-30" cy="-2" rx="1.5" ry="5" fill="#fff" opacity=".18" transform="rotate(14 -30 -2)" />
            {/* Cara: halo de la vela, borde tallado y fuego */}
            <g className="hw-patch-glow">
                <path d={FACES[face]} fillRule="evenodd" fill="#ffae1a" opacity=".9" filter="url(#hw-pk-blur)" />
                <path d={FACES[face]} fillRule="evenodd" fill="url(#hw-pk-fire)" stroke="#7c2d12" strokeWidth="1.4" strokeLinejoin="round" paintOrder="stroke" />
            </g>
        </g>
    );
}

/** Tres calabazas talladas con hojas de arce, apoyadas sobre el borde superior de un panel (el padre debe ser `relative`). */
export function PumpkinPatch() {
    if (!isHalloween) return null;
    return (
        <svg className="hw-patch" viewBox="0 0 260 122" aria-hidden="true">
            <defs>
                <radialGradient id="hw-pk-core" cx="42%" cy="24%" r="85%">
                    <stop offset="0" stopColor="#ffc46b" /><stop offset=".45" stopColor="#ff8a1f" /><stop offset=".85" stopColor="#d9530c" /><stop offset="1" stopColor="#9a3a0b" />
                </radialGradient>
                <radialGradient id="hw-pk-mid" cx="40%" cy="24%" r="85%">
                    <stop offset="0" stopColor="#ffab4a" /><stop offset=".5" stopColor="#f47312" /><stop offset=".88" stopColor="#c2470c" /><stop offset="1" stopColor="#84300b" />
                </radialGradient>
                <radialGradient id="hw-pk-outer" cx="45%" cy="26%" r="85%">
                    <stop offset="0" stopColor="#f08a2c" /><stop offset=".55" stopColor="#cf520d" /><stop offset="1" stopColor="#6b2409" />
                </radialGradient>
                <radialGradient id="hw-pk-fire" cx="50%" cy="62%" r="70%">
                    <stop offset="0" stopColor="#fffbe0" /><stop offset=".45" stopColor="#ffd34d" /><stop offset="1" stopColor="#ff8a00" />
                </radialGradient>
                <radialGradient id="hw-pk-halo" cx="50%" cy="50%" r="50%">
                    <stop offset="0" stopColor="#ff7a1a" stopOpacity=".5" /><stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="hw-pk-stem" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#8aa83a" /><stop offset=".6" stopColor="#4d6b1f" /><stop offset="1" stopColor="#2f3f12" />
                </linearGradient>
                <linearGradient id="hw-leaf-amber" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fde68a" /><stop offset=".5" stopColor="#f59e0b" /><stop offset="1" stopColor="#b45309" />
                </linearGradient>
                <linearGradient id="hw-leaf-orange" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fdba74" /><stop offset=".5" stopColor="#ea580c" /><stop offset="1" stopColor="#7c2d12" />
                </linearGradient>
                <linearGradient id="hw-leaf-red" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fca5a5" /><stop offset=".45" stopColor="#dc2626" /><stop offset="1" stopColor="#7f1d1d" />
                </linearGradient>
                <filter id="hw-pk-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6" /></filter>
            </defs>
            <ellipse className="hw-patch-glow" cx="130" cy="82" rx="124" ry="40" fill="url(#hw-pk-halo)" />
            {/* Hojas detrás */}
            <Leaf x={22} y={84} s={0.6} r={-62} tone="orange" />
            <Leaf x={238} y={80} s={0.62} r={70} tone="amber" />
            <Leaf x={92} y={50} s={0.42} r={-28} tone="red" />
            <Leaf x={172} y={56} s={0.4} r={36} tone="orange" />
            <Jack x={200} y={90} s={0.72} face="spooked" />
            <Jack x={58} y={86} s={0.86} face="happy" />
            <Jack x={130} y={74} s={1.25} face="wicked" />
            {/* Hojas delante, sobre el borde del panel */}
            <Leaf x={24} y={108} s={0.72} r={-38} tone="amber" />
            <Leaf x={88} y={112} s={0.5} r={24} tone="red" />
            <Leaf x={166} y={112} s={0.55} r={-18} tone="amber" />
            <Leaf x={232} y={108} s={0.7} r={48} tone="red" />
            <Leaf x={250} y={114} s={0.4} r={-25} tone="orange" />
            <Leaf x={6} y={114} s={0.4} r={30} tone="orange" />
        </svg>
    );
}

/** Sombrero de bruja ladeado sobre un botón (posición absoluta; el padre debe ser `relative`). */
export function WitchHat({ className = '' }: { className?: string }) {
    if (!isHalloween) return null;
    return (
        <svg className={`hw-hat ${className}`} viewBox="0 0 32 32" aria-hidden="true">
            <path d="M17 2c3 1 5 3 6 6l-3-1 4 15H8z" fill="#5b21b6" />
            <path d="M17 2c3 1 5 3 6 6l-3-1 1 4-6-4z" fill="#7c3aed" />
            <path d="M9.2 18.500h13.8l1 3.5H8z" fill="#ff7a1a" />
            <rect x="14" y="18" width="4.5" height="4.5" rx=".8" fill="none" stroke="#ffd27a" strokeWidth="1.3" />
            <ellipse cx="16" cy="24" rx="14.5" ry="4" fill="#3b1a7a" />
            <ellipse cx="16" cy="23.2" rx="9" ry="2" fill="#2a1158" />
        </svg>
    );
}

/** Araña para la tarjeta "Pendientes". */
export function TinySpider({ className = '' }: { className?: string }) {
    if (!isHalloween) return null;
    return (
        <svg className={`hw-spider-tiny ${className}`} viewBox="0 0 24 24" aria-hidden="true">
            <g stroke="#ff8a3d" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path d="M9 11L5 8 3 3M9 13l-5 0-3 3M9 15l-4 3-1 4M15 11l4-3 2-5M15 13l5 0 3 3M15 15l4 3 1 4" />
            </g>
            <ellipse cx="12" cy="14.5" rx="4.2" ry="5" fill="#ff6d00" />
            <circle cx="12" cy="8.8" r="2.6" fill="#ff8a3d" />
            <circle cx="11" cy="8.2" r=".6" fill="#1a0b00" />
            <circle cx="13" cy="8.2" r=".6" fill="#1a0b00" />
        </svg>
    );
}
