import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import 'ol/ol.css';
import 'rotulo';
import {
    attribution, dateText, graticule, grid, legend, northArrow, overviewMap, QUALITY, saveBlob, scaleBar, text, title, toBlob, toPdf,
    type ExportOptions, type LayoutKind, type Quality, type Sheet,
} from 'cartela';
import { useMapExport, usePrintFrame } from 'cartela/react';
import { CENTER, THEME, cellsLayer, classEntries, routeLayer, swatchImage } from './data';
import { VideoPanel } from './video';

declare global {
    interface Window {
        cartela?: { map: OlMap; sheet: Sheet | null; pdf: () => Promise<string> };
    }
}

type GridKind = 'none' | 'divisions' | 'lonlat' | 'utm';

function gridElements(kind: GridKind) {
    if (kind === 'divisions') return [grid()];
    if (kind === 'lonlat') return [graticule()];
    if (kind === 'utm') return [graticule({ crs: 'utm' })];
    return [];
}

function useMap(): [React.RefObject<HTMLDivElement | null>, OlMap | null] {
    const ref = useRef<HTMLDivElement | null>(null);
    const [map, setMap] = useState<OlMap | null>(null);
    useEffect(() => {
        if (!ref.current) return undefined;
        const instance = new OlMap({
            target: ref.current,
            layers: [cellsLayer(), routeLayer()],
            view: new View({ center: CENTER, zoom: 10 }),
        });
        setMap(instance);
        return () => {
            instance.setTarget(undefined);
            setMap(null);
        };
    }, []);
    return [ref, map];
}

function App() {
    const [target, map] = useMap();
    const [mapTitle, setTitle] = useState('Sample cells');
    const [layout, setLayout] = useState<LayoutKind>('right');
    const [quality, setQuality] = useState<Quality>('normal');
    const [longLegend, setLongLegend] = useState(false);
    const [gridKind, setGridKind] = useState<GridKind>('divisions');
    const [withOverview, setWithOverview] = useState(false);
    const [urls, setUrls] = useState<string[]>([]);
    const job = useMapExport(map);

    const options = useMemo<ExportOptions>(() => ({
        page: { size: 'letter', orientation: 'landscape', dpi: QUALITY[quality] },
        layout,
        theme: THEME,
        elements: [
            title(mapTitle, { subtitle: 'cartela demo' }),
            dateText({ locale: 'en-US' }),
            legend([{ heading: 'Classes' }, ...classEntries(longLegend), { label: 'Ramp', image: swatchImage() }], { title: 'Legend' }),
            text('Source: synthetic data generated in the browser.'),
            attribution({ prefix: '© ' }),
            scaleBar({ ratio: true, locale: 'en-US' }),
            northArrow(),
            ...gridElements(gridKind),
            ...(withOverview ? [overviewMap({ layers: () => [cellsLayer(), routeLayer()], position: 'bottom-right' })] : []),
        ],
    }), [mapTitle, layout, quality, longLegend, gridKind, withOverview]);

    const frame = usePrintFrame(map, options);

    useEffect(() => {
        if (map) window.cartela = { map, sheet: job.sheet, pdf: async () => {
            if (!job.sheet) return '';
            const blob = await toPdf(job.sheet, { title: mapTitle });
            return new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 8));
        } };
    }, [map, job.sheet, mapTitle]);

    useEffect(() => {
        const sheet = job.sheet;
        if (!sheet) return undefined;
        let alive = true;
        const created: string[] = [];
        Promise.all(sheet.pages.map((_, i) => toBlob(sheet, 'image/png', 1, i))).then(blobs => {
            if (!alive) return;
            created.push(...blobs.map(blob => URL.createObjectURL(blob)));
            setUrls(created);
        });
        return () => {
            alive = false;
            created.forEach(url => URL.revokeObjectURL(url));
        };
    }, [job.sheet]);

    const download = async (kind: 'png' | 'pdf') => {
        if (!job.sheet) return;
        const blob = kind === 'pdf' ? await toPdf(job.sheet, { title: mapTitle }) : await toBlob(job.sheet);
        saveBlob(blob, `${mapTitle}.${kind}`);
    };

    const running = job.status === 'running';
    return (
        <div className="app">
            <div className="map">
                <div ref={target} className="map-target" data-testid="map" />
                {frame && <div className="guide" data-testid="guide" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }} />}
            </div>
            <aside className="side">
                <label>Title<input type="text" value={mapTitle} onChange={e => setTitle(e.target.value)} /></label>
                <label>Layout
                    <select value={layout} onChange={e => setLayout(e.target.value as LayoutKind)} data-testid="layout">
                        <option value="right">Right panel</option>
                        <option value="left">Left panel</option>
                        <option value="bottom">Bottom band</option>
                        <option value="none">Map only</option>
                    </select>
                </label>
                <label>Quality
                    <select value={quality} onChange={e => setQuality(e.target.value as Quality)} data-testid="quality">
                        {Object.entries(QUALITY).map(([key, dpi]) => <option key={key} value={key}>{`${key} · ${dpi} dpi`}</option>)}
                    </select>
                </label>
                <label>Graticule
                    <select value={gridKind} onChange={e => setGridKind(e.target.value as GridKind)} data-testid="grid">
                        <option value="none">None</option>
                        <option value="divisions">Divisions</option>
                        <option value="lonlat">Lon/lat</option>
                        <option value="utm">UTM</option>
                    </select>
                </label>
                <label className="check"><input type="checkbox" checked={withOverview} onChange={e => setWithOverview(e.target.checked)} data-testid="overview" />Overview map</label>
                <label className="check"><input type="checkbox" checked={longLegend} onChange={e => setLongLegend(e.target.checked)} data-testid="long" />Long legend</label>
                <div className="row">
                    <button type="button" onClick={() => job.run(options)} disabled={!map || running} data-testid="export">Export</button>
                    {running && <button type="button" onClick={job.cancel}>Cancel</button>}
                    <button type="button" onClick={() => download('png')} disabled={!job.sheet}>PNG</button>
                    <button type="button" onClick={() => download('pdf')} disabled={!job.sheet}>PDF</button>
                </div>
                <span className="status" data-testid="status">
                    {job.status}{job.progress ? ` · ${job.progress.phase} ${Math.round(job.progress.ratio * 100)}%` : ''}
                    {job.sheet ? ` · ${job.sheet.pages.length} pp. · ${job.sheet.geometry.size.join('×')} px` : ''}
                    {job.error ? ` · ${job.error.message}` : ''}
                </span>
                <VideoPanel map={map} />
                <div className="pages">{urls.map(url => <img key={url} src={url} alt="Exported page" />)}</div>
            </aside>
        </div>
    );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
