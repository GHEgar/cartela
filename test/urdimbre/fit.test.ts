import { describe, expect, it } from 'vitest';
import type { LegendEntry as UrdimbreLegendEntry } from '../../../urdimbre/src/legend/types.js';
import type { LegendEntry } from '../../src/core/index.js';

const legendFits = (entries: UrdimbreLegendEntry[]): readonly LegendEntry[] => entries;

describe('urdimbre fit', () => {
    it('accepts urdimbre legend entries in the sheet legend', () => {
        expect(legendFits).toBeTypeOf('function');
    });
});
