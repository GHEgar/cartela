import type OlMap from 'ol/Map.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Size } from '../core/types.js';
import { DEFAULT_FPS, DEFAULT_SIZE } from './defaults.js';
import type { FramePlan, FrameState, VideoFormat } from './types.js';

export interface OrbitOptions {
    fps?: number;
    size?: Size;
    duration?: number;
    turns?: number;
    direction?: 1 | -1;
    center?: Coordinate;
    resolution?: number;
}

export interface RecordingDefaults {
    fps: number;
    size: Size;
}

export function recordingDefaults(format: VideoFormat): RecordingDefaults {
    return format === 'gif' ? { fps: 15, size: [480, 480] } : { fps: DEFAULT_FPS, size: DEFAULT_SIZE };
}

export function planOrbit(map: Pick<OlMap, 'getView'>, options: OrbitOptions = {}): FramePlan {
    const view = map.getView();
    const fps = options.fps ?? DEFAULT_FPS;
    const size = options.size ?? DEFAULT_SIZE;
    const count = Math.max(1, Math.round((options.duration ?? 6) * fps));
    const sweep = 2 * Math.PI * (options.turns ?? 1) * (options.direction ?? 1);
    const center = options.center ?? view.getCenter() ?? [0, 0];
    const resolution = options.resolution ?? view.getResolution() ?? 1;
    const start = view.getRotation();
    const frames: FrameState[] = Array.from({ length: count }, (_, i) => ({
        center,
        resolution,
        rotation: start + (sweep * i) / count,
    }));
    return { fps, size, frames };
}
