import type OlMap from 'ol/Map.js';
import type { Coordinate } from 'ol/coordinate.js';
import type MapEvent from 'ol/MapEvent.js';
import { getCenter } from 'ol/extent.js';
import { collectAttributions, layerLabel } from './attributions.js';
import { abortError, RenderTimeoutError, TaintedCanvasError, throwIfAborted } from './errors.js';
import { fitRect } from './frame.js';
import { freeze } from './freeze.js';
import { fitResolution, rotatedExtent } from './geo.js';
import type { MapSnapshot, RenderMapOptions, Size } from './types.js';

export const DEFAULT_TIMEOUT = 30_000;

interface ViewTarget {
    center: Coordinate;
    resolution: number;
    rotation: number;
}

export function resolveViewTarget(map: OlMap, size: Size, options: RenderMapOptions): ViewTarget {
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

function waitForRender(map: OlMap, timeout: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const done = (error?: Error): void => {
            clearTimeout(timer);
            map.un('rendercomplete', onComplete);
            signal?.removeEventListener('abort', onAbort);
            if (error) reject(error);
            else resolve();
        };
        const onComplete = (): void => done();
        const onAbort = (): void => done(abortError(signal));
        const timer = setTimeout(() => done(new RenderTimeoutError(timeout)), timeout);
        map.on('rendercomplete', onComplete);
        signal?.addEventListener('abort', onAbort, { once: true });
        map.render();
    });
}

function assertReadable(canvas: HTMLCanvasElement, map: OlMap): void {
    try {
        canvas.getContext('2d')?.getImageData(0, 0, 1, 1);
    } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'SecurityError') throw error;
        const suspects = map.getAllLayers()
            .filter(layer => layer.getVisible() && !('getFeatures' in (layer.getSource() ?? {})))
            .map(layerLabel);
        throw new TaintedCanvasError(suspects);
    }
}

export async function renderMap(map: OlMap, options: RenderMapOptions): Promise<MapSnapshot> {
    throwIfAborted(options.signal);
    const view = map.getView();
    const pixelRatio = options.pixelRatio ?? 1;
    const size: Size = [Math.max(1, Math.round(options.size[0])), Math.max(1, Math.round(options.size[1]))];
    const goal = resolveViewTarget(map, size, options);
    const original = {
        target: map.getTarget(),
        pixelRatio: map.getPixelRatio(),
        center: view.getCenter(),
        resolution: view.getResolution(),
        rotation: view.getRotation(),
    };

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size[0] * pixelRatio);
    canvas.height = Math.round(size[1] * pixelRatio);
    canvas.getContext('2d')?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const attributions = new Set<string>();
    const onPostrender = (event: MapEvent): void => {
        if (event.frameState) collectAttributions(event.frameState, attributions);
    };
    const frozen = options.freeze === false ? null : freeze(map);

    try {
        map.setTarget(canvas);
        map.setPixelRatio(pixelRatio);
        frozen?.mount();
        view.setRotation(goal.rotation);
        view.setCenter(goal.center);
        view.setResolution(goal.resolution);
        map.on('postrender', onPostrender);
        await waitForRender(map, options.timeout ?? DEFAULT_TIMEOUT, options.signal);
        assertReadable(canvas, map);
        const center = view.getCenter() ?? goal.center;
        const resolution = view.getResolution() ?? goal.resolution;
        const rotation = view.getRotation();
        return {
            canvas,
            size,
            pixelRatio,
            center,
            resolution,
            rotation,
            projection: view.getProjection(),
            extent: rotatedExtent(center, resolution, rotation, size),
            attributions: [...attributions],
        };
    } finally {
        map.un('postrender', onPostrender);
        view.setRotation(original.rotation);
        if (original.center) view.setCenter(original.center);
        if (original.resolution !== undefined) view.setResolution(original.resolution);
        map.setTarget(original.target);
        map.setPixelRatio(original.pixelRatio);
        if (frozen) {
            frozen.handoff();
            map.once('rendercomplete', frozen.release);
            setTimeout(frozen.release, options.timeout ?? DEFAULT_TIMEOUT);
        }
    }
}
