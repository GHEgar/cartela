import { vi } from 'vitest';
import type { Camera, MaplibreMap, StyleLayerLike } from '../../src/maplibre/types.js';

export interface Draw {
    source: unknown;
    args: number[];
}

export function stubContext(): Draw[] {
    const draws: Draw[] = [];
    const ctx = {
        drawImage: (source: unknown, ...args: number[]) => {
            draws.push({ source, args });
        },
        clearRect() {}, fillRect() {}, strokeRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
        setTransform() {}, fillText() {},
        measureText: () => ({ width: 10 }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as CanvasRenderingContext2D);
    return draws;
}

export interface DoubleOptions {
    width?: number;
    height?: number;
    maxCanvas?: number;
    pixelRatio?: number | null;
    camera?: Partial<Camera>;
    layers?: StyleLayerLike[];
    sources?: Record<string, string>;
    idle?: boolean;
}

export interface MapDouble extends MaplibreMap {
    readonly calls: string[];
    readonly jumps: Partial<Camera>[];
    readonly ratios: (number | null)[];
    readonly canvas: HTMLCanvasElement;
    readonly container: HTMLElement;
    listeners: () => number;
}

export function mapDouble(options: DoubleOptions = {}): MapDouble {
    const width = options.width ?? 800;
    const height = options.height ?? 600;
    const maxCanvas = options.maxCanvas ?? 4096;
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: width });
    Object.defineProperty(container, 'clientHeight', { value: height });
    const canvas = document.createElement('canvas');
    const camera: Camera = { center: [-103.35, 20.67], zoom: 10, bearing: 0, pitch: 0, roll: 0, ...options.camera };
    let override: number | null = options.pixelRatio ?? null;
    const listeners = new Map<string, Set<() => void>>();
    const calls: string[] = [];
    const jumps: Partial<Camera>[] = [];
    const ratios: (number | null)[] = [];

    const applied = (): number => override ?? globalThis.devicePixelRatio;
    const resize = (): void => {
        const ratio = Math.min(applied(), maxCanvas / width, maxCanvas / height);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
    };
    resize();
    const emit = (type: string): void => {
        for (const listener of [...(listeners.get(type) ?? [])]) listener();
    };

    return {
        calls,
        jumps,
        ratios,
        canvas,
        container,
        listeners: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
        getContainer: () => container,
        getCanvas: () => canvas,
        getCenter: () => ({ lng: camera.center[0], lat: camera.center[1] }),
        getZoom: () => camera.zoom,
        getBearing: () => camera.bearing,
        getPitch: () => camera.pitch,
        getRoll: () => camera.roll ?? 0,
        jumpTo: next => {
            calls.push('jumpTo');
            jumps.push(next);
            Object.assign(camera, next);
        },
        getPixelRatio: applied,
        setPixelRatio: ratio => {
            calls.push('setPixelRatio');
            ratios.push(ratio);
            override = ratio;
            resize();
        },
        triggerRepaint: () => {
            calls.push('triggerRepaint');
            setTimeout(() => {
                emit('render');
                if (options.idle !== false) emit('idle');
            }, 0);
        },
        on: (type, listener) => {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)?.add(listener);
        },
        off: (type, listener) => {
            listeners.get(type)?.delete(listener);
        },
        getStyle: () => ({ layers: options.layers ?? [] }),
        getSource: id => {
            const attribution = options.sources?.[id];
            return attribution === undefined ? undefined : { attribution };
        },
    };
}
