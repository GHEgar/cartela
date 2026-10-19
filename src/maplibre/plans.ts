import type { Size } from '../core/types.js';
import { DEFAULT_FPS, DEFAULT_SIZE } from '../video/defaults.js';
import { cameraOf } from './camera.js';
import type { Camera, CameraFrame, CameraPlan, LngLat, MaplibreMap } from './types.js';

export interface OrbitOptions {
    fps?: number;
    size?: Size;
    duration?: number;
    turns?: number;
    direction?: 1 | -1;
    center?: LngLat;
    zoom?: number;
    pitch?: number;
}

export interface HoldOptions {
    fps?: number;
    size?: Size;
    frames?: number;
    duration?: number;
    camera?: Partial<Camera>;
}

export function planOrbit(map: MaplibreMap, options: OrbitOptions = {}): CameraPlan {
    const current = cameraOf(map);
    const fps = options.fps ?? DEFAULT_FPS;
    const size = options.size ?? DEFAULT_SIZE;
    const count = Math.max(1, Math.round((options.duration ?? 6) * fps));
    const sweep = 360 * (options.turns ?? 1) * (options.direction ?? 1);
    const base: Camera = {
        ...current,
        center: options.center ?? current.center,
        zoom: options.zoom ?? current.zoom,
        pitch: options.pitch ?? current.pitch,
    };
    const frames: CameraFrame[] = Array.from({ length: count }, (_, i) => ({
        ...base,
        bearing: current.bearing + (sweep * i) / count,
    }));
    return { fps, size, frames };
}

export function planHold(map: MaplibreMap, options: HoldOptions = {}): CameraPlan {
    const fps = options.fps ?? DEFAULT_FPS;
    const size = options.size ?? DEFAULT_SIZE;
    const count = Math.max(1, Math.round(options.frames ?? (options.duration ?? 3) * fps));
    const frame: CameraFrame = { ...cameraOf(map), ...options.camera };
    return { fps, size, frames: Array.from({ length: count }, () => ({ ...frame })) };
}
