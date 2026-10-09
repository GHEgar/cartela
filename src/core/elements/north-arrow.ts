import { haloBox } from './draw.js';
import type { Box, Corner, DrawEnv, SheetElement } from '../types.js';

export interface NorthArrowOptions {
    size?: number;
    label?: string;
    slot?: 'map' | 'panel';
    position?: Corner;
    halo?: boolean;
}

export function drawNeedle(ctx: CanvasRenderingContext2D, cx: number, cy: number, length: number, rotation: number, env: DrawEnv): void {
    const half = length / 2;
    const wing = length * 0.2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.lineJoin = 'round';
    ctx.lineWidth = env.mm(0.2);
    ctx.strokeStyle = env.theme.color;
    ctx.fillStyle = env.theme.color;
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(-wing, half * 0.55);
    ctx.lineTo(0, half * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = env.theme.background;
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(wing, half * 0.55);
    ctx.lineTo(0, half * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

export function northArrow(options: NorthArrowOptions = {}): SheetElement {
    const label = options.label ?? 'N';
    const fontSize = (env: DrawEnv): number => env.theme.fontSize * 1.1;
    const dimensions = (env: DrawEnv): [number, number] => {
        const needle = env.mm(options.size ?? 12);
        return [needle * 0.6, needle + env.pt(fontSize(env)) * 1.3];
    };

    const paint = (ctx: CanvasRenderingContext2D, box: Box, env: DrawEnv): undefined => {
        const [width, height] = dimensions(env);
        const x = box.x + (box.width - width) / 2;
        if (options.halo ?? options.slot !== 'panel') haloBox(ctx, { ...box, x, width, height }, env);
        const text = env.pt(fontSize(env)) * 1.3;
        ctx.font = env.font(fontSize(env), '700');
        ctx.fillStyle = env.theme.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + width / 2, box.y);
        ctx.textAlign = 'left';
        drawNeedle(ctx, x + width / 2, box.y + text + (height - text) / 2, height - text, env.snapshot.rotation, env);
    };

    return {
        slot: options.slot ?? 'map',
        position: options.position ?? 'top-right',
        size: (_ctx, env) => dimensions(env),
        measure: (_ctx, _width, env) => dimensions(env)[1],
        draw: paint,
    };
}
