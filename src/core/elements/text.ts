import { drawText, measureText, type TextStyle } from './draw.js';
import type { DrawEnv, SheetElement } from '../types.js';

export type TextContent = string | ((env: DrawEnv) => string);

export interface TextOptions {
    size?: number;
    weight?: string;
    color?: string;
    align?: CanvasTextAlign;
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
    return {
        slot: 'panel',
        measure: (ctx, width, env) => measureText(ctx, resolve(content, env), width, styleOf(options, env), env),
        draw: (ctx, box, env) => {
            drawText(ctx, resolve(content, env), box, styleOf(options, env), env);
        },
    };
}

export interface TitleOptions {
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
    return {
        slot: 'panel',
        measure: measureAll,
        draw: (ctx, box, env) => {
            const used = drawText(ctx, resolve(content, env), box, main(env), env);
            if (!options.subtitle) return;
            const y = box.y + used + env.mm(1);
            drawText(ctx, resolve(options.subtitle, env), { ...box, y, height: box.height - used }, sub(env), env);
        },
    };
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
