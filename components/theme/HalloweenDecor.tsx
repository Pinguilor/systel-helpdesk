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

const leaf = "M0 0c-1-5-5-6-9-5 2-2 2-5-1-8 4 1 6-1 7-5 1 3 3 4 6 2-1 4 0 6 4 7-4 1-6 3-5 7-1-1-2 0-2 2z";

function Jack({ x, y, s, flip = false }: { x: number; y: number; s: number; flip?: boolean }) {
    return (
        <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
            <ellipse cx="0" cy="27" rx="34" ry="5" fill="#000" opacity=".45" />
            <path d="M-2-27c-1-6 1-11 7-13l3 4c-4 1-5 5-4 9z" fill="#4d6b1f" />
            <ellipse cx="-22" cy="2" rx="14" ry="23" fill="url(#hw-pk-dark)" />
            <ellipse cx="22" cy="2" rx="14" ry="23" fill="url(#hw-pk-dark)" />
            <ellipse cx="-11" cy="1" rx="14" ry="26" fill="url(#hw-pk)" />
            <ellipse cx="11" cy="1" rx="14" ry="26" fill="url(#hw-pk)" />
            <ellipse cx="0" cy="1" rx="11" ry="27" fill="url(#hw-pk-light)" />
            <g className="hw-patch-glow" fill="url(#hw-pk-fire)">
                <path d="M-19-9l11 3-9 8zM19-9l-11 3 9 8zM0-2l4 6h-8z" />
                <path d="M-22 8c5 3 9 4 12 3l2 4 4-4h8l4 4 2-4c3 1 7 0 12-3-3 10-11 16-22 16s-19-6-22-16zm12 9l3-4 3 4zm14 0l3-4 3 4z" fillRule="evenodd" />
            </g>
        </g>
    );
}

/** Tres calabazas con hojas de otoño, apoyadas sobre el borde superior de un panel (el padre debe ser `relative`). */
export function PumpkinPatch() {
    if (!isHalloween) return null;
    return (
        <svg className="hw-patch" viewBox="0 0 220 112" aria-hidden="true">
            <defs>
                <radialGradient id="hw-pk" cx="40%" cy="30%" r="80%">
                    <stop offset="0" stopColor="#ffa238" /><stop offset=".55" stopColor="#f26a0a" /><stop offset="1" stopColor="#a8380a" />
                </radialGradient>
                <radialGradient id="hw-pk-light" cx="45%" cy="28%" r="80%">
                    <stop offset="0" stopColor="#ffb85c" /><stop offset=".6" stopColor="#fb7a14" /><stop offset="1" stopColor="#bf4a0c" />
                </radialGradient>
                <radialGradient id="hw-pk-dark" cx="50%" cy="30%" r="80%">
                    <stop offset="0" stopColor="#e2600c" /><stop offset="1" stopColor="#7c2d12" />
                </radialGradient>
                <radialGradient id="hw-pk-fire" cx="50%" cy="60%" r="70%">
                    <stop offset="0" stopColor="#fff6c2" /><stop offset=".5" stopColor="#ffc53d" /><stop offset="1" stopColor="#ff8a00" />
                </radialGradient>
                <radialGradient id="hw-pk-halo" cx="50%" cy="50%" r="50%">
                    <stop offset="0" stopColor="#ff7a1a" stopOpacity=".55" /><stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
                </radialGradient>
            </defs>
            <ellipse className="hw-patch-glow" cx="112" cy="70" rx="104" ry="42" fill="url(#hw-pk-halo)" />
            <g>
                <path d={leaf} fill="#c2410c" transform="translate(24 100) scale(1.5) rotate(-35)" />
                <path d={leaf} fill="#f59e0b" transform="translate(196 100) scale(1.6) rotate(40)" />
                <path d={leaf} fill="#9a3412" transform="translate(176 62) scale(1.4) rotate(20)" />
                <path d={leaf} fill="#ea580c" transform="translate(52 56) scale(1.2) rotate(-15)" />
            </g>
            <Jack x={168} y={78} s={0.62} flip />
            <Jack x={56} y={74} s={0.74} />
            <Jack x={112} y={58} s={1.05} />
            <g>
                <path d={leaf} fill="#f97316" transform="translate(84 106) scale(1.5) rotate(-60)" />
                <path d={leaf} fill="#b45309" transform="translate(146 107) scale(1.3) rotate(65)" />
                <path d={leaf} fill="#fbbf24" transform="translate(206 84) scale(1.1) rotate(75)" />
                <path d={leaf} fill="#dc2626" transform="translate(14 82) scale(1.1) rotate(-80)" />
            </g>
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
