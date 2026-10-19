import type { LngLat } from './types.js';

const RAD = Math.PI / 180;
const RADIUS = 6371008.8;

export function haversine(a: LngLat, b: LngLat): number {
    const dLat = (b[1] - a[1]) * RAD;
    const dLng = (b[0] - a[0]) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
    return 2 * RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function initialBearing(a: LngLat, b: LngLat): number {
    const phi1 = a[1] * RAD;
    const phi2 = b[1] * RAD;
    const dLambda = (b[0] - a[0]) * RAD;
    const y = Math.sin(dLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
    return Math.atan2(y, x) / RAD;
}

export interface LngLatMeasure {
    readonly length: number;
    pointAt: (distance: number) => LngLat;
    headingAt: (distance: number, window: number) => number;
}

export function measureLine(coordinates: readonly LngLat[]): LngLatMeasure {
    const points = coordinates.map((c): LngLat => [c[0], c[1]]);
    const cumulative = [0];
    for (let i = 1; i < points.length; i += 1) {
        cumulative.push((cumulative[i - 1] ?? 0) + haversine(points[i - 1] ?? [0, 0], points[i] ?? [0, 0]));
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

    const pointAt = (distance: number): LngLat => {
        const s = Math.min(length, Math.max(0, distance));
        const i = segment(s);
        const a = points[i] ?? [0, 0];
        const b = points[i + 1] ?? a;
        const start = cumulative[i] ?? 0;
        const span = (cumulative[i + 1] ?? start) - start;
        const t = span > 0 ? (s - start) / span : 0;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
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
        return initialBearing(a, b);
    };

    return { length, pointAt, headingAt };
}
