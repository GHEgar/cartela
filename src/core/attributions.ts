import { inView } from 'ol/layer/Layer.js';
import type { FrameState } from 'ol/Map.js';
import { plainText } from './plain-text.js';

export { plainText } from './plain-text.js';

export function collectAttributions(frameState: FrameState, into: Set<string>): void {
    for (const state of frameState.layerStatesArray) {
        if (!inView(state, frameState.viewState)) continue;
        const source = state.layer.getSource?.();
        const getter = source?.getAttributions?.();
        if (!getter) continue;
        if (!frameState.extent) continue;
        const value = getter({ ...frameState, extent: frameState.extent });
        for (const item of Array.isArray(value) ? value : [value]) {
            const text = plainText(item);
            if (text) into.add(text);
        }
    }
}

export function layerLabel(layer: { get: (key: string) => unknown; getClassName: () => string }): string {
    const label = layer.get('title') ?? layer.get('name') ?? layer.get('id');
    return typeof label === 'string' && label ? label : layer.getClassName();
}
