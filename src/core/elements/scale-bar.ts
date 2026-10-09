import { getPointResolution } from 'ol/proj.js';
import { formatDistance, niceStep } from '../geo.js';
import { CSS_DPI, MM_PER_INCH } from '../units.js';
import { haloBox } from './draw.js';
import type { Box, Corner, DrawEnv, SheetElement, Size } from '../types.js';

export interface ScaleBarOptions {
    width?: number;
    segments?: number;
    ratio?: boolean;
    locale?: string;
    slot?: 'map' | 'panel';
    position?: Corner;
    halo?: boolean;
}

export interface ScaleMeasure {
    metersPerPixel: number;
    meters: number;
    pixels: number;
    denominator: number;
}

export function scaleMeasure(env: DrawEnv, maxPixels: number): ScaleMeasure {
    const { snapshot } = env;
    const ground = getPointResolution(snapshot.projection, snapshot.resolution, snapshot.center, 'm');
    const metersPerPixel = ground / (env.dpi / CSS_DPI);
    const meters = niceStep(maxPixels * metersPerPixel);
    const paperMetersPerPixel = MM_PER_INCH / env.dpi / 1000;
    return {
        metersPerPixel,
        meters,
        pixels: metersPerPixel ? meters / metersPerPixel : 0,
        denominator: metersPerPixel / paperMetersPerPixel,
    };
}

export function scaleBar(options: ScaleBarOptions = {}): SheetElement {
    const segments = Math.max(1, options.segments ?? 4);
    const fontSize = (env: DrawEnv): number => env.theme.fontSize * 0.9;
    const barHeight = (env: DrawEnv): number => env.mm(1.4);
    const ratioText = (measure: ScaleMeasure): string =>
        `1:${Math.round(measure.denominator).toLocaleString(options.locale)}`;

    const layout = (ctx: CanvasRenderingContext2D, env: DrawEnv, maxWidth: number): Size => {
        const measure = scaleMeasure(env, Math.min(maxWidth, env.mm(options.width ?? 40)));
        ctx.font = env.font(fontSize(env));
        const tail = ctx.measureText(formatDistance(measure.meters)).width;
        const line = env.pt(fontSize(env)) * 1.3;
        const lines = options.ratio ? 2 : 1;
        return [measure.pixels + tail / 2 + env.mm(1), line * lines + env.mm(0.8) + barHeight(env)];
    };

    const paint = (ctx: CanvasRenderingContext2D, box: Box, env: DrawEnv): undefined => {
        const measure = scaleMeasure(env, Math.min(box.width, env.mm(options.width ?? 40)));
        if (!measure.pixels) return;
        if (options.halo ?? options.slot !== 'panel') haloBox(ctx, box, env);
        const { theme } = env;
        const line = env.pt(fontSize(env)) * 1.3;
        const top = box.y + line + env.mm(0.8);
        const step = measure.pixels / segments;
        ctx.font = env.font(fontSize(env));
        ctx.fillStyle = theme.color;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';
        ctx.fillText('0', box.x + ctx.measureText('0').width / 2, box.y);
        ctx.fillText(formatDistance(measure.meters), box.x + measure.pixels, box.y);
        ctx.textAlign = 'left';
        ctx.lineWidth = env.mm(0.15);
        ctx.strokeStyle = theme.color;
        for (let i = 0; i < segments; i += 1) {
            const x = box.x + i * step;
            ctx.fillStyle = i % 2 === 0 ? theme.color : theme.background;
            ctx.fillRect(x, top, step, barHeight(env));
            ctx.strokeRect(x, top, step, barHeight(env));
        }
        if (options.ratio) {
            ctx.fillStyle = theme.muted;
            ctx.fillText(ratioText(measure), box.x, top + barHeight(env) + env.mm(0.8));
        }
    };

    return {
        slot: options.slot ?? 'map',
        position: options.position ?? 'bottom-left',
        size: (ctx, env) => layout(ctx, env, env.layout.frame.width / 2),
        measure: (ctx, width, env) => layout(ctx, env, width)[1],
        draw: paint,
    };
}
