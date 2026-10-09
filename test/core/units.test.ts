import { describe, expect, it } from 'vitest';
import { pageGeometry, paperSize, QUALITY } from '../../src/core/units.js';

describe('paperSize', () => {
    it('defaults to landscape letter', () => {
        expect(paperSize()).toEqual([279.4, 215.9]);
    });

    it('honours portrait and custom sizes', () => {
        expect(paperSize({ size: 'a4', orientation: 'portrait' })).toEqual([210, 297]);
        expect(paperSize({ size: [300, 100] })).toEqual([300, 100]);
    });
});

describe('pageGeometry', () => {
    it('converts millimetres to pixels at the requested dpi', () => {
        const geometry = pageGeometry({ size: 'a4', dpi: 300 });
        expect(geometry.size).toEqual([3508, 2480]);
        expect(geometry.clamped).toBe(false);
    });

    it('clamps the dpi when the canvas would exceed the pixel budget', () => {
        const geometry = pageGeometry({ size: 'a2', dpi: 600 }, 16_777_216);
        expect(geometry.clamped).toBe(true);
        expect(geometry.dpi).toBeLessThan(600);
        expect(geometry.size[0] * geometry.size[1]).toBeLessThanOrEqual(16_777_216);
        expect(geometry.requestedDpi).toBe(600);
    });

    it('keeps the ultra preset under the default budget on letter', () => {
        expect(pageGeometry({ dpi: QUALITY.ultra }).clamped).toBe(false);
    });
});
