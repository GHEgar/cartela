import type { MapSnapshot, SheetOptions, Size } from '../core/types.js';
import type { FrameRecordOptions } from '../video/types.js';

export type LngLat = [number, number];

export interface Camera {
    center: LngLat;
    zoom: number;
    bearing: number;
    pitch: number;
    roll?: number;
}

export interface CameraFrame extends Camera {
    along?: number;
    heading?: number;
}

export interface CameraPlan {
    fps: number;
    size: Size;
    frames: CameraFrame[];
}

export interface StyleLayerLike {
    source?: unknown;
    minzoom?: number;
    maxzoom?: number;
    layout?: { visibility?: unknown };
}

export interface MaplibreMap {
    getContainer(): HTMLElement;
    getCanvas(): HTMLCanvasElement;
    getCenter(): { lng: number; lat: number };
    getZoom(): number;
    getBearing(): number;
    getPitch(): number;
    getRoll(): number;
    jumpTo(options: Partial<Camera>): unknown;
    getPixelRatio(): number;
    setPixelRatio(pixelRatio: number): void;
    triggerRepaint(): void;
    on(type: 'render' | 'idle', listener: () => void): unknown;
    off(type: 'render' | 'idle', listener: () => void): unknown;
    getStyle(): { layers?: readonly StyleLayerLike[] } | undefined;
    getSource(id: string): { attribution?: string } | undefined;
}

export interface CaptureOptions {
    camera?: Partial<Camera>;
    padding?: number;
    freeze?: boolean;
    timeout?: number;
    overlays?: () => readonly HTMLCanvasElement[];
    signal?: AbortSignal;
}

export interface CaptureMapOptions extends CaptureOptions {
    size: Size;
    pixelRatio?: number;
}

export interface MaplibreSnapshot extends MapSnapshot {
    camera: Camera;
}

export interface MaplibreExportOptions extends SheetOptions, Omit<CaptureOptions, 'signal'> {}

export interface MaplibreRecordOptions extends FrameRecordOptions<CameraFrame>, Omit<CaptureOptions, 'signal' | 'camera'> {}
