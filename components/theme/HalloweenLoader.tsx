/* Contenido del LoopLoader en temporada de Halloween: calabaza que parpadea como vela,
   murciélagos orbitando, brasas que suben y luna de fondo. Solo apariencia: el
   LoopLoader decide cuándo y dónde se muestra. */

const bat = (
    <path d="M60 14l-4-8-3 9c-8-6-20-9-33-6-10 2-17 7-20 13 7-3 13-2 17 2 3 3 4 7 3 11 5-5 11-6 16-3 4 2 6 6 6 10 4-5 9-7 14-5 2 1 3 3 4 6 1-3 2-5 4-6 5-2 10 0 14 5 0-4 2-8 6-10 5-3 11-2 16 3-1-4 0-8 3-11 4-4 10-5 17-2-3-6-10-11-20-13-13-3-25 0-33 6l-3-9z" />
);

export function HalloweenLoaderContent({ text, fullScreen }: { text?: string; fullScreen: boolean }) {
    return (
        <div className={`hwk ${fullScreen ? 'hwk--full' : ''}`} role="status" aria-live="polite">
            <div className="hwk-stage" aria-hidden="true">
                <span className="hwk-moon" />
                <span className="hwk-orbit hwk-orbit-1"><svg viewBox="0 0 120 60" fill="currentColor">{bat}</svg></span>
                <span className="hwk-orbit hwk-orbit-2"><svg viewBox="0 0 120 60" fill="currentColor">{bat}</svg></span>
                <span className="hwk-orbit hwk-orbit-3"><svg viewBox="0 0 120 60" fill="currentColor">{bat}</svg></span>
                <svg className="hwk-jack" viewBox="-48 -48 96 84">
                    <defs>
                        <radialGradient id="hwk-core" cx="42%" cy="24%" r="85%">
                            <stop offset="0" stopColor="#ffc46b" /><stop offset=".45" stopColor="#ff8a1f" /><stop offset=".85" stopColor="#d9530c" /><stop offset="1" stopColor="#9a3a0b" />
                        </radialGradient>
                        <radialGradient id="hwk-side" cx="40%" cy="24%" r="85%">
                            <stop offset="0" stopColor="#ffab4a" /><stop offset=".5" stopColor="#f47312" /><stop offset="1" stopColor="#84300b" />
                        </radialGradient>
                        <radialGradient id="hwk-fire" cx="50%" cy="60%" r="70%">
                            <stop offset="0" stopColor="#fffbe0" /><stop offset=".45" stopColor="#ffd34d" /><stop offset="1" stopColor="#ff8a00" />
                        </radialGradient>
                        <filter id="hwk-blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" /></filter>
                    </defs>
                    <ellipse cx="0" cy="30" rx="34" ry="4.5" fill="#000" opacity=".5" />
                    <path d="M-4-22C-5-30-2-37 5-40L9-35C5-33 3-29 4-22Z" fill="#4d6b1f" />
                    <path d="M4-30c8-3 13 1 11 6-2 4-7 2-5-1" fill="none" stroke="#6b9a2e" strokeWidth="1.3" strokeLinecap="round" />
                    <ellipse cx="-24" cy="4" rx="12" ry="21" fill="url(#hwk-side)" />
                    <ellipse cx="24" cy="4" rx="12" ry="21" fill="url(#hwk-side)" />
                    <ellipse cx="-12" cy="2" rx="14" ry="25" fill="url(#hwk-side)" />
                    <ellipse cx="12" cy="2" rx="14" ry="25" fill="url(#hwk-side)" />
                    <ellipse cx="0" cy="1.5" rx="12" ry="27" fill="url(#hwk-core)" />
                    <ellipse cx="-17" cy="-12" rx="2.4" ry="6.5" fill="#fff" opacity=".28" transform="rotate(16 -17 -12)" />
                    <g className="hwk-face">
                        <g fill="#ffae1a" filter="url(#hwk-blur)">
                            <path d="M-19-9L-6-5-9 4Q-16 4-19-9Z" /><path d="M19-9L6-5 9 4Q16 4 19-9Z" />
                            <path d="M-21 9Q-11 14-7 12L-5 16-2 12.5H2L5 16 7 12Q11 14 21 9 16 23 0 23.5-16 23-21 9Z" />
                        </g>
                        <g fill="url(#hwk-fire)" stroke="#6b2409" strokeWidth="1.1" strokeLinejoin="round" paintOrder="stroke">
                            <path className="hwk-eye" d="M-19-9L-6-5-9 4Q-16 4-19-9Z" /><path className="hwk-eye" d="M19-9L6-5 9 4Q16 4 19-9Z" />
                            <path d="M0 0L3 5.5H-3Z" />
                            <path d="M-21 9Q-11 14-7 12L-5 16-2 12.5H2L5 16 7 12Q11 14 21 9 16 23 0 23.5-16 23-21 9ZM-12 20.5L-9.5 16.5-7 21.5ZM7 21.5L9.5 16.5 12 20.5Z" fillRule="evenodd" />
                        </g>
                    </g>
                </svg>
                <span className="hwk-embers"><i /><i /><i /><i /><i /><i /></span>
            </div>
            {text && (
                <span className="hwk-text">
                    {text.replace(/(\.{3}|…)\s*$/, '')}
                    <span className="hwk-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
                </span>
            )}
        </div>
    );
}
