import type { Box, Corner, DrawEnv, SheetElement } from './types.js';

export const MAX_PAGES = 24;

export function createPage(width: number, height: number, background: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = context(canvas);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    return canvas;
}

export function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    return ctx;
}

function clipped(ctx: CanvasRenderingContext2D, box: Box, paint: () => SheetElement | null | undefined): SheetElement | null {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();
    const rest = paint() ?? null;
    ctx.restore();
    return rest;
}

export function cornerBox(frame: Box, size: [number, number], corner: Corner, inset: number): Box {
    const [width, height] = size;
    const right = corner.endsWith('right');
    const bottom = corner.startsWith('bottom');
    return {
        x: right ? frame.x + frame.width - inset - width : frame.x + inset,
        y: bottom ? frame.y + frame.height - inset - height : frame.y + inset,
        width,
        height,
    };
}

export function flow(
    ctx: CanvasRenderingContext2D,
    boxes: readonly Box[],
    elements: readonly SheetElement[],
    env: DrawEnv,
): SheetElement[] {
    let queue = [...elements];
    const gap = env.mm(env.theme.gap);
    for (const box of boxes) {
        if (queue.length === 0) break;
        const placed: { element: SheetElement; height: number }[] = [];
        let used = 0;
        for (const element of queue) {
            const height = element.grow ? 0 : (element.measure?.(ctx, box.width, env) ?? 0);
            const extra = placed.length ? gap : 0;
            if (placed.length && used + extra + height > box.height) break;
            placed.push({ element, height });
            used += extra + height;
        }
        const natural = placed.reduce((sum, item) => sum + (item.element.grow ? (item.element.measure?.(ctx, box.width, env) ?? 0) : 0), 0);
        const firstGrow = placed.findIndex(item => item.element.grow);
        if (firstGrow >= 0 && used + natural > box.height) {
            placed.splice(firstGrow + 1);
            used = placed.reduce((sum, item, i) => sum + item.height + (i ? gap : 0), 0);
        }
        queue = queue.slice(placed.length);
        const growing = placed.filter(item => item.element.grow).length;
        const spare = Math.max(0, box.height - used) / Math.max(1, growing);
        let y = box.y;
        for (const [index, { element, height }] of placed.entries()) {
            const slot: Box = { x: box.x, y, width: box.width, height: element.grow ? spare : height };
            const rest = clipped(ctx, slot, () => element.draw(ctx, slot, env));
            if (rest) {
                queue = [rest, ...placed.slice(index + 1).map(item => item.element), ...queue];
                break;
            }
            y += slot.height + gap;
        }
    }
    return queue;
}

export function overlay(ctx: CanvasRenderingContext2D, frame: Box, elements: readonly SheetElement[], env: DrawEnv): void {
    const inset = env.mm(env.theme.gap);
    for (const element of elements) {
        if (element.slot === 'frame') {
            element.draw(ctx, frame, env);
            continue;
        }
        const size = element.size?.(ctx, env);
        if (!size) continue;
        const box = cornerBox(frame, size, element.position ?? 'bottom-left', inset);
        clipped(ctx, frame, () => element.draw(ctx, box, env));
    }
}

export function strokeFrame(ctx: CanvasRenderingContext2D, frame: Box, env: DrawEnv): void {
    const width = env.mm(env.theme.frameWidth);
    if (width <= 0) return;
    ctx.save();
    ctx.strokeStyle = env.theme.frame;
    ctx.lineWidth = width;
    ctx.strokeRect(frame.x - width / 2, frame.y - width / 2, frame.width + width, frame.height + width);
    ctx.restore();
}

export function continuationBoxes(content: Box, panel: Box | undefined, gap: number): Box[] {
    const width = panel?.width ?? content.width;
    const count = Math.max(1, Math.floor((content.width + gap) / (width + gap)));
    const column = (content.width - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, i) => ({ ...content, x: content.x + i * (column + gap), width: column }));
}
