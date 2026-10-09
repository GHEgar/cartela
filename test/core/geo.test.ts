import { describe, expect, it } from 'vitest';
import { fitResolution, formatDegrees, formatDistance, niceStep, pixelToCoordinate, rotatedExtent } from '../../src/core/geo.js';

describe('niceStep', () => {
    it('rounds down to 1, 2 or 5 times a power of ten', () => {
        expect(niceStep(7300)).toBe(5000);
        expect(niceStep(1999)).toBe(1000);
        expect(niceStep(0.31)).toBe(0.2);
        expect(niceStep(0)).toBe(0);
    });
});

describe('pixelToCoordinate', () => {
    it('maps the centre pixel to the centre coordinate', () => {
        expect(pixelToCoordinate([100, 200], 2, 0, [50, 30], [25, 15])).toEqual([100, 200]);
    });

    it('applies rotation', () => {
        const [x, y] = pixelToCoordinate([0, 0], 1, Math.PI / 2, [20, 20], [20, 10]);
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(10);
    });
});

describe('rotatedExtent', () => {
    it('is the plain extent without rotation', () => {
        expect(rotatedExtent([0, 0], 1, 0, [10, 4])).toEqual([-5, -2, 5, 2]);
    });
});

describe('fitResolution', () => {
    it('contains or covers the extent', () => {
        expect(fitResolution([0, 0, 100, 50], [10, 10], 'contain')).toBe(10);
        expect(fitResolution([0, 0, 100, 50], [10, 10], 'cover')).toBe(5);
    });
});

describe('formatters', () => {
    it('formats degrees with hemisphere', () => {
        expect(formatDegrees(-103.5, 'lon')).toBe('103°30′00″W');
        expect(formatDegrees(20.999999, 'lat')).toBe('21°00′00″N');
    });

    it('formats distances', () => {
        expect(formatDistance(500)).toBe('500 m');
        expect(formatDistance(2000)).toBe('2 km');
    });
});
