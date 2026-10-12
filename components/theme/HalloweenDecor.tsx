import { isHalloween } from '@/lib/theme';

/* Decoraciones de Halloween. Todas son puramente visuales:
   aria-hidden, pointer-events: none y sin cambiar el layout.
   Con el tema apagado devuelven null. */

const bat = (
    <path d="M60 22c-4 0-6 5-9 5-4 0-6-6-14-9-10-4-22-1-33 8 8-1 14 1 17 6-5 0-9 3-11 8 7-3 13-2 17 3 4 5 8 6 12 2 3 3 5 9 5 13 0-4 2-10 5-13 4 4 8 3 12-2 4-5 10-6 17-3-2-5-6-8-11-8 3-5 9-7 17-6-11-9-23-12-33-8-8 3-10 9-14 9-3 0-5-5-9-5z" />
);

/** Capa fija de fondo: murciélagos lejanos + telarañas en las esquinas de la pantalla. */
export function HalloweenBackdrop() {
    if (!isHalloween) return null;
    return (
        <div className="hw-backdrop" aria-hidden="true">
            <svg className="hw-bat hw-bat-1" viewBox="0 0 120 60" fill="currentColor">{bat}</svg>
            <svg className="hw-bat hw-bat-2" viewBox="0 0 120 60" fill="currentColor">{bat}</svg>
            <svg className="hw-bat hw-bat-3" viewBox="0 0 120 60" fill="currentColor">{bat}</svg>
            <span className="hw-screen-web hw-screen-web-bl" />
            <span className="hw-screen-web hw-screen-web-br" />
        </div>
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
