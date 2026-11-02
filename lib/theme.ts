/**
 * Tema estacional. UN SOLO INTERRUPTOR:
 *  - Para apagar Halloween (noviembre): deja ACTIVE_THEME en null
 *    o define NEXT_PUBLIC_SEASONAL_THEME=none en Vercel.
 *  - Para limpiar del todo: borrar app/halloween.css, components/theme/
 *    y los className "hw-*" (inertes sin el atributo data-theme).
 */
export type SeasonalTheme = 'halloween' | null;

// Halloween terminó (nov. 2026): tema apagado. Para reactivarlo el próximo año,
// cambia `null` por `envTheme === 'none' ? null : 'halloween'`.
export const ACTIVE_THEME: SeasonalTheme = null;

export const isHalloween = ACTIVE_THEME === 'halloween';
