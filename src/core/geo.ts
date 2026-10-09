import type { Coordinate } from 'ol/coordinate.js';
import type { Extent } from 'ol/extent.js';
import type { Size } from './types.js';

export function pixelToCoordinate(
    center: Coordinate,
    resolution: number,
    rotation: number,
    size: Size,
    pixel: Coordinate,
): Coordinate {
    const dx = ((pixel[0] ?? 0) - size[0] / 2) * resolution;
    const dy = (size[1] / 2 - (pixel[1] ?? 0)) * resolution;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return [
        (center[0] ?? 0) + dx * cos - dy * sin,
        (center[1] ?? 0) + dx * sin + dy * cos,
    ];
}

export function rotatedExtent(center: Coordinate, resolution: number, rotation: number, size: Size): Extent {
    const corners = [[0, 0], [size[0], 0], [size[0], size[1]], [0, size[1]]]
        .map(pixel => pixelToCoordinate(center, resolution, rotation, size, pixel));
    const xs = corners.map(c => c[0] ?? 0);
    const ys = corners.map(c => c[1] ?? 0);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function fitResolution(extent: Extent, size: Size, fit: 'contain' | 'cover'): number {
    const [minX = 0, minY = 0, maxX = 0, maxY = 0] = extent;
    const rx = (maxX - minX) / size[0];
    const ry = (maxY - minY) / size[1];
    return fit === 'contain' ? Math.max(rx, ry) : Math.min(rx, ry);
}

export function niceStep(value: number): number {
    if (!(value > 0)) return 0;
    const power = 10 ** Math.floor(Math.log10(value));
    const fraction = value / power;
    const nice = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
    return nice * power;
}

export function formatDegrees(value: number, axis: 'lon' | 'lat'): string {
    const hemisphere = axis === 'lon' ? (value < 0 ? 'W' : 'E') : (value < 0 ? 'S' : 'N');
    const abs = Math.abs(value);
    let degrees = Math.floor(abs);
    let minutes = Math.floor((abs - degrees) * 60);
    let seconds = Math.round(((abs - degrees) * 60 - minutes) * 60);
    if (seconds === 60) {
        seconds = 0;
        minutes += 1;
    }
    if (minutes === 60) {
        minutes = 0;
        degrees += 1;
    }
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${degrees}°${pad(minutes)}′${pad(seconds)}″${hemisphere}`;
}

export function formatDistance(meters: number): string {
    return meters >= 1000 ? `${trim(meters / 1000)} km` : `${trim(meters)} m`;
}

function trim(value: number): string {
    return String(Number(value.toFixed(3)));
}
