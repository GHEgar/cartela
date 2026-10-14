import type OlMap from 'ol/Map.js';
import { context, overlay } from '../core/compose.js';
import { createEnv, loadFonts } from '../core/env.js';
import { throwIfAborted } from '../core/errors.js';
import { openSession } from '../core/session.js';
import { resolveTheme } from '../core/theme.js';
import { CSS_DPI } from '../core/units.js';
import type { Box, DrawEnv, Phase, SheetLayout, Size } from '../core/types.js';
import { addTrail } from './trail.js';
import type { FramePlan, FrameEncoder, RecordOptions, Video } from './types.js';

export const MAX_FRAMES = 3600;

const even = (value: number): number => Math.max(2, 2 * Math.round(value / 2));

export function overlayDpi(size: Size): number {
    return CSS_DPI * Math.max(1, Math.min(size[0], size[1]) / 600);
}

function frameCanvas(size: Size, readsPixels: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size[0];
    canvas.height = size[1];
    if (readsPixels) canvas.getContext('2d', { willReadFrequently: true });
    return canvas;
}

export async function recordMap(map: OlMap, plan: FramePlan, options: RecordOptions): Promise<Video> {
    const { signal, onProgress } = options;
    const report = (phase: Phase, ratio: number): void => onProgress?.({ phase, ratio });
    throwIfAborted(signal);
    const elements = options.elements ?? [];
    if (elements.some(element => element.slot === 'panel')) throw new TypeError('Video frames only take map and frame elements');
    const { frames, fps } = plan;
    if (!frames.length) throw new RangeError('The plan has no frames');
    if (!(fps > 0)) throw new RangeError('The plan needs a positive fps');
    const maxFrames = options.maxFrames ?? MAX_FRAMES;
    if (frames.length > maxFrames) throw new RangeError(`The plan has ${frames.length} frames; the limit is ${maxFrames}`);

    const size: Size = [even(plan.size[0]), even(plan.size[1])];
    const theme = resolveTheme(options.theme);
    const dpi = options.dpi ?? overlayDpi(size);
    const date = options.date ?? new Date();
    const box: Box = { x: 0, y: 0, width: size[0], height: size[1] };
    const layout: SheetLayout = { page: box, content: box, frame: box, panels: [] };

    report('load', 0);
    const encoder: FrameEncoder = await options.encoder(size, fps, frames.length);
    const canvas = frameCanvas(size, encoder.readsPixels);
    const ctx = context(canvas);
    const session = openSession(map, {
        size,
        pixelRatio: 1,
        freeze: options.freeze !== false,
        ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
    });
    const trail = options.trail ? addTrail(map, options.trail, theme) : null;

    try {
        let loaded = false;
        for (const [index, frame] of frames.entries()) {
            throwIfAborted(signal);
            await options.beforeFrame?.(frame, index);
            throwIfAborted(signal);
            trail?.update(frame);
            const snapshot = await session.render(frame, signal);
            const env: DrawEnv = createEnv(dpi, theme, snapshot, layout, date);
            if (!loaded) {
                await Promise.all([loadFonts(env), ...elements.map(element => element.load?.(env, signal))]);
                throwIfAborted(signal);
                loaded = true;
                report('load', 1);
            }
            ctx.fillStyle = theme.background;
            ctx.fillRect(0, 0, size[0], size[1]);
            ctx.drawImage(snapshot.canvas, 0, 0, size[0], size[1]);
            overlay(ctx, box, elements, env);
            await encoder.add(canvas, index / fps, 1 / fps);
            report('render', (index + 1) / frames.length);
        }
        report('encode', 0);
        const blob = await encoder.finish();
        report('encode', 1);
        return {
            blob,
            mimeType: encoder.mimeType,
            extension: encoder.extension,
            size,
            fps,
            frames: frames.length,
            duration: frames.length / fps,
        };
    } catch (error) {
        await encoder.cancel().catch(() => undefined);
        throw error;
    } finally {
        trail?.remove();
        session.close();
    }
}
