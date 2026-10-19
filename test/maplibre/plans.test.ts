import { describe, expect, it } from 'vitest';
import { haversine, initialBearing } from '../../src/maplibre/measure.js';
import { planHold, planOrbit } from '../../src/maplibre/plans.js';
import { planRoute } from '../../src/maplibre/route.js';
import type { LngLat } from '../../src/maplibre/types.js';
import { mapDouble } from './double.js';

const line: LngLat[] = [[0, 0], [0, 1], [1, 1]];

describe('planOrbit', () => {
    it('turns the bearing once around the current camera without repeating the first frame', () => {
        const map = mapDouble({ camera: { bearing: 20, pitch: 10, zoom: 12 } });
        const plan = planOrbit(map, { fps: 10, duration: 2, pitch: 60 });
        expect(plan.frames).toHaveLength(20);
        expect(plan.frames[0]).toMatchObject({ bearing: 20, pitch: 60, zoom: 12 });
        expect(plan.frames[10]?.bearing).toBeCloseTo(200);
        expect(plan.frames[19]?.bearing).toBeCloseTo(20 + 342);
    });

    it('goes backwards with direction -1', () => {
        const plan = planOrbit(mapDouble(), { fps: 4, duration: 1, direction: -1 });
        expect(plan.frames[1]?.bearing).toBeCloseTo(-90);
    });
});

describe('planHold', () => {
    it('repeats the camera, with overrides', () => {
        const plan = planHold(mapDouble({ camera: { zoom: 7 } }), { frames: 3, camera: { pitch: 45 } });
        expect(plan.frames).toHaveLength(3);
        expect(plan.frames.every(frame => frame.zoom === 7 && frame.pitch === 45)).toBe(true);
    });
});

describe('measure', () => {
    it('measures geodesic distance and bearing', () => {
        expect(haversine([0, 0], [0, 1])).toBeCloseTo(111195, -1);
        expect(initialBearing([0, 0], [0, 1])).toBeCloseTo(0);
        expect(initialBearing([0, 0], [1, 0])).toBeCloseTo(90);
    });
});

describe('planRoute', () => {
    it('follows the line at constant speed with holds', () => {
        const plan = planRoute(mapDouble(), line, { fps: 10, duration: 3, hold: [0.5, 0.5] });
        expect(plan.frames).toHaveLength(30);
        expect(plan.frames[0]?.along).toBe(0);
        expect(plan.frames[5]?.along).toBe(0);
        expect(plan.frames.at(-1)?.along).toBe(1);
        expect(plan.frames.at(-1)?.center[0]).toBeCloseTo(1);
        expect(plan.frames.at(-1)?.center[1]).toBeCloseTo(1);
    });

    it('turns the bearing with the heading without jumping', () => {
        const plan = planRoute(mapDouble(), [[0, 0], [0, 1], [-1, 1], [-1, 0], [0, 0]], { fps: 20, duration: 4, rotate: true, smoothing: 0.1 });
        const bearings = plan.frames.map(frame => frame.bearing);
        for (let i = 1; i < bearings.length; i += 1) expect(Math.abs((bearings[i] ?? 0) - (bearings[i - 1] ?? 0))).toBeLessThan(90);
        expect(bearings[0]).toBeCloseTo(0, 0);
        expect(bearings.at(-1)).toBeLessThan(-180);
    });

    it('fits the whole line in the frame when it does not follow', () => {
        const map = mapDouble({ width: 1280, height: 720 });
        const plan = planRoute(map, line, { follow: false, fps: 2, duration: 2, size: [1280, 720], padding: 0 });
        const dy = Math.log(Math.tan(Math.PI / 4 + Math.PI / 360)) / (2 * Math.PI);
        expect(plan.frames[0]?.zoom).toBeCloseTo(Math.log2(720 / dy / 512), 6);
        expect(plan.frames[0]?.center[0]).toBeCloseTo(0.5);
        expect(plan.frames[0]?.center[1]).toBeCloseTo(0.5, 2);
    });

    it('rejects holds longer than the duration', () => {
        expect(() => planRoute(mapDouble(), line, { duration: 1, hold: [1, 1] })).toThrow(RangeError);
    });
});
