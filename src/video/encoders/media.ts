import type { CanvasSource, Quality } from 'mediabunny';
import { UnsupportedFormatError } from '../../core/errors.js';
import type { EncoderFactory } from '../types.js';
import { encodableCodec, outputFormat, type Container, type Mediabunny } from './codec.js';

export type { Container } from './codec.js';
export type VideoQuality = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';

export interface VideoEncoderOptions {
    container?: Container;
    quality?: VideoQuality | number;
    keyFrameInterval?: number;
}

function bitrate(mb: Mediabunny, quality: VideoQuality | number): number | Quality {
    if (typeof quality === 'number') return quality;
    const table: Record<VideoQuality, Quality> = {
        'very-low': mb.QUALITY_VERY_LOW,
        low: mb.QUALITY_LOW,
        medium: mb.QUALITY_MEDIUM,
        high: mb.QUALITY_HIGH,
        'very-high': mb.QUALITY_VERY_HIGH,
    };
    return table[quality];
}

export function videoEncoder(options: VideoEncoderOptions = {}): EncoderFactory {
    const container = options.container ?? 'mp4';
    return async (size, fps) => {
        if (!('VideoEncoder' in globalThis)) throw new UnsupportedFormatError(container);
        const mb = await import('mediabunny');
        const codec = await encodableCodec(mb, container, size);
        if (!codec) throw new UnsupportedFormatError(container);
        const format = outputFormat(mb, container);
        const target = new mb.BufferTarget();
        const output = new mb.Output({ format, target });
        let source: CanvasSource | null = null;
        return {
            mimeType: format.mimeType,
            extension: format.fileExtension,
            readsPixels: false,
            add: async (canvas, timestamp, duration) => {
                if (!source) {
                    source = new mb.CanvasSource(canvas, {
                        codec,
                        bitrate: bitrate(mb, options.quality ?? 'high'),
                        ...(options.keyFrameInterval === undefined ? {} : { keyFrameInterval: options.keyFrameInterval }),
                    });
                    output.addVideoTrack(source, { frameRate: fps });
                    await output.start();
                }
                await source.add(timestamp, duration);
            },
            finish: async () => {
                await output.finalize();
                if (!target.buffer) throw new Error('The video encoder produced no data');
                return new Blob([target.buffer], { type: format.mimeType });
            },
            cancel: async () => {
                if (output.state === 'pending' || output.state === 'started') await output.cancel().catch(() => undefined);
            },
        };
    };
}
