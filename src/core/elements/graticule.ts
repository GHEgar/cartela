import { fromLonLat, toLonLat, transform, type ProjectionLike } from 'ol/proj.js';
import { formatDegrees } from '../geo.js';
import { fromUtm, toUtm, utmZone } from '../utm.js';
import type { Box, DrawEnv, SheetElement } from '../types.js';
import { labelBand, labelSize } from './grid.js';
import {
    autoInterval, border, crossings, range, sampleLines,
    type Axis, type Crossing, type GridLine, type Point, type Side,
} from './graticule-lines.js';

export type GraticuleCrs = 'lonlat' | 'utm' | ProjectionLike;

export interface GraticuleOptions {
    crs?: GraticuleCrs;
    zone?: number | 'auto';
    interval?: number | [number, number] | 'auto';
    lines?: boolean;
    labels?: boolean;
    sides?: Side[];
    format?: (value: number, axis: Axis) => string;
    color?: string;
}

interface Reference {
    toCrs: (pixel: Point) => Point;
    toPixel: (point: Point) => Point;
    angular: boolean;
    format: (value: number, axis: Axis) => string;
}

export function formatMeters(value: number, suffix = ''): string {
    const digits = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${value < 0 ? '−' : ''}${digits} m${suffix}`;
}

function reference(options: GraticuleOptions, env: DrawEnv): Reference {
    const { projection } = env.snapshot;
    const crs = options.crs ?? 'lonlat';
    const toMap = (pixel: Point): number[] => env.toCoordinate(pixel[0], pixel[1]);
    if (crs === 'lonlat') {
        return {
            toCrs: pixel => toLonLat(toMap(pixel), projection) as Point,
            toPixel: point => env.toPixel(fromLonLat(point, projection)),
            angular: true,
            format: (value, axis) => formatDegrees(value, axis === 'x' ? 'lon' : 'lat'),
        };
    }
    if (crs === 'utm') {
        const center = toLonLat(env.snapshot.center, projection);
        const zone = options.zone === undefined || options.zone === 'auto' ? utmZone(center[0] ?? 0) : options.zone;
        const south = (center[1] ?? 0) < 0;
        return {
            toCrs: pixel => {
                const utm = toUtm(toLonLat(toMap(pixel), projection), zone, south);
                return [utm.easting, utm.northing];
            },
            toPixel: ([easting, northing]) => env.toPixel(fromLonLat(fromUtm({ easting, northing, zone, south }), projection)),
            angular: false,
            format: (value, axis) => formatMeters(value, axis === 'x' ? ' E' : ' N'),
        };
    }
    return {
        toCrs: pixel => transform(toMap(pixel), projection, crs) as Point,
        toPixel: point => env.toPixel(transform(point, crs, projection)),
        angular: false,
        format: value => formatMeters(value),
    };
}

function intervals(options: GraticuleOptions, span: Point, angular: boolean): [number, number] {
    const { interval } = options;
    if (Array.isArray(interval)) return interval;
    if (typeof interval === 'number') return [interval, interval];
    return [autoInterval(span[0], angular), autoInterval(span[1], angular)];
}

function stroke(ctx: CanvasRenderingContext2D, lines: GridLine[], frame: Box, env: DrawEnv, color: string): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.width, frame.height);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = env.mm(0.15);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const line of lines) {
        let pen = false;
        for (const [x, y] of line.points) {
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                pen = false;
                continue;
            }
            if (pen) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
            pen = true;
        }
    }
    ctx.stroke();
    ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, crossing: Crossing, text: string, frame: Box, gap: number): void {
    const { side, at } = crossing;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (side === 'top') ctx.translate(at, frame.y - gap);
    if (side === 'bottom') {
        ctx.translate(at, frame.y + frame.height + gap);
        ctx.textBaseline = 'top';
    }
    if (side === 'left') {
        ctx.translate(frame.x - gap, at);
        ctx.rotate(-Math.PI / 2);
    }
    if (side === 'right') {
        ctx.translate(frame.x + frame.width + gap, at);
        ctx.rotate(Math.PI / 2);
    }
    ctx.fillText(text, 0, 0);
    ctx.restore();
}

function drawLabels(ctx: CanvasRenderingContext2D, found: Crossing[], frame: Box, env: DrawEnv, ref: Reference, options: GraticuleOptions): void {
    const format = options.format ?? ref.format;
    const sides = new Set(options.sides ?? ['top', 'right', 'bottom', 'left']);
    const gap = env.mm(0.8) + env.mm(env.theme.frameWidth);
    const spacing = env.mm(1.5);
    ctx.font = env.font(labelSize(env.theme));
    ctx.fillStyle = env.theme.muted;
    for (const side of sides) {
        let end = -Infinity;
        const horizontal = side === 'top' || side === 'bottom';
        const low = horizontal ? frame.x : frame.y;
        const high = horizontal ? frame.x + frame.width : frame.y + frame.height;
        const placed = found.filter(c => c.side === side).sort((a, b) => a.at - b.at);
        for (const crossing of placed) {
            const text = format(crossing.value, crossing.axis);
            const half = ctx.measureText(text).width / 2;
            if (crossing.at - half < Math.max(low, end + spacing) || crossing.at + half > high) continue;
            label(ctx, crossing, text, frame, gap);
            end = crossing.at + half;
        }
    }
}

export function graticule(options: GraticuleOptions = {}): SheetElement {
    const labels = options.labels ?? true;
    return {
        slot: 'frame',
        reserve: theme => {
            if (!labels) return {};
            const band = labelBand(theme);
            return { top: band, right: band, bottom: band, left: band };
        },
        draw: (ctx, frame, env) => {
            const ref = reference(options, env);
            const { min, max } = range(border(frame).map(ref.toCrs));
            if (![...min, ...max].every(Number.isFinite)) return;
            const interval = intervals(options, [max[0] - min[0], max[1] - min[1]], ref.angular);
            const lines = sampleLines(ref.toPixel, min, max, interval);
            if (options.lines ?? true) stroke(ctx, lines, frame, env, options.color ?? env.theme.frame);
            if (labels) drawLabels(ctx, crossings(lines, frame), frame, env, ref, options);
        },
    };
}
