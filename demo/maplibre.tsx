import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Map as MaplibreGl, type StyleSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'rotulo';
import { attribution, legend, northArrow, saveBlob, scaleBar, title, toBlob, toPdf, type LegendClassItem, type Sheet } from 'cartela';
import { exportMap, planOrbit, printFrame, recordMap, type MaplibreExportOptions } from 'cartela/maplibre';
import { gifEncoder, pickFormat, recordingDefaults, videoEncoder, videoSupport, type Video, type VideoFormat } from 'cartela/video';
import { CLASSES, noise, ORIGIN, ROUTE, STEP, THEME } from './sample';

declare global {
    interface Window {
        cartelaMaplibre?: { map: MaplibreGl; sheet: Sheet | null; video: Video | null };
    }
}

const COUNTS = CLASSES.map(() => 0);

function cells(): FeatureCollection {
    const features: Feature[] = [];
    for (let i = 0; i < 12; i += 1) {
        for (let j = 0; j < 9; j += 1) {
            const [x, y] = [ORIGIN[0] + i * STEP, ORIGIN[1] + j * STEP];
            const value = noise(i, j);
            const index = Math.floor(value * CLASSES.length);
            COUNTS[index] = (COUNTS[index] ?? 0) + 1;
            features.push({
                type: 'Feature',
                properties: { color: CLASSES[index], height: 400 + value * 6000 },
                geometry: { type: 'Polygon', coordinates: [[[x, y], [x + STEP, y], [x + STEP, y + STEP], [x, y + STEP], [x, y]]] },
            });
        }
    }
    return { type: 'FeatureCollection', features };
}

const STYLE: StyleSpecification = {
    version: 8,
    sources: {
        cells: { type: 'geojson', data: cells(), attribution: 'Synthetic data by cartela' },
        route: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ROUTE } } },
    },
    layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#dbe4ec' } },
        {
            id: 'cells',
            type: 'fill-extrusion',
            source: 'cells',
            paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': 0.9 },
        },
        { id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#c2410c', 'line-width': 3 } },
    ],
};

const CLASS_ITEMS: LegendClassItem[] = CLASSES.map((color, i) => ({ label: `Class ${i + 1}`, color, count: COUNTS[i] ?? 0 }));

function useMaplibre(): [React.RefObject<HTMLDivElement | null>, MaplibreGl | null] {
    const ref = useRef<HTMLDivElement | null>(null);
    const [map, setMap] = useState<MaplibreGl | null>(null);
    useEffect(() => {
        if (!ref.current) return undefined;
        const instance = new MaplibreGl({
            container: ref.current,
            style: STYLE,
            center: [ORIGIN[0] + 6 * STEP, ORIGIN[1] + 4.5 * STEP],
            zoom: 9.6,
            pitch: 55,
            bearing: -20,
            maxCanvasSize: [8192, 8192],
        });
        instance.once('load', () => setMap(instance));
        return () => {
            instance.remove();
            setMap(null);
        };
    }, []);
    return [ref, map];
}

function App() {
    const [target, map] = useMaplibre();
    const [globe, setGlobe] = useState(false);
    const [status, setStatus] = useState('idle');
    const [sheet, setSheet] = useState<Sheet | null>(null);
    const [video, setVideo] = useState<Video | null>(null);
    const [format, setFormat] = useState<VideoFormat | null>(null);
    const [preview, setPreview] = useState<{ url: string; video: boolean } | null>(null);
    const [frame, setFrame] = useState<ReturnType<typeof printFrame>>(null);

    const options = useMemo<MaplibreExportOptions>(() => ({
        page: { size: 'letter', orientation: 'landscape', dpi: 150 },
        layout: 'right',
        theme: THEME,
        elements: [
            title('Sample columns', { subtitle: 'cartela on MapLibre' }),
            legend([{ kind: 'classes', layerId: 'cells', title: 'Cells', classes: CLASS_ITEMS }], { histogram: true }),
            attribution({ prefix: '© ' }),
            scaleBar({ ratio: true, locale: 'en-US' }),
            northArrow(),
        ],
    }), []);

    useEffect(() => {
        if (!map) return undefined;
        const update = (): void => setFrame(printFrame(map, options));
        update();
        map.on('resize', update);
        return () => {
            map.off('resize', update);
        };
    }, [map, options]);

    useEffect(() => {
        map?.setProjection({ type: globe ? 'globe' : 'mercator' });
    }, [map, globe]);

    useEffect(() => {
        videoSupport().then(support => setFormat(pickFormat('mp4', support)));
    }, []);

    useEffect(() => {
        if (map) window.cartelaMaplibre = { map, sheet, video };
    }, [map, sheet, video]);

    useEffect(() => () => {
        if (preview) URL.revokeObjectURL(preview.url);
    }, [preview]);

    const run = async (job: () => Promise<Blob | null>, video: boolean) => {
        setStatus('running');
        try {
            const blob = await job();
            setPreview(blob ? { url: URL.createObjectURL(blob), video: video && blob.type.startsWith('video/') } : null);
            setStatus('done');
        } catch (error) {
            setStatus(`error · ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const exportSheet = () => run(async () => {
        if (!map) return null;
        const result = await exportMap(map, options);
        setSheet(result);
        return toBlob(result);
    }, false);

    const orbit = () => run(async () => {
        if (!map || !format) return null;
        const { fps, size } = recordingDefaults(format);
        const result = await recordMap(map, planOrbit(map, { fps, size, duration: 4 }), {
            encoder: format === 'gif' ? gifEncoder() : videoEncoder({ container: format }),
            elements: [title('Orbit', { slot: 'map' }), northArrow(), attribution({ prefix: '© ', slot: 'map' })],
            theme: THEME,
        });
        setVideo(result);
        return result.blob;
    }, true);

    const running = status === 'running';
    return (
        <div className="app">
            <div className="map">
                <div ref={target} className="map-target" data-testid="map" />
                {frame && <div className="guide" data-testid="guide" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }} />}
            </div>
            <aside className="side">
                <a href="./index.html">OpenLayers demo</a>
                <label className="check"><input type="checkbox" checked={globe} onChange={e => setGlobe(e.target.checked)} data-testid="globe" />Globe</label>
                <div className="row">
                    <button type="button" onClick={exportSheet} disabled={!map || running} data-testid="export">Export</button>
                    <button type="button" onClick={() => sheet && toPdf(sheet).then(blob => saveBlob(blob, 'cartela-maplibre.pdf'))} disabled={!sheet}>PDF</button>
                    <button type="button" onClick={orbit} disabled={!map || !format || running} data-testid="record-orbit">Orbit</button>
                </div>
                <span className="status" data-testid="status">
                    {status}{sheet ? ` · ${sheet.geometry.size.join('×')} px` : ''}{video ? ` · ${video.frames} frames ${video.extension}` : ''}
                </span>
                <div className="pages">
                    {preview && (preview.video
                        ? <video src={preview.url} controls loop muted />
                        : <img src={preview.url} alt="Export" />)}
                </div>
            </aside>
        </div>
    );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
