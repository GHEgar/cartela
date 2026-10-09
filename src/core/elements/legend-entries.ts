import type OlMap from 'ol/Map.js';
import { imageSize, loadImage } from './draw.js';
import { layerLabel } from '../attributions.js';
import type { DrawEnv } from '../types.js';

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

export type LegendEntry = HeadingEntry | SymbolEntry | ImageEntry | WmsEntry;

export type ResolvedEntry =
    | { kind: 'heading'; text: string }
    | { kind: 'symbol'; entry: SymbolEntry }
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

async function resolveOne(entry: LegendEntry, env: DrawEnv, signal?: AbortSignal): Promise<ResolvedEntry | null> {
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

export async function resolveEntries(entries: readonly LegendEntry[], env: DrawEnv, signal?: AbortSignal): Promise<ResolvedEntry[]> {
    const resolved = await Promise.all(entries.map(entry => resolveOne(entry, env, signal)));
    return resolved.filter((entry): entry is ResolvedEntry => entry !== null);
}
