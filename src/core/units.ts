import type { PageGeometry, PageOptions, PaperName, Size } from './types.js';

export const MM_PER_INCH = 25.4;
export const CSS_DPI = 96;
export const DEFAULT_MAX_PIXELS = 16_777_216;

export const PAPER: Readonly<Record<PaperName, Size>> = {
    letter: [215.9, 279.4],
    legal: [215.9, 355.6],
    tabloid: [279.4, 431.8],
    a5: [148, 210],
    a4: [210, 297],
    a3: [297, 420],
    a2: [420, 594],
};

export const QUALITY = {
    draft: 72,
    normal: 150,
    high: 300,
    ultra: 400,
} as const;

export type Quality = keyof typeof QUALITY;

export const mmToPx = (mm: number, dpi: number): number => (mm * dpi) / MM_PER_INCH;

export const ptToPx = (pt: number, dpi: number): number => (pt * dpi) / 72;

export function paperSize(page: PageOptions = {}): Size {
    const [a, b] = Array.isArray(page.size) ? page.size : PAPER[page.size ?? 'letter'];
    const short = Math.min(a, b);
    const long = Math.max(a, b);
    return (page.orientation ?? 'landscape') === 'landscape' ? [long, short] : [short, long];
}

export function pageGeometry(page: PageOptions = {}, maxPixels = DEFAULT_MAX_PIXELS): PageGeometry {
    const paper = paperSize(page);
    const requestedDpi = page.dpi ?? QUALITY.normal;
    const area = mmToPx(paper[0], 1) * mmToPx(paper[1], 1);
    const limit = Math.floor(Math.sqrt(maxPixels / area));
    const dpi = Math.min(requestedDpi, limit);
    return {
        paper,
        dpi,
        requestedDpi,
        clamped: dpi < requestedDpi,
        size: [Math.round(mmToPx(paper[0], dpi)), Math.round(mmToPx(paper[1], dpi))],
    };
}
