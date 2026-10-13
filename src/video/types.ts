import type LineString from 'ol/geom/LineString.js';
import type { Progress, SheetElement, Size, Theme, ViewState } from '../core/types.js';

export type VideoFormat = 'mp4' | 'webm' | 'gif';

export interface FrameState extends ViewState {
    along?: number;
    heading?: number;
}

export interface FramePlan {
    fps: number;
    size: Size;
    frames: FrameState[];
}

export interface FrameEncoder {
    readonly mimeType: string;
    readonly extension: string;
    readonly readsPixels: boolean;
    add: (canvas: HTMLCanvasElement, timestamp: number, duration: number) => Promise<void>;
    finish: () => Promise<Blob | null>;
    cancel: () => Promise<void>;
}

export type EncoderFactory = (size: Size, fps: number, frames: number) => Promise<FrameEncoder>;

export interface FileChunk {
    type: 'write';
    data: Uint8Array<ArrayBuffer>;
    position: number;
}

export type VideoTarget = WritableStream<FileChunk>;

export interface TrailOptions {
    route: LineString;
    stroke?: string;
    width?: number;
    halo?: string;
    marker?: boolean;
}

export interface RecordOptions {
    encoder: EncoderFactory;
    elements?: SheetElement[];
    theme?: Partial<Theme>;
    trail?: TrailOptions;
    dpi?: number;
    timeout?: number;
    freeze?: boolean;
    maxFrames?: number;
    date?: Date;
    signal?: AbortSignal;
    onProgress?: (progress: Progress) => void;
}

export interface Video {
    blob: Blob | null;
    mimeType: string;
    extension: string;
    size: Size;
    fps: number;
    frames: number;
    duration: number;
}

export type VideoSupport = Record<VideoFormat, boolean>;
