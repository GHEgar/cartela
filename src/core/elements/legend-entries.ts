import type OlMap from 'ol/Map.js';
import { imageSize, loadImage } from './draw.js';
import { layerLabel } from '../attributions.js';
import { cssColor } from '../color.js';
import type { DrawEnv } from '../types.js';
import { layerParts, type HistogramBar, type LayerLegend, type LegendStopItem } from './legend-layer.js';

export interface LegendSource {
    getLegendUrl(resolution?: number, params?: Record<string, unknown>): string | undefined;
}

export interface HeadingEntry {
    heading: string;
}

export interface SymbolEntry {
    label: string;
    fill?: string;
    stroke?: string;
    shape?: 'box' | 'line' | 'circle';
}

export interface ImageEntry {
    label?: string;
    image: string | CanvasImageSource;
    scale?: number;
}

export interface WmsEntry {
    label?: string;
    source: LegendSource;
    layer?: string;
    params?: Record<string, unknown>;
    scale?: number;
}

export type LegendEntry = HeadingEntry | SymbolEntry | ImageEntry | WmsEntry | LayerLegend;

export type ResolvedEntry =
    | { kind: 'heading'; text: string }
    | { kind: 'symbol'; entry: SymbolEntry }
    | { kind: 'histogram'; bars: HistogramBar[] }
    | { kind: 'ramp'; stops: LegendStopItem[] }
    | { kind: 'image'; label?: string; source: CanvasImageSource; size: [number, number]; scale: number };

function isWmsSource(value: unknown): value is LegendSource {
    return typeof (value as LegendSource | undefined)?.getLegendUrl === 'function';
}

export function wmsLegends(map: OlMap, params: Record<string, unknown> = {}, scale = 1): WmsEntry[] {
    return map.getAllLayers()
        .filter(layer => layer.getVisible())
        .flatMap(layer => {
            const source = layer.getSource();
            return isWmsSource(source) ? [{ label: layerLabel(layer), source, params, scale }] : [];
        });
}

async function resolveOne(entry: LegendEntry, env: DrawEnv, signal?: AbortSignal, histogram = false): Promise<ResolvedEntry[] | ResolvedEntry | null> {
    if ('kind' in entry) {
        if (entry.kind !== 'image') return layerParts(entry, histogram);
        const image = await loadImage(entry.url, signal).catch(() => null);
        return image ? { kind: 'image', label: entry.title, source: image, size: imageSize(image), scale: 1 } : null;
    }
    if ('heading' in entry) return { kind: 'heading', text: entry.heading };
    if ('source' in entry) {
        const params = entry.layer ? { LAYER: entry.layer, ...entry.params } : { ...entry.params };
        const url = entry.source.getLegendUrl(env.snapshot.resolution, params);
        if (!url) return null;
        const image = await loadImage(url, signal).catch(() => null);
        if (!image) return null;
        return withLabel({ kind: 'image', source: image, size: imageSize(image), scale: entry.scale ?? 1 }, entry.label);
    }
    if ('image' in entry) {
        const source = typeof entry.image === 'string' ? await loadImage(entry.image, signal).catch(() => null) : entry.image;
        if (!source) return null;
        return withLabel({ kind: 'image', source, size: imageSize(source), scale: entry.scale ?? 1 }, entry.label);
    }
    return { kind: 'symbol', entry };
}

function withLabel(entry: Extract<ResolvedEntry, { kind: 'image' }>, label: string | undefined): ResolvedEntry {
    return label === undefined ? entry : { ...entry, label };
}

function withColors(entry: ResolvedEntry, scope?: Element): ResolvedEntry {
    const color = (value: string): string => cssColor(value, scope);
    if (entry.kind === 'histogram') return { ...entry, bars: entry.bars.map(bar => ({ ...bar, color: color(bar.color) })) };
    if (entry.kind === 'ramp') return { ...entry, stops: entry.stops.map(stop => ({ ...stop, color: color(stop.color) })) };
    if (entry.kind !== 'symbol') return entry;
    const symbol: SymbolEntry = { ...entry.entry };
    if (symbol.fill !== undefined) symbol.fill = color(symbol.fill);
    if (symbol.stroke !== undefined) symbol.stroke = color(symbol.stroke);
    return { kind: 'symbol', entry: symbol };
}

export async function resolveEntries(entries: readonly LegendEntry[], env: DrawEnv, signal?: AbortSignal, histogram = false, scope?: Element): Promise<ResolvedEntry[]> {
    const resolved = await Promise.all(entries.map(entry => resolveOne(entry, env, signal, histogram)));
    return resolved.flatMap(entry => (entry === null ? [] : Array.isArray(entry) ? entry : [entry])).map(entry => withColors(entry, scope));
}
