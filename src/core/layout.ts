import { mmToPx } from './units.js';
import type { Box, Insets, LayoutKind, LayoutOptions, SheetElement, SheetLayout, Size, Theme } from './types.js';

const DEFAULT_PANEL: Record<LayoutKind, number> = { right: 0.27, left: 0.27, bottom: 0.24, none: 0 };

export function resolveLayout(layout: LayoutKind | LayoutOptions = 'right'): Required<LayoutOptions> {
    const options = typeof layout === 'string' ? { kind: layout } : layout;
    const kind = options.kind ?? 'right';
    return {
        kind,
        panel: options.panel ?? DEFAULT_PANEL[kind],
        gap: options.gap ?? 4,
        columns: options.columns ?? (kind === 'bottom' ? 3 : 1),
    };
}

export function reserveOf(elements: readonly SheetElement[], theme: Theme): Insets {
    const total: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const element of elements) {
        const reserve = element.reserve?.(theme);
        if (!reserve) continue;
        total.top = Math.max(total.top, reserve.top ?? 0);
        total.right = Math.max(total.right, reserve.right ?? 0);
        total.bottom = Math.max(total.bottom, reserve.bottom ?? 0);
        total.left = Math.max(total.left, reserve.left ?? 0);
    }
    return total;
}

function inset(box: Box, insets: Insets): Box {
    return {
        x: box.x + insets.left,
        y: box.y + insets.top,
        width: Math.max(1, box.width - insets.left - insets.right),
        height: Math.max(1, box.height - insets.top - insets.bottom),
    };
}

function columns(box: Box, count: number, gap: number): Box[] {
    const width = (box.width - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, i) => ({ ...box, x: box.x + i * (width + gap), width }));
}

function scaleInsets(insets: Insets, dpi: number): Insets {
    return {
        top: mmToPx(insets.top, dpi),
        right: mmToPx(insets.right, dpi),
        bottom: mmToPx(insets.bottom, dpi),
        left: mmToPx(insets.left, dpi),
    };
}

export function computeLayout(
    size: Size,
    dpi: number,
    margin: number,
    layout: Required<LayoutOptions>,
    reserve: Insets,
): SheetLayout {
    const page: Box = { x: 0, y: 0, width: size[0], height: size[1] };
    const m = mmToPx(margin, dpi);
    const content = inset(page, { top: m, right: m, bottom: m, left: m });
    const gap = mmToPx(layout.gap, dpi);
    const reserved = scaleInsets(reserve, dpi);

    if (layout.kind === 'none' || layout.panel <= 0) {
        return { page, content, frame: inset(content, reserved), panels: [] };
    }

    if (layout.kind === 'bottom') {
        const band = content.height * layout.panel;
        const mapArea: Box = { ...content, height: content.height - band - gap };
        const panel: Box = { ...content, y: content.y + content.height - band, height: band };
        return {
            page,
            content,
            frame: inset(mapArea, reserved),
            panels: columns(panel, Math.max(1, layout.columns), gap),
        };
    }

    const side = content.width * layout.panel;
    const mapWidth = content.width - side - gap;
    const left = layout.kind === 'left';
    const mapArea: Box = { ...content, x: left ? content.x + side + gap : content.x, width: mapWidth };
    const panel: Box = { ...content, x: left ? content.x : content.x + mapWidth + gap, width: side };
    return {
        page,
        content,
        frame: inset(mapArea, reserved),
        panels: columns(panel, Math.max(1, layout.columns), gap),
    };
}
