import { writePdf, type PdfMeta } from './pdf.js';
import type { Sheet } from './types.js';

export type ImageType = 'image/png' | 'image/jpeg' | 'image/webp';

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error(`The browser could not encode ${type}`));
        }, type, quality);
    });
}

export function toBlob(sheet: Sheet, type: ImageType = 'image/png', quality = 0.92, page = 0): Promise<Blob> {
    const canvas = sheet.pages[page];
    if (!canvas) return Promise.reject(new RangeError(`The sheet has no page ${page}`));
    return canvasToBlob(canvas, type, quality);
}

export function toBlobs(sheet: Sheet, type: ImageType = 'image/png', quality = 0.92): Promise<Blob[]> {
    return Promise.all(sheet.pages.map(canvas => canvasToBlob(canvas, type, quality)));
}

export interface PdfOptions extends PdfMeta {
    quality?: number;
}

export async function toPdf(sheet: Sheet, options: PdfOptions = {}): Promise<Blob> {
    const images = await Promise.all(sheet.pages.map(async canvas => {
        const blob = await canvasToBlob(canvas, 'image/jpeg', options.quality ?? 0.92);
        return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
    }));
    const bytes = writePdf(images, sheet.geometry.paper, options);
    return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
