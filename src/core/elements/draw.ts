import { abortError } from '../errors.js';
import type { Box, DrawEnv } from '../types.js';

export const LINE_HEIGHT = 1.3;

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(candidate).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }
        lines.push(line);
    }
    return lines;
}

export interface TextStyle {
    size: number;
    weight?: string;
    color?: string;
    align?: CanvasTextAlign;
}

export function measureText(ctx: CanvasRenderingContext2D, text: string, width: number, style: TextStyle, env: DrawEnv): number {
    ctx.font = env.font(style.size, style.weight);
    return wrapLines(ctx, text, width).length * env.pt(style.size) * LINE_HEIGHT;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, box: Box, style: TextStyle, env: DrawEnv): number {
    ctx.font = env.font(style.size, style.weight);
    ctx.fillStyle = style.color ?? env.theme.color;
    ctx.textBaseline = 'top';
    const align = style.align ?? 'left';
    ctx.textAlign = align;
    const x = align === 'center' ? box.x + box.width / 2 : align === 'right' ? box.x + box.width : box.x;
    const step = env.pt(style.size) * LINE_HEIGHT;
    const lines = wrapLines(ctx, text, box.width);
    lines.forEach((line, i) => ctx.fillText(line, x, box.y + i * step));
    ctx.textAlign = 'left';
    return lines.length * step;
}

export function haloBox(ctx: CanvasRenderingContext2D, box: Box, env: DrawEnv): void {
    const pad = env.mm(1);
    ctx.fillStyle = env.theme.halo;
    ctx.fillRect(box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2);
}

export function loadImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.decoding = 'async';
        const onAbort = (): void => {
            image.src = '';
            reject(abortError(signal));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        image.onload = () => {
            signal?.removeEventListener('abort', onAbort);
            resolve(image);
        };
        image.onerror = () => {
            signal?.removeEventListener('abort', onAbort);
            reject(new Error(`Could not load image ${src}`));
        };
        image.src = src;
    });
}

export function imageSize(source: CanvasImageSource): [number, number] {
    if (source instanceof HTMLImageElement) return [source.naturalWidth, source.naturalHeight];
    if (source instanceof SVGImageElement) return [source.width.baseVal.value, source.height.baseVal.value];
    if (typeof VideoFrame !== 'undefined' && source instanceof VideoFrame) return [source.displayWidth, source.displayHeight];
    if (source instanceof HTMLVideoElement) return [source.videoWidth, source.videoHeight];
    if ('width' in source) return [source.width, source.height];
    return [0, 0];
}
