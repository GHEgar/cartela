import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderTimeoutError } from '../../src/core/errors.js';
import { captureMap } from '../../src/maplibre/capture.js';
import { printFrame } from '../../src/maplibre/export.js';
import { mapDouble, stubContext } from './double.js';

beforeEach(() => {
    stubContext();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('MapLibre capture sessions', () => {
    it('names the sources still loading when the map never goes idle', async () => {
        const map = mapDouble({ idle: false, loading: ['wms'], sources: { osm: 'OSM' } });
        const error = await captureMap(map, { size: [100, 100], timeout: 20, freeze: false }).catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(RenderTimeoutError);
        expect((error as RenderTimeoutError).pending).toEqual(['wms']);
        expect((error as RenderTimeoutError).message).toContain('Still loading: wms');
    });

    it('captures what is there on timeout with onTimeout capture', async () => {
        const map = mapDouble({ idle: false, loading: ['wms'], pixelRatio: 2 });
        const snapshot = await captureMap(map, { size: [100, 100], timeout: 20, freeze: false, onTimeout: 'capture' });
        expect(snapshot.pending).toEqual(['wms']);
        expect(snapshot.canvas.width).toBe(100);
        expect(map.ratios.at(-1)).toBe(2);
    });

    it('queues simultaneous captures of one map so the pixel ratio is not mixed up', async () => {
        const map = mapDouble({ width: 800, height: 600, pixelRatio: 2 });
        const [a, b] = await Promise.all([
            captureMap(map, { size: [400, 300], pixelRatio: 1, padding: 0, freeze: false }),
            captureMap(map, { size: [400, 300], pixelRatio: 3, padding: 0, freeze: false }),
        ]);
        expect([a.canvas.width, b.canvas.width]).toEqual([400, 1200]);
        expect(map.ratios).toEqual([0.5, 2, 1.5, 2]);
        expect(map.getPixelRatio()).toBe(2);
    });

    it('lets a queued capture be aborted while it waits', async () => {
        const map = mapDouble({ width: 800, height: 600 });
        const controller = new AbortController();
        const first = captureMap(map, { size: [100, 100], freeze: false });
        const second = captureMap(map, { size: [100, 100], freeze: false, signal: controller.signal });
        controller.abort();
        await expect(second).rejects.toThrow();
        await expect(first).resolves.toBeDefined();
        await expect(captureMap(map, { size: [100, 100], freeze: false })).resolves.toBeDefined();
    });

    it('keeps the print frame and the capture clear of an inset', async () => {
        const map = mapDouble({ width: 1000, height: 600 });
        const inset = { left: 300 };
        const frame = printFrame(map, { page: { size: [100, 100], margin: 0 }, layout: 'none', padding: 0, inset });
        expect(frame).toEqual({ x: 350, y: 0, width: 600, height: 600 });
        const draws = stubContext();
        await captureMap(map, { size: [600, 600], padding: 0, inset, freeze: false });
        const copy = draws.find(draw => draw.source === map.canvas);
        expect(copy?.args.slice(0, 4)).toEqual([350, 0, 600, 600]);
    });
});
