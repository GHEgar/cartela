import type OlMap from 'ol/Map.js';
import type LineString from 'ol/geom/LineString.js';
import { getCenter } from 'ol/extent.js';
import { fitResolution } from '../core/geo.js';
import type { Size } from '../core/types.js';
import { DEFAULT_FPS, DEFAULT_SIZE } from './defaults.js';
import { measureRoute } from './measure.js';
import type { FramePlan, FrameState } from './types.js';

export interface RouteOptions {
    fps?: number;
    size?: Size;
    duration?: number;
    follow?: boolean;
    rotate?: boolean;
    zoom?: 'fit' | 'view' | number;
    padding?: number;
    smoothing?: number;
    hold?: [number, number];
    easing?: (t: number) => number;
}

export { DEFAULT_FPS, DEFAULT_SIZE };

export function unwrap(angle: number, previous: number): number {
    const turn = 2 * Math.PI;
    return angle + turn * Math.round((previous - angle) / turn);
}

function resolutionFor(map: Pick<OlMap, 'getView'>, route: LineString, size: Size, zoom: RouteOptions['zoom'], padding: number): number {
    if (typeof zoom === 'number') return zoom;
    const view = map.getView();
    if (zoom === 'view') return view.getResolution() ?? 1;
    const inner: Size = [Math.max(1, size[0] - 2 * padding), Math.max(1, size[1] - 2 * padding)];
    return fitResolution(route.getExtent(), inner, 'contain') || (view.getResolution() ?? 1);
}

export function planRoute(map: Pick<OlMap, 'getView'>, route: LineString, options: RouteOptions = {}): FramePlan {
    const view = map.getView();
    const fps = options.fps ?? DEFAULT_FPS;
    const size = options.size ?? DEFAULT_SIZE;
    const duration = options.duration ?? 10;
    const follow = options.follow ?? true;
    const hold = Math.min(0.5, duration * 0.1);
    const [holdStart, holdEnd] = options.hold ?? [hold, hold];
    const easing = options.easing ?? ((t: number): number => t);
    const measure = measureRoute(route, view.getProjection());

    const count = Math.max(2, Math.round(duration * fps));
    const span = (count - 1) / fps - holdStart - holdEnd;
    if (!(span > 0)) throw new RangeError('The duration is too short for the hold times');

    const zoom = options.zoom ?? (follow ? 'view' : 'fit');
    const resolution = resolutionFor(map, route, size, zoom, options.padding ?? 48);
    const fixedCenter = getCenter(route.getExtent());
    const window = (options.smoothing ?? 0.5) * (measure.length / span);
    const baseRotation = view.getRotation();

    const frames: FrameState[] = [];
    let rotation = options.rotate ? -measure.headingAt(0, window) : baseRotation;
    for (let i = 0; i < count; i += 1) {
        const linear = Math.min(1, Math.max(0, (i / fps - holdStart) / span));
        const along = Math.min(1, Math.max(0, easing(linear)));
        const distance = along * measure.length;
        const heading = measure.headingAt(distance, window);
        if (options.rotate) rotation = unwrap(-heading, rotation);
        frames.push({
            center: follow ? measure.pointAt(distance) : fixedCenter,
            resolution,
            rotation,
            along,
            heading,
        });
    }
    return { fps, size, frames };
}
