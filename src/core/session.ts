import type OlMap from 'ol/Map.js';
import type MapEvent from 'ol/MapEvent.js';
import { collectAttributions, layerLabel } from './attributions.js';
import { abortError, RenderTimeoutError, TaintedCanvasError, throwIfAborted } from './errors.js';
import { freeze } from './freeze.js';
import { rotatedExtent } from './geo.js';
import type { MapSession, MapSnapshot, SessionOptions, Size, ViewState } from './types.js';

export const DEFAULT_TIMEOUT = 30_000;

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

export function openSession(map: OlMap, options: SessionOptions): MapSession {
    const view = map.getView();
    const pixelRatio = options.pixelRatio ?? 1;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const size: Size = [Math.max(1, Math.round(options.size[0])), Math.max(1, Math.round(options.size[1]))];
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
    let open = true;

    map.setTarget(canvas);
    map.setPixelRatio(pixelRatio);
    frozen?.mount();
    map.on('postrender', onPostrender);

    const render = async (state: ViewState, signal?: AbortSignal): Promise<MapSnapshot> => {
        throwIfAborted(signal);
        if (!open) throw new Error('The map session is closed');
        attributions.clear();
        view.setRotation(state.rotation);
        view.setCenter(state.center);
        view.setResolution(state.resolution);
        await waitForRender(map, timeout, signal);
        assertReadable(canvas, map);
        const center = view.getCenter() ?? state.center;
        const resolution = view.getResolution() ?? state.resolution;
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
    };

    const close = (): void => {
        if (!open) return;
        open = false;
        map.un('postrender', onPostrender);
        view.setRotation(original.rotation);
        if (original.center) view.setCenter(original.center);
        if (original.resolution !== undefined) view.setResolution(original.resolution);
        map.setTarget(original.target);
        map.setPixelRatio(original.pixelRatio);
        if (frozen) {
            frozen.handoff();
            map.once('rendercomplete', frozen.release);
            setTimeout(frozen.release, timeout);
        }
    };

    return { canvas, size, pixelRatio, render, close };
}
