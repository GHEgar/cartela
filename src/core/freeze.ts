import type OlMap from 'ol/Map.js';

const MATRIX = /^matrix\(([^)]*)\)$/;

export function composeViewport(map: OlMap, pixelRatio = 1): HTMLCanvasElement | null {
    const size = map.getSize();
    if (!size || !size[0] || !size[1]) return null;
    const out = document.createElement('canvas');
    out.width = Math.round(size[0] * pixelRatio);
    out.height = Math.round(size[1] * pixelRatio);
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    const base = new DOMMatrix([pixelRatio, 0, 0, pixelRatio, 0, 0]);
    const viewport = map.getViewport() as HTMLElement | undefined;
    if (!viewport) return null;
    for (const canvas of viewport.querySelectorAll('canvas')) {
        if (!canvas.width || !canvas.height) continue;
        const parent = canvas.parentElement;
        const opacity = canvas.style.opacity || parent?.style.opacity || '1';
        const match = MATRIX.exec(canvas.style.transform);
        const local = match?.[1]
            ? new DOMMatrix(match[1].split(',').map(Number))
            : new DOMMatrix([size[0] / canvas.width, 0, 0, size[1] / canvas.height, 0, 0]);
        ctx.globalAlpha = Number(opacity);
        ctx.setTransform(base.multiply(local));
        ctx.drawImage(canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return out;
}

export interface Freeze {
    mount: () => void;
    handoff: () => void;
    release: () => void;
}

export function freeze(map: OlMap): Freeze {
    const host = map.getTargetElement();
    const image = host && !(host instanceof HTMLCanvasElement)
        ? composeViewport(map, globalThis.devicePixelRatio || 1)
        : null;
    if (!host || !image) return { mount: () => {}, handoff: () => {}, release: () => {} };
    image.dataset['cartelaFreeze'] = '';
    image.setAttribute('aria-hidden', 'true');
    Object.assign(image.style, { display: 'block', width: '100%', height: '100%' });
    return {
        mount: () => {
            host.appendChild(image);
        },
        handoff: () => {
            Object.assign(image.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
            (map.getViewport() as HTMLElement | undefined)?.appendChild(image);
        },
        release: () => {
            image.remove();
        },
    };
}
