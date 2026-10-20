import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planHold } from '../../src/maplibre/plans.js';
import { recordMap } from '../../src/maplibre/record.js';
import { measureLine } from '../../src/maplibre/measure.js';
import type { CameraPlan, LngLat } from '../../src/maplibre/types.js';
import type { EncoderFactory } from '../../src/video/types.js';
import { mapDouble, stubContext } from './double.js';

const encoder: EncoderFactory = async () => ({
    mimeType: 'video/test',
    extension: '.test',
    readsPixels: false,
    add: async () => {},
    finish: async () => new Blob(['ok']),
    cancel: async () => {},
});

const ROUTE: LngLat[] = [[-103.4, 20.6], [-103.3, 20.6], [-103.3, 20.7]];

interface Collection {
    features: { properties: { part: string }; geometry: { coordinates: unknown } }[];
}

beforeEach(() => {
    stubContext();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('MapLibre trail', () => {
    it('slices a line by distance', () => {
        const measure = measureLine(ROUTE);
        expect(measure.slice(0)).toEqual([ROUTE[0], ROUTE[0]]);
        const half = measure.slice(measure.length / 2);
        expect(half[0]).toEqual(ROUTE[0]);
        expect(half.length).toBe(3);
        expect(measure.slice(measure.length).at(-1)).toEqual(ROUTE[2]);
    });

    it('grows with the frames and leaves the style as it was', async () => {
        const map = mapDouble();
        const hold = planHold(map, { fps: 2, frames: 3 });
        const plan: CameraPlan = { ...hold, frames: hold.frames.map((frame, index) => ({ ...frame, along: index / 2 })) };
        const lengths: number[] = [];
        const recording: EncoderFactory = async (...args) => ({
            ...await encoder(...args),
            add: async () => {
                const data = map.added.get('cartela-trail')?.data as Collection | undefined;
                lengths.push((data?.features[0]?.geometry.coordinates as unknown[] | undefined)?.length ?? 0);
            },
        });
        await recordMap(map, plan, { encoder: recording, freeze: false, trail: { route: ROUTE, stroke: '#f00' } });
        expect([...map.styleLayers.keys()]).toEqual([]);
        expect(map.added.size).toBe(0);
        expect(lengths).toEqual([2, 3, 3]);
    });

    it('adds a halo, a line and a marker on top of the style', async () => {
        const map = mapDouble();
        const seen: string[] = [];
        await recordMap(map, planHold(map, { fps: 1, frames: 1 }), {
            encoder,
            freeze: false,
            trail: { route: ROUTE, width: 6 },
            beforeFrame: () => {
                seen.push(...map.styleLayers.keys());
            },
        });
        expect(seen).toEqual(['cartela-trail-halo', 'cartela-trail-line', 'cartela-trail-marker']);
    });

    it('rejects a map that cannot hold the trail', async () => {
        const map = { ...mapDouble(), addLayer: undefined } as unknown as ReturnType<typeof mapDouble>;
        await expect(recordMap(map, planHold(map, { fps: 1, frames: 1 }), { encoder, freeze: false, trail: { route: ROUTE } }))
            .rejects.toBeInstanceOf(TypeError);
    });
});
