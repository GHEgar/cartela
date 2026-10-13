import { describe, expect, it } from 'vitest';
import { formatMeters } from '../../src/core/elements/graticule.js';
import { autoInterval, border, crossings, range, sampleLines, steps, type Point } from '../../src/core/elements/graticule-lines.js';

describe('autoInterval', () => {
    it('picks degree steps that read well in DMS', () => {
        expect(autoInterval(0.6, true)).toBeCloseTo(10 / 60);
        expect(autoInterval(3, true)).toBe(0.5);
        expect(autoInterval(0.01, true)).toBeCloseTo(10 / 3600);
    });

    it('picks 1, 2, 2.5 or 5 times a power of ten for metres', () => {
        expect(autoInterval(42_000, false)).toBe(10_000);
        expect(autoInterval(12_000, false)).toBe(2_000);
        expect(autoInterval(14_000, false)).toBe(2_500);
        expect(autoInterval(600, false)).toBe(100);
    });

    it('keeps at most six lines', () => {
        for (const span of [0.37, 1.9, 7, 33]) expect(span / autoInterval(span, true)).toBeLessThanOrEqual(6);
        for (const span of [123, 9_999, 77_777]) expect(span / autoInterval(span, false)).toBeLessThanOrEqual(6);
    });
});

describe('steps', () => {
    it('lists the multiples of the interval inside the range', () => {
        expect(steps(661_234, 689_000, 10_000)).toEqual([670_000, 680_000]);
        expect(steps(-0.5, 0.5, 0.25)).toEqual([-0.5, -0.25, 0, 0.25, 0.5]);
    });
});

describe('crossings', () => {
    const frame = { x: 10, y: 20, width: 100, height: 50 };

    it('labels straight lines where they leave the frame', () => {
        const identity = (p: Point): Point => [p[0], p[1]];
        const { min, max } = range(border(frame).map(identity));
        expect(min).toEqual([10, 20]);
        expect(max).toEqual([110, 70]);
        const lines = sampleLines(identity, min, max, [25, 25]);
        const found = crossings(lines, frame);
        const top = found.filter(c => c.side === 'top').map(c => c.value);
        expect(top).toEqual([25, 50, 75, 100]);
        expect(found.filter(c => c.side === 'left').map(c => c.value)).toEqual([25, 50]);
    });

    it('finds crossings on every side of a rotated grid', () => {
        const angle = Math.PI / 6;
        const rotate = (p: Point): Point => [
            60 + (p[0] - 60) * Math.cos(angle) - (p[1] - 45) * Math.sin(angle),
            45 + (p[0] - 60) * Math.sin(angle) + (p[1] - 45) * Math.cos(angle),
        ];
        const inverse = (p: Point): Point => [
            60 + (p[0] - 60) * Math.cos(-angle) - (p[1] - 45) * Math.sin(-angle),
            45 + (p[0] - 60) * Math.sin(-angle) + (p[1] - 45) * Math.cos(-angle),
        ];
        const { min, max } = range(border(frame).map(inverse));
        const found = crossings(sampleLines(rotate, min, max, [20, 20]), frame);
        for (const side of ['top', 'right', 'bottom', 'left']) {
            expect(found.some(c => c.side === side)).toBe(true);
        }
        for (const c of found) {
            if (c.side === 'top' || c.side === 'bottom') expect(c.at).toBeGreaterThanOrEqual(10);
        }
    });
});

describe('formatMeters', () => {
    it('groups thousands with a thin space', () => {
        expect(formatMeters(665000, ' E')).toBe('665 000 m E');
        expect(formatMeters(2_285_000.4, ' N')).toBe('2 285 000 m N');
    });
});
