import { abortError, RenderTimeoutError, throwIfAborted } from '../core/errors.js';
import type { MaplibreMap } from './types.js';

export function repaint<T>(
    map: MaplibreMap,
    type: 'render' | 'idle',
    timeout: number,
    signal: AbortSignal | undefined,
    onPaint: () => T,
    onTimeout?: () => T,
): Promise<T> {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        const detach = (): void => {
            clearTimeout(timer);
            map.off(type, onEvent);
            signal?.removeEventListener('abort', onAbort);
        };
        const fail = (error: unknown): void => {
            detach();
            reject(error instanceof Error ? error : new Error(String(error)));
        };
        const settle = (paint: () => T): void => {
            try {
                const value = paint();
                detach();
                resolve(value);
            } catch (error) {
                fail(error);
            }
        };
        const onEvent = (): void => settle(onPaint);
        const onAbort = (): void => fail(abortError(signal));
        const timer = setTimeout(() => (onTimeout ? settle(onTimeout) : fail(new RenderTimeoutError(timeout))), timeout);
        map.on(type, onEvent);
        signal?.addEventListener('abort', onAbort, { once: true });
        map.triggerRepaint();
    });
}

export function viewportSize(map: MaplibreMap): [number, number] {
    const container = map.getContainer();
    return [container.clientWidth, container.clientHeight];
}

export interface MapFreeze {
    release: () => void;
}

export async function freezeMap(map: MaplibreMap, timeout: number, signal?: AbortSignal): Promise<MapFreeze> {
    const image = document.createElement('canvas');
    await repaint(map, 'render', timeout, signal, () => {
        const source = map.getCanvas();
        image.width = source.width;
        image.height = source.height;
        image.getContext('2d')?.drawImage(source, 0, 0);
    });
    image.dataset['cartelaFreeze'] = '';
    image.setAttribute('aria-hidden', 'true');
    Object.assign(image.style, { display: 'block', position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    map.getContainer().appendChild(image);
    return { release: () => image.remove() };
}
