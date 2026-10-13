import type { Mp4OutputFormat, VideoCodec, WebMOutputFormat } from 'mediabunny';
import type { Size } from '../../core/types.js';

export type Container = 'mp4' | 'webm';
export type Mediabunny = typeof import('mediabunny');

export function outputFormat(mb: Mediabunny, container: Container, streamed = false): Mp4OutputFormat | WebMOutputFormat {
    if (container === 'webm') return new mb.WebMOutputFormat();
    return new mb.Mp4OutputFormat({ fastStart: streamed ? 'reserve' : 'in-memory' });
}

export async function encodableCodec(mb: Mediabunny, container: Container, size: Size): Promise<VideoCodec | null> {
    const format = outputFormat(mb, container);
    return mb.getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: size[0], height: size[1] });
}
