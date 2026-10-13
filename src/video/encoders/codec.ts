import type { Mp4OutputFormat, VideoCodec, WebMOutputFormat } from 'mediabunny';
import type { Size } from '../../core/types.js';

export type Container = 'mp4' | 'webm';
export type Mediabunny = typeof import('mediabunny');

export function outputFormat(mb: Mediabunny, container: Container): Mp4OutputFormat | WebMOutputFormat {
    return container === 'mp4' ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat();
}

export async function encodableCodec(mb: Mediabunny, container: Container, size: Size): Promise<VideoCodec | null> {
    const format = outputFormat(mb, container);
    return mb.getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: size[0], height: size[1] });
}
