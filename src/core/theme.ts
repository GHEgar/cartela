import type { Theme } from './types.js';

export const DEFAULT_THEME: Readonly<Theme> = {
    fontFamily: 'system-ui, sans-serif',
    fontSize: 8,
    titleSize: 15,
    color: '#1f2328',
    muted: '#57606a',
    background: '#ffffff',
    frame: '#1f2328',
    frameWidth: 0.25,
    halo: 'rgba(255, 255, 255, 0.85)',
    gap: 3,
};

export function resolveTheme(theme: Partial<Theme> = {}): Theme {
    return { ...DEFAULT_THEME, ...theme };
}
