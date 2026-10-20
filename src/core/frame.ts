import type OlMap from 'ol/Map.js';
import { unByKey } from 'ol/Observable.js';
import { fitRect, sheetAspect } from './aspect.js';
import type { Box, ExportOptions } from './types.js';

export { fitRect, sheetAspect, DEFAULT_FRAME_PADDING } from './aspect.js';

export function printFrame(map: OlMap, options: ExportOptions = {}): Box | null {
    const size = map.getSize();
    if (!size || !size[0] || !size[1]) return null;
    return fitRect([size[0], size[1]], sheetAspect(options), options.padding, options.inset);
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
