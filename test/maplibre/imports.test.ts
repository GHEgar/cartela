import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const IMPORT = /^(?:import|export)(?!\s+type\b)[^'"]*from\s*'([^']+)'/gm;

function runtimeImports(entry: string): Set<string> {
    const seen = new Set<string>();
    const bare = new Set<string>();
    const walk = (file: string): void => {
        if (seen.has(file)) return;
        seen.add(file);
        for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
            const target = match[1] ?? '';
            if (target.startsWith('.')) walk(resolve(dirname(file), target.replace(/\.js$/, '.ts')));
            else bare.add(target);
        }
    };
    walk(entry);
    return bare;
}

describe('cartela/maplibre', () => {
    it('loads neither OpenLayers nor maplibre-gl at runtime', () => {
        const entry = resolve('src/maplibre/index.ts');
        expect([...runtimeImports(entry)]).toEqual([]);
    });
});
