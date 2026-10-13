import { useEffect, useMemo, useState } from 'react';
import type OlMap from 'ol/Map.js';
import { attribution, northArrow, scaleBar, title } from 'cartela';
import {
    canPickFile, fileTarget, gifEncoder, pickFormat, planOrbit, planRoute, recordMap, recordingDefaults, videoEncoder, videoSupport,
    type EncoderFactory, type FileChunk, type FramePlan, type Video, type VideoFormat, type VideoSupport, type VideoTarget,
} from 'cartela/video';
import { useMapVideo } from 'cartela/react';
import { routeLine } from './data';

declare global {
    interface Window {
        cartelaVideo?: {
            video: Video | null;
            head: () => Promise<number[]>;
            support: VideoSupport | null;
            streamed: (format: VideoFormat, cancelAfter?: number) => Promise<{ bytes: number[]; blob: boolean; closed: boolean; aborted: boolean }>;
        };
    }
}

const LABELS: Record<VideoFormat, string> = { mp4: 'MP4', webm: 'WebM', gif: 'GIF' };

function encoderFor(format: VideoFormat, target?: VideoTarget): EncoderFactory {
    const extra = target ? { target } : {};
    return format === 'gif' ? gifEncoder(extra) : videoEncoder({ container: format, ...extra });
}

function memoryTarget() {
    const state = { bytes: new Uint8Array(0), closed: false, aborted: false };
    const target: VideoTarget = new WritableStream<FileChunk>({
        write: chunk => {
            const end = chunk.position + chunk.data.length;
            if (end > state.bytes.length) {
                const grown = new Uint8Array(end);
                grown.set(state.bytes);
                state.bytes = grown;
            }
            state.bytes.set(chunk.data, chunk.position);
        },
        close: () => {
            state.closed = true;
        },
        abort: () => {
            state.aborted = true;
        },
    });
    return { target, state };
}

export function VideoPanel({ map }: { map: OlMap | null }) {
    const [support, setSupport] = useState<VideoSupport | null>(null);
    const [format, setFormat] = useState<VideoFormat>('mp4');
    const [planError, setPlanError] = useState<string | null>(null);
    const [seconds, setSeconds] = useState(4);
    const [toDisk, setToDisk] = useState(false);
    const job = useMapVideo(map);

    useEffect(() => {
        let alive = true;
        videoSupport().then(result => {
            if (!alive) return;
            setSupport(result);
            setFormat(current => pickFormat(current, result) ?? current);
        });
        return () => {
            alive = false;
        };
    }, []);

    const url = useMemo(() => (job.video?.blob ? URL.createObjectURL(job.video.blob) : null), [job.video]);
    useEffect(() => () => {
        if (url) URL.revokeObjectURL(url);
    }, [url]);

    useEffect(() => {
        const blob = job.video?.blob;
        window.cartelaVideo = {
            video: job.video,
            support,
            head: async () => (blob ? [...new Uint8Array(await blob.slice(0, 12).arrayBuffer())] : []),
            streamed: async (kind, cancelAfter) => {
                if (!map) throw new Error('No map');
                const { fps, size } = recordingDefaults(kind);
                const { target, state } = memoryTarget();
                const controller = new AbortController();
                const result = await recordMap(map, planOrbit(map, { fps, size, duration: 1 }), {
                    encoder: encoderFor(kind, target),
                    signal: controller.signal,
                    onProgress: progress => {
                        if (cancelAfter !== undefined && progress.phase === 'render' && progress.ratio >= cancelAfter) controller.abort();
                    },
                }).catch(() => null);
                return { bytes: [...state.bytes], blob: !!result?.blob, closed: state.closed, aborted: state.aborted };
            },
        };
    }, [job.video, support, map]);

    const route = useMemo(() => routeLine(), []);
    const elements = useMemo(() => [title('Recorrido de ejemplo', { slot: 'map' }), scaleBar({ locale: 'es-MX' }), northArrow({ position: 'top-right' }), attribution({ prefix: '© ', slot: 'map' })], []);

    const record = async (kind: 'route' | 'orbit') => {
        if (!map) return;
        const { fps, size } = recordingDefaults(format);
        let plan: FramePlan;
        try {
            plan = kind === 'route'
                ? planRoute(map, route, { fps, size, duration: seconds, rotate: true })
                : planOrbit(map, { fps, size, duration: seconds });
        } catch (error) {
            setPlanError(error instanceof Error ? error.message : String(error));
            return;
        }
        setPlanError(null);
        let target: VideoTarget | null = null;
        if (toDisk) {
            try {
                target = await fileTarget(`cartela-${kind}.${format}`, format === 'gif' ? 'image/gif' : `video/${format}`);
            } catch {
                return;
            }
        }
        job.record(plan, { encoder: encoderFor(format, target ?? undefined), elements, ...(kind === 'route' ? { trail: { route } } : {}) });
    };

    const running = job.status === 'running';
    return (
        <section className="video">
            <label>Formato
                <select value={format} onChange={e => setFormat(e.target.value as VideoFormat)} data-testid="format">
                    {(Object.keys(LABELS) as VideoFormat[]).map(key => (
                        <option key={key} value={key} disabled={!support?.[key]}>{LABELS[key]}</option>
                    ))}
                </select>
            </label>
            <label>Segundos<input type="text" inputMode="numeric" value={seconds} onChange={e => setSeconds(Number(e.target.value) || 1)} data-testid="seconds" /></label>
            {canPickFile() && <label className="check"><input type="checkbox" checked={toDisk} onChange={e => setToDisk(e.target.checked)} />Guardar directo a disco</label>}
            <div className="row">
                <button type="button" onClick={() => record('route')} disabled={!map || !support || running} data-testid="record-route">Ruta</button>
                <button type="button" onClick={() => record('orbit')} disabled={!map || !support || running} data-testid="record-orbit">Órbita</button>
                {running && <button type="button" onClick={job.cancel}>Cancelar</button>}
            </div>
            <span className="status" data-testid="video-status">
                {job.status}{job.progress ? ` · ${job.progress.phase} ${Math.round(job.progress.ratio * 100)}%` : ''}
                {job.video ? ` · ${job.video.frames} cuadros · ${job.video.size.join('×')} · ${job.video.extension}${job.video.blob ? '' : ' · en disco'}` : ''}
                {job.error ? ` · ${job.error.message}` : ''}
                {planError ? ` · ${planError}` : ''}
            </span>
            {url && job.video && (job.video.mimeType === 'image/gif'
                ? <img src={url} alt="Animación grabada" />
                : <video src={url} controls loop muted />)}
        </section>
    );
}
