import { CSS_DPI } from '../units.js';
import { drawText, measureText } from './draw.js';
import { resolveEntries, type LegendEntry, type ResolvedEntry } from './legend-entries.js';
import { drawHistogram, drawRamp, formatValue, histogramHeight, rampHeight, type ValueFormat } from './legend-graphics.js';
import type { Box, DrawEnv, SheetElement } from '../types.js';

export interface LegendOptions {
    title?: string;
    symbolSize?: number;
    histogram?: boolean;
    format?: ValueFormat;
    colorScope?: Element;
}

interface Placed {
    entry: ResolvedEntry;
    height: number;
    shrink: number;
}

function imageDimensions(entry: Extract<ResolvedEntry, { kind: 'image' }>, env: DrawEnv, maxWidth: number): [number, number] {
    const factor = env.dpi / CSS_DPI / entry.scale;
    let width = entry.size[0] * factor;
    let height = entry.size[1] * factor;
    if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
    }
    return [width, height];
}

function entryHeight(ctx: CanvasRenderingContext2D, entry: ResolvedEntry, width: number, env: DrawEnv, symbol: number): number {
    const { theme } = env;
    if (entry.kind === 'heading') return measureText(ctx, entry.text, width, { size: theme.fontSize, weight: '700' }, env);
    if (entry.kind === 'histogram') return histogramHeight(ctx, entry.bars, width, env, symbol);
    if (entry.kind === 'ramp') return rampHeight(env, symbol);
    if (entry.kind === 'symbol') {
        const label = measureText(ctx, entry.entry.label, width - symbol - env.mm(2), { size: theme.fontSize }, env);
        return Math.max(symbol, label);
    }
    const label = entry.label ? measureText(ctx, entry.label, width, { size: theme.fontSize, weight: '700' }, env) + env.mm(1) : 0;
    return label + imageDimensions(entry, env, width)[1];
}

function drawSymbol(ctx: CanvasRenderingContext2D, entry: ResolvedEntry & { kind: 'symbol' }, box: Box, size: number, env: DrawEnv): void {
    const { fill, stroke, shape = 'box' } = entry.entry;
    ctx.save();
    ctx.lineWidth = env.mm(0.3);
    ctx.strokeStyle = stroke ?? env.theme.color;
    ctx.fillStyle = fill ?? 'transparent';
    ctx.beginPath();
    if (shape === 'line') {
        ctx.lineWidth = env.mm(0.6);
        ctx.strokeStyle = stroke ?? fill ?? env.theme.color;
        ctx.moveTo(box.x, box.y + size / 2);
        ctx.lineTo(box.x + size, box.y + size / 2);
    } else if (shape === 'circle') {
        ctx.arc(box.x + size / 2, box.y + size / 2, size / 2 - ctx.lineWidth, 0, Math.PI * 2);
    } else {
        ctx.rect(box.x, box.y, size, size);
    }
    if (shape !== 'line' && fill) ctx.fill();
    if (shape === 'line' || stroke || !fill) ctx.stroke();
    ctx.restore();
    drawText(ctx, entry.entry.label, { ...box, x: box.x + size + env.mm(2), width: box.width - size - env.mm(2) }, { size: env.theme.fontSize }, env);
}

function drawEntry(ctx: CanvasRenderingContext2D, placed: Placed, box: Box, env: DrawEnv, symbol: number, format: ValueFormat): void {
    const { entry } = placed;
    if (entry.kind === 'histogram') {
        drawHistogram(ctx, entry.bars, box, env, symbol);
        return;
    }
    if (entry.kind === 'ramp') {
        drawRamp(ctx, entry.stops, box, env, symbol, format);
        return;
    }
    if (entry.kind === 'heading') {
        drawText(ctx, entry.text, box, { size: env.theme.fontSize, weight: '700' }, env);
        return;
    }
    if (entry.kind === 'symbol') {
        drawSymbol(ctx, entry, box, symbol, env);
        return;
    }
    let y = box.y;
    if (entry.label) y += drawText(ctx, entry.label, box, { size: env.theme.fontSize, weight: '700' }, env) + env.mm(1);
    const [width, height] = imageDimensions(entry, env, box.width);
    ctx.drawImage(entry.source, box.x, y, width * placed.shrink, height * placed.shrink);
}

function naturalHeight(ctx: CanvasRenderingContext2D, entries: ResolvedEntry[], options: LegendOptions, heading: boolean, width: number, env: DrawEnv): number {
    const symbol = env.mm(options.symbolSize ?? 4);
    const gap = env.mm(1.5);
    const title = heading && options.title
        ? measureText(ctx, options.title, width, { size: env.theme.fontSize * 1.2, weight: '700' }, env) + gap
        : 0;
    return entries.reduce((sum, entry, i) => sum + entryHeight(ctx, entry, width, env, symbol) + (i ? gap : 0), title);
}

function legendPart(entries: ResolvedEntry[], options: LegendOptions, heading: boolean): SheetElement {
    return {
        slot: 'panel',
        grow: true,
        measure: (ctx, width, env) => naturalHeight(ctx, entries, options, heading, width, env),
        draw: (ctx, box, env) => {
            const symbol = env.mm(options.symbolSize ?? 4);
            const gap = env.mm(1.5);
            let y = box.y;
            if (heading && options.title) {
                y += drawText(ctx, options.title, box, { size: env.theme.fontSize * 1.2, weight: '700' }, env) + gap;
            }
            let index = 0;
            for (; index < entries.length; index += 1) {
                const entry = entries[index];
                if (!entry) break;
                const height = entryHeight(ctx, entry, box.width, env, symbol);
                const room = box.y + box.height - y;
                const next = entries[index + 1];
                const keep = entry.kind === 'heading' && next ? gap + entryHeight(ctx, next, box.width, env, symbol) : 0;
                if (height + keep > room && index > 0) break;
                const shrink = height > room && entry.kind === 'image' ? room / height : 1;
                drawEntry(ctx, { entry, height, shrink }, { ...box, y, height: height * shrink }, env, symbol, options.format ?? formatValue);
                y += height * shrink + gap;
            }
            const rest = entries.slice(index);
            return rest.length ? legendPart(rest, options, false) : null;
        },
    };
}

export function legend(entries: readonly LegendEntry[], options: LegendOptions = {}): SheetElement {
    let resolved: ResolvedEntry[] = [];
    const part = (): SheetElement => legendPart(resolved, options, true);
    return {
        slot: 'panel',
        grow: true,
        load: async (env, signal) => {
            resolved = await resolveEntries(entries, env, signal, options.histogram ?? false, options.colorScope);
        },
        measure: (ctx, width, env) => naturalHeight(ctx, resolved, options, true, width, env),
        draw: (ctx, box, env) => part().draw(ctx, box, env),
    };
}
