import { coordinateToPixel, pixelToCoordinate } from './geo.js';
import { mmToPx, ptToPx } from './units.js';
import type { DrawEnv, MapSnapshot, SheetLayout, Theme } from './types.js';

export function createEnv(dpi: number, theme: Theme, snapshot: MapSnapshot, layout: SheetLayout, date: Date): DrawEnv {
    const { frame } = layout;
    return {
        dpi,
        theme,
        snapshot,
        layout,
        date,
        mm: value => mmToPx(value, dpi),
        pt: value => ptToPx(value, dpi),
        font: (size, weight = '400') => `${weight} ${ptToPx(size, dpi)}px ${theme.fontFamily}`,
        toCoordinate: (x, y) => pixelToCoordinate(
            snapshot.center,
            snapshot.resolution,
            snapshot.rotation,
            snapshot.size,
            [((x - frame.x) / frame.width) * snapshot.size[0], ((y - frame.y) / frame.height) * snapshot.size[1]],
        ),
        toPixel: coordinate => {
            const [px = 0, py = 0] = coordinateToPixel(snapshot.center, snapshot.resolution, snapshot.rotation, snapshot.size, coordinate);
            return [frame.x + (px / snapshot.size[0]) * frame.width, frame.y + (py / snapshot.size[1]) * frame.height];
        },
    };
}

export async function loadFonts(env: DrawEnv): Promise<void> {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (!fonts) return;
    const { theme } = env;
    await Promise.all([
        fonts.load(env.font(theme.fontSize)),
        fonts.load(env.font(theme.fontSize, '700')),
        fonts.load(env.font(theme.titleSize, '700')),
    ]).catch(() => undefined);
}
