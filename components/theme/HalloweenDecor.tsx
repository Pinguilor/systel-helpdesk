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

const glowFace = (
    <g fill="#ffd54a">
        <path d="M-9 -6l5 -6 5 6z" transform="translate(0 4)" />
        <path d="M4 -6l5 -6 5 6z" transform="translate(0 4)" />
        <path d="M-2 4l3 -4 3 4z" transform="translate(0 4)" />
        <path d="M-12 12q12 12 24 0l-4 -3 -3 3 -3 -3 -3 3 -3 -3 -3 3z" transform="translate(0 4)" />
    </g>
);

/** Grupo de calabazas con hojas de otoño, apoyado sobre el borde superior del panel (posición absoluta). */
export function PumpkinPatch({ className = '' }: { className?: string }) {
    if (!isHalloween) return null;
    return (
        <svg className={`hw-patch ${className}`} viewBox="0 0 220 100" aria-hidden="true">
            <defs>
                <radialGradient id="hwPk" cx="50%" cy="40%" r="65%">
                    <stop offset="0" stopColor="#ff9a2e" />
                    <stop offset=".6" stopColor="#f26a00" />
                    <stop offset="1" stopColor="#a63d00" />
                </radialGradient>
            </defs>
            {/* hojas */}
            <g opacity=".95">
                <path d="M14 92c6-16 20-22 34-22-2 14-16 26-34 22z" fill="#b8460a" />
                <path d="M40 96c2-14 12-24 26-26 2 12-8 24-26 26z" fill="#d97706" />
                <path d="M170 94c-2-14-12-24-26-26-2 12 8 24 26 26z" fill="#c2410c" />
                <path d="M200 90c-6-16-20-22-34-22 2 14 16 26 34 22z" fill="#a3330a" />
                <path d="M96 98c0-10 4-18 14-22 2 10-4 18-14 22z" fill="#e08a1a" />
            </g>
            {/* calabaza izquierda */}
            <g transform="translate(58 62)">
                <ellipse cx="-12" cy="0" rx="17" ry="22" fill="url(#hwPk)" />
                <ellipse cx="12" cy="0" rx="17" ry="22" fill="url(#hwPk)" />
                <ellipse cx="0" cy="0" rx="15" ry="24" fill="url(#hwPk)" />
                <path d="M0 -24c0-6 2-9 6-11" stroke="#4d7c0f" strokeWidth="3" strokeLinecap="round" fill="none" />
                <g transform="scale(.8)">{glowFace}</g>
            </g>
            {/* calabaza central (grande) */}
            <g transform="translate(112 52)">
                <ellipse cx="-18" cy="2" rx="26" ry="32" fill="url(#hwPk)" />
                <ellipse cx="18" cy="2" rx="26" ry="32" fill="url(#hwPk)" />
                <ellipse cx="0" cy="2" rx="23" ry="35" fill="url(#hwPk)" />
                <path d="M0 -33c0-8 3-12 8-14" stroke="#4d7c0f" strokeWidth="4" strokeLinecap="round" fill="none" />
                <g transform="scale(1.25) translate(0 1)">{glowFace}</g>
            </g>
            {/* calabaza derecha (sin cara) */}
            <g transform="translate(166 72)">
                <ellipse cx="-9" cy="0" rx="13" ry="17" fill="url(#hwPk)" />
                <ellipse cx="9" cy="0" rx="13" ry="17" fill="url(#hwPk)" />
                <ellipse cx="0" cy="0" rx="11" ry="18" fill="url(#hwPk)" />
                <path d="M0 -18c0-5 2-8 5-9" stroke="#4d7c0f" strokeWidth="3" strokeLinecap="round" fill="none" />
            </g>
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
