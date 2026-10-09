import type OlMap from 'ol/Map.js';
import { unByKey } from 'ol/Observable.js';
import { computeLayout, reserveOf, resolveLayout } from './layout.js';
import { resolveTheme } from './theme.js';
import { CSS_DPI, pageGeometry } from './units.js';
import type { Box, ExportOptions, Size } from './types.js';

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

export function sheetAspect(options: ExportOptions = {}): number {
    const theme = resolveTheme(options.theme);
    const geometry = pageGeometry({ ...options.page, dpi: CSS_DPI }, Number.POSITIVE_INFINITY);
    const layout = computeLayout(
        geometry.size,
        CSS_DPI,
        options.page?.margin ?? 8,
        resolveLayout(options.layout),
        reserveOf(options.elements ?? [], theme),
    );
    return layout.frame.width / layout.frame.height;
}

export function printFrame(map: OlMap, options: ExportOptions = {}): Box | null {
    const size = map.getSize();
    if (!size || !size[0] || !size[1]) return null;
    return fitRect([size[0], size[1]], sheetAspect(options), options.padding);
}

export function watchPrintFrame(
    map: OlMap,
    options: ExportOptions,
    listener: (frame: Box | null) => void,
): () => void {
    const emit = (): void => listener(printFrame(map, options));
    const key = map.on('change:size', emit);
    emit();
    return () => unByKey(key);
}
