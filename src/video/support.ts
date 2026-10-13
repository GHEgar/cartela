import type { Size } from '../core/types.js';
import { encodableCodec, type Container } from './encoders/codec.js';
import type { VideoFormat, VideoSupport } from './types.js';

export const FORMAT_ORDER: readonly VideoFormat[] = ['mp4', 'webm', 'gif'];

async function canEncode(container: Container, size: Size): Promise<boolean> {
    if (!('VideoEncoder' in globalThis)) return false;
    try {
        const mb = await import('mediabunny');
        return (await encodableCodec(mb, container, size)) !== null;
    } catch {
        return false;
    }
}

async function canGif(): Promise<boolean> {
    try {
        await import('gifenc');
        return typeof document !== 'undefined';
    } catch {
        return false;
    }
}

export async function videoSupport(size: Size = [1280, 720]): Promise<VideoSupport> {
    const [mp4, webm, gif] = await Promise.all([canEncode('mp4', size), canEncode('webm', size), canGif()]);
    return { mp4, webm, gif };
}

export function pickFormat(
    preferred: VideoFormat | null,
    support: VideoSupport,
    order: readonly VideoFormat[] = FORMAT_ORDER,
): VideoFormat | null {
    if (preferred && support[preferred]) return preferred;
    return order.find(format => support[format]) ?? null;
}
