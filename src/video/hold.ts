import type OlMap from 'ol/Map.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Size } from '../core/types.js';
import { DEFAULT_FPS, DEFAULT_SIZE } from './route.js';
import type { FramePlan, FrameState } from './types.js';

export interface HoldOptions {
    fps?: number;
    size?: Size;
    frames?: number;
    duration?: number;
    center?: Coordinate;
    resolution?: number;
    rotation?: number;
}

export function planHold(map: Pick<OlMap, 'getView'>, options: HoldOptions = {}): FramePlan {
    const view = map.getView();
    const fps = options.fps ?? DEFAULT_FPS;
    const size = options.size ?? DEFAULT_SIZE;
    const count = Math.max(1, Math.round(options.frames ?? (options.duration ?? 3) * fps));
    const frame: FrameState = {
        center: options.center ?? view.getCenter() ?? [0, 0],
        resolution: options.resolution ?? view.getResolution() ?? 1,
        rotation: options.rotation ?? view.getRotation(),
    };
    return { fps, size, frames: Array.from({ length: count }, () => ({ ...frame })) };
}
