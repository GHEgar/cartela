import { rotatedExtent } from '../core/geo.js';
import type { Size } from '../core/types.js';
import type { Camera, LngLat, MaplibreMap, MaplibreSnapshot } from './types.js';

export const EARTH_RADIUS = 6378137;
export const TILE_SIZE = 512;
const MAX_LATITUDE = 85.0511287798;
const RAD = Math.PI / 180;

export function cameraOf(map: MaplibreMap): Camera {
    const { lng, lat } = map.getCenter();
    return { center: [lng, lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), roll: map.getRoll() };
}

export function jumpOptions(camera: Partial<Camera>): Partial<Camera> {
    const options: Partial<Camera> = {};
    if (camera.center) options.center = [camera.center[0], camera.center[1]];
    if (camera.zoom !== undefined) options.zoom = camera.zoom;
    if (camera.bearing !== undefined) options.bearing = camera.bearing;
    if (camera.pitch !== undefined) options.pitch = camera.pitch;
    if (camera.roll !== undefined) options.roll = camera.roll;
    return options;
}

export function toMercator(lngLat: LngLat): [number, number] {
    const lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lngLat[1]));
    return [EARTH_RADIUS * lngLat[0] * RAD, EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2))];
}

export function fromMercator(point: [number, number]): LngLat {
    return [point[0] / EARTH_RADIUS / RAD, (2 * Math.atan(Math.exp(point[1] / EARTH_RADIUS)) - Math.PI / 2) / RAD];
}

export function zoomResolution(zoom: number): number {
    return (2 * Math.PI * EARTH_RADIUS) / (TILE_SIZE * 2 ** zoom);
}

export function bearingRotation(bearing: number): number {
    return -bearing * RAD;
}

export interface SnapshotInput {
    canvas: HTMLCanvasElement;
    camera: Camera;
    size: Size;
    pixelRatio: number;
    cssWidth: number;
    attributions: string[];
}

export function snapshotOf(input: SnapshotInput): MaplibreSnapshot {
    const { size, camera } = input;
    const center = toMercator(camera.center);
    const resolution = (zoomResolution(camera.zoom) * input.cssWidth) / size[0];
    const rotation = bearingRotation(camera.bearing);
    return {
        canvas: input.canvas,
        size,
        pixelRatio: input.pixelRatio,
        center,
        resolution,
        rotation,
        projection: 'EPSG:3857',
        extent: rotatedExtent(center, resolution, rotation, size),
        attributions: input.attributions,
        camera,
    };
}
