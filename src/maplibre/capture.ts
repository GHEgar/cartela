import { DEFAULT_FRAME_PADDING, fitRect } from '../core/aspect.js';
import { DEFAULT_TIMEOUT } from '../core/errors.js';
import type { Box, Size } from '../core/types.js';
import { collectAttributions } from './attributions.js';
import { cameraOf, jumpOptions, snapshotOf } from './camera.js';
import { freezeMap, repaint, viewportSize, type MapFreeze } from './paint.js';
import type { Camera, CaptureMapOptions, CaptureOptions, MaplibreMap, MaplibreSnapshot } from './types.js';

export interface CaptureFrame {
    canvas: HTMLCanvasElement;
    camera: Camera;
    attributions: string[];
}

export interface CaptureSession {
    readonly rect: Box;
    readonly canvas: HTMLCanvasElement;
    render: (camera?: Partial<Camera>, signal?: AbortSignal) => Promise<CaptureFrame>;
    close: () => void;
}

function draw(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, rect: Box, screen: Size, output: Size): void {
    const scale = source.width / screen[0];
    if (!(scale > 0)) return;
    ctx.drawImage(source, rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale, 0, 0, output[0], output[1]);
}

export async function openCapture(map: MaplibreMap, output: Size, options: Omit<CaptureOptions, 'camera'> = {}): Promise<CaptureSession> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const screen = viewportSize(map);
    if (!screen[0] || !screen[1]) throw new Error('The map container has no size');
    const rect = fitRect(screen, output[0] / output[1], options.padding ?? DEFAULT_FRAME_PADDING);
    const original = { camera: cameraOf(map), pixelRatio: map.getPixelRatio() };
    const followsDevice = original.pixelRatio === globalThis.devicePixelRatio;

    const canvas = document.createElement('canvas');
    canvas.width = output[0];
    canvas.height = output[1];
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');

    const frozen: MapFreeze | null = options.freeze === false ? null : await freezeMap(map, timeout, options.signal);
    let open = true;
    let moved = false;
    map.setPixelRatio(output[0] / rect.width);

    const render = async (camera?: Partial<Camera>, signal?: AbortSignal): Promise<CaptureFrame> => {
        if (!open) throw new Error('The capture session is closed');
        if (camera) {
            map.jumpTo(jumpOptions(camera));
            moved = true;
        }
        return repaint(map, 'idle', timeout, signal, () => {
            ctx.clearRect(0, 0, output[0], output[1]);
            draw(ctx, map.getCanvas(), rect, screen, output);
            for (const overlay of options.overlays?.() ?? []) draw(ctx, overlay, rect, screen, output);
            return { canvas, camera: cameraOf(map), attributions: collectAttributions(map) };
        });
    };

    const close = (): void => {
        if (!open) return;
        open = false;
        map.setPixelRatio(followsDevice ? (null as unknown as number) : original.pixelRatio);
        if (moved) map.jumpTo(jumpOptions(original.camera));
        if (!frozen) return;
        const release = (): void => {
            clearTimeout(timer);
            map.off('idle', release);
            frozen.release();
        };
        const timer = setTimeout(release, timeout);
        map.on('idle', release);
        map.triggerRepaint();
    };

    return { rect, canvas, render, close };
}

export async function captureMap(map: MaplibreMap, options: CaptureMapOptions): Promise<MaplibreSnapshot> {
    const pixelRatio = options.pixelRatio ?? 1;
    const size: Size = [Math.max(1, Math.round(options.size[0])), Math.max(1, Math.round(options.size[1]))];
    const output: Size = [Math.max(1, Math.round(options.size[0] * pixelRatio)), Math.max(1, Math.round(options.size[1] * pixelRatio))];
    const session = await openCapture(map, output, options);
    try {
        const frame = await session.render(options.camera, options.signal);
        return snapshotOf({ ...frame, size, pixelRatio, cssWidth: session.rect.width });
    } finally {
        session.close();
    }
}
