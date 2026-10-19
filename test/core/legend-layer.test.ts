import { describe, expect, it, vi } from 'vitest';
import { legend } from '../../src/core/elements/legend.js';
import { resolveEntries } from '../../src/core/elements/legend-entries.js';
import type { LayerLegend } from '../../src/core/index.js';
import type { DrawEnv } from '../../src/core/types.js';

vi.mock('../../src/core/elements/draw.js', async (original) => ({
    ...await original<typeof import('../../src/core/elements/draw.js')>(),
    loadImage: vi.fn(async (url: string) => {
        if (url.includes('broken')) throw new Error('broken');
        return { width: 40, height: 20 } as unknown as HTMLImageElement;
    }),
}));

const env = {
    dpi: 96,
    mm: (v: number) => v,
    pt: (v: number) => v,
    font: () => '10px sans-serif',
    theme: { fontSize: 10, color: '#000', muted: '#777' },
    snapshot: { resolution: 1 },
} as unknown as DrawEnv;

const recorder = () => {
    const bars: { color: unknown; width: number; height: number }[] = [];
    const stops: [number, string][] = [];
    const texts: string[] = [];
    const state: Record<string, unknown> = {};
    const ctx = new Proxy(state, {
        get(target, key) {
            if (key === 'measureText') return (text: string) => ({ width: text.length });
            if (key === 'fillText') return (text: string) => texts.push(text);
            if (key === 'fillRect') return (_x: number, _y: number, width: number, height: number) => bars.push({ color: target.fillStyle, width, height });
            if (key === 'createLinearGradient') return () => ({ addColorStop: (offset: number, color: string) => stops.push([offset, color]) });
            if (key in target) return target[key as string];
            return () => undefined;
        },
        set(target, key, value) {
            target[key as string] = value;
            return true;
        },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, bars, stops, texts };
};

const classes: LayerLegend = {
    kind: 'classes',
    layerId: 'hex',
    title: 'Crimes',
    classes: [
        { label: '0 – 10', color: '#aaa', min: 0, max: 10, count: 5 },
        { label: '10 – 20', color: '#555', min: 10, max: 20, count: 10 },
    ],
};

describe('layer legends', () => {
    it('draws classes as symbols unless a histogram is asked for', async () => {
        expect(await resolveEntries([classes], env)).toEqual([
            { kind: 'heading', text: 'Crimes' },
            { kind: 'symbol', entry: { label: '0 – 10', fill: '#aaa', shape: 'box' } },
            { kind: 'symbol', entry: { label: '10 – 20', fill: '#555', shape: 'box' } },
        ]);
        expect(await resolveEntries([classes], env, undefined, true)).toEqual([
            { kind: 'heading', text: 'Crimes' },
            { kind: 'histogram', bars: [{ label: '0 – 10', color: '#aaa', count: 5 }, { label: '10 – 20', color: '#555', count: 10 }] },
        ]);
        expect(await resolveEntries([{ ...classes, histogram: false }], env, undefined, true)).toHaveLength(3);
    });

    it('falls back to symbols when no class has a count', async () => {
        const plain: LayerLegend = { kind: 'classes', layerId: 'a', title: 'A', classes: [{ label: 'x', color: '#000' }] };
        expect((await resolveEntries([plain], env, undefined, true))[1]?.kind).toBe('symbol');
    });

    it('maps symbols, sorts ramp stops and loads images under their title', async () => {
        const resolved = await resolveEntries([
            { kind: 'symbols', layerId: 's', title: 'Roads', items: [
                { label: 'Stop', color: '#f00', shape: 'point' },
                { label: 'Road', color: '#0f0', shape: 'line' },
                { label: 'Park', color: '#00f', shape: 'fill' },
            ] },
            { kind: 'ramp', layerId: 'r', title: 'NDVI', stops: [{ value: 1, color: '#0f0' }, { value: -1, color: '#f00' }] },
            { kind: 'image', layerId: 'w', title: 'Rivers', url: 'https://example.test/legend.png' },
            { kind: 'image', layerId: 'b', title: 'Broken', url: 'https://example.test/broken.png' },
        ], env);
        expect(resolved.map(entry => entry.kind)).toEqual(['heading', 'symbol', 'symbol', 'symbol', 'heading', 'ramp', 'image']);
        expect(resolved.slice(1, 4)).toEqual([
            { kind: 'symbol', entry: { label: 'Stop', fill: '#f00', shape: 'circle' } },
            { kind: 'symbol', entry: { label: 'Road', stroke: '#0f0', shape: 'line' } },
            { kind: 'symbol', entry: { label: 'Park', fill: '#00f', shape: 'box' } },
        ]);
        expect(resolved[5]).toEqual({ kind: 'ramp', stops: [{ value: -1, color: '#f00' }, { value: 1, color: '#0f0' }] });
        expect(resolved[6]).toMatchObject({ kind: 'image', label: 'Rivers', size: [40, 20], scale: 1 });
    });

    it('draws the histogram with bars proportional to the counts', async () => {
        const element = legend([classes], { histogram: true, symbolSize: 4 });
        const { ctx, bars, texts } = recorder();
        await element.load?.(env);
        const height = element.measure?.(ctx, 100, env) ?? 0;
        expect(height).toBeGreaterThan(0);
        element.draw(ctx, { x: 0, y: 0, width: 100, height: 200 }, env);
        expect(bars.map(bar => bar.color)).toEqual(['#aaa', '#555']);
        expect(bars[1]?.width).toBeCloseTo((bars[0]?.width ?? 0) * 2);
        expect(texts).toEqual(expect.arrayContaining(['Crimes', '0 – 10', '5', '10']));
    });

    it('draws a ramp as a gradient with its end values', async () => {
        const element = legend([{ kind: 'ramp', layerId: 'r', title: 'NDVI', stops: [{ value: -1, color: '#f00' }, { value: 0, color: '#fff' }, { value: 1, color: '#0f0' }] }], { format: v => `${v}!` });
        const { ctx, stops, texts } = recorder();
        await element.load?.(env);
        element.draw(ctx, { x: 0, y: 0, width: 100, height: 200 }, env);
        expect(stops).toEqual([[0, '#f00'], [0.5, '#fff'], [1, '#0f0']]);
        expect(texts).toEqual(expect.arrayContaining(['-1!', '1!']));
    });
});
