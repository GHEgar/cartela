import type OlMap from 'ol/Map.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Extent } from 'ol/extent.js';
import type { ProjectionLike } from 'ol/proj.js';

export type Size = [number, number];

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Insets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export type PaperName = 'letter' | 'legal' | 'tabloid' | 'a5' | 'a4' | 'a3' | 'a2';

export interface PageOptions {
    size?: PaperName | Size;
    orientation?: 'landscape' | 'portrait';
    dpi?: number;
    margin?: number;
}

export type LayoutKind = 'right' | 'left' | 'bottom' | 'none';

export interface LayoutOptions {
    kind?: LayoutKind;
    panel?: number;
    gap?: number;
    columns?: number;
}

export interface Theme {
    fontFamily: string;
    fontSize: number;
    titleSize: number;
    color: string;
    muted: string;
    background: string;
    frame: string;
    frameWidth: number;
    halo: string;
    gap: number;
}

export type ExtentMode =
    | 'frame'
    | 'view'
    | Extent
    | { center: Coordinate; resolution: number };

export type TimeoutMode = 'error' | 'capture';

export interface MapRenderOptions {
    extent?: ExtentMode;
    fit?: 'contain' | 'cover';
    padding?: number;
    inset?: Partial<Insets>;
    rotation?: number;
    timeout?: number;
    onTimeout?: TimeoutMode;
    freeze?: boolean;
    signal?: AbortSignal;
}

export interface RenderMapOptions extends MapRenderOptions {
    size: Size;
    pixelRatio?: number;
    aspect?: number;
}

export interface MapSnapshot {
    canvas: HTMLCanvasElement;
    size: Size;
    pixelRatio: number;
    center: Coordinate;
    resolution: number;
    rotation: number;
    projection: ProjectionLike;
    extent: Extent;
    attributions: string[];
    pending?: string[];
}

export interface ViewState {
    center: Coordinate;
    resolution: number;
    rotation: number;
}

export interface SessionOptions {
    size: Size;
    pixelRatio?: number;
    freeze?: boolean;
    timeout?: number;
    onTimeout?: TimeoutMode;
}

export interface MapSession {
    readonly canvas: HTMLCanvasElement;
    readonly size: Size;
    readonly pixelRatio: number;
    render: (state: ViewState, signal?: AbortSignal) => Promise<MapSnapshot>;
    close: () => void;
}

export type Phase = 'layout' | 'render' | 'load' | 'compose' | 'encode';

export interface Progress {
    phase: Phase;
    ratio: number;
}

export interface SheetOptions {
    page?: PageOptions;
    layout?: LayoutKind | LayoutOptions;
    elements?: SheetElement[];
    theme?: Partial<Theme>;
    maxPixels?: number;
    date?: Date;
    signal?: AbortSignal;
    onProgress?: (progress: Progress) => void;
}

export interface ExportOptions extends SheetOptions, MapRenderOptions {}

export interface CaptureRequest {
    size: Size;
    pixelRatio: number;
    aspect: number;
}

export type Capture = (request: CaptureRequest) => Promise<MapSnapshot>;

export interface PageGeometry {
    size: Size;
    dpi: number;
    requestedDpi: number;
    clamped: boolean;
    paper: Size;
}

export interface SheetLayout {
    page: Box;
    content: Box;
    frame: Box;
    panels: Box[];
}

export interface DrawEnv {
    dpi: number;
    theme: Theme;
    snapshot: MapSnapshot;
    layout: SheetLayout;
    date: Date;
    mm: (value: number) => number;
    pt: (value: number) => number;
    font: (size: number, weight?: string) => string;
    toCoordinate: (x: number, y: number) => Coordinate;
    toPixel: (coordinate: Coordinate) => [number, number];
}

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface SheetElement {
    readonly slot: 'map' | 'panel' | 'frame';
    readonly grow?: boolean;
    readonly position?: Corner;
    load?(env: DrawEnv, signal?: AbortSignal): Promise<void>;
    reserve?(theme: Theme): Partial<Insets>;
    measure?(ctx: CanvasRenderingContext2D, width: number, env: DrawEnv): number;
    size?(ctx: CanvasRenderingContext2D, env: DrawEnv): Size;
    draw(ctx: CanvasRenderingContext2D, box: Box, env: DrawEnv): SheetElement | null | undefined;
}

export interface Sheet {
    pages: HTMLCanvasElement[];
    geometry: PageGeometry;
    layout: SheetLayout;
    snapshot: MapSnapshot;
}

export type { OlMap };
