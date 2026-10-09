import { drawText, haloBox, measureText, wrapLines } from './draw.js';
import type { Corner, DrawEnv, SheetElement, Size } from '../types.js';

export interface AttributionOptions {
    prefix?: string;
    separator?: string;
    extra?: string[];
    slot?: 'panel' | 'map';
    position?: Corner;
}

export function attribution(options: AttributionOptions = {}): SheetElement {
    const content = (env: DrawEnv): string => {
        const items = [...env.snapshot.attributions, ...(options.extra ?? [])];
        return items.length ? `${options.prefix ?? ''}${items.join(options.separator ?? ' · ')}` : '';
    };
    const style = (env: DrawEnv): { size: number; color: string } => ({ size: env.theme.fontSize * 0.8, color: env.theme.muted });

    const size = (ctx: CanvasRenderingContext2D, env: DrawEnv): Size => {
        const value = content(env);
        if (!value) return [0, 0];
        const max = env.layout.frame.width / 2;
        ctx.font = env.font(style(env).size);
        const lines = wrapLines(ctx, value, max);
        const width = Math.min(max, Math.max(...lines.map(line => ctx.measureText(line).width)));
        return [width, measureText(ctx, value, max, style(env), env)];
    };

    return {
        slot: options.slot ?? 'panel',
        position: options.position ?? 'bottom-right',
        measure: (ctx, width, env) => (content(env) ? measureText(ctx, content(env), width, style(env), env) : 0),
        size,
        draw: (ctx, box, env) => {
            const value = content(env);
            if (!value) return;
            if (options.slot === 'map') haloBox(ctx, box, env);
            drawText(ctx, value, box, style(env), env);
        },
    };
}
