import { plainText } from '../core/plain-text.js';
import type { MaplibreMap } from './types.js';

export function collectAttributions(map: MaplibreMap): string[] {
    const zoom = map.getZoom();
    const found = new Set<string>();
    for (const layer of map.getStyle()?.layers ?? []) {
        if (typeof layer.source !== 'string') continue;
        if (layer.layout?.visibility === 'none') continue;
        if (layer.minzoom !== undefined && zoom < layer.minzoom) continue;
        if (layer.maxzoom !== undefined && zoom >= layer.maxzoom) continue;
        const html = map.getSource(layer.source)?.attribution;
        const text = html ? plainText(html) : '';
        if (text) found.add(text);
    }
    return [...found];
}
