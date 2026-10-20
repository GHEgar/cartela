import { useCallback, useRef, useSyncExternalStore } from 'react';
import type OlMap from 'ol/Map.js';
import { unByKey } from 'ol/Observable.js';
import { DEFAULT_FRAME_PADDING, fitRect, sheetAspect } from '../core/frame.js';
import type { Box, ExportOptions } from '../core/types.js';

export function usePrintFrame(map: OlMap | null | undefined, options: ExportOptions = {}): Box | null {
    const aspect = sheetAspect(options);
    const padding = options.padding ?? DEFAULT_FRAME_PADDING;
    const { top = 0, right = 0, bottom = 0, left = 0 } = options.inset ?? {};
    const cache = useRef<{ key: string; box: Box | null }>({ key: '', box: null });

    const subscribe = useCallback((notify: () => void) => {
        if (!map) return () => {};
        const key = map.on('change:size', notify);
        return () => unByKey(key);
    }, [map]);

    const getSnapshot = useCallback((): Box | null => {
        const size = map?.getSize();
        const width = size?.[0] ?? 0;
        const height = size?.[1] ?? 0;
        const key = `${width}x${height}:${aspect}:${padding}:${top},${right},${bottom},${left}`;
        if (cache.current.key !== key) {
            const inset = { top, right, bottom, left };
            cache.current = { key, box: width && height ? fitRect([width, height], aspect, padding, inset) : null };
        }
        return cache.current.box;
    }, [map, aspect, padding, top, right, bottom, left]);

    return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
