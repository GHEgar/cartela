import { computeLayout, reserveOf, resolveLayout } from './layout.js';
import { DEFAULT_MARGIN } from './sheet.js';
import { resolveTheme } from './theme.js';
import { CSS_DPI, pageGeometry } from './units.js';
import type { Box, SheetOptions, Size } from './types.js';

export const DEFAULT_FRAME_PADDING = 24;

export function fitRect(container: Size, aspect: number, padding = DEFAULT_FRAME_PADDING): Box {
    const availableWidth = Math.max(1, container[0] - padding * 2);
    const availableHeight = Math.max(1, container[1] - padding * 2);
    const width = Math.min(availableWidth, availableHeight * aspect);
    const height = width / aspect;
    return {
        x: (container[0] - width) / 2,
        y: (container[1] - height) / 2,
        width,
        height,
    };
}

export function sheetAspect(options: SheetOptions = {}): number {
    const theme = resolveTheme(options.theme);
    const geometry = pageGeometry({ ...options.page, dpi: CSS_DPI }, Number.POSITIVE_INFINITY);
    const layout = computeLayout(
        geometry.size,
        CSS_DPI,
        options.page?.margin ?? DEFAULT_MARGIN,
        resolveLayout(options.layout),
        reserveOf(options.elements ?? [], theme),
    );
    return layout.frame.width / layout.frame.height;
}
