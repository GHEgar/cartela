import { drawText, measureText } from './draw.js';
import type { HistogramBar, LegendStopItem } from './legend-layer.js';
import type { Box, DrawEnv } from '../types.js';

export type ValueFormat = (value: number) => string;

export const formatValue: ValueFormat = (value) => {
    const rounded = Number(value.toFixed(2));
    return Object.is(rounded, -0) ? '0' : String(rounded);
};

const LABEL_SHARE = 0.4;

function rowHeight(ctx: CanvasRenderingContext2D, label: string, width: number, env: DrawEnv, symbol: number): number {
    return Math.max(symbol, measureText(ctx, label, width * LABEL_SHARE, { size: env.theme.fontSize }, env));
}

export function histogramHeight(ctx: CanvasRenderingContext2D, bars: readonly HistogramBar[], width: number, env: DrawEnv, symbol: number): number {
    const gap = env.mm(1);
    return bars.reduce((sum, bar, i) => sum + rowHeight(ctx, bar.label, width, env, symbol) + (i ? gap : 0), 0);
}

export function drawHistogram(ctx: CanvasRenderingContext2D, bars: readonly HistogramBar[], box: Box, env: DrawEnv, symbol: number): void {
    const gap = env.mm(1);
    const labelWidth = box.width * LABEL_SHARE;
    const max = Math.max(0, ...bars.map(bar => bar.count));
    ctx.font = env.font(env.theme.fontSize);
    const countWidth = ctx.measureText(String(max)).width + env.mm(1);
    const area = Math.max(0, box.width - labelWidth - env.mm(2) - countWidth);
    let y = box.y;
    for (const bar of bars) {
        const height = rowHeight(ctx, bar.label, box.width, env, symbol);
        drawText(ctx, bar.label, { x: box.x, y, width: labelWidth, height }, { size: env.theme.fontSize }, env);
        const x = box.x + labelWidth + env.mm(2);
        const length = max > 0 ? (area * bar.count) / max : 0;
        ctx.fillStyle = bar.color;
        ctx.fillRect(x, y, length, symbol);
        drawText(ctx, String(bar.count), { x: x + length + env.mm(1), y, width: countWidth, height }, { size: env.theme.fontSize, color: env.theme.muted }, env);
        y += height + gap;
    }
}

export function rampHeight(env: DrawEnv, symbol: number): number {
    return symbol + env.mm(1) + env.pt(env.theme.fontSize) * 1.3;
}

export function drawRamp(ctx: CanvasRenderingContext2D, stops: readonly LegendStopItem[], box: Box, env: DrawEnv, symbol: number, format: ValueFormat): void {
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (!first || !last) return;
    const span = last.value - first.value;
    const gradient = ctx.createLinearGradient(box.x, 0, box.x + box.width, 0);
    for (const stop of stops) gradient.addColorStop(span > 0 ? (stop.value - first.value) / span : 0, stop.color);
    ctx.fillStyle = gradient;
    ctx.fillRect(box.x, box.y, box.width, symbol);
    const labels = { ...box, y: box.y + symbol + env.mm(1) };
    drawText(ctx, format(first.value), labels, { size: env.theme.fontSize }, env);
    if (stops.length > 1) drawText(ctx, format(last.value), labels, { size: env.theme.fontSize, align: 'right' }, env);
}
