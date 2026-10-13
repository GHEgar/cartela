import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import 'ol/ol.css';
import {
    attribution, dateText, grid, legend, northArrow, QUALITY, saveBlob, scaleBar, text, title, toBlob, toPdf,
    type ExportOptions, type LayoutKind, type Quality, type Sheet,
} from 'cartela';
import { useMapExport, usePrintFrame } from 'cartela/react';
import { CENTER, cellsLayer, classEntries, routeLayer, swatchImage } from './data';
import { VideoPanel } from './video';

declare global {
    interface Window {
        cartela?: { map: OlMap; sheet: Sheet | null; pdf: () => Promise<string> };
    }
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
    const [mapTitle, setTitle] = useState('Celdas de ejemplo');
    const [layout, setLayout] = useState<LayoutKind>('right');
    const [quality, setQuality] = useState<Quality>('normal');
    const [longLegend, setLongLegend] = useState(false);
    const [withGrid, setWithGrid] = useState(true);
    const [urls, setUrls] = useState<string[]>([]);
    const job = useMapExport(map);

    const options = useMemo<ExportOptions>(() => ({
        page: { size: 'letter', orientation: 'landscape', dpi: QUALITY[quality] },
        layout,
        elements: [
            title(mapTitle, { subtitle: 'Demo de cartela' }),
            dateText({ locale: 'es-MX' }),
            legend([{ heading: 'Clases' }, ...classEntries(longLegend), { label: 'Rampa', image: swatchImage() }], { title: 'Leyenda' }),
            text('Fuente: datos sintéticos generados en el navegador.'),
            attribution({ prefix: '© ' }),
            scaleBar({ ratio: true, locale: 'es-MX' }),
            northArrow(),
            ...(withGrid ? [grid()] : []),
        ],
    }), [mapTitle, layout, quality, longLegend, withGrid]);

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
                <label>Título<input type="text" value={mapTitle} onChange={e => setTitle(e.target.value)} /></label>
                <label>Distribución
                    <select value={layout} onChange={e => setLayout(e.target.value as LayoutKind)} data-testid="layout">
                        <option value="right">Panel derecho</option>
                        <option value="left">Panel izquierdo</option>
                        <option value="bottom">Banda inferior</option>
                        <option value="none">Solo mapa</option>
                    </select>
                </label>
                <label>Calidad
                    <select value={quality} onChange={e => setQuality(e.target.value as Quality)} data-testid="quality">
                        {Object.entries(QUALITY).map(([key, dpi]) => <option key={key} value={key}>{`${key} · ${dpi} dpi`}</option>)}
                    </select>
                </label>
                <label className="check"><input type="checkbox" checked={withGrid} onChange={e => setWithGrid(e.target.checked)} />Retícula</label>
                <label className="check"><input type="checkbox" checked={longLegend} onChange={e => setLongLegend(e.target.checked)} data-testid="long" />Leyenda larga</label>
                <div className="row">
                    <button type="button" onClick={() => job.run(options)} disabled={!map || running} data-testid="export">Exportar</button>
                    {running && <button type="button" onClick={job.cancel}>Cancelar</button>}
                    <button type="button" onClick={() => download('png')} disabled={!job.sheet}>PNG</button>
                    <button type="button" onClick={() => download('pdf')} disabled={!job.sheet}>PDF</button>
                </div>
                <span className="status" data-testid="status">
                    {job.status}{job.progress ? ` · ${job.progress.phase} ${Math.round(job.progress.ratio * 100)}%` : ''}
                    {job.sheet ? ` · ${job.sheet.pages.length} pág. · ${job.sheet.geometry.size.join('×')} px` : ''}
                    {job.error ? ` · ${job.error.message}` : ''}
                </span>
                <VideoPanel map={map} />
                <div className="pages">{urls.map(url => <img key={url} src={url} alt="Página exportada" />)}</div>
            </aside>
        </div>
    );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
