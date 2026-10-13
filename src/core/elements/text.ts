import { drawText, haloBox, measureText, wrapLines, type TextStyle } from './draw.js';
import type { Corner, DrawEnv, SheetElement, Size } from '../types.js';

export type TextContent = string | ((env: DrawEnv) => string);

export interface Placement {
    slot?: 'panel' | 'map';
    position?: Corner;
    halo?: boolean;
    maxWidth?: number;
}

export interface TextOptions extends Placement {
    size?: number;
    weight?: string;
    color?: string;
    align?: CanvasTextAlign;
}

interface Part {
    value: string;
    style: TextStyle;
}

function widest(ctx: CanvasRenderingContext2D, parts: Part[], max: number, env: DrawEnv): number {
    let width = 0;
    for (const { value, style } of parts) {
        ctx.font = env.font(style.size, style.weight);
        for (const line of wrapLines(ctx, value, max)) width = Math.max(width, ctx.measureText(line).width);
    }
    return Math.min(max, Math.ceil(width));
}

function place(element: SheetElement, placement: Placement, parts: (env: DrawEnv) => Part[]): SheetElement {
    if (placement.slot !== 'map') return element;
    const size = (ctx: CanvasRenderingContext2D, env: DrawEnv): Size => {
        const width = widest(ctx, parts(env), env.layout.frame.width * (placement.maxWidth ?? 0.5), env);
        return [width, element.measure?.(ctx, width, env) ?? 0];
    };
    return {
        ...element,
        slot: 'map',
        position: placement.position ?? 'top-left',
        size,
        draw: (ctx, box, env) => {
            if (placement.halo !== false) haloBox(ctx, box, env);
            return element.draw(ctx, box, env);
        },
    };
}

function resolve(content: TextContent, env: DrawEnv): string {
    return typeof content === 'function' ? content(env) : content;
}

function styleOf(options: TextOptions, env: DrawEnv): TextStyle {
    return {
        size: options.size ?? env.theme.fontSize,
        weight: options.weight ?? '400',
        color: options.color ?? env.theme.color,
        align: options.align ?? 'left',
    };
}

export function text(content: TextContent, options: TextOptions = {}): SheetElement {
    return place({
        slot: 'panel',
        measure: (ctx, width, env) => measureText(ctx, resolve(content, env), width, styleOf(options, env), env),
        draw: (ctx, box, env) => {
            drawText(ctx, resolve(content, env), box, styleOf(options, env), env);
        },
    }, options, env => [{ value: resolve(content, env), style: styleOf(options, env) }]);
}

export interface TitleOptions extends Placement {
    subtitle?: TextContent;
    align?: CanvasTextAlign;
}

export function title(content: TextContent, options: TitleOptions = {}): SheetElement {
    const align = options.align ?? 'left';
    const main = (env: DrawEnv): TextStyle => ({ size: env.theme.titleSize, weight: '700', align });
    const sub = (env: DrawEnv): TextStyle => ({ size: env.theme.fontSize * 1.25, color: env.theme.muted, align });
    const measureAll = (ctx: CanvasRenderingContext2D, width: number, env: DrawEnv): number => {
        const head = measureText(ctx, resolve(content, env), width, main(env), env);
        if (!options.subtitle) return head;
        return head + env.mm(1) + measureText(ctx, resolve(options.subtitle, env), width, sub(env), env);
    };
    const parts = (env: DrawEnv): Part[] => [
        { value: resolve(content, env), style: main(env) },
        ...(options.subtitle ? [{ value: resolve(options.subtitle, env), style: sub(env) }] : []),
    ];
    return place({
        slot: 'panel',
        measure: measureAll,
        draw: (ctx, box, env) => {
            const used = drawText(ctx, resolve(content, env), box, main(env), env);
            if (!options.subtitle) return;
            const y = box.y + used + env.mm(1);
            drawText(ctx, resolve(options.subtitle, env), { ...box, y, height: box.height - used }, sub(env), env);
        },
    }, options, parts);
}

export interface DateOptions extends TextOptions {
    locale?: string;
    prefix?: string;
    format?: Intl.DateTimeFormatOptions;
}

export function dateText(options: DateOptions = {}): SheetElement {
    const format = options.format ?? { dateStyle: 'long' };
    return text(env => `${options.prefix ?? ''}${env.date.toLocaleDateString(options.locale, format)}`, options);
}
