import type OlMap from 'ol/Map.js';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, RegularShape, Stroke, Style } from 'ol/style.js';
import type { Theme } from '../core/types.js';
import { measureRoute } from './measure.js';
import type { FrameState, TrailOptions } from './types.js';

export interface Trail {
    update: (frame: FrameState) => void;
    remove: () => void;
}

export function addTrail(map: OlMap, options: TrailOptions, theme: Theme): Trail {
    const measure = measureRoute(options.route, map.getView().getProjection());
    const color = options.stroke ?? theme.color;
    const width = options.width ?? 4;
    const halo = options.halo ?? theme.halo;
    const line = new Feature(new LineString([]));
    line.setStyle([
        new Style({ stroke: new Stroke({ color: halo, width: width + 4, lineCap: 'round', lineJoin: 'round' }) }),
        new Style({ stroke: new Stroke({ color, width, lineCap: 'round', lineJoin: 'round' }) }),
    ]);
    const marker = new Feature(new Point(measure.pointAt(0)));
    const arrow = new RegularShape({
        points: 3,
        radius: width * 2.5,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: halo, width: 2 }),
        rotateWithView: true,
    });
    marker.setStyle(new Style({ image: arrow }));
    const source = new VectorSource({ features: options.marker === false ? [line] : [line, marker] });
    const layer = new VectorLayer({ source, zIndex: Number.MAX_SAFE_INTEGER, properties: { title: 'cartela trail' } });
    map.addLayer(layer);

    return {
        update: frame => {
            const distance = (frame.along ?? 1) * measure.length;
            line.getGeometry()?.setCoordinates(measure.slice(distance));
            marker.getGeometry()?.setCoordinates(measure.pointAt(distance));
            arrow.setRotation(frame.heading ?? measure.headingAt(distance, measure.length * 0.01));
            marker.changed();
        },
        remove: () => {
            map.removeLayer(layer);
            layer.dispose();
        },
    };
}
