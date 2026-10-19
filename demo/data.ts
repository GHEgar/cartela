import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import type { SymbolEntry } from 'cartela';
import { CLASSES, noise, ORIGIN, ROUTE, STEP } from './sample';

export { CLASSES, THEME } from './sample';

export function cellsLayer(): VectorLayer {
    const features: Feature[] = [];
    for (let i = 0; i < 12; i += 1) {
        for (let j = 0; j < 9; j += 1) {
            const [x, y] = [ORIGIN[0] + i * STEP, ORIGIN[1] + j * STEP];
            const ring = [[x, y], [x + STEP, y], [x + STEP, y + STEP], [x, y + STEP], [x, y]].map(c => fromLonLat(c));
            const feature = new Feature(new Polygon([ring]));
            feature.set('class', Math.floor(noise(i, j) * CLASSES.length));
            features.push(feature);
        }
    }
    const styles = CLASSES.map(color => new Style({
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#ffffff', width: 0.5 }),
    }));
    return new VectorLayer({
        source: new VectorSource({ features, attributions: 'Synthetic data by cartela' }),
        style: feature => styles[feature.get('class') as number] ?? styles[0],
        properties: { title: 'Cells' },
    });
}

export function routeLine(): LineString {
    return new LineString(ROUTE.map(c => fromLonLat(c)));
}

export function routeLayer(): VectorLayer {
    return new VectorLayer({
        source: new VectorSource({ features: [new Feature(routeLine())] }),
        style: new Style({ stroke: new Stroke({ color: '#c2410c', width: 3 }) }),
        properties: { title: 'Route' },
    });
}

export const CENTER = fromLonLat([ORIGIN[0] + 6 * STEP, ORIGIN[1] + 4.5 * STEP]);

export function classEntries(long: boolean): SymbolEntry[] {
    const base: SymbolEntry[] = CLASSES.map((fill, i) => ({ label: `Class ${i + 1}`, fill, stroke: '#94a3b8' }));
    base.push({ label: 'Route', stroke: '#c2410c', shape: 'line' });
    if (!long) return base;
    const extra = Array.from({ length: 70 }, (_, i) => ({
        label: `Additional category ${i + 1} with a long name to test line wrapping`,
        fill: CLASSES[i % CLASSES.length] ?? '#ccc',
        shape: i % 2 ? 'circle' as const : 'box' as const,
    }));
    return [...base, ...extra];
}

export function swatchImage(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    CLASSES.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(i * 32, 0, 32, 24);
    });
    return canvas;
}
