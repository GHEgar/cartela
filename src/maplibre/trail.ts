import type { Theme } from '../core/types.js';
import { measureLine } from './measure.js';
import type { CameraFrame, MaplibreMap, MaplibreTrailMap, MaplibreTrailOptions } from './types.js';

export const TRAIL_ID = 'cartela-trail';

export interface MaplibreTrail {
    update: (frame: CameraFrame) => void;
    remove: () => void;
}

const METHODS = ['addSource', 'addLayer', 'getLayer', 'removeLayer', 'removeSource'] as const;

function isTrailMap(map: MaplibreMap): map is MaplibreTrailMap {
    return METHODS.every(name => typeof (map as unknown as Record<string, unknown>)[name] === 'function');
}

export function addTrail(map: MaplibreMap, options: MaplibreTrailOptions, theme: Theme): MaplibreTrail {
    if (!isTrailMap(map)) throw new TypeError('The trail needs a map with addSource, addLayer, getLayer, removeLayer and removeSource');
    const measure = measureLine(options.route);
    const color = options.stroke ?? theme.color;
    const width = options.width ?? 4;
    const halo = options.halo ?? theme.halo;
    const lineLayout = { 'line-cap': 'round', 'line-join': 'round' };
    const dataAt = (distance: number): object => ({
        type: 'FeatureCollection',
        features: [
            { type: 'Feature', properties: { part: 'line' }, geometry: { type: 'LineString', coordinates: measure.slice(distance) } },
            ...(options.marker === false ? [] : [{ type: 'Feature', properties: { part: 'marker' }, geometry: { type: 'Point', coordinates: measure.pointAt(distance) } }]),
        ],
    });
    const ids = [`${TRAIL_ID}-halo`, `${TRAIL_ID}-line`, `${TRAIL_ID}-marker`];

    map.addSource(TRAIL_ID, { type: 'geojson', data: dataAt(0) });
    map.addLayer({ id: ids[0] as string, type: 'line', source: TRAIL_ID, layout: lineLayout, paint: { 'line-color': halo, 'line-width': width + 4 } });
    map.addLayer({ id: ids[1] as string, type: 'line', source: TRAIL_ID, layout: lineLayout, paint: { 'line-color': color, 'line-width': width } });
    if (options.marker !== false) {
        map.addLayer({
            id: ids[2] as string,
            type: 'circle',
            source: TRAIL_ID,
            paint: { 'circle-radius': width * 1.6, 'circle-color': color, 'circle-stroke-color': halo, 'circle-stroke-width': 2 },
        });
    }

    return {
        update: frame => {
            const source = map.getSource(TRAIL_ID) as { setData?: (data: object) => unknown } | undefined;
            source?.setData?.(dataAt((frame.along ?? 1) * measure.length));
        },
        remove: () => {
            for (const id of [...ids].reverse()) if (map.getLayer(id)) map.removeLayer(id);
            if (map.getSource(TRAIL_ID)) map.removeSource(TRAIL_ID);
        },
    };
}
