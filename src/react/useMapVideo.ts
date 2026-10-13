import { useCallback, useEffect, useRef, useState } from 'react';
import type OlMap from 'ol/Map.js';
import type { Progress } from '../core/types.js';
import { recordMap } from '../video/record.js';
import type { FramePlan, RecordOptions, Video } from '../video/types.js';
import type { ExportStatus } from './useMapExport.js';

export interface MapVideoState {
    status: ExportStatus;
    progress: Progress | null;
    error: Error | null;
    video: Video | null;
}

export interface MapVideo extends MapVideoState {
    record: (plan: FramePlan, options: RecordOptions) => Promise<Video | null>;
    cancel: () => void;
    reset: () => void;
}

const IDLE: MapVideoState = { status: 'idle', progress: null, error: null, video: null };

function isAbort(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}

export function useMapVideo(map: OlMap | null | undefined): MapVideo {
    const [state, setState] = useState<MapVideoState>(IDLE);
    const controller = useRef<AbortController | null>(null);

    useEffect(() => () => controller.current?.abort(), []);

    const record = useCallback(async (plan: FramePlan, options: RecordOptions): Promise<Video | null> => {
        if (!map) return null;
        controller.current?.abort();
        const current = new AbortController();
        controller.current = current;
        const signal = options.signal ? AbortSignal.any([options.signal, current.signal]) : current.signal;
        setState({ status: 'running', progress: null, error: null, video: null });
        try {
            const video = await recordMap(map, plan, {
                ...options,
                signal,
                onProgress: progress => {
                    options.onProgress?.(progress);
                    if (controller.current === current) setState(prev => ({ ...prev, progress }));
                },
            });
            if (controller.current === current) setState({ status: 'done', progress: null, error: null, video });
            return video;
        } catch (error) {
            if (controller.current === current) {
                setState(isAbort(error)
                    ? { ...IDLE, status: 'cancelled' }
                    : { status: 'error', progress: null, error: error instanceof Error ? error : new Error(String(error)), video: null });
            }
            return null;
        } finally {
            if (controller.current === current) controller.current = null;
        }
    }, [map]);

    const cancel = useCallback(() => controller.current?.abort(), []);
    const reset = useCallback(() => {
        controller.current?.abort();
        setState(IDLE);
    }, []);

    return { ...state, record, cancel, reset };
}
