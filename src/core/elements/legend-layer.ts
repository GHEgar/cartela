import type { SymbolEntry } from './legend-entries.js';

export interface LegendClassItem {
    label: string;
    color: string;
    min?: number;
    max?: number;
    count?: number;
}

export interface LegendStopItem {
    value: number;
    color: string;
}

export interface LegendSymbolItem {
    label: string;
    color: string;
    shape: 'point' | 'line' | 'fill';
}

export interface ClassesLegend {
    kind: 'classes';
    layerId: string;
    title: string;
    classes: readonly LegendClassItem[];
    histogram?: boolean;
}

export interface RampLegend {
    kind: 'ramp';
    layerId: string;
    title: string;
    stops: readonly LegendStopItem[];
}

export interface ImageUrlLegend {
    kind: 'image';
    layerId: string;
    title: string;
    url: string;
}

export interface SymbolsLegend {
    kind: 'symbols';
    layerId: string;
    title: string;
    items: readonly LegendSymbolItem[];
}

export type LayerLegend = ClassesLegend | RampLegend | ImageUrlLegend | SymbolsLegend;

export interface HistogramBar {
    label: string;
    color: string;
    count: number;
}

export type LayerPart =
    | { kind: 'heading'; text: string }
    | { kind: 'symbol'; entry: SymbolEntry }
    | { kind: 'histogram'; bars: HistogramBar[] }
    | { kind: 'ramp'; stops: LegendStopItem[] };

const SHAPES = { point: 'circle', line: 'line', fill: 'box' } as const;

function symbolOf(item: LegendSymbolItem): SymbolEntry {
    return item.shape === 'line'
        ? { label: item.label, stroke: item.color, shape: 'line' }
        : { label: item.label, fill: item.color, shape: SHAPES[item.shape] };
}

export function layerParts(entry: Exclude<LayerLegend, ImageUrlLegend>, histogram: boolean): LayerPart[] {
    const heading: LayerPart = { kind: 'heading', text: entry.title };
    if (entry.kind === 'ramp') {
        const stops = [...entry.stops].sort((a, b) => a.value - b.value);
        return stops.length ? [heading, { kind: 'ramp', stops }] : [heading];
    }
    if (entry.kind === 'symbols') return [heading, ...entry.items.map((item): LayerPart => ({ kind: 'symbol', entry: symbolOf(item) }))];
    const counted = entry.classes.some(item => item.count !== undefined);
    if ((entry.histogram ?? histogram) && counted) {
        return [heading, { kind: 'histogram', bars: entry.classes.map(({ label, color, count }) => ({ label, color, count: count ?? 0 })) }];
    }
    return [heading, ...entry.classes.map((item): LayerPart => ({ kind: 'symbol', entry: { label: item.label, fill: item.color, shape: 'box' } }))];
}
