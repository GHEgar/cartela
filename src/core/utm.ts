export interface UtmCoordinate {
    easting: number;
    northing: number;
    zone: number;
    south: boolean;
}

const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const FALSE_EASTING = 500_000;
const FALSE_NORTHING_SOUTH = 10_000_000;

const N = F / (2 - F);
const RECTIFYING = (A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64);
const ALPHA = [N / 2 - (2 * N ** 2) / 3 + (5 * N ** 3) / 16, (13 * N ** 2) / 48 - (3 * N ** 3) / 5, (61 * N ** 3) / 240];
const BETA = [N / 2 - (2 * N ** 2) / 3 + (37 * N ** 3) / 96, N ** 2 / 48 + N ** 3 / 15, (17 * N ** 3) / 480];
const DELTA = [2 * N - (2 * N ** 2) / 3 - 2 * N ** 3, (7 * N ** 2) / 3 - (8 * N ** 3) / 5, (56 * N ** 3) / 15];
const ECCENTRIC = (2 * Math.sqrt(N)) / (1 + N);

const RAD = Math.PI / 180;

export function utmZone(lon: number): number {
    const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
    return Math.min(60, Math.floor((wrapped + 180) / 6) + 1);
}

const centralMeridian = (zone: number): number => (zone * 6 - 183) * RAD;

export function toUtm(lonLat: readonly number[], zone?: number, south?: boolean): UtmCoordinate {
    const lon = lonLat[0] ?? 0;
    const lat = lonLat[1] ?? 0;
    const z = zone ?? utmZone(lon);
    const s = south ?? lat < 0;
    const phi = lat * RAD;
    const lambda = lon * RAD - centralMeridian(z);
    const sinPhi = Math.sin(phi);
    const t = Math.sinh(Math.atanh(sinPhi) - ECCENTRIC * Math.atanh(ECCENTRIC * sinPhi));
    const xiPrime = Math.atan2(t, Math.cos(lambda));
    const etaPrime = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t));
    let xi = xiPrime;
    let eta = etaPrime;
    ALPHA.forEach((alpha, i) => {
        const j = 2 * (i + 1);
        xi += alpha * Math.sin(j * xiPrime) * Math.cosh(j * etaPrime);
        eta += alpha * Math.cos(j * xiPrime) * Math.sinh(j * etaPrime);
    });
    return {
        easting: FALSE_EASTING + K0 * RECTIFYING * eta,
        northing: (s ? FALSE_NORTHING_SOUTH : 0) + K0 * RECTIFYING * xi,
        zone: z,
        south: s,
    };
}

export function fromUtm(utm: UtmCoordinate): [number, number] {
    const xi = (utm.northing - (utm.south ? FALSE_NORTHING_SOUTH : 0)) / (K0 * RECTIFYING);
    const eta = (utm.easting - FALSE_EASTING) / (K0 * RECTIFYING);
    let xiPrime = xi;
    let etaPrime = eta;
    BETA.forEach((beta, i) => {
        const j = 2 * (i + 1);
        xiPrime -= beta * Math.sin(j * xi) * Math.cosh(j * eta);
        etaPrime -= beta * Math.cos(j * xi) * Math.sinh(j * eta);
    });
    const chi = Math.asin(Math.sin(xiPrime) / Math.cosh(etaPrime));
    let phi = chi;
    DELTA.forEach((delta, i) => {
        phi += delta * Math.sin(2 * (i + 1) * chi);
    });
    const lambda = centralMeridian(utm.zone) + Math.atan2(Math.sinh(etaPrime), Math.cos(xiPrime));
    return [lambda / RAD, phi / RAD];
}
