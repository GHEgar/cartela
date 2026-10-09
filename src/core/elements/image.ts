import { imageSize, loadImage } from './draw.js';
import type { Box, Corner, DrawEnv, SheetElement, Size } from '../types.js';

export interface ImageOptions {
    width?: number;
    height?: number;
    align?: 'left' | 'center' | 'right';
    slot?: 'panel' | 'map';
    position?: Corner;
}

export function image(src: string | CanvasImageSource, options: ImageOptions = {}): SheetElement {
    let source: CanvasImageSource | null = typeof src === 'string' ? null : src;

    const fitted = (env: DrawEnv, maxWidth: number): Size => {
        if (!source) return [0, 0];
        const [naturalWidth, naturalHeight] = imageSize(source);
        const ratio = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 1;
        let width = options.width !== undefined ? env.mm(options.width) : 0;
        let height = options.height !== undefined ? env.mm(options.height) : 0;
        if (!width && !height) height = env.mm(12);
        if (!width) width = height * ratio;
        if (!height) height = width / ratio;
        if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
        }
        return [width, height];
    };

    const paint = (ctx: CanvasRenderingContext2D, box: Box, env: DrawEnv): undefined => {
        if (!source) return;
        const [width, height] = fitted(env, box.width);
        const align = options.align ?? 'left';
        const x = align === 'center' ? box.x + (box.width - width) / 2 : align === 'right' ? box.x + box.width - width : box.x;
        ctx.drawImage(source, x, box.y, width, height);
    };

    return {
        slot: options.slot ?? 'panel',
        position: options.position ?? 'top-left',
        load: async (_env, signal) => {
            if (typeof src === 'string') source = await loadImage(src, signal).catch(() => null);
        },
        measure: (_ctx, width, env) => fitted(env, width)[1],
        size: (_ctx, env) => fitted(env, env.layout.frame.width / 3),
        draw: paint,
    };
}
