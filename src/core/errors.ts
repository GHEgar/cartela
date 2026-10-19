export const DEFAULT_TIMEOUT = 30_000;

export class CartelaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class TaintedCanvasError extends CartelaError {
    readonly layers: string[];

    constructor(layers: string[]) {
        super(`The map canvas is tainted by a cross-origin source without CORS. Suspects: ${layers.join(', ') || 'unknown'}`);
        this.layers = layers;
    }
}

export class RenderTimeoutError extends CartelaError {
    constructor(ms: number) {
        super(`The map did not finish rendering within ${ms} ms`);
    }
}

export class UnsupportedFormatError extends CartelaError {
    readonly format: string;

    constructor(format: string) {
        super(`This browser cannot encode ${format}`);
        this.format = format;
    }
}

export function abortError(signal?: AbortSignal): Error {
    const reason: unknown = signal?.reason;
    if (reason instanceof Error) return reason;
    return new DOMException('The export was aborted', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw abortError(signal);
}
