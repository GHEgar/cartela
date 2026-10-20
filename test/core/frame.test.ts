import VectorLayer from 'ol/layer/Vector.js';
import type OlMap from 'ol/Map.js';
import VectorSource from 'ol/source/Vector.js';
import { describe, expect, it } from 'vitest';
import { fitRect } from '../../src/core/aspect.js';
import { RenderTimeoutError } from '../../src/core/errors.js';
import { trackPending } from '../../src/core/pending.js';

describe('fitRect', () => {
    it('centres the frame in the area left by the insets', () => {
        expect(fitRect([1000, 600], 1, 0)).toEqual({ x: 200, y: 0, width: 600, height: 600 });
        expect(fitRect([1000, 600], 1, 0, { left: 400 })).toEqual({ x: 400, y: 0, width: 600, height: 600 });
        expect(fitRect([1000, 600], 2, 10, { top: 100, right: 200 })).toEqual({ x: 10, y: 155, width: 780, height: 390 });
    });
});

describe('trackPending', () => {
    it('lists the layers whose sources are still loading', () => {
        const roads = new VectorSource();
        const parcels = new VectorSource();
        const map = {
            getAllLayers: () => [
                new VectorLayer({ source: roads, properties: { title: 'Roads' } }),
                new VectorLayer({ source: parcels, properties: { title: 'Parcels' } }),
            ],
        } as unknown as OlMap;
        const tracker = trackPending(map);
        roads.dispatchEvent('featuresloadstart');
        parcels.dispatchEvent('featuresloadstart');
        parcels.dispatchEvent('featuresloadend');
        parcels.dispatchEvent('featuresloaderror');
        expect(tracker.pending()).toEqual(['Roads']);
        tracker.stop();
        roads.dispatchEvent('featuresloadend');
        expect(tracker.pending()).toEqual(['Roads']);
    });

    it('feeds the timeout error', () => {
        const error = new RenderTimeoutError(100, ['Roads', 'Parcels']);
        expect(error.pending).toEqual(['Roads', 'Parcels']);
        expect(error.message).toBe('The map did not finish rendering within 100 ms. Still loading: Roads, Parcels');
        expect(new RenderTimeoutError(5).message).toBe('The map did not finish rendering within 5 ms');
    });
});
