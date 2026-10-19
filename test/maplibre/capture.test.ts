import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderTimeoutError } from '../../src/core/errors.js';
import { captureMap } from '../../src/maplibre/capture.js';
import { exportMap, printFrame } from '../../src/maplibre/export.js';
import { mapDouble, stubContext, type Draw } from './double.js';

let draws: Draw[];

beforeEach(() => {
    draws = stubContext();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('captureMap', () => {
    it('crops the centred frame at the requested size and restores the map', async () => {
        const map = mapDouble({ width: 800, height: 600 });
        const snapshot = await captureMap(map, { size: [400, 200], pixelRatio: 2, padding: 0 });
        expect([snapshot.canvas.width, snapshot.canvas.height]).toEqual([800, 400]);
        expect(map.ratios).toEqual([1, null]);
        const copy = draws.find(draw => draw.source === map.canvas && draw.args.length === 8);
        expect(copy?.args).toEqual([0, 100, 800, 400, 0, 0, 800, 400]);
        expect(snapshot.size).toEqual([400, 200]);
        expect(snapshot.pixelRatio).toBe(2);
        expect(map.getPixelRatio()).toBe(globalThis.devicePixelRatio);
        expect(map.listeners()).toBe(1);
        expect(map.container.querySelector('canvas[data-cartela-freeze]')).not.toBeNull();
        await vi.waitFor(() => expect(map.container.querySelector('canvas[data-cartela-freeze]')).toBeNull());
        expect(map.listeners()).toBe(0);
    });

    it('measures the real canvas scale when maxCanvasSize clamps the pixel ratio', async () => {
        const map = mapDouble({ width: 800, height: 600, maxCanvas: 1600 });
        await captureMap(map, { size: [1600, 1200], pixelRatio: 2, padding: 0, freeze: false });
        const copy = draws.find(draw => draw.source === map.canvas);
        expect(copy?.args).toEqual([0, 0, 1600, 1200, 0, 0, 3200, 2400]);
    });

    it('applies a camera while capturing and puts the original one back', async () => {
        const map = mapDouble({ camera: { bearing: 10, pitch: 30 } });
        const snapshot = await captureMap(map, { size: [100, 100], camera: { bearing: 90, pitch: 60 }, freeze: false });
        expect(snapshot.camera.bearing).toBe(90);
        expect(snapshot.rotation).toBeCloseTo(-Math.PI / 2);
        expect(map.getBearing()).toBe(10);
        expect(map.getPitch()).toBe(30);
    });

    it('keeps an explicit pixel ratio', async () => {
        const map = mapDouble({ pixelRatio: 1.5 });
        await captureMap(map, { size: [100, 100], freeze: false });
        expect(map.ratios.at(-1)).toBe(1.5);
    });

    it('fills the snapshot in Web Mercator', async () => {
        const map = mapDouble({ camera: { center: [0, 0], zoom: 0 } });
        const snapshot = await captureMap(map, { size: [512, 512], padding: 0, freeze: false });
        expect(snapshot.projection).toBe('EPSG:3857');
        expect(snapshot.center[0]).toBeCloseTo(0);
        expect(snapshot.resolution).toBeCloseTo((2 * Math.PI * 6378137) / 512 * (600 / 512));
    });

    it('collects attributions of visible layers once and without markup', async () => {
        const map = mapDouble({
            layers: [
                { source: 'osm' },
                { source: 'osm' },
                { source: 'hidden', layout: { visibility: 'none' } },
                { source: 'far', minzoom: 14 },
                {},
            ],
            sources: { osm: '<a href="#">&copy; OpenStreetMap</a>', hidden: 'Hidden', far: 'Far' },
        });
        const snapshot = await captureMap(map, { size: [100, 100], freeze: false });
        expect(snapshot.attributions).toEqual(['© OpenStreetMap']);
    });

    it('draws overlay canvases on top with their own scale', async () => {
        const map = mapDouble({ width: 800, height: 600 });
        const deck = document.createElement('canvas');
        deck.width = 400;
        deck.height = 300;
        await captureMap(map, { size: [800, 600], padding: 0, freeze: false, overlays: () => [deck] });
        const copy = draws.find(draw => draw.source === deck);
        expect(copy?.args).toEqual([0, 0, 400, 300, 0, 0, 800, 600]);
    });

    it('times out when the map never goes idle and still restores it', async () => {
        const map = mapDouble({ idle: false, pixelRatio: 2 });
        await expect(captureMap(map, { size: [100, 100], timeout: 20, freeze: false })).rejects.toBeInstanceOf(RenderTimeoutError);
        expect(map.ratios.at(-1)).toBe(2);
        expect(map.listeners()).toBe(0);
    });

    it('stops on abort', async () => {
        const map = mapDouble({ idle: false });
        const controller = new AbortController();
        const pending = captureMap(map, { size: [100, 100], freeze: false, signal: controller.signal });
        controller.abort();
        await expect(pending).rejects.toThrow();
        expect(map.listeners()).toBe(0);
    });
});

describe('exportMap from MapLibre', () => {
    it('lays out a sheet around the capture', async () => {
        const map = mapDouble();
        const sheet = await exportMap(map, { page: { size: 'letter', dpi: 96 }, layout: 'right', freeze: false });
        expect(sheet.pages).toHaveLength(1);
        expect(sheet.geometry.size).toEqual([1056, 816]);
        expect(sheet.snapshot.canvas.width).toBe(Math.round(sheet.layout.frame.width));
        expect(draws.some(draw => draw.source === sheet.snapshot.canvas)).toBe(true);
    });

    it('returns the print frame for the sheet proportions', () => {
        const map = mapDouble({ width: 800, height: 600 });
        const frame = printFrame(map, { page: { size: 'letter' }, layout: 'none' });
        expect(frame?.height).toBeCloseTo(552);
        expect((frame?.width ?? 0) / (frame?.height ?? 1)).toBeCloseTo(sheetRatio());
    });
});

function sheetRatio(): number {
    const margin = (8 / 25.4) * 96;
    return (11 * 96 - 2 * margin) / (8.5 * 96 - 2 * margin);
}
