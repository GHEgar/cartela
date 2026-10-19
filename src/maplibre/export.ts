import { fitRect, sheetAspect } from '../core/aspect.js';
import { exportSheet, PREVIEW_DPI } from '../core/sheet.js';
import type { Box, Sheet } from '../core/types.js';
import { captureMap } from './capture.js';
import { viewportSize } from './paint.js';
import type { MaplibreExportOptions, MaplibreMap } from './types.js';

export function exportMap(map: MaplibreMap, options: MaplibreExportOptions = {}): Promise<Sheet> {
    return exportSheet(request => captureMap(map, { ...options, size: request.size, pixelRatio: request.pixelRatio }), options);
}

export function previewMap(map: MaplibreMap, options: MaplibreExportOptions = {}, dpi = PREVIEW_DPI): Promise<Sheet> {
    return exportMap(map, { ...options, page: { ...options.page, dpi } });
}

export function printFrame(map: MaplibreMap, options: MaplibreExportOptions = {}): Box | null {
    const size = viewportSize(map);
    if (!size[0] || !size[1]) return null;
    return fitRect(size, sheetAspect(options), options.padding);
}
