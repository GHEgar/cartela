import { describe, expect, it } from 'vitest';
import View from 'ol/View.js';
import LineString from 'ol/geom/LineString.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { getDistance } from 'ol/sphere.js';
import { measureRoute } from '../../src/video/measure.js';
import { planHold } from '../../src/video/hold.js';
import { planOrbit, recordingDefaults } from '../../src/video/orbit.js';
import { planRoute, unwrap } from '../../src/video/route.js';

const route = new LineString([[-103.5, 20.5], [-103.3, 20.5], [-103.3, 20.7], [-103.1, 20.7]].map(c => fromLonLat(c)));
const mapWith = (view: View) => ({ getView: () => view });
const view = (): View => new View({ center: fromLonLat([-103.3, 20.6]), resolution: 40, rotation: 0.3 });
const ground = (a: number[], b: number[]): number => getDistance(toLonLat(a), toLonLat(b));

describe('measureRoute', () => {
    it('measures the geodesic length and interpolates along it', () => {
        const measure = measureRoute(route, 'EPSG:3857');
        const coords = route.getCoordinates();
        const expected = coords.slice(1).reduce((sum, c, i) => sum + ground(coords[i] ?? [], c), 0);
        expect(measure.length).toBeCloseTo(expected, 3);
        expect(measure.pointAt(0)).toEqual(coords[0]);
        expect(measure.pointAt(measure.length)).toEqual(coords[3]);
        expect(measure.slice(measure.length / 2).length).toBeGreaterThan(1);
    });

    it('rejects a route without length', () => {
        expect(() => measureRoute(new LineString([[0, 0], [0, 0]]), 'EPSG:3857')).toThrow(RangeError);
    });
});

describe('unwrap', () => {
    it('keeps the angle within half a turn of the previous one', () => {
        expect(unwrap(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(Math.PI + 0.1);
        expect(unwrap(0.2, 0.1)).toBeCloseTo(0.2);
    });
});

describe('planRoute', () => {
    it('makes duration × fps frames that go from 0 to 1 at constant ground speed', () => {
        const plan = planRoute(mapWith(view()), route, { fps: 10, duration: 5, hold: [1, 1] });
        expect(plan.frames).toHaveLength(50);
        const along = plan.frames.map(f => f.along ?? -1);
        expect(along[0]).toBe(0);
        expect(along[49]).toBe(1);
        along.slice(1).forEach((a, i) => expect(a).toBeGreaterThanOrEqual(along[i] ?? 0));
        const moving = plan.frames.slice(12, 38);
        const steps = moving.slice(1).map((f, i) => ground(moving[i]?.center ?? [], f.center));
        const corners = steps.filter(step => Math.abs(step - (steps[0] ?? 0)) > (steps[0] ?? 0) * 0.05);
        expect(corners.length).toBeLessThanOrEqual(2);
    });

    it('keeps the view still without follow and fits the route', () => {
        const plan = planRoute(mapWith(view()), route, { follow: false, duration: 2, fps: 5 });
        const centers = new Set(plan.frames.map(f => f.center.join(',')));
        expect(centers.size).toBe(1);
        expect(plan.frames[0]?.resolution).not.toBe(40);
        expect(plan.frames[0]?.rotation).toBe(0.3);
    });

    it('rotates with the heading and never jumps more than half a turn', () => {
        const plan = planRoute(mapWith(view()), route, { rotate: true, duration: 4, fps: 15 });
        const rotations = plan.frames.map(f => f.rotation);
        expect(rotations[0]).toBeCloseTo(-Math.PI / 2, 1);
        rotations.slice(1).forEach((r, i) => expect(Math.abs(r - (rotations[i] ?? 0))).toBeLessThan(Math.PI));
    });

    it('rejects hold times longer than the duration', () => {
        expect(() => planRoute(mapWith(view()), route, { duration: 1, hold: [1, 1] })).toThrow(RangeError);
    });
});

describe('planOrbit', () => {
    it('turns once and leaves the closing frame out for a seamless loop', () => {
        const plan = planOrbit(mapWith(view()), { fps: 10, duration: 3 });
        expect(plan.frames).toHaveLength(30);
        const first = plan.frames[0]?.rotation ?? 0;
        const last = plan.frames[29]?.rotation ?? 0;
        expect(first).toBe(0.3);
        expect(last + (2 * Math.PI) / 30).toBeCloseTo(first + 2 * Math.PI);
    });

    it('turns the other way with direction -1', () => {
        const plan = planOrbit(mapWith(view()), { fps: 4, duration: 1, direction: -1, turns: 2 });
        expect(plan.frames[1]?.rotation).toBeCloseTo(0.3 - Math.PI);
    });
});

describe('recordingDefaults', () => {
    it('uses a small square for GIF and 720p for video', () => {
        expect(recordingDefaults('gif')).toEqual({ fps: 15, size: [480, 480] });
        expect(recordingDefaults('mp4')).toEqual({ fps: 30, size: [1280, 720] });
    });
});

describe('planHold', () => {
    it('repeats the current view for the requested frames', () => {
        const plan = planHold(mapWith(view()), { fps: 12, frames: 36 });
        expect(plan.fps).toBe(12);
        expect(plan.frames).toHaveLength(36);
        expect(new Set(plan.frames.map(frame => JSON.stringify(frame))).size).toBe(1);
        expect(plan.frames[0]).not.toBe(plan.frames[1]);
    });

    it('takes the length from the duration by default', () => {
        expect(planHold(mapWith(view()), { fps: 10 }).frames).toHaveLength(30);
        expect(planHold(mapWith(view()), { fps: 10, duration: 1.5 }).frames).toHaveLength(15);
    });
});
