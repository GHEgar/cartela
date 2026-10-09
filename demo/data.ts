import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import type { SymbolEntry } from 'cartela';

export const CLASSES = ['#e8f1d6', '#bfdc9c', '#86c06c', '#4f9a4a', '#2a6b36'];

const ORIGIN: [number, number] = [-103.6, 20.45];
const STEP = 0.05;

function noise(i: number, j: number): number {
    const value = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return value - Math.floor(value);
}

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
        source: new VectorSource({ features, attributions: 'Datos sintéticos de cartela' }),
        style: feature => styles[feature.get('class') as number] ?? styles[0],
        properties: { title: 'Celdas' },
    });
}

export function routeLayer(): VectorLayer {
    const points = [[-103.55, 20.5], [-103.4, 20.62], [-103.25, 20.58], [-103.12, 20.8]].map(c => fromLonLat(c));
    return new VectorLayer({
        source: new VectorSource({ features: [new Feature(new LineString(points))] }),
        style: new Style({ stroke: new Stroke({ color: '#c2410c', width: 3 }) }),
        properties: { title: 'Ruta' },
    });
}

export const CENTER = fromLonLat([ORIGIN[0] + 6 * STEP, ORIGIN[1] + 4.5 * STEP]);

export function classEntries(long: boolean): SymbolEntry[] {
    const base: SymbolEntry[] = CLASSES.map((fill, i) => ({ label: `Clase ${i + 1}`, fill, stroke: '#94a3b8' }));
    base.push({ label: 'Ruta', stroke: '#c2410c', shape: 'line' });
    if (!long) return base;
    const extra = Array.from({ length: 70 }, (_, i) => ({
        label: `Categoría adicional ${i + 1} con un nombre largo para probar el ajuste de línea`,
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
