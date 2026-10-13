import type { CanvasSource, Quality } from 'mediabunny';
import { UnsupportedFormatError } from '../../core/errors.js';
import type { EncoderFactory, VideoTarget } from '../types.js';
import { relay } from '../target.js';
import { encodableCodec, outputFormat, type Container, type Mediabunny } from './codec.js';

export type { Container } from './codec.js';
export type VideoQuality = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';

export interface VideoEncoderOptions {
    container?: Container;
    quality?: VideoQuality | number;
    keyFrameInterval?: number;
    target?: VideoTarget;
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
    return async (size, fps, frames) => {
        if (!('VideoEncoder' in globalThis)) throw new UnsupportedFormatError(container);
        const mb = await import('mediabunny');
        const codec = await encodableCodec(mb, container, size);
        if (!codec) throw new UnsupportedFormatError(container);
        const streamed = options.target !== undefined;
        const format = outputFormat(mb, container, streamed);
        const memory = streamed ? null : new mb.BufferTarget();
        const stream = options.target ? relay(options.target) : null;
        const target = stream ? new mb.StreamTarget(stream.writable, { chunked: true }) : memory;
        if (!target) throw new Error('The video encoder has no target');
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
                    output.addVideoTrack(source, { frameRate: fps, ...(streamed ? { maximumPacketCount: Math.max(1, frames) } : {}) });
                    await output.start();
                }
                await source.add(timestamp, duration);
            },
            finish: async () => {
                await output.finalize();
                if (!memory) return null;
                if (!memory.buffer) throw new Error('The video encoder produced no data');
                return new Blob([memory.buffer], { type: format.mimeType });
            },
            cancel: async () => {
                await stream?.abort(new DOMException('The recording was cancelled', 'AbortError'));
                if (output.state === 'pending' || output.state === 'started') await output.cancel().catch(() => undefined);
            },
        };
    };
}
