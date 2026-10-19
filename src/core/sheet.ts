import { context, continuationBoxes, createPage, flow, MAX_PAGES, overlay, strokeFrame } from './compose.js';
import { createEnv, loadFonts } from './env.js';
import { throwIfAborted } from './errors.js';
import { computeLayout, reserveOf, resolveLayout } from './layout.js';
import { resolveTheme } from './theme.js';
import { CSS_DPI, pageGeometry } from './units.js';
import type { Capture, DrawEnv, Phase, Sheet, SheetElement, SheetOptions, Size } from './types.js';

export const DEFAULT_MARGIN = 8;
export const PREVIEW_DPI = 60;

export function composeSheet(env: DrawEnv, elements: readonly SheetElement[]): HTMLCanvasElement[] {
    const { layout, theme, snapshot } = env;
    const { page, frame } = layout;
    const first = createPage(page.width, page.height, theme.background);
    const ctx = context(first);
    ctx.drawImage(snapshot.canvas, frame.x, frame.y, frame.width, frame.height);
    overlay(ctx, frame, elements.filter(element => element.slot !== 'panel'), env);
    strokeFrame(ctx, frame, env);

    const pages = [first];
    let rest = flow(ctx, layout.panels, elements.filter(element => element.slot === 'panel'), env);
    const boxes = continuationBoxes(layout.content, layout.panels[0], env.mm(theme.gap));
    while (rest.length && pages.length < MAX_PAGES) {
        const next = createPage(page.width, page.height, theme.background);
        const before = rest.length;
        rest = flow(context(next), boxes, rest, env);
        pages.push(next);
        if (rest.length >= before && rest.every(element => !element.grow)) break;
    }
    return pages;
}

export async function exportSheet(capture: Capture, options: SheetOptions = {}): Promise<Sheet> {
    const { signal, onProgress } = options;
    const report = (phase: Phase, ratio: number): void => onProgress?.({ phase, ratio });
    const theme = resolveTheme(options.theme);
    const elements = options.elements ?? [];

    report('layout', 0);
    const geometry = pageGeometry(options.page, options.maxPixels);
    const layout = computeLayout(
        geometry.size,
        geometry.dpi,
        options.page?.margin ?? DEFAULT_MARGIN,
        resolveLayout(options.layout),
        reserveOf(elements, theme),
    );
    const pixelRatio = geometry.dpi / CSS_DPI;
    const size: Size = [layout.frame.width / pixelRatio, layout.frame.height / pixelRatio];

    report('render', 0);
    const snapshot = await capture({ size, pixelRatio, aspect: layout.frame.width / layout.frame.height });
    report('render', 1);

    const env = createEnv(geometry.dpi, theme, snapshot, layout, options.date ?? new Date());
    report('load', 0);
    let loaded = 0;
    await Promise.all([
        loadFonts(env),
        ...elements.map(async element => {
            await element.load?.(env, signal);
            loaded += 1;
            report('load', loaded / elements.length);
        }),
    ]);
    throwIfAborted(signal);

    report('compose', 0);
    const pages = composeSheet(env, elements);
    report('compose', 1);
    return { pages, geometry, layout, snapshot };
}
