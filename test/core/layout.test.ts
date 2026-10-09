import { describe, expect, it } from 'vitest';
import { computeLayout, reserveOf, resolveLayout } from '../../src/core/layout.js';
import { fitRect, sheetAspect } from '../../src/core/frame.js';
import { grid } from '../../src/core/elements/grid.js';
import { DEFAULT_THEME } from '../../src/core/theme.js';
import { continuationBoxes } from '../../src/core/compose.js';

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

describe('computeLayout', () => {
    it('places the panel on the right by default', () => {
        const layout = computeLayout([1000, 800], 25.4, 10, resolveLayout(), NONE);
        expect(layout.content).toEqual({ x: 10, y: 10, width: 980, height: 780 });
        expect(layout.panels).toHaveLength(1);
        const panel = layout.panels[0];
        expect(panel?.x).toBeGreaterThan(layout.frame.x + layout.frame.width);
        expect((panel?.x ?? 0) + (panel?.width ?? 0)).toBeCloseTo(990);
    });

    it('splits a bottom band into columns', () => {
        const layout = computeLayout([1000, 800], 25.4, 0, resolveLayout('bottom'), NONE);
        expect(layout.panels).toHaveLength(3);
        expect(layout.frame.y + layout.frame.height).toBeLessThan(layout.panels[0]?.y ?? 0);
    });

    it('reserves room for grid labels around the frame', () => {
        const reserve = reserveOf([grid()], DEFAULT_THEME);
        expect(reserve.top).toBeGreaterThan(0);
        const plain = computeLayout([1000, 800], 25.4, 0, resolveLayout('none'), NONE);
        const framed = computeLayout([1000, 800], 25.4, 0, resolveLayout('none'), reserve);
        expect(framed.frame.width).toBeCloseTo(plain.frame.width - reserve.left - reserve.right);
    });
});

describe('print frame', () => {
    it('fits a centred rectangle with the requested aspect', () => {
        expect(fitRect([400, 300], 2, 0)).toEqual({ x: 0, y: 50, width: 400, height: 200 });
    });

    it('follows the sheet layout aspect', () => {
        expect(sheetAspect({ layout: 'none', page: { margin: 0 } })).toBeCloseTo(279.4 / 215.9);
        expect(sheetAspect({ layout: 'right' })).toBeLessThan(sheetAspect({ layout: 'none' }));
    });
});

describe('continuationBoxes', () => {
    it('reuses the panel width as column width', () => {
        const boxes = continuationBoxes({ x: 0, y: 0, width: 1000, height: 500 }, { x: 0, y: 0, width: 240, height: 500 }, 10);
        expect(boxes).toHaveLength(4);
        expect(boxes[3]?.x).toBeCloseTo(1000 - (boxes[3]?.width ?? 0));
    });
});
