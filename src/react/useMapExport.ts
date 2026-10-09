import { useCallback, useEffect, useRef, useState } from 'react';
import type OlMap from 'ol/Map.js';
import { exportMap } from '../core/export.js';
import type { ExportOptions, Progress, Sheet } from '../core/types.js';

export type ExportStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

export interface MapExportState {
    status: ExportStatus;
    progress: Progress | null;
    error: Error | null;
    sheet: Sheet | null;
}

export interface MapExport extends MapExportState {
    run: (options?: ExportOptions) => Promise<Sheet | null>;
    cancel: () => void;
    reset: () => void;
}

const IDLE: MapExportState = { status: 'idle', progress: null, error: null, sheet: null };

function isAbort(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}

export function useMapExport(map: OlMap | null | undefined): MapExport {
    const [state, setState] = useState<MapExportState>(IDLE);
    const controller = useRef<AbortController | null>(null);

    useEffect(() => () => controller.current?.abort(), []);

    const run = useCallback(async (options: ExportOptions = {}): Promise<Sheet | null> => {
        if (!map) return null;
        controller.current?.abort();
        const current = new AbortController();
        controller.current = current;
        const signal = options.signal ? AbortSignal.any([options.signal, current.signal]) : current.signal;
        setState({ status: 'running', progress: null, error: null, sheet: null });
        try {
            const sheet = await exportMap(map, {
                ...options,
                signal,
                onProgress: progress => {
                    options.onProgress?.(progress);
                    if (controller.current === current) setState(prev => ({ ...prev, progress }));
                },
            });
            if (controller.current === current) setState({ status: 'done', progress: null, error: null, sheet });
            return sheet;
        } catch (error) {
            if (controller.current === current) {
                setState(isAbort(error)
                    ? { ...IDLE, status: 'cancelled' }
                    : { status: 'error', progress: null, error: error instanceof Error ? error : new Error(String(error)), sheet: null });
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

    return { ...state, run, cancel, reset };
}
