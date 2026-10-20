import { afterEach, describe, expect, it } from 'vitest';
import { cssColor } from '../../src/core/color.js';
import { resolveEntries } from '../../src/core/elements/legend-entries.js';
import type { DrawEnv } from '../../src/core/types.js';

const env = { snapshot: { resolution: 1 } } as unknown as DrawEnv;

afterEach(() => {
    document.documentElement.style.removeProperty('--accent');
});

describe('cssColor', () => {
    it('leaves plain colors alone', () => {
        expect(cssColor('#123456')).toBe('#123456');
        expect(cssColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    });

    it('resolves custom properties against the document or a scope', () => {
        document.documentElement.style.setProperty('--accent', 'rgb(10, 20, 30)');
        expect(cssColor('var(--accent)')).toBe('rgb(10, 20, 30)');
        const scope = document.createElement('div');
        scope.style.setProperty('--accent', 'rgb(1, 2, 3)');
        document.body.appendChild(scope);
        expect(cssColor('var(--accent)', scope)).toBe('rgb(1, 2, 3)');
        scope.remove();
        expect(document.querySelectorAll('span[hidden]')).toHaveLength(0);
    });

    it('keeps the original text when the variable is unknown', () => {
        expect(cssColor('var(--missing)')).toBe('var(--missing)');
    });

    it('resolves the colors of layer legends before drawing', async () => {
        document.documentElement.style.setProperty('--accent', 'rgb(10, 20, 30)');
        const resolved = await resolveEntries([
            { kind: 'classes', layerId: 'a', title: 'A', classes: [{ label: 'x', color: 'var(--accent)' }] },
            { kind: 'ramp', layerId: 'b', title: 'B', stops: [{ value: 0, color: 'var(--accent)' }, { value: 1, color: '#fff' }] },
            { label: 'road', stroke: 'var(--accent)', shape: 'line' },
        ], env);
        expect(resolved[1]).toEqual({ kind: 'symbol', entry: { label: 'x', fill: 'rgb(10, 20, 30)', shape: 'box' } });
        expect(resolved[3]).toEqual({ kind: 'ramp', stops: [{ value: 0, color: 'rgb(10, 20, 30)' }, { value: 1, color: '#fff' }] });
        expect(resolved[4]).toEqual({ kind: 'symbol', entry: { label: 'road', stroke: 'rgb(10, 20, 30)', shape: 'line' } });
    });
});
