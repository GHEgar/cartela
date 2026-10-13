import type { Coordinate } from 'ol/coordinate.js';
import type LineString from 'ol/geom/LineString.js';
import type { ProjectionLike } from 'ol/proj.js';
import { toLonLat } from 'ol/proj.js';
import { getDistance } from 'ol/sphere.js';

export interface RouteMeasure {
    readonly length: number;
    pointAt: (distance: number) => Coordinate;
    headingAt: (distance: number, window: number) => number;
    slice: (distance: number) => Coordinate[];
}

function lerp(a: Coordinate, b: Coordinate, t: number): Coordinate {
    return [(a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t, (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t];
}

export function measureRoute(route: LineString, projection: ProjectionLike): RouteMeasure {
    const points = route.getCoordinates().map(c => [c[0] ?? 0, c[1] ?? 0]);
    const cumulative = [0];
    for (let i = 1; i < points.length; i += 1) {
        const step = getDistance(toLonLat(points[i - 1] ?? [0, 0], projection), toLonLat(points[i] ?? [0, 0], projection));
        cumulative.push((cumulative[i - 1] ?? 0) + step);
    }
    const length = cumulative[cumulative.length - 1] ?? 0;
    if (points.length < 2 || !(length > 0)) throw new RangeError('The route has no length');

    const segment = (distance: number): number => {
        let low = 0;
        let high = cumulative.length - 1;
        while (high - low > 1) {
            const mid = (low + high) >> 1;
            if ((cumulative[mid] ?? 0) <= distance) low = mid;
            else high = mid;
        }
        return low;
    };

    const pointAt = (distance: number): Coordinate => {
        const s = Math.min(length, Math.max(0, distance));
        const i = segment(s);
        const start = cumulative[i] ?? 0;
        const span = (cumulative[i + 1] ?? start) - start;
        return lerp(points[i] ?? [0, 0], points[i + 1] ?? points[i] ?? [0, 0], span > 0 ? (s - start) / span : 0);
    };

    const headingAt = (distance: number, window: number): number => {
        const w = Math.max(window, length * 1e-6);
        let a = pointAt(distance - w);
        let b = pointAt(distance + w);
        if (a[0] === b[0] && a[1] === b[1]) {
            const i = Math.min(segment(distance), points.length - 2);
            a = points[i] ?? a;
            b = points[i + 1] ?? b;
        }
        return Math.atan2((b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0));
    };

    const slice = (distance: number): Coordinate[] => {
        const s = Math.min(length, Math.max(0, distance));
        const i = segment(s);
        return [...points.slice(0, i + 1), pointAt(s)];
    };

    return { length, pointAt, headingAt, slice };
}
