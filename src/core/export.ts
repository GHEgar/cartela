import type OlMap from 'ol/Map.js';
import { renderMap } from './render.js';
import { exportSheet, PREVIEW_DPI } from './sheet.js';
import type { ExportOptions, Sheet } from './types.js';

export { composeSheet, exportSheet, DEFAULT_MARGIN, PREVIEW_DPI } from './sheet.js';

export function exportMap(map: OlMap, options: ExportOptions = {}): Promise<Sheet> {
    return exportSheet(request => renderMap(map, { ...options, ...request }), options);
}

export function previewMap(map: OlMap, options: ExportOptions = {}, dpi = PREVIEW_DPI): Promise<Sheet> {
    return exportMap(map, { ...options, page: { ...options.page, dpi } });
}
