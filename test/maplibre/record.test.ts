import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { title } from '../../src/core/elements/text.js';
import { planOrbit } from '../../src/maplibre/plans.js';
import { recordMap } from '../../src/maplibre/record.js';
import type { EncoderFactory } from '../../src/video/types.js';
import { mapDouble, stubContext } from './double.js';

function fakeEncoder(log: string[]): EncoderFactory {
    return async () => ({
        mimeType: 'video/test',
        extension: '.test',
        readsPixels: false,
        add: async (_canvas, timestamp) => {
            log.push(`add ${timestamp.toFixed(2)}`);
        },
        finish: async () => new Blob(['ok']),
        cancel: async () => {
            log.push('cancel');
        },
    });
}

beforeEach(() => {
    stubContext();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('recordMap on MapLibre', () => {
    it('jumps to each camera after beforeFrame and restores the map', async () => {
        const map = mapDouble({ width: 1280, height: 720, camera: { bearing: 5 } });
        const plan = planOrbit(map, { fps: 4, duration: 1, size: [640, 360] });
        const log: string[] = [];
        const video = await recordMap(map, plan, {
            encoder: fakeEncoder(log),
            beforeFrame: (_frame, index) => {
                log.push(`before ${index} at ${map.getBearing()}`);
            },
        });
        expect(video.frames).toBe(4);
        expect(video.size).toEqual([640, 360]);
        expect(log.slice(0, 4)).toEqual(['before 0 at 5', 'add 0.00', 'before 1 at 5', 'add 0.25']);
        expect(map.jumps.slice(0, 4).map(jump => jump.bearing)).toEqual([5, 95, 185, 275]);
        expect(map.jumps.at(-1)?.bearing).toBe(5);
        expect(map.getBearing()).toBe(5);
        expect(map.ratios[0]).toBeCloseTo(0.5);
        expect(map.ratios.at(-1)).toBeNull();
    });

    it('rejects panel elements', async () => {
        const map = mapDouble();
        await expect(recordMap(map, planOrbit(map, { fps: 2, duration: 1 }), { encoder: fakeEncoder([]), elements: [title('x')] }))
            .rejects.toBeInstanceOf(TypeError);
    });

    it('cancels the encoder and restores the map when a frame fails', async () => {
        const map = mapDouble({ idle: false, pixelRatio: 2 });
        const log: string[] = [];
        await expect(recordMap(map, planOrbit(map, { fps: 2, duration: 1 }), { encoder: fakeEncoder(log), timeout: 20 })).rejects.toThrow();
        expect(log).toContain('cancel');
        expect(map.ratios.at(-1)).toBe(2);
    });
});
