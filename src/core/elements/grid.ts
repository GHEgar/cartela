import { toLonLat } from 'ol/proj.js';
import { formatDegrees } from '../geo.js';
import { MM_PER_INCH } from '../units.js';
import type { Box, DrawEnv, SheetElement, Theme } from '../types.js';

export type CoordinateFormat = 'dms' | 'decimal' | ((value: number, axis: 'lon' | 'lat') => string);

export interface GridOptions {
    divisions?: [number, number];
    lines?: boolean;
    labels?: boolean;
    format?: CoordinateFormat;
}

function formatter(format: CoordinateFormat): (value: number, axis: 'lon' | 'lat') => string {
    if (typeof format === 'function') return format;
    if (format === 'decimal') return value => `${value.toFixed(4)}°`;
    return formatDegrees;
}

export const labelSize = (theme: Theme): number => theme.fontSize * 0.85;

export function labelBand(theme: Theme): number {
    return (labelSize(theme) * MM_PER_INCH) / 72 * 1.3 + 1.2 + theme.frameWidth;
}

export function grid(options: GridOptions = {}): SheetElement {
    const [nx, ny] = options.divisions ?? [4, 3];
    const labels = options.labels ?? true;
    const format = formatter(options.format ?? 'dms');

    const lonLat = (env: DrawEnv, x: number, y: number): number[] =>
        toLonLat(env.toCoordinate(x, y), env.snapshot.projection);

    const paint = (ctx: CanvasRenderingContext2D, frame: Box, env: DrawEnv): undefined => {
        const { theme } = env;
        const tick = env.mm(1.5);
        const xs = Array.from({ length: nx + 1 }, (_, i) => frame.x + (frame.width * i) / nx);
        const ys = Array.from({ length: ny + 1 }, (_, i) => frame.y + (frame.height * i) / ny);
        ctx.save();
        ctx.strokeStyle = theme.frame;
        ctx.lineWidth = env.mm(0.15);
        ctx.beginPath();
        for (const x of xs.slice(1, -1)) {
            if (options.lines ?? true) {
                ctx.moveTo(x, frame.y);
                ctx.lineTo(x, frame.y + frame.height);
            } else {
                ctx.moveTo(x, frame.y);
                ctx.lineTo(x, frame.y + tick);
                ctx.moveTo(x, frame.y + frame.height - tick);
                ctx.lineTo(x, frame.y + frame.height);
            }
        }
        for (const y of ys.slice(1, -1)) {
            if (options.lines ?? true) {
                ctx.moveTo(frame.x, y);
                ctx.lineTo(frame.x + frame.width, y);
            } else {
                ctx.moveTo(frame.x, y);
                ctx.lineTo(frame.x + tick, y);
                ctx.moveTo(frame.x + frame.width - tick, y);
                ctx.lineTo(frame.x + frame.width, y);
            }
        }
        ctx.globalAlpha = 0.45;
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (labels) drawLabels(ctx, frame, env, xs.slice(1, -1), ys.slice(1, -1));
        ctx.restore();
    };

    const drawLabels = (ctx: CanvasRenderingContext2D, frame: Box, env: DrawEnv, xs: number[], ys: number[]): void => {
        const gap = env.mm(0.8) + env.mm(env.theme.frameWidth);
        ctx.font = env.font(labelSize(env.theme));
        ctx.fillStyle = env.theme.muted;
        ctx.textAlign = 'center';
        const bottom = frame.y + frame.height;
        for (const x of xs) {
            ctx.textBaseline = 'bottom';
            ctx.fillText(format(lonLat(env, x, frame.y)[0] ?? 0, 'lon'), x, frame.y - gap);
            ctx.textBaseline = 'top';
            ctx.fillText(format(lonLat(env, x, bottom)[0] ?? 0, 'lon'), x, bottom + gap);
        }
        const right = frame.x + frame.width;
        for (const y of ys) {
            ctx.save();
            ctx.translate(frame.x - gap, y);
            ctx.rotate(-Math.PI / 2);
            ctx.textBaseline = 'bottom';
            ctx.fillText(format(lonLat(env, frame.x, y)[1] ?? 0, 'lat'), 0, 0);
            ctx.restore();
            ctx.save();
            ctx.translate(right + gap, y);
            ctx.rotate(Math.PI / 2);
            ctx.textBaseline = 'bottom';
            ctx.fillText(format(lonLat(env, right, y)[1] ?? 0, 'lat'), 0, 0);
            ctx.restore();
        }
        ctx.textAlign = 'left';
    };

    return {
        slot: 'frame',
        reserve: theme => {
            if (!labels) return {};
            const band = labelBand(theme);
            return { top: band, right: band, bottom: band, left: band };
        },
        draw: paint,
    };
}
