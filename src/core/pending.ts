import type OlMap from 'ol/Map.js';
import { listen, unlistenByKey, type EventsKey } from 'ol/events.js';
import { layerLabel } from './attributions.js';

const STARTS = ['tileloadstart', 'imageloadstart', 'featuresloadstart'];
const ENDS = ['tileloadend', 'tileloaderror', 'imageloadend', 'imageloaderror', 'featuresloadend', 'featuresloaderror'];

export interface PendingTracker {
    pending: () => string[];
    stop: () => void;
}

export function trackPending(map: OlMap): PendingTracker {
    const counts = new Map<string, number>();
    const keys: EventsKey[] = [];
    for (const layer of map.getAllLayers()) {
        const source = layer.getSource();
        if (!source) continue;
        const label = layerLabel(layer);
        const shift = (delta: number) => (): void => {
            counts.set(label, Math.max(0, (counts.get(label) ?? 0) + delta));
        };
        keys.push(...STARTS.map(type => listen(source, type, shift(1))), ...ENDS.map(type => listen(source, type, shift(-1))));
    }
    return {
        pending: () => [...counts].filter(([, count]) => count > 0).map(([label]) => label),
        stop: () => keys.forEach(unlistenByKey),
    };
}
