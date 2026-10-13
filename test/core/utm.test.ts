import { describe, expect, it } from 'vitest';
import { fromUtm, toUtm, utmZone } from '../../src/core/utm.js';

function snyder(lon: number, lat: number, zone: number): [number, number] {
    const a = 6378137;
    const f = 1 / 298.257223563;
    const e2 = f * (2 - f);
    const ep2 = e2 / (1 - e2);
    const k0 = 0.9996;
    const phi = (lat * Math.PI) / 180;
    const lambda0 = ((zone * 6 - 183) * Math.PI) / 180;
    const nu = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const t = Math.tan(phi) ** 2;
    const c = ep2 * Math.cos(phi) ** 2;
    const big = Math.cos(phi) * ((lon * Math.PI) / 180 - lambda0);
    const m = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi
        - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi)
        + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi)
        - ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
    const easting = 500000 + k0 * nu * (big + ((1 - t + c) * big ** 3) / 6 + ((5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * big ** 5) / 120);
    const northing = k0 * (m + nu * Math.tan(phi) * (big ** 2 / 2 + ((5 - t + 9 * c + 4 * c ** 2) * big ** 4) / 24
        + ((61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * big ** 6) / 720));
    return [easting, lat < 0 ? northing + 10_000_000 : northing];
}

describe('utmZone', () => {
    it('picks the six-degree zone', () => {
        expect(utmZone(-103.35)).toBe(13);
        expect(utmZone(-180)).toBe(1);
        expect(utmZone(179.99)).toBe(60);
        expect(utmZone(3)).toBe(31);
        expect(utmZone(360 - 103.35)).toBe(13);
    });
});

describe('toUtm', () => {
    it('puts the central meridian on the equator at 500 000 E, 0 N', () => {
        const utm = toUtm([-105, 0]);
        expect(utm.easting).toBeCloseTo(500000, 6);
        expect(utm.northing).toBeCloseTo(0, 6);
        expect(utm.zone).toBe(13);
        expect(utm.south).toBe(false);
    });

    it('agrees with the Snyder series within a metre inside the zone', () => {
        for (const [lon, lat] of [[-103.35, 20.67], [-101.2, 25.1], [-107.9, 15.3], [151.21, -33.87], [-58.38, -34.6]]) {
            const utm = toUtm([lon ?? 0, lat ?? 0]);
            const [e, n] = snyder(lon ?? 0, lat ?? 0, utm.zone);
            expect(Math.abs(utm.easting - e)).toBeLessThan(1);
            expect(Math.abs(utm.northing - n)).toBeLessThan(1);
        }
    });

    it('uses the false northing in the south', () => {
        const utm = toUtm([151.21, -33.87]);
        expect(utm.south).toBe(true);
        expect(utm.zone).toBe(56);
        expect(utm.northing).toBeGreaterThan(6_000_000);
    });

    it('can force a neighbouring zone', () => {
        const utm = toUtm([-101.9, 20], 13);
        expect(utm.zone).toBe(13);
        expect(utm.easting).toBeGreaterThan(800_000);
    });
});

describe('fromUtm', () => {
    it('round-trips below a millimetre', () => {
        for (const [lon, lat] of [[-103.35, 20.67], [-102.01, 23.9], [151.21, -33.87], [10.5, 60.1], [-104.9, 0.001]]) {
            const utm = toUtm([lon ?? 0, lat ?? 0]);
            const back = toUtm(fromUtm(utm), utm.zone, utm.south);
            expect(Math.abs(back.easting - utm.easting)).toBeLessThan(0.001);
            expect(Math.abs(back.northing - utm.northing)).toBeLessThan(0.001);
            const [blon, blat] = fromUtm(utm);
            expect(blon).toBeCloseTo(lon ?? 0, 7);
            expect(blat).toBeCloseTo(lat ?? 0, 7);
        }
    });
});
