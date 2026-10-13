declare module 'gifenc' {
    export type Palette = number[][];

    export interface FrameOptions {
        palette?: Palette;
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
    }

    export interface Encoder {
        writeFrame: (index: Uint8Array, width: number, height: number, options?: FrameOptions) => void;
        finish: () => void;
        bytes: () => Uint8Array;
        reset: () => void;
        readonly stream: { reset: () => void };
    }

    export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): Encoder;
    export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: string }): Palette;
    export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: string): Uint8Array;
}
