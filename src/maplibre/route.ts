import { fitRect } from '../core/aspect.js';
import type { Size } from '../core/types.js';
import { DEFAULT_FPS, DEFAULT_SIZE } from '../video/defaults.js';
import { cameraOf, fromMercator, TILE_SIZE } from './camera.js';
import { measureLine } from './measure.js';
import { viewportSize } from './paint.js';
import type { CameraFrame, CameraPlan, LngLat, MaplibreMap } from './types.js';

export interface RouteOptions {
    fps?: number;
    size?: Size;
    duration?: number;
    follow?: boolean;
    rotate?: boolean;
    zoom?: 'fit' | 'view' | number;
    pitch?: number;
    padding?: number;
    smoothing?: number;
    hold?: [number, number];
    easing?: (t: number) => number;
}

const MAX_ZOOM = 22;
const RAD = Math.PI / 180;

function unit(lngLat: LngLat): [number, number] {
    const lat = Math.max(-85.0511287798, Math.min(85.0511287798, lngLat[1])) * RAD;
    return [(lngLat[0] + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2];
}

function bounds(points: readonly LngLat[]): { min: [number, number]; max: [number, number] } {
    const units = points.map(unit);
    const xs = units.map(p => p[0]);
    const ys = units.map(p => p[1]);
    return { min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)] };
}

function unwrapDegrees(angle: number, previous: number): number {
    return angle + 360 * Math.round((previous - angle) / 360);
}

export function fitZoom(map: MaplibreMap, points: readonly LngLat[], size: Size, padding: number, fallback: number): number {
    const { min, max } = bounds(points);
    const inner: Size = [Math.max(1, size[0] - 2 * padding), Math.max(1, size[1] - 2 * padding)];
    const scales = [inner[0] / (max[0] - min[0]), inner[1] / (max[1] - min[1])].filter(Number.isFinite);
    if (!scales.length) return fallback;
    const screen = viewportSize(map);
    const width = screen[0] && screen[1] ? fitRect(screen, size[0] / size[1], 0).width : size[0];
    const zoom = Math.log2(Math.min(...scales) / TILE_SIZE) - Math.log2(size[0] / width);
    return Math.min(MAX_ZOOM, zoom);
}

function middle(points: readonly LngLat[]): LngLat {
    const { min, max } = bounds(points);
    const [x, y] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
    const circumference = 2 * Math.PI * 6378137;
    return fromMercator([(x - 0.5) * circumference, (0.5 - y) * circumference]);
}

export function planRoute(map: MaplibreMap, coordinates: readonly LngLat[], options: RouteOptions = {}): CameraPlan {
    const current = cameraOf(map);
    const fps = options.fps ?? DEFAULT_FPS;
    const size = options.size ?? DEFAULT_SIZE;
    const duration = options.duration ?? 10;
    const follow = options.follow ?? true;
    const hold = Math.min(0.5, duration * 0.1);
    const [holdStart, holdEnd] = options.hold ?? [hold, hold];
    const easing = options.easing ?? ((t: number): number => t);
    const measure = measureLine(coordinates);

    const count = Math.max(2, Math.round(duration * fps));
    const span = (count - 1) / fps - holdStart - holdEnd;
    if (!(span > 0)) throw new RangeError('The duration is too short for the hold times');

    const zoomOption = options.zoom ?? (follow ? 'view' : 'fit');
    const zoom = typeof zoomOption === 'number'
        ? zoomOption
        : zoomOption === 'view' ? current.zoom : fitZoom(map, coordinates, size, options.padding ?? 48, current.zoom);
    const fixedCenter = middle(coordinates);
    const window = (options.smoothing ?? 0.5) * (measure.length / span);
    const pitch = options.pitch ?? current.pitch;

    const frames: CameraFrame[] = [];
    let bearing = options.rotate ? measure.headingAt(0, window) : current.bearing;
    for (let i = 0; i < count; i += 1) {
        const linear = Math.min(1, Math.max(0, (i / fps - holdStart) / span));
        const along = Math.min(1, Math.max(0, easing(linear)));
        const distance = along * measure.length;
        const heading = measure.headingAt(distance, window);
        if (options.rotate) bearing = unwrapDegrees(heading, bearing);
        frames.push({
            center: follow ? measure.pointAt(distance) : fixedCenter,
            zoom,
            bearing,
            pitch,
            along,
            heading,
        });
    }
    return { fps, size, frames };
}
