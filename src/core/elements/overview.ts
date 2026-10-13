import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import type BaseLayer from 'ol/layer/Base.js';
import type { Extent } from 'ol/extent.js';
import { getCenter, getHeight, getWidth } from 'ol/extent.js';
import { abortError, RenderTimeoutError } from '../errors.js';
import { DEFAULT_TIMEOUT } from '../session.js';
import type { Box, Corner, DrawEnv, SheetElement, Size } from '../types.js';

export interface FootprintStyle {
    stroke?: string;
    fill?: string;
    width?: number;
}

export interface OverviewOptions {
    layers: () => BaseLayer[];
    extent?: Extent | 'auto';
    factor?: number;
    size?: number;
    slot?: 'map' | 'panel';
    position?: Corner;
    footprint?: FootprintStyle;
    background?: string;
    timeout?: number;
}

interface Overview {
    image: HTMLCanvasElement;
    center: number[];
    resolution: number;
}

function renderOverview(layers: BaseLayer[], side: number, view: View, timeout: number, signal?: AbortSignal): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const map = new OlMap({ target: canvas, pixelRatio: 1, controls: [], interactions: [], layers, view });
    return new Promise<HTMLCanvasElement>((resolve, reject) => {
        const done = (error?: Error): void => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            const image = document.createElement('canvas');
            image.width = side;
            image.height = side;
            if (!error) image.getContext('2d')?.drawImage(canvas, 0, 0);
            map.setTarget(undefined);
            map.dispose();
            if (error) reject(error);
            else resolve(image);
        };
        const onAbort = (): void => done(abortError(signal));
        const timer = setTimeout(() => done(new RenderTimeoutError(timeout)), timeout);
        signal?.addEventListener('abort', onAbort, { once: true });
        map.once('rendercomplete', () => done());
        map.render();
    });
}

function footprint(env: DrawEnv): number[][] {
    const { frame } = env.layout;
    return [
        [frame.x, frame.y],
        [frame.x + frame.width, frame.y],
        [frame.x + frame.width, frame.y + frame.height],
        [frame.x, frame.y + frame.height],
    ].map(([x = 0, y = 0]) => env.toCoordinate(x, y));
}

export function overviewMap(options: OverviewOptions): SheetElement {
    const slot = options.slot ?? 'map';
    let loaded: Overview | null = null;
    const side = (env: DrawEnv): number => env.mm(options.size ?? 35);

    const paint = (ctx: CanvasRenderingContext2D, box: Box, env: DrawEnv): undefined => {
        const { theme } = env;
        const length = Math.min(box.width, box.height);
        const scale = loaded ? length / loaded.image.width : 1;
        ctx.save();
        ctx.fillStyle = options.background ?? theme.background;
        ctx.fillRect(box.x, box.y, length, length);
        if (loaded) {
            ctx.drawImage(loaded.image, box.x, box.y, length, length);
            const { center, resolution } = loaded;
            const half = loaded.image.width / 2;
            const points = footprint(env).map(([x = 0, y = 0]) => [
                box.x + (half + (x - (center[0] ?? 0)) / resolution) * scale,
                box.y + (half - (y - (center[1] ?? 0)) / resolution) * scale,
            ]);
            const xs = points.map(p => p[0] ?? 0);
            const ys = points.map(p => p[1] ?? 0);
            const style = options.footprint ?? {};
            ctx.beginPath();
            ctx.rect(box.x, box.y, length, length);
            ctx.clip();
            ctx.strokeStyle = style.stroke ?? theme.color;
            ctx.lineWidth = env.mm(style.width ?? 0.4);
            if (Math.max(...xs) - Math.min(...xs) < 4 && Math.max(...ys) - Math.min(...ys) < 4) {
                ctx.fillStyle = style.stroke ?? theme.color;
                ctx.beginPath();
                ctx.arc(xs.reduce((a, b) => a + b, 0) / 4, ys.reduce((a, b) => a + b, 0) / 4, env.mm(0.8), 0, 2 * Math.PI);
                ctx.fill();
            } else {
                ctx.beginPath();
                points.forEach(([x = 0, y = 0], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
                ctx.closePath();
                if (style.fill) {
                    ctx.fillStyle = style.fill;
                    ctx.fill();
                }
                ctx.stroke();
            }
        }
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = theme.frame;
        ctx.lineWidth = env.mm(theme.frameWidth);
        ctx.strokeRect(box.x, box.y, length, length);
        ctx.restore();
        return undefined;
    };

    return {
        slot,
        position: options.position ?? 'bottom-right',
        load: async (env, signal) => {
            const pixels = Math.max(16, Math.round(side(env)));
            const extent = options.extent === undefined || options.extent === 'auto'
                ? null
                : options.extent;
            const center = extent ? getCenter(extent) : env.snapshot.center;
            const span = extent
                ? Math.max(getWidth(extent), getHeight(extent))
                : Math.max(getWidth(env.snapshot.extent), getHeight(env.snapshot.extent)) * (options.factor ?? 8);
            const resolution = span / pixels;
            const view = new View({ projection: env.snapshot.projection, center, resolution });
            const image = await renderOverview(options.layers(), pixels, view, options.timeout ?? DEFAULT_TIMEOUT, signal);
            loaded = { image, center, resolution };
        },
        size: (_ctx, env): Size => [side(env), side(env)],
        measure: (_ctx, width) => width,
        draw: paint,
    };
}
