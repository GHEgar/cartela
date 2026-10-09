import { describe, expect, it } from 'vitest';
import { flow } from '../../src/core/compose.js';
import type { Box, DrawEnv, SheetElement } from '../../src/core/types.js';

const ctx = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {} } as unknown as CanvasRenderingContext2D;
const env = { mm: (v: number) => v, theme: { gap: 0 } } as unknown as DrawEnv;
const box = (x: number): Box => ({ x, y: 0, width: 10, height: 10 });

function fixed(name: string, height: number, log: string[]): SheetElement {
    return { slot: 'panel', measure: () => height, draw: (_c, b) => { log.push(`${name}@${b.x}`); } };
}

function growing(name: string, parts: number, log: string[]): SheetElement {
    return {
        slot: 'panel',
        grow: true,
        draw: (_c, b) => {
            log.push(`${name}@${b.x}`);
            return parts > 1 ? growing(name, parts - 1, log) : null;
        },
    };
}

describe('flow', () => {
    it('keeps reading order when a growing element spills into the next box', () => {
        const log: string[] = [];
        const rest = flow(ctx, [box(0), box(20), box(40)], [fixed('title', 4, log), growing('legend', 2, log), fixed('source', 2, log)], env);
        expect(rest).toEqual([]);
        expect(log).toEqual(['title@0', 'legend@0', 'legend@20', 'source@20']);
    });

    it('gives an overflowing growing element the rest of the box', () => {
        const log: string[] = [];
        const legend = { ...growing('legend', 2, log), measure: () => 50 };
        flow(ctx, [box(0), box(20)], [fixed('title', 4, log), legend, fixed('source', 2, log)], env);
        expect(log).toEqual(['title@0', 'legend@0', 'legend@20', 'source@20']);
    });

    it('returns what does not fit', () => {
        const log: string[] = [];
        const rest = flow(ctx, [box(0)], [fixed('a', 6, log), fixed('b', 6, log)], env);
        expect(log).toEqual(['a@0']);
        expect(rest).toHaveLength(1);
    });
});
