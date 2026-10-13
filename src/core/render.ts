import type OlMap from 'ol/Map.js';
import { getCenter } from 'ol/extent.js';
import { throwIfAborted } from './errors.js';
import { fitRect } from './frame.js';
import { fitResolution } from './geo.js';
import { DEFAULT_TIMEOUT, openSession } from './session.js';
import type { MapSnapshot, RenderMapOptions, Size, ViewState } from './types.js';

export { DEFAULT_TIMEOUT };

export function resolveViewTarget(map: OlMap, size: Size, options: RenderMapOptions): ViewState {
    const view = map.getView();
    const center = view.getCenter() ?? [0, 0];
    const resolution = view.getResolution() ?? 1;
    const rotation = view.getRotation();
    const current = map.getSize();
    const screen: Size = [current?.[0] ?? size[0], current?.[1] ?? size[1]];
    const extent = options.extent ?? 'frame';
    const fit = options.fit ?? 'contain';

    if (extent === 'frame') {
        const rect = fitRect(screen, options.aspect ?? size[0] / size[1], options.padding);
        const pixel = [rect.x + rect.width / 2, rect.y + rect.height / 2];
        return {
            center: map.getCoordinateFromPixel(pixel) ?? center,
            resolution: (resolution * rect.width) / size[0],
            rotation,
        };
    }
    if (extent === 'view') {
        const rx = (screen[0] * resolution) / size[0];
        const ry = (screen[1] * resolution) / size[1];
        return { center, resolution: fit === 'contain' ? Math.max(rx, ry) : Math.min(rx, ry), rotation };
    }
    if (Array.isArray(extent)) {
        return {
            center: getCenter(extent),
            resolution: fitResolution(extent, size, fit),
            rotation: options.rotation ?? 0,
        };
    }
    return { center: extent.center, resolution: extent.resolution, rotation: options.rotation ?? rotation };
}

export async function renderMap(map: OlMap, options: RenderMapOptions): Promise<MapSnapshot> {
    throwIfAborted(options.signal);
    const size: Size = [Math.max(1, Math.round(options.size[0])), Math.max(1, Math.round(options.size[1]))];
    const goal = resolveViewTarget(map, size, options);
    const session = openSession(map, {
        size,
        pixelRatio: options.pixelRatio ?? 1,
        freeze: options.freeze !== false,
        timeout: options.timeout ?? DEFAULT_TIMEOUT,
    });
    try {
        return await session.render(goal, options.signal);
    } finally {
        session.close();
    }
}
