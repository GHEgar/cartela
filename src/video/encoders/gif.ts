import { UnsupportedFormatError } from '../../core/errors.js';
import type { EncoderFactory } from '../types.js';

export interface GifEncoderOptions {
    colors?: number;
    loop?: boolean | number;
}

export function gifDelay(timestamp: number, duration: number): number {
    return 10 * (Math.round(100 * (timestamp + duration)) - Math.round(100 * timestamp));
}

function repeatOf(loop: boolean | number): number {
    if (loop === true) return 0;
    if (loop === false) return -1;
    return Math.max(0, Math.round(loop));
}

export function gifEncoder(options: GifEncoderOptions = {}): EncoderFactory {
    const colors = Math.min(256, Math.max(2, Math.round(options.colors ?? 256)));
    const repeat = repeatOf(options.loop ?? true);
    return async () => {
        const gifenc = await import('gifenc').catch(() => null);
        if (!gifenc) throw new UnsupportedFormatError('gif');
        const { GIFEncoder, quantize, applyPalette } = gifenc;
        const gif = GIFEncoder();
        return {
            mimeType: 'image/gif',
            extension: '.gif',
            readsPixels: true,
            add: async (canvas, timestamp, duration) => {
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) throw new Error('Canvas 2D context is not available');
                const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const palette = quantize(data, colors);
                gif.writeFrame(applyPalette(data, palette), width, height, {
                    palette,
                    delay: gifDelay(timestamp, duration),
                    repeat,
                });
            },
            finish: async () => {
                gif.finish();
                return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: 'image/gif' });
            },
            cancel: async () => {
                gif.reset();
            },
        };
    };
}
