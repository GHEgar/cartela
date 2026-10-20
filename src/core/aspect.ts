import { computeLayout, reserveOf, resolveLayout } from './layout.js';
import { DEFAULT_MARGIN } from './sheet.js';
import { resolveTheme } from './theme.js';
import { CSS_DPI, pageGeometry } from './units.js';
import type { Box, Insets, SheetOptions, Size } from './types.js';

export const DEFAULT_FRAME_PADDING = 24;

export function fitRect(container: Size, aspect: number, padding = DEFAULT_FRAME_PADDING, inset: Partial<Insets> = {}): Box {
    const left = Math.max(0, inset.left ?? 0);
    const top = Math.max(0, inset.top ?? 0);
    const areaWidth = Math.max(1, container[0] - left - Math.max(0, inset.right ?? 0));
    const areaHeight = Math.max(1, container[1] - top - Math.max(0, inset.bottom ?? 0));
    const availableWidth = Math.max(1, areaWidth - padding * 2);
    const availableHeight = Math.max(1, areaHeight - padding * 2);
    const width = Math.min(availableWidth, availableHeight * aspect);
    const height = width / aspect;
    return {
        x: left + (areaWidth - width) / 2,
        y: top + (areaHeight - height) / 2,
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
