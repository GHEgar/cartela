import { describe, expect, it } from 'vitest';
import { gifDelay } from '../../src/video/encoders/gif.js';
import { pickFormat, videoSupport } from '../../src/video/support.js';

describe('gifDelay', () => {
    it('adds up to the real duration without drift', () => {
        for (const fps of [15, 24, 30]) {
            const total = Array.from({ length: fps * 10 }, (_, i) => gifDelay(i / fps, 1 / fps)).reduce((a, b) => a + b, 0);
            expect(total).toBe(10_000);
        }
    });

    it('uses whole hundredths of a second', () => {
        expect(gifDelay(0, 1 / 30) % 10).toBe(0);
    });
});

describe('pickFormat', () => {
    const all = { mp4: true, webm: true, gif: true };

    it('keeps the preferred format when it is supported', () => {
        expect(pickFormat('webm', all)).toBe('webm');
    });

    it('falls back in order', () => {
        expect(pickFormat('mp4', { mp4: false, webm: true, gif: true })).toBe('webm');
        expect(pickFormat('mp4', { mp4: false, webm: false, gif: true })).toBe('gif');
        expect(pickFormat(null, { mp4: false, webm: false, gif: false })).toBeNull();
        expect(pickFormat('mp4', { mp4: false, webm: true, gif: true }, ['gif', 'webm'])).toBe('gif');
    });
});

describe('videoSupport', () => {
    it('reports no video without WebCodecs but still offers GIF', async () => {
        expect('VideoEncoder' in globalThis).toBe(false);
        expect(await videoSupport()).toEqual({ mp4: false, webm: false, gif: true });
    });
});
