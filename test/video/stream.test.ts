import { describe, expect, it } from 'vitest';
import { gifEncoder } from '../../src/video/encoders/gif.js';
import { relay } from '../../src/video/target.js';
import type { FileChunk } from '../../src/video/types.js';

function fakeCanvas(seed: number): HTMLCanvasElement {
    const width = 16;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4).map((_, i) => (i * 31 + seed * 17) % 256);
    const ctx = { getImageData: () => ({ data, width, height }) };
    return { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

function sink() {
    const chunks: FileChunk[] = [];
    const state = { closed: false, aborted: false };
    const stream = new WritableStream<FileChunk>({
        write: chunk => {
            chunks.push(chunk);
        },
        close: () => {
            state.closed = true;
        },
        abort: () => {
            state.aborted = true;
        },
    });
    return { stream, chunks, state };
}

async function encode(frames: number, target?: WritableStream<FileChunk>): Promise<Blob | null> {
    const encoder = await gifEncoder(target ? { target } : {})([16, 8], 10, frames);
    for (let i = 0; i < frames; i += 1) await encoder.add(fakeCanvas(i), i / 10, 1 / 10);
    return encoder.finish();
}

describe('gifEncoder with a target', () => {
    it('writes contiguous chunks that add up to the in-memory GIF', async () => {
        const memory = await encode(3);
        const { stream, chunks, state } = sink();
        const streamed = await encode(3, stream);
        expect(streamed).toBeNull();
        expect(state.closed).toBe(true);
        expect(chunks.length).toBeGreaterThanOrEqual(4);
        let position = 0;
        for (const chunk of chunks) {
            expect(chunk.position).toBe(position);
            position += chunk.data.length;
        }
        const joined = new Uint8Array(position);
        for (const chunk of chunks) joined.set(chunk.data, chunk.position);
        expect([...joined]).toEqual([...new Uint8Array(await (memory as Blob).arrayBuffer())]);
    });

    it('aborts the stream instead of closing it on cancel', async () => {
        const { stream, state } = sink();
        const encoder = await gifEncoder({ target: stream })([16, 8], 10, 2);
        await encoder.add(fakeCanvas(0), 0, 0.1);
        await encoder.cancel();
        expect(state.aborted).toBe(true);
        expect(state.closed).toBe(false);
    });
});

describe('relay', () => {
    it('ignores the close that follows an abort', async () => {
        const { stream, state } = sink();
        const link = relay(stream);
        await link.write({ type: 'write', data: new Uint8Array([1, 2]), position: 0 });
        await link.abort();
        await link.writable.close().catch(() => undefined);
        expect(state.aborted).toBe(true);
        expect(state.closed).toBe(false);
    });
});
