import type { Box } from '../types.js';

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Axis = 'x' | 'y';
export type Point = [number, number];

export interface Crossing {
    side: Side;
    at: number;
    value: number;
    axis: Axis;
}

export interface GridLine {
    axis: Axis;
    value: number;
    points: Point[];
}

const DMS_STEPS = [30, 20, 15, 10, 5, 2, 1, 30 / 60, 20 / 60, 15 / 60, 10 / 60, 5 / 60, 2 / 60, 1 / 60,
    30 / 3600, 20 / 3600, 15 / 3600, 10 / 3600, 5 / 3600, 2 / 3600, 1 / 3600];

export function autoInterval(span: number, angular: boolean, maxLines = 6): number {
    if (!(span > 0)) return 1;
    if (angular) {
        const fitting = DMS_STEPS.filter(step => span / step <= maxLines);
        return fitting[fitting.length - 1] ?? DMS_STEPS[0] ?? 1;
    }
    let power = 10 ** Math.floor(Math.log10(span / maxLines));
    for (;;) {
        for (const factor of [1, 2, 2.5, 5]) {
            if (span / (factor * power) <= maxLines) return factor * power;
        }
        power *= 10;
    }
}

export function border(frame: Box, perSide = 24): Point[] {
    const { x, y, width, height } = frame;
    const points: Point[] = [];
    for (let i = 0; i < perSide; i += 1) {
        const t = i / perSide;
        points.push([x + width * t, y], [x + width, y + height * t], [x + width * (1 - t), y + height], [x, y + height * (1 - t)]);
    }
    return points;
}

export function range(values: Point[]): { min: Point; max: Point } {
    const xs = values.map(v => v[0]).filter(Number.isFinite);
    const ys = values.map(v => v[1]).filter(Number.isFinite);
    return { min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)] };
}

export function steps(min: number, max: number, interval: number): number[] {
    const first = Math.ceil(min / interval - 1e-9);
    const last = Math.floor(max / interval + 1e-9);
    const values: number[] = [];
    for (let k = first; k <= last && values.length < 200; k += 1) values.push(Number((k * interval).toPrecision(12)));
    return values;
}

export function sampleLines(
    toPixel: (point: Point) => Point,
    min: Point,
    max: Point,
    interval: [number, number],
    samples = 64,
): GridLine[] {
    const lines: GridLine[] = [];
    const along = (from: number, to: number): number[] => Array.from({ length: samples + 1 }, (_, i) => from + ((to - from) * i) / samples);
    for (const value of steps(min[0], max[0], interval[0])) {
        lines.push({ axis: 'x', value, points: along(min[1], max[1]).map(y => toPixel([value, y])) });
    }
    for (const value of steps(min[1], max[1], interval[1])) {
        lines.push({ axis: 'y', value, points: along(min[0], max[0]).map(x => toPixel([x, value])) });
    }
    return lines;
}

function hit(a: Point, b: Point, side: Side, frame: Box): number | null {
    const vertical = side === 'left' || side === 'right';
    const edge = side === 'top' ? frame.y : side === 'bottom' ? frame.y + frame.height : side === 'left' ? frame.x : frame.x + frame.width;
    const [a0, a1] = vertical ? [a[0], a[1]] : [a[1], a[0]];
    const [b0, b1] = vertical ? [b[0], b[1]] : [b[1], b[0]];
    if (a0 === b0 || (a0 - edge) * (b0 - edge) > 0) return null;
    const at = a1 + ((edge - a0) / (b0 - a0)) * (b1 - a1);
    const [low, high] = vertical ? [frame.y, frame.y + frame.height] : [frame.x, frame.x + frame.width];
    return at >= low && at <= high ? at : null;
}

export function crossings(lines: GridLine[], frame: Box): Crossing[] {
    const found: Crossing[] = [];
    const sides: Side[] = ['top', 'right', 'bottom', 'left'];
    for (const line of lines) {
        for (let i = 1; i < line.points.length; i += 1) {
            const a = line.points[i - 1];
            const b = line.points[i];
            if (!a || !b || !a.every(Number.isFinite) || !b.every(Number.isFinite)) continue;
            for (const side of sides) {
                const at = hit(a, b, side, frame);
                if (at === null) continue;
                if (found.some(c => c.side === side && c.axis === line.axis && c.value === line.value && Math.abs(c.at - at) < 1)) continue;
                found.push({ side, at, value: line.value, axis: line.axis });
            }
        }
    }
    return found;
}
